// Entry point: load saved data, connect buttons, draw the page.
import { $, $$ } from './lib/dom.js';
import { thisWeekId, shiftWeek } from './lib/dates.js';
import { ui, setRenderer, requestRender, renderNow } from './state.js';
import { load, subscribe } from './data/store.js';
import { render } from './ui/render.js';
import { addMembersFromBox } from './ui/roster-view.js';
import { openScores, bindScoresDialog } from './ui/scores-dialog.js';
import { openSettings, bindSettingsDialog } from './ui/settings-dialog.js';
import { openFollowUp, bindFollowUpDialog } from './ui/followup-dialog.js';
import { openBackup, bindBackupDialog } from './ui/backup-dialog.js';
import { exportWeekCsv } from './ui/export-csv.js';

function bindPage() {
  $$('.tab').forEach((b) => b.addEventListener('click', () => { ui.tab = b.dataset.tab; ui.rosterConfirm = null; renderNow(); }));
  $('#prevWeek').addEventListener('click', () => { ui.weekId = shiftWeek(ui.weekId, -1); renderNow(); });
  $('#nextWeek').addEventListener('click', () => { if (ui.weekId < thisWeekId()) { ui.weekId = shiftWeek(ui.weekId, 1); renderNow(); } });
  $('#thisWeekBtn').addEventListener('click', () => { ui.weekId = thisWeekId(); renderNow(); });
  $('#search').addEventListener('input', (e) => { ui.query = e.target.value; renderNow(); });
  $('#fAll').addEventListener('click', () => { ui.filter = 'all'; renderNow(); });
  $('#fFlag').addEventListener('click', () => { ui.filter = 'flag'; renderNow(); });

  $('#addScoresBtn').addEventListener('click', openScores);
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#followBtn').addEventListener('click', openFollowUp);
  $('#exportBtn').addEventListener('click', exportWeekCsv);
  $('#backupBtn').addEventListener('click', openBackup);
  $('#rosterAddBtn').addEventListener('click', addMembersFromBox);

  // Every dialog's × and Cancel buttons.
  $$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  bindScoresDialog();
  bindSettingsDialog();
  bindFollowUpDialog();
  bindBackupDialog();

  // A new Duel week starts while the page is open: move along if the person was on the old current week.
  let lastWeek = thisWeekId();
  setInterval(() => {
    const tw = thisWeekId();
    if (tw !== lastWeek) { if (ui.weekId === lastWeek) ui.weekId = tw; lastWeek = tw; requestRender(); }
  }, 60000);
}

load();
setRenderer(render);
subscribe(requestRender);
bindPage();
renderNow();
