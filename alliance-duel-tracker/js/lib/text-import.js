// Turn pasted text ("1. Raven 3,240,000", "Grizzly<TAB>2.8m", "Kestrel, 950k") into {name, points} rows.
import { parsePoints } from './numbers.js';

// The points value at the end of a line: grouped thousands, a k/m/b value, or plain digits.
const NUM_AT_END = /(\d{1,3}(?:[,.  '’]\d{3})+|\d+(?:[.,]\d+)?\s?[kKmMbB]|\d+)\s*(?:pts|points)?\s*$/;

export function parsePasted(text) {
  const rows = [];
  let bad = 0;
  for (let line of String(text).split(/\r?\n/)) {
    line = line.replace(/\t/g, ' ').trim();
    if (!line) continue;
    const m = line.match(NUM_AT_END);
    if (!m) { bad++; continue; }
    let name = line.slice(0, m.index).replace(/[\s,;:|\-–—=]+$/, '').trim();
    // Drop a leading rank number like "1." "#4" "12)".
    const stripped = name.replace(/^(?:#|no\.?\s*)?\d{1,3}\s*[.):\-–]?\s+/i, '').trim();
    if (stripped) name = stripped;
    const p = parsePoints(m[1]);
    if (!name || !p.ok || typeof p.value !== 'number') { bad++; continue; }
    rows.push({ name, points: p.value });
  }
  return { rows, bad };
}
