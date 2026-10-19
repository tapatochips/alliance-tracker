// "Follow-up list": ready-to-paste text naming who is under the minimum or has no score.
import { DAYS } from '../config.js';
import { $, h, toast, copyText } from '../lib/dom.js';
import { weekRange } from '../lib/dates.js';
import { fmtCompact } from '../lib/numbers.js';
import { ui } from '../state.js';
import { data } from '../data/store.js';
import { computeWeek, minFor } from '../model/week.js';

export function openFollowUp() {
  const W = computeWeek(ui.weekId, data());
  const opts = [h('option', { value: 'week', text: 'Whole week' })];
  let latest = null;
  DAYS.forEach((d, i) => {
    if (W.recorded[i]) { latest = d.n; opts.push(h('option', { value: String(d.n), text: `Day ${d.n} · ${d.name}` })); }
  });
  const sel = $('#fuScope');
  sel.replaceChildren(...opts);
  sel.value = latest ? String(latest) : 'week';
  build();
  $('#dlgFollow').showModal();
}

/** The message text for the whole week or one day. */
export function followUpText(weekId, d, scope) {
  const W = computeWeek(weekId, d);
  const lines = [`${(d.config && d.config.allianceName) || 'Alliance'} · Alliance Duel, week of ${weekRange(weekId)}`];
  const active = W.rows.filter((r) => !r.left).sort((a, b) => a.m.name.localeCompare(b.m.name));
  if (!W.recorded.some(Boolean)) {
    lines.push('', 'No scores recorded yet this week.');
  } else if (scope === 'week') {
    const fl = active.filter((r) => r.flags > 0).sort((a, b) => b.flags - a.flags || a.m.name.localeCompare(b.m.name));
    if (!fl.length) lines.push('', 'Everyone met the configured minimums. Great work!');
    else {
      lines.push('', `Needs follow-up (${fl.length}):`);
      for (const r of fl) {
        const bits = r.cells.filter((c) => c.st === 'below' || c.st === 'missed')
          .map((c) => (c.st === 'missed' ? `Day ${c.day.n} missed` : `Day ${c.day.n} ${fmtCompact(c.v)} (min ${fmtCompact(c.min)})`));
        if (r.weeklyBelow) bits.push(`Week total ${fmtCompact(r.total)} (min ${fmtCompact(r.weeklyMinimum)})`);
        lines.push(`• ${r.m.name}: ${bits.join(', ')}`);
      }
    }
  } else {
    const i = Number(scope) - 1;
    const day = DAYS[i];
    const min = minFor(d.config, day.key);
    lines.push(`Day ${day.n} · ${day.name}${min ? ` · minimum ${fmtCompact(min)}` : ''}`);
    const below = active.filter((r) => r.cells[i].st === 'below').sort((a, b) => a.cells[i].v - b.cells[i].v);
    const missed = active.filter((r) => r.cells[i].st === 'missed');
    if (!below.length && !missed.length) lines.push('', 'Everyone hit the daily minimum. Great work!');
    if (below.length) lines.push('', `Below minimum (${below.length}): ` + below.map((r) => `${r.m.name} ${fmtCompact(r.cells[i].v)}`).join(', '));
    if (missed.length) lines.push('', `No score (${missed.length}): ` + missed.map((r) => r.m.name).join(', '));
  }
  return lines.join('\n');
}

function build() {
  $('#fuText').value = followUpText(ui.weekId, data(), $('#fuScope').value);
}

export function bindFollowUpDialog() {
  $('#fuScope').addEventListener('change', build);
  $('#fuCopy').addEventListener('click', async () => {
    const ok = await copyText($('#fuText').value, $('#fuText'));
    toast(ok ? 'Copied. Paste it into alliance chat.' : 'Text selected. Press Ctrl+C (or long-press) to copy.');
  });
}
