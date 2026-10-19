// "Minimums": alliance name, daily point minimums, and an optional weekly total minimum.
import { DAYS } from '../config.js';
import { $, h, toast } from '../lib/dom.js';
import { parsePoints, minText } from '../lib/numbers.js';
import { data, setConfig } from '../data/store.js';
import { minFor } from '../model/week.js';

export function openSettings() {
  const cfg = data().config || {};
  $('#stName').value = cfg.allianceName || '';
  $('#stAll').value = '';
  $('#stAll').classList.remove('invalid');
  $('#stWeekly').value = cfg.weeklyMinimum ? minText(cfg.weeklyMinimum) : '';
  $('#stWeekly').classList.remove('invalid');
  $('#stNote').textContent = '';
  $('#stMins').replaceChildren(...DAYS.map((d) => {
    const v = minFor(cfg, d.key);
    return h('label', { class: 'f', for: 'stMin-' + d.key },
      h('span', null, `Day ${d.n} `, h('small', { text: d.name })),
      h('input', { class: 'input', id: 'stMin-' + d.key, placeholder: 'no minimum', value: v ? minText(v) : '' }));
  }));
  $('#dlgSettings').showModal();
}

function applyToAll() {
  const p = parsePoints($('#stAll').value);
  if (!p.ok || p.value === 'ex') { $('#stAll').classList.add('invalid'); return; }
  $('#stAll').classList.remove('invalid');
  for (const d of DAYS) $('#stMin-' + d.key).value = p.value ? minText(p.value) : '';
}

function save() {
  const minimums = {};
  let bad = false;
  const weekly = $('#stWeekly');
  const weeklyParsed = parsePoints(weekly.value);
  if (!weeklyParsed.ok || weeklyParsed.value === 'ex') {
    weekly.classList.add('invalid');
    bad = true;
  } else {
    weekly.classList.remove('invalid');
  }
  for (const d of DAYS) {
    const el = $('#stMin-' + d.key);
    const p = parsePoints(el.value);
    if (!p.ok || p.value === 'ex') { el.classList.add('invalid'); bad = true; }
    else { el.classList.remove('invalid'); minimums[d.key] = p.value || null; }
  }
  if (bad) { $('#stNote').textContent = 'Use numbers like 2m, 750k or 2,000,000, or leave a minimum blank.'; return; }
  setConfig({
    allianceName: $('#stName').value.trim().slice(0, 60),
    minimums,
    weeklyMinimum: weeklyParsed.value || null,
  });
  $('#dlgSettings').close();
  toast('Minimums saved.');
}

export function bindSettingsDialog() {
  $('#stApply').addEventListener('click', applyToAll);
  $('#stSave').addEventListener('click', save);
}
