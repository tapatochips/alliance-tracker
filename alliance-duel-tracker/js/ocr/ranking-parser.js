// Turns OCR words (text + position) from a ranking screenshot into {name, points} rows.
//
// How it works:
//  1. Group words into screen lines by their vertical position.
//  2. On each line, the right-most number is the points value (numbers split by spaces are joined).
//  3. The words to the left of it are the name, minus a leading rank number and screen labels.
//  4. If a layout puts the name on one line and the points just below, the two lines are paired.
import { OCR } from '../config.js';
import { parsePoints } from '../lib/numbers.js';
import { norm } from '../lib/names.js';

const IGNORE = new Set(OCR.ignoreWords);
const MIN_CONF = 15;

/** If an OCR word is a number (allowing common misreads: O→0, l/I→1, S→5), return it as text; else null. */
function numericText(t) {
  const clean = t.replace(/[^0-9A-Za-z.,'’]/g, '');
  if (!clean) return null;
  const digits = (clean.match(/\d/g) || []).length;
  if (!digits) return null;
  const suffix = /[kKmMbB]$/.test(clean) && digits >= 1 ? clean.slice(-1) : '';
  const body = (suffix ? clean.slice(0, -1) : clean).replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5');
  if (!/^[\d.,'’]+$/.test(body)) return null;
  const core = body.replace(/[.,'’]/g, '');
  if (!core || digits / core.length < 0.6) return null;
  return body + suffix;
}

function valueOf(text) {
  const p = parsePoints(text);
  return p.ok && typeof p.value === 'number' ? p.value : null;
}

const isRankToken = (t) => /^(?:#|no\.?)?\d{1,3}[.)]?$/i.test(t);
// Badges that sit next to names on many ranking screens: alliance rank (R4), level (Lv.25).
const isBadge = (t) => /^R[1-5]$/i.test(t) || /^lv\.?\d*$/i.test(t);
const isJunk = (t) => !/[\p{L}\p{N}]/u.test(t) || (t.length === 1 && !/[\p{L}\p{N}]/u.test(t));

/** Group words into lines by vertical centre. */
function toLines(words) {
  const ws = words
    .filter((w) => w.conf == null || w.conf >= MIN_CONF)
    .map((w) => ({ ...w, cy: (w.y0 + w.y1) / 2, h: Math.max(1, w.y1 - w.y0) }))
    .sort((a, b) => a.cy - b.cy);
  const lines = [];
  for (const w of ws) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(w.cy - line.cy) <= Math.max(6, 0.55 * Math.max(line.h, w.h))) {
      line.words.push(w);
      line.cy = line.words.reduce((a, x) => a + x.cy, 0) / line.words.length;
      line.h = Math.max(line.h, w.h);
    } else {
      lines.push({ words: [w], cy: w.cy, h: w.h });
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.x0 - b.x0);
  return lines;
}

/** Split one line into {name, points, conf}. Either part may be missing. */
function splitLine(line) {
  const ws = line.words;
  // Right-most numeric word, then pull in numeric fragments just to its left ("12 345 678").
  let end = -1;
  for (let i = ws.length - 1; i >= 0; i--) { if (numericText(ws[i].text)) { end = i; break; } }

  let points = null, start = end;
  if (end >= 0) {
    let text = numericText(ws[end].text);
    let i = end - 1;
    while (i >= 0) {
      const t = numericText(ws[i].text);
      const gap = ws[i + 1].x0 - ws[i].x1;
      if (!t || gap > line.h * 1.2 || !/^\d{1,3}[.,'’]?$/.test(t) || !/^[\d]{3}/.test(text.replace(/^[.,'’]/, ''))) break;
      text = t + text;
      start = i;
      i--;
    }
    points = valueOf(text);
    if (points == null) start = end + 1;
  }

  const nameWords = (points != null ? ws.slice(0, start) : ws).filter((w) => !isJunk(w.text));
  // Drop a leading rank number, unsure scraps from avatars/badges at either end, and screen labels.
  const scrap = (w) => w.text.length <= 3 && w.conf != null && w.conf < 45;
  while (nameWords.length && (isRankToken(nameWords[0].text) || scrap(nameWords[0]))) nameWords.shift();
  while (nameWords.length > 1 && scrap(nameWords[nameWords.length - 1])) nameWords.pop();
  const kept = nameWords.filter((w) => !isBadge(w.text) && !IGNORE.has(norm(w.text).replace(/[^\p{L}]/gu, '')));
  const name = kept.map((w) => w.text).join(' ').replace(/^[^\p{L}\p{N}[]+|[^\p{L}\p{N}\]]+$/gu, '').trim();
  const conf = kept.length ? Math.min(...kept.map((w) => (w.conf == null ? 100 : w.conf))) : 0;

  // A "points" value with nothing to its left (e.g. a rank number on its own) isn't points.
  if (points != null && !name && start > 0 && !ws.slice(0, start).some((w) => !isJunk(w.text))) {
    return { name: '', points, conf, onlyNumber: true };
  }
  return { name, points, conf, onlyNumber: !name && points != null };
}

const looksLikeName = (s) => (s.match(/[\p{L}\p{N}]/gu) || []).length >= 2 && s.length <= 40;

/** Main entry: OCR words → [{name, points, conf}] in screen order. */
export function wordsToRows(words) {
  const lines = toLines(words).map((l) => ({ ...l, ...splitLine(l) }));
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.name && l.points != null && looksLikeName(l.name)) {
      rows.push({ name: l.name, points: l.points, conf: l.conf });
      continue;
    }
    // Name on this line, points on the next one.
    const next = lines[i + 1];
    if (l.name && l.points == null && next && next.onlyNumber && next.cy - l.cy <= 2.4 * Math.max(l.h, next.h) && looksLikeName(l.name)) {
      rows.push({ name: l.name, points: next.points, conf: l.conf });
      i++;
    }
  }
  // Keep each player once (overlapping screenshots, pinned "my rank" bar).
  const byName = new Map();
  for (const r of rows) {
    const k = norm(r.name);
    const cur = byName.get(k);
    if (!cur || r.conf > cur.conf) byName.set(k, r);
  }
  return [...byName.values()];
}
