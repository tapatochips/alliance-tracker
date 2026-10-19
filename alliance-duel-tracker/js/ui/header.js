// Header (alliance name, week switcher), tab bar, action buttons and the notice banner.
import { $, h } from '../lib/dom.js';
import { thisWeekId, weekRange, weekSubtitle } from '../lib/dates.js';
import { ui, renderNow } from '../state.js';
import { isSample, stopSample, savingWorks } from '../data/store.js';

export function renderHeader(d) {
  $('#allianceName').textContent = (d.config && d.config.allianceName) || 'Alliance Duel';
  document.title = d.config && d.config.allianceName ? `${d.config.allianceName} · Duel Tracker` : 'Alliance Duel Tracker';

  const tw = thisWeekId();
  $('#weekLabel').textContent = weekRange(ui.weekId);
  $('#weekSub').textContent = weekSubtitle(ui.weekId);
  $('#nextWeek').disabled = ui.weekId >= tw;
  $('#thisWeekBtn').hidden = ui.weekId === tw;

  for (const t of ['week', 'history', 'roster']) {
    $('#tabbtn-' + t).setAttribute('aria-selected', String(ui.tab === t));
    $('#tab-' + t).hidden = ui.tab !== t;
  }

  const hasMembers = d.members.size > 0;
  $('#followBtn').hidden = !hasMembers;
  $('#exportBtn').hidden = !(hasMembers && ui.tab === 'week');
  renderBanner();
}

function renderBanner() {
  const b = $('#banner');
  b.replaceChildren();
  if (isSample()) {
    b.append(
      h('span', null, h('b', { text: 'Sample data. ' }), 'Nothing here is saved; your own tracker is untouched.'),
      h('button', { class: 'btn small', text: 'Exit sample', onclick: () => { stopSample(); ui.weekId = thisWeekId(); renderNow(); } }));
    b.hidden = false;
    return;
  }
  if (!savingWorks()) {
    b.append(h('span', { text: 'This browser isn’t letting the tracker save (private browsing or storage turned off). Changes will be lost when you close the page. Use Backup to keep a copy.' }));
    b.hidden = false;
    return;
  }
  b.hidden = true;
}
