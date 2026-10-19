// Working out a week: who is tracked, which days are recorded, who is below minimum or missed a day.
import { DAYS } from '../config.js';
import { todayDay } from '../lib/dates.js';

/** The minimum for a day, or null when none is set. */
export function minFor(cfg, key) {
  const v = cfg && cfg.minimums && cfg.minimums[key];
  return typeof v === 'number' && v > 0 ? v : null;
}
export function weeklyMinFor(cfg) {
  const v = cfg && cfg.weeklyMinimum;
  return typeof v === 'number' && v > 0 ? v : null;
}
export const hasAnyMin = (cfg) => weeklyMinFor(cfg) != null || DAYS.some((d) => minFor(cfg, d.key) != null);

/**
 * Everything the week grid needs.
 * A day is "recorded" once any member has a value for it; after that, a member with no value is "missed".
 * Cell states: ok | below | missed | ex (excused) | pending (day not recorded yet, or before they joined).
 */
export function computeWeek(weekId, d) {
  const wk = d.weeks.get(weekId);
  const scores = (wk && wk.scores) || {};
  const recorded = DAYS.map((day) => Object.values(scores).some((s) => s && s[day.key] != null));
  const weeklyMinimum = weeklyMinFor(d.config);

  const ids = new Set();
  for (const m of d.members.values()) {
    if (m.status !== 'left' && (!m.since || m.since <= weekId)) ids.add(m.id);
  }
  for (const [id, s] of Object.entries(scores)) {
    if (s && d.members.has(id) && DAYS.some((x) => s[x.key] != null)) ids.add(id);
  }

  const rows = [...ids].map((id) => {
    const m = d.members.get(id);
    const s = scores[id] || {};
    const left = m.status === 'left';
    const startDay = m.since === weekId && m.sinceDay ? m.sinceDay : 1;
    let total = 0, below = 0, missed = 0;
    const cells = DAYS.map((day, i) => {
      const v = s[day.key];
      const min = minFor(d.config, day.key);
      let st;
      if (v === 'ex') st = 'ex';
      else if (typeof v === 'number') {
        total += v;
        st = min != null && v < min && !left ? 'below' : 'ok';
        if (st === 'below') below++;
      } else st = recorded[i] && !left && day.n >= startDay ? 'missed' : 'pending';
      if (st === 'missed') missed++;
      return { v, st, min, day };
    });
    const weeklyBelow = !left && weeklyMinimum != null && recorded.some(Boolean) && total < weeklyMinimum;
    return { id, m, cells, total, below, missed, weeklyBelow, weeklyMinimum, flags: below + missed + Number(weeklyBelow), left };
  });
  return { weekId, rows, recorded, scores, weeklyMinimum };
}

/** Week ids that have at least one score, oldest first. */
export function weeksWithData(d) {
  return [...d.weeks.entries()]
    .filter(([, w]) => w && w.scores && Object.values(w.scores).some((s) => s && DAYS.some((x) => s[x.key] != null)))
    .map(([id]) => id)
    .sort();
}

export function memberHasScores(id, d) {
  for (const w of d.weeks.values()) {
    const s = w && w.scores && w.scores[id];
    if (s && DAYS.some((x) => s[x.key] != null)) return true;
  }
  return false;
}

/** Sort grid rows by name, total, flags, or a day key (d1..d6). dir: 1 ascending, -1 descending. */
export function sortRows(rows, { key, dir }) {
  const dayVal = (r, k) => {
    const c = r.cells.find((c) => c.day.key === k);
    return typeof c.v === 'number' ? c.v : -1;
  };
  return rows.slice().sort((a, b) => {
    if (key === 'name') return dir * a.m.name.localeCompare(b.m.name, undefined, { sensitivity: 'base' });
    let x, y;
    if (key === 'total') { x = a.total; y = b.total; }
    else if (key === 'flags') { x = a.flags * 1e13 - a.total; y = b.flags * 1e13 - b.total; }
    else { x = dayVal(a, key); y = dayVal(b, key); }
    return dir * (x - y) || a.m.name.localeCompare(b.m.name);
  });
}

/** Which day to suggest when adding scores: the first day not yet entered, up to today. */
export function defaultDay(weekId, d) {
  const W = computeWeek(weekId, d);
  const td = todayDay(weekId) || 6;
  for (let i = 0; i < td; i++) if (!W.recorded[i]) return i + 1;
  return td;
}
