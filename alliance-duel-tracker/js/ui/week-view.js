// The Week tab: stat tiles, the member × day grid with inline editing, and the first-run empty state.
import { DAYS } from '../config.js';
import { $, h, toast } from '../lib/dom.js';
import { todayDay } from '../lib/dates.js';
import { fmtCompact, fmtFull, parsePoints } from '../lib/numbers.js';
import { norm } from '../lib/names.js';
import { ui, renderNow, flushRender } from '../state.js';
import { data, setScores, startSample } from '../data/store.js';
import { computeWeek, sortRows, minFor, hasAnyMin } from '../model/week.js';
import { stat, sortHeader, ariaSort } from './widgets.js';
import { openScores } from './scores-dialog.js';

export function renderWeek(d) {
  const empty = $('#weekEmpty'), body = $('#weekBody');
  if (!d.members.size) {
    empty.hidden = false; body.hidden = true;
    renderEmpty(empty);
    return;
  }
  empty.hidden = true; body.hidden = false;

  const W = computeWeek(ui.weekId, d);
  renderStats(W, d);
  $('#fAll').setAttribute('aria-pressed', String(ui.filter === 'all'));
  $('#fFlag').setAttribute('aria-pressed', String(ui.filter === 'flag'));
  renderGrid(W, d);
}

function renderEmpty(el) {
  el.replaceChildren(
    h('h2', { text: 'Start with your roster' }),
    h('p', { text: 'Every member gets a row, with Duel Days 1–6 across. Scores under the daily or weekly minimum and missed days are flagged so you can follow up fast.' }),
    h('ol', { class: 'steps' },
      h('li', null, h('div', null, h('b', { text: 'Add scores from screenshots' }),
        h('span', { text: 'Pick or paste the Duel ranking screenshots. They are read on this device, and new names join the roster.' }))),
      h('li', null, h('div', null, h('b', { text: 'Or paste your member list' }), h('span', { text: 'On the Roster tab, one name per line.' }))),
      h('li', null, h('div', null, h('b', { text: 'Set daily and weekly minimums' }), h('span', { text: 'Anyone under a daily minimum, weekly total minimum, or missing a recorded day gets flagged.' })))),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', text: '+ Add scores', onclick: openScores }),
      h('button', { class: 'btn', text: 'Add members', onclick: () => { ui.tab = 'roster'; renderNow(); setTimeout(() => $('#rosterAdd').focus(), 0); } }),
      h('button', { class: 'btn', text: 'Preview with sample data', onclick: () => { startSample(); ui.tab = 'week'; renderNow(); } }),
      h('button', { class: 'btn ghost', text: 'Load a backup', onclick: () => $('#backupBtn').click() })));
}

function renderStats(W, d) {
  const tracked = W.rows.filter((r) => !r.left);
  const daysRec = W.recorded.filter(Boolean).length;
  const total = W.rows.reduce((a, r) => a + r.total, 0);
  const flagged = tracked.filter((r) => r.flags > 0);
  const belowN = tracked.reduce((a, r) => a + r.below, 0);
  const missedN = tracked.reduce((a, r) => a + r.missed, 0);
  const weeklyN = tracked.filter((r) => r.weeklyBelow).length;
  const top = W.rows.reduce((a, r) => (!a || r.total > a.total ? r : a), null);
  const anyMin = hasAnyMin(d.config);
  $('#stats').replaceChildren(
    stat('Alliance total', daysRec ? fmtCompact(total) : '—', `${daysRec} of 6 days recorded`),
    stat('On track', daysRec ? String(tracked.length - flagged.length) : '—',
      `of ${tracked.length} members${anyMin ? '' : ' · no minimums set'}`, daysRec && !flagged.length ? 'good' : ''),
    stat('Need follow-up', daysRec ? String(flagged.length) : '—',
      daysRec ? `${belowN} daily below · ${missedN} missed · ${weeklyN} weekly below` : 'Add a day’s scores to see flags', flagged.length ? 'alert' : ''),
    stat('Top scorer', top && top.total > 0 ? top.m.name : '—', top && top.total > 0 ? fmtFull(top.total) + ' points' : 'No scores yet'));
}

function setSort(key) {
  if (ui.sort.key === key) ui.sort.dir *= -1;
  else ui.sort = { key, dir: key === 'name' ? 1 : -1 };
  renderNow();
}

function renderGrid(W, d) {
  let rows = W.rows;
  if (ui.filter === 'flag') rows = rows.filter((r) => r.flags > 0);
  const q = norm(ui.query);
  if (q) rows = rows.filter((r) => norm(r.m.name).includes(q) || (r.m.aliases || []).some((a) => norm(a).includes(q)));
  rows = sortRows(rows, ui.sort);
  ui.lastOrder = rows.map((r) => r.id);
  const today = todayDay(ui.weekId);
  const daysRec = W.recorded.filter(Boolean).length;

  const thead = h('thead', null, h('tr', null,
    h('th', { class: 'mcol', 'aria-sort': ariaSort(ui.sort, 'name') }, sortHeader('Member', 'name', ui.sort, setSort)),
    DAYS.map((day) => {
      const min = minFor(d.config, day.key);
      const inner = h('div', null,
        h('div', { class: 'th-k' }, `Day ${day.n}`, today === day.n ? h('span', { class: 'th-today', text: 'TODAY' }) : null),
        h('div', { class: 'th-n', text: day.short }),
        h('div', { class: 'th-m', text: min ? `min ${fmtCompact(min)}` : 'no min' }));
      return h('th', { class: today === day.n ? 'today' : null, title: day.name, 'aria-sort': ariaSort(ui.sort, day.key) },
        sortHeader('', day.key, ui.sort, setSort, inner));
    }),
    h('th', { title: W.weeklyMinimum ? `Minimum weekly total: ${fmtFull(W.weeklyMinimum)}` : 'No weekly total minimum set',
      'aria-sort': ariaSort(ui.sort, 'total') }, sortHeader('', 'total', ui.sort, setSort,
      h('div', null, h('div', { class: 'th-k', text: 'Week total' }),
        h('div', { class: 'th-m', text: W.weeklyMinimum ? `min ${fmtCompact(W.weeklyMinimum)}` : 'no min' })))),
    h('th', { class: 'left', 'aria-sort': ariaSort(ui.sort, 'flags') }, sortHeader('Status', 'flags', ui.sort, setSort))));

  const tbody = h('tbody');
  for (const r of rows) {
    const tr = h('tr', { dataset: { id: r.id } });
    tr.append(h('td', { class: 'mcol' },
      h('span', { class: 'mname', text: r.m.name, title: r.m.name }),
      r.m.rank ? h('span', { class: 'rank', text: r.m.rank }) : null));
    for (const c of r.cells) {
      const td = h('td', { class: 'score ' + c.st, tabindex: '0', dataset: { id: r.id, day: c.day.key } });
      fillCell(td, c);
      td.addEventListener('click', () => startEdit(td, r.id, c.day.key));
      td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(td, r.id, c.day.key); }
      });
      tr.append(td);
    }
    tr.append(h('td', { class: 'total' + (r.weeklyBelow ? ' below' : ''),
      text: r.total ? fmtCompact(r.total) : '—',
      title: `${r.total ? fmtFull(r.total) : '0'} points${r.weeklyBelow ? ` · below the ${fmtFull(r.weeklyMinimum)} weekly minimum` : ''}` }));
    tr.append(h('td', { class: 'status' }, statusChip(r, daysRec)));
    tbody.append(tr);
  }
  if (!rows.length) {
    tbody.append(h('tr', null, h('td', { class: 'mcol message', colspan: '9',
      text: ui.filter === 'flag' ? 'Nobody needs follow-up this week.' : 'No members match that search.' })));
  }

  const daySums = DAYS.map((_, i) => W.rows.reduce((a, r) => a + (typeof r.cells[i].v === 'number' ? r.cells[i].v : 0), 0));
  const total = W.rows.reduce((a, r) => a + r.total, 0);
  const tfoot = h('tfoot', null, h('tr', null,
    h('td', { class: 'mcol', text: 'Alliance total' }),
    daySums.map((s, i) => h('td', { text: W.recorded[i] ? fmtCompact(s) : '—', title: W.recorded[i] ? fmtFull(s) : null })),
    h('td', { text: total ? fmtCompact(total) : '—' }),
    h('td')));

  $('#grid').replaceChildren(thead, tbody, tfoot);
  $('#gridHint').textContent = 'Tap any score to edit it. Type 2.4m, 850k or 2,400,000, or ex to excuse a member for that day. Enter saves and moves down; Tab moves across.';
}

function statusChip(r, daysRec) {
  if (r.left) return h('span', { class: 'chip mute', text: 'Left alliance' });
  if (!daysRec) return h('span', { class: 'chip mute', text: 'Waiting' });
  if (r.flags) {
    const parts = [];
    if (r.below) parts.push(`${r.below} below`);
    if (r.missed) parts.push(`${r.missed} missed`);
    if (r.weeklyBelow) parts.push('weekly min');
    return h('span', { class: 'chip bad', text: '⚑ ' + parts.join(' · ') });
  }
  return h('span', { class: 'chip ok', text: '✓ On track' });
}

function fillCell(td, c) {
  td.replaceChildren();
  td.removeAttribute('title');
  if (c.st === 'ok' || c.st === 'below') {
    if (c.st === 'below') td.append(h('span', { class: 'tri', text: '▼', 'aria-hidden': 'true' }));
    td.append(fmtCompact(c.v));
    td.title = fmtFull(c.v) + ' points' + (c.st === 'below' ? ` · under the ${fmtFull(c.min)} minimum` : '');
  } else if (c.st === 'missed') {
    td.append(h('span', { class: 'tag', text: 'Missed' }));
    td.title = 'No score on a recorded day';
  } else if (c.st === 'ex') {
    td.append(h('span', { class: 'tag', text: 'Excused' }));
  } else {
    td.append('·');
  }
}

/** Turn a score cell into an input. Enter saves and moves down, Tab across, Esc cancels. */
function startEdit(td, id, dayKey) {
  if (ui.editing) return;
  const wk = data().weeks.get(ui.weekId);
  const cur = wk && wk.scores && wk.scores[id] ? wk.scores[id][dayKey] : undefined;
  ui.editing = { id, dayKey };
  const input = h('input', { class: 'cellinput', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Points',
    value: cur == null ? '' : String(cur) });
  td.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit, move, fromBlur) => {
    if (done) return;
    let val = cur;
    if (commit) {
      const p = parsePoints(input.value);
      if (!p.ok) {
        toast('Enter points like 2.4m or 2,400,000, or ex to excuse.');
        if (!fromBlur) { input.focus(); input.select(); return; }
      } else val = p.value;
    }
    done = true;
    ui.editing = null;
    const changed = commit && val !== cur && !(val == null && cur == null);

    let nextId = id, nextDay = dayKey;
    if (move === 'down' || move === 'up') {
      const i = ui.lastOrder.indexOf(id);
      nextId = ui.lastOrder[i + (move === 'down' ? 1 : -1)] || null;
    }
    if (move === 'right' || move === 'left') {
      const i = DAYS.findIndex((x) => x.key === dayKey);
      const nd = DAYS[i + (move === 'right' ? 1 : -1)];
      nextDay = nd ? nd.key : null;
    }
    if (changed) setScores(ui.weekId, { [id]: { [dayKey]: val } }); // triggers a re-render
    renderNow();
    flushRender();

    const sel = (mid, dk) => `#grid td.score[data-id="${CSS.escape(mid)}"][data-day="${dk}"]`;
    if (move && nextId && nextDay) {
      const nt = document.querySelector(sel(nextId, nextDay));
      if (nt) startEdit(nt, nextId, nextDay);
    } else if (!fromBlur) {
      const back = document.querySelector(sel(id, dayKey));
      if (back) back.focus();
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true, e.shiftKey ? 'up' : 'down'); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'Tab') { e.preventDefault(); finish(true, e.shiftKey ? 'left' : 'right'); }
  });
  input.addEventListener('blur', () => finish(true, null, true));
}
