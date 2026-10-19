// Reading and formatting Duel points.

/**
 * Parse what a person (or OCR) typed into a points value.
 * Accepts 2.4m, 850k, 1.2b, 2,400,000, 2.400.000, "3240000 pts".
 * "ex" / "excused" / "x" → 'ex'. Blank → null. Returns {ok, value}.
 */
export function parsePoints(str) {
  if (str == null) return { ok: false };
  let s = String(str).toLowerCase().replace(/[\s  '’_]/g, '');
  if (s === '') return { ok: true, value: null };
  if (s === 'ex' || s === 'excused' || s === 'x') return { ok: true, value: 'ex' };
  s = s.replace(/(points|pts)$/, '');
  const m = s.match(/^(\d[\d.,]*)([kmb])?$/);
  if (!m) return { ok: false };
  let num = m[1];
  const suf = m[2];
  let mult = 1;
  if (suf) {
    mult = suf === 'k' ? 1e3 : suf === 'm' ? 1e6 : 1e9;
    num = num.replace(/,/g, '.');
    if ((num.match(/\./g) || []).length > 1) return { ok: false };
  } else {
    num = num.replace(/[.,](?=\d{3}(?:\D|$))/g, ''); // thousands separators
    num = num.replace(',', '.');
    if ((num.match(/\./g) || []).length > 1) return { ok: false };
  }
  const v = Math.round(parseFloat(num) * mult);
  if (!isFinite(v) || v < 0) return { ok: false };
  return { ok: true, value: v };
}

/** 3,240,000 → "3.24M"; 950,000 → "950K". */
export function fmtCompact(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const a = Math.abs(v);
  const t = (n, dp) => {
    let s = n.toFixed(dp);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  };
  if (a >= 9.995e8) return t(v / 1e9, a >= 9.995e10 ? 0 : a >= 9.995e9 ? 1 : 2) + 'B';
  if (a >= 999500) return t(v / 1e6, a >= 9.995e7 ? 0 : a >= 9.995e6 ? 1 : 2) + 'M';
  if (a >= 1000) return t(v / 1e3, a >= 99950 ? 0 : 1) + 'K';
  return String(Math.round(v));
}

/** 3240000 → "3,240,000". */
export const fmtFull = (v) => (typeof v === 'number' ? Math.round(v).toLocaleString('en-US') : '');

/** Short form for an input box, but only if it reads back as the exact same number. */
export function minText(v) {
  const c = fmtCompact(v).toLowerCase();
  const p = parsePoints(c);
  return p.ok && p.value === v ? c : fmtFull(v);
}
