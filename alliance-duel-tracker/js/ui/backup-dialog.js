// "Backup": save everything to a file or text, and load a backup (combine with or replace this device's data).
// This is also how officers share one tracker: one person sends a backup, the others load it.
import { $, toast, copyText } from '../lib/dom.js';
import { downloadText, canShareFiles, shareText, readFileText } from '../lib/files.js';
import { ui, renderNow } from '../state.js';
import { isSample, stopSample, savingWorks } from '../data/store.js';
import { backupText, backupFilename, parseBackup, mergeBackup, replaceWithBackup } from '../data/backup.js';

export function openBackup() {
  $('#bkShare').hidden = !canShareFiles();
  $('#bkText').value = '';
  setStatus('');
  $('#bkWhere').textContent = savingWorks()
    ? 'Your scores are saved in this browser on this device. Save a backup now and then, and send it to other officers so they can load the same data.'
    : 'This browser isn’t saving the tracker. Save a backup before you close the page.';
  $('#dlgBackup').showModal();
}

function setStatus(msg, isError) {
  const s = $('#bkStatus');
  s.textContent = msg;
  s.classList.toggle('err', !!isError);
}

function load(text) {
  let incoming;
  try { incoming = parseBackup(text); } catch (e) { setStatus(e.message, true); return; }
  if (isSample()) stopSample();
  const mode = document.querySelector('input[name="bkMode"]:checked').value;
  if (mode === 'replace') {
    const r = replaceWithBackup(incoming);
    setStatus(`Loaded ${r.members} members and ${r.weeks} weeks.`);
  } else {
    const r = mergeBackup(incoming);
    setStatus(`Combined: ${r.addedMembers} new members, ${r.filled} scores filled in` +
      (r.conflicts ? `, ${r.conflicts} kept as yours where the backup had a different score.` : '.'));
  }
  ui.tab = 'week';
  renderNow();
  toast('Backup loaded.');
}

export function bindBackupDialog() {
  $('#bkDownload').addEventListener('click', () => {
    downloadText(backupFilename(), backupText(), 'application/json');
    toast('Backup saved to your downloads.');
  });
  $('#bkShare').addEventListener('click', async () => {
    await shareText(backupFilename(), backupText());
  });
  $('#bkCopy').addEventListener('click', async () => {
    const ta = $('#bkText');
    const text = backupText();
    const ok = await copyText(text);
    if (ok) toast('Backup copied. Paste it in a message to another officer.');
    else { ta.value = text; ta.focus(); ta.select(); toast('Backup text selected below. Copy it from there.'); }
  });
  $('#bkFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { load(await readFileText(f)); } catch (err) { setStatus('That file couldn’t be read.', true); }
  });
  $('#bkLoad').addEventListener('click', () => {
    const text = $('#bkText').value.trim();
    if (!text) { setStatus('Choose a backup file or paste backup text first.', true); return; }
    load(text);
  });
}
