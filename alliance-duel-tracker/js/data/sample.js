// Made-up sample alliance for "Preview with sample data". Never saved.
import { DAYS } from '../config.js';
import { ymd, addDays, parseYmd, thisWeekId, todayDay } from '../lib/dates.js';

// Small seeded random generator so the sample looks the same every time.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSampleData() {
  const rnd = mulberry32(11);
  const names = ['Raven', 'Grizzly', 'Vex', 'Nomad', 'Kestrel', 'Ironside', 'Juno', 'Talon', 'Mako', 'Rook', 'Pike', 'Ember', 'Sable', 'Dune'];
  const ranks = ['R5', 'R4', 'R4', 'R3', 'R3', 'R3', 'R2', 'R2', 'R2', 'R1', 'R1', 'R1', 'R1', 'R1'];
  const cur = thisWeekId();
  const start = ymd(addDays(parseYmd(cur), -35));

  const members = new Map();
  names.forEach((n, i) => members.set('pv' + i, {
    id: 'pv' + i, name: n, rank: ranks[i], status: i === 13 ? 'left' : 'active', aliases: [], since: start,
  }));

  const mins = { d1: 1.5e6, d2: 3e6, d3: 3e6, d4: 2e6, d5: 4e6, d6: 2e6 };
  const strength = names.map((_, i) => 2.6 - i * 0.11 + rnd() * 0.3);
  const weeks = new Map();
  for (let w = 5; w >= 0; w--) {
    const wid = ymd(addDays(parseYmd(cur), -7 * w));
    const last = w === 0 ? (todayDay(wid) || 6) : 6;
    const scores = {};
    names.forEach((n, i) => {
      if (i === 13 && w < 2) return; // Dune left two weeks ago
      const s = {};
      for (const day of DAYS) {
        if (day.n > last) continue;
        const r = rnd();
        if (r < 0.05) continue; // missed
        if (r < 0.07) { s[day.key] = 'ex'; continue; }
        s[day.key] = Math.round((mins[day.key] * strength[i] * (0.62 + rnd() * 0.9)) / 1000) * 1000;
      }
      scores['pv' + i] = s;
    });
    weeks.set(wid, { scores });
  }
  return { config: { allianceName: 'Sample Alliance', minimums: mins, weeklyMinimum: 15e6 }, members, weeks };
}
