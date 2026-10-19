// "Export CSV": the selected week as a spreadsheet file (opens in Excel, Google Sheets, Numbers).
import { DAYS } from '../config.js';
import { toast } from '../lib/dom.js';
import { downloadText, toCsv } from '../lib/files.js';
import { ui } from '../state.js';
import { data } from '../data/store.js';
import { computeWeek, sortRows } from '../model/week.js';

export function exportWeekCsv() {
  const W = computeWeek(ui.weekId, data());
  const head = ['Member', 'Rank', ...DAYS.map((x) => `Day ${x.n} ${x.name}`), 'Week total', 'Minimum weekly total', 'Days below minimum', 'Days missed', 'Below weekly minimum', 'Status'];
  const rows = sortRows(W.rows, { key: 'total', dir: -1 }).map((r) => [
    r.m.name, r.m.rank || '',
    ...r.cells.map((c) => (c.v === 'ex' ? 'excused' : typeof c.v === 'number' ? c.v : '')),
    r.total, r.weeklyMinimum || '', r.below, r.missed, r.weeklyBelow ? 'yes' : '', r.left ? 'left' : 'active',
  ]);
  downloadText(`alliance-duel-${ui.weekId}.csv`, toCsv([head, ...rows]), 'text/csv');
  toast('CSV saved to your downloads.');
}
