// Duel weeks run Monday (Day 1) to Saturday (Day 6). A week is identified by its Monday, as 'YYYY-MM-DD'
// in the device's local time. On Sunday the "current" week is the one that just finished.

const pad = (n) => String(n).padStart(2, '0');

export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const thisWeekId = () => ymd(mondayOf(new Date()));

/** Duel day number (1–6) for today if `weekId` is the current week, otherwise null. Sunday is null. */
export function todayDay(weekId) {
  if (weekId !== thisWeekId()) return null;
  const dow = (new Date().getDay() + 6) % 7;
  return dow <= 5 ? dow + 1 : null;
}

export const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function weekRange(weekId) {
  const m = parseYmd(weekId);
  return `${fmtDate(m)} – ${fmtDate(addDays(m, 5))}`;
}

export const shiftWeek = (weekId, weeks) => ymd(addDays(parseYmd(weekId), 7 * weeks));

/** "This week · Day 3 today", "Last week", "4 weeks ago". */
export function weekSubtitle(weekId) {
  const tw = thisWeekId();
  if (weekId === tw) {
    const td = todayDay(weekId);
    return td ? `This week · Day ${td} today` : 'This week · Duel finished';
  }
  const n = Math.round((parseYmd(tw) - parseYmd(weekId)) / 6048e5);
  return n === 1 ? 'Last week' : n > 1 ? `${n} weeks ago` : 'Upcoming';
}
