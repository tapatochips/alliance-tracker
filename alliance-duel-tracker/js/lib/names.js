// Matching player names: typed, pasted or read by OCR, against the roster (names + old names).

/** Lowercase, drop [TAG] alliance tags and spaces, normalise look-alike Unicode. */
export const norm = (s) => String(s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\[[^\]]*\]/g, '')
  .replace(/\s+/g, '')
  .trim();

/**
 * Looser key for OCR: also folds characters OCR commonly confuses (0/o, 1/l/i/|, 5/s, 8/b, rn/m)
 * and drops punctuation, so "Ironsid3" and "lronside" both land near "ironside".
 */
export const ocrKey = (s) => norm(s)
  .replace(/rn/g, 'm')
  .replace(/[0ø]/g, 'o')
  .replace(/[1il|!]/g, 'l')
  .replace(/5/g, 's')
  .replace(/8/g, 'b')
  .replace(/[^\p{L}\p{N}]/gu, '');

/** Edit distance between two strings. */
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Map of normalised name/alias → member id. Active members win over members who left. */
export function nameIndex(members) {
  const idx = new Map();
  const ms = [...members.values()].sort((a, b) => (a.status === 'left') - (b.status === 'left'));
  for (const m of ms) {
    for (const n of [m.name, ...(m.aliases || [])]) {
      const k = norm(n);
      if (k && !idx.has(k)) idx.set(k, m.id);
    }
  }
  return idx;
}

/**
 * Find the roster member a name refers to.
 * Exact (normalised) match first; then a close match allowing a few typos, more for OCR.
 * Returns {id, fuzzy} or null when nothing is close or two members are equally close.
 */
export function matchName(name, idx, { ocr = false } = {}) {
  const k = norm(name);
  if (!k) return null;
  if (idx.has(k)) return { id: idx.get(k), fuzzy: false };

  const key = ocr ? ocrKey(name) : k;
  const len = key.length;
  const lim = ocr
    ? (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3)
    : (len <= 4 ? 0 : len <= 8 ? 1 : 2);

  let best = null, bestD = 99, tie = false;
  for (const [entry, id] of idx) {
    const other = ocr ? ocrKey(entry) : entry;
    if (ocr && other === key) return { id, fuzzy: true };
    if (!lim || Math.abs(other.length - len) > lim) continue;
    const d = lev(key, other);
    if (d < bestD) { bestD = d; best = id; tie = false; }
    else if (d === bestD && id !== best) tie = true;
  }
  return best && bestD <= lim && !tie ? { id: best, fuzzy: true } : null;
}
