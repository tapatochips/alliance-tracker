// The History tab: weekly totals per member for the last 8 recorded weeks, with flag counts.
import { $, h } from '../lib/dom.js';
import { fmtDate, parseYmd } from '../lib/dates.js';
import { fmtCompact, fmtFull } from '../lib/numbers.js';
import { ui, renderNow } from '../state.js';
import { computeWeek, weeksWithData } from '../model/week.js';
import { sortHeader } from './widgets.js';

const WEEKS_SHOWN = 8;

export function renderHistory(d) {
  const box = $('#historyBody');
  box.replaceChildren();
  const weeks = weeksWithData(d).slice(-WEEKS_SHOWN);
  if (!d.members.size || !weeks.length) {
    box.append(h('div', { class: 'empty' },
      h('h2', { text: 'No history yet' }),
      h('p', { text: 'Each week you record shows up here as a column, so you can spot members who fall short week after week.' })));
    return;
  }

  // One row per member: their total and flag count in each week.
  const per = new Map();
  weeks.map((w) => computeWeek(w, d)).forEach((c, wi) => {
    for (const r of c.rows) {
      if (!per.has(r.id)) per.set(r.id, { id: r.id, m: r.m, cells: new Array(weeks.length).fill(null), flags: 0, sum: 0, n: 0 });
      const p = per.get(r.id);
      const present = r.cells.some((x) => x.st !== 'pending');
      p.cells[wi] = { total: r.total, flags: r.flags, below: r.below, missed: r.missed, weeklyBelow: r.weeklyBelow, present };
      if (present) { p.flags += r.flags; p.sum += r.total; p.n++; }
    }
  });

  const avg = (p) => (p.n ? p.sum / p.n : 0);
  const { key, dir } = ui.historySort;
  const rows = [...per.values()]
    .filter((p) => p.n > 0 || p.m.status !== 'left')
    .sort((a, b) => {
      if (key === 'name') return dir * a.m.name.localeCompare(b.m.name, undefined, { sensitivity: 'base' });
      if (key === 'avg') return dir * (avg(a) - avg(b));
      return dir * (a.flags - b.flags) || avg(b) - avg(a);
    });

  const onSort = (k) => {
    if (ui.historySort.key === k) ui.historySort.dir *= -1;
    else ui.historySort = { key: k, dir: k === 'name' ? 1 : -1 };
    renderNow();
  };

  const thead = h('thead', null, h('tr', null,
    h('th', { class: 'mcol' }, sortHeader('Member', 'name', ui.historySort, onSort)),
    weeks.map((w) => h('th', null,
      h('button', { class: 'weeklink', title: 'Open this week', onclick: () => { ui.weekId = w; ui.tab = 'week'; renderNow(); } },
        h('div', { class: 'th-k', text: fmtDate(parseYmd(w)) }),
        h('div', { class: 'th-n', text: 'week of' })))),
    h('th', null, sortHeader('Weekly flags', 'flags', ui.historySort, onSort)),
    h('th', null, sortHeader('Avg / week', 'avg', ui.historySort, onSort))));

  const tbody = h('tbody');
  for (const p of rows) {
    const tr = h('tr');
    tr.append(h('td', { class: 'mcol' },
      h('span', { class: 'mname', text: p.m.name }),
      p.m.rank ? h('span', { class: 'rank', text: p.m.rank }) : null,
      p.m.status === 'left' ? h('span', { class: 'rank', text: 'LEFT' }) : null));
    for (const c of p.cells) {
      if (!c || !c.present) { tr.append(h('td', { class: 'hcell absent', text: '—' })); continue; }
      const td = h('td', {
        class: 'hcell' + (c.flags ? ' flagged' : ''),
        title: fmtFull(c.total) + ' points' + (c.flags
          ? ` · ${c.below + c.missed} daily flag${c.below + c.missed === 1 ? '' : 's'}${c.weeklyBelow ? ' · below weekly minimum' : ''}`
          : ''),
      }, fmtCompact(c.total));
      if (c.flags) td.append(h('span', { class: 'flagcount', text: '⚑' + c.flags }));
      tr.append(td);
    }
    tr.append(h('td', { class: 'hnum' + (p.flags ? ' bad' : ''), text: String(p.flags) }));
    tr.append(h('td', { class: 'hnum', text: p.n ? fmtCompact(avg(p)) : '—' }));
    tbody.append(tr);
  }

  box.append(
    h('p', { class: 'hint', text: `Last ${weeks.length} recorded week${weeks.length > 1 ? 's' : ''}. ⚑ counts daily issues and weeks below the weekly minimum. Tap a week to open it.` }),
    h('div', { class: 'tablewrap' }, h('table', { class: 'grid' }, thead, tbody)));
}
