// "Add scores": pick or paste screenshots (read on this device) or paste text, review the matches, save.
import { DAYS } from '../config.js';
import { $, $$, h, toast } from '../lib/dom.js';
import { thisWeekId, weekRange } from '../lib/dates.js';
import { fmtCompact, fmtFull, parsePoints } from '../lib/numbers.js';
import { norm, ocrKey, lev, nameIndex, matchName } from '../lib/names.js';
import { parsePasted } from '../lib/text-import.js';
import { ui, renderNow } from '../state.js';
import { data, batch, addMember, updateMember, setScores } from '../data/store.js';
import { defaultDay } from '../model/week.js';
import { readScreenshots, stopReader } from '../ocr/read-screenshots.js';

const SC = { mode: 'shots', files: [], rows: null, busy: false, stopped: false };
const LOW_CONF = 70; // OCR names below this confidence get a "check" badge

export function openScores() {
  const sel = $('#scDay');
  sel.replaceChildren(...DAYS.map((d) => h('option', { value: String(d.n), text: `Day ${d.n} · ${d.name}` })));
  sel.value = String(defaultDay(ui.weekId, data()));
  $('#scWeek').textContent = 'Week of ' + weekRange(ui.weekId);
  SC.files = [];
  SC.rows = null;
  renderFiles();
  $('#scText').value = '';
  $('#scReview').hidden = true;
  setStatus('');
  setMode('shots');
  updateSave();
  $('#dlgScores').showModal();
}

function setMode(m) {
  SC.mode = m;
  $('#scShots').hidden = m !== 'shots';
  $('#scPaste').hidden = m !== 'paste';
  $('#scModeShots').setAttribute('aria-pressed', String(m === 'shots'));
  $('#scModePaste').setAttribute('aria-pressed', String(m === 'paste'));
}

function setStatus(msg, isError) {
  const s = $('#scStatus');
  s.textContent = msg;
  s.classList.toggle('err', !!isError);
}

function updateReadButton() {
  $('#scRead').disabled = SC.busy;
}

/* ---------- picking screenshots ---------- */

function renderFiles() {
  $('#scFileList').replaceChildren(...SC.files.map((f, i) => h('li', { title: f.name }, `${i + 1}. ${f.name}`,
    h('button', { class: 'x', type: 'button', 'aria-label': 'Remove ' + f.name, text: '×',
      onclick: () => { if (SC.busy) return; SC.files.splice(i, 1); renderFiles(); } }))));
}

function addFiles(list) {
  const all = [...list];
  const ok = all.filter((f) => /^image\//.test(f.type) && !/heic|heif/i.test(f.type));
  if (ok.length < all.length) setStatus('Some files were skipped. Use regular screenshots (PNG or JPG).', true);
  else setStatus('');
  SC.files = SC.files.concat(ok).slice(0, 40);
  renderFiles();
  return ok.length;
}

function clipboardImages(e) {
  const dt = e.clipboardData;
  if (!dt) return [];
  let files = [...(dt.files || [])];
  if (!files.length && dt.items) for (const it of dt.items) if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); }
  return files.filter((f) => /^image\//.test(f.type));
}

function onPaste(e) {
  if (SC.mode !== 'shots') return;
  const files = clipboardImages(e);
  if (files.length) {
    e.preventDefault();
    const start = SC.files.length;
    const named = files.map((f, i) => {
      try { return new File([f], `pasted-${start + i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }); }
      catch (err) { return f; }
    });
    const added = addFiles(named);
    if (added) setStatus(`Added ${added} pasted screenshot${added > 1 ? 's' : ''}. Paste more, or tap Read.`);
  } else if (e.target && e.target.closest && e.target.closest('#scPasteBox')) {
    e.preventDefault();
    setStatus('That paste had no picture in it. Copy a screenshot from your photos first.', true);
  }
  $('#scPasteBox').textContent = '';
}

/* ---------- reading ---------- */

async function readShots() {
  if (SC.busy) return;
  if (!SC.files.length) { setStatus('Choose or paste at least one screenshot first.', true); return; }
  SC.busy = true;
  SC.stopped = false;
  $('#scStop').hidden = false;
  updateReadButton();
  updateSave();
  let result;
  try {
    const opts = { onStatus: (m) => setStatus(m), isStopped: () => SC.stopped };
    result = await readScreenshots(SC.files.slice(), opts);
  } catch (e) {
    setStatus(e && e.message ? e.message : 'The screenshot reader stopped unexpectedly. Try again.', true);
    return;
  } finally {
    SC.busy = false;
    $('#scStop').hidden = true;
    updateReadButton();
    updateSave();
  }

  const { rows, failed, stopped } = result;
  const n = SC.files.length;
  const failNote = failed.length
    ? ` Nothing readable in screenshot${failed.length > 1 ? 's' : ''} ${failed.join(', ')}; try a clearer shot of the ranking list.` : '';
  if (rows.length) {
    setReview(rows, { ocr: true });
    const missingPoints = SC.rows.filter((row) => row.points == null && row.target !== 'skip').length;
    const pointsNote = missingPoints ? ` ${missingPoints} score${missingPoints === 1 ? '' : 's'} need manual entry.` : '';
    setStatus(`${stopped ? 'Stopped. ' : ''}Found ${SC.rows.length} players in ${n - failed.length} of ${n} screenshot${n > 1 ? 's' : ''}.${pointsNote}${failNote} Check every name and score, then save.`, failed.length > 0);
  } else {
    setStatus(stopped ? 'Stopped.' : 'Couldn’t find names and scores in those screenshots. Make sure the ranking list fills most of the screen, or use Paste text.', !stopped);
  }
}

function readPaste() {
  const { rows, bad } = parsePasted($('#scText').value);
  if (!rows.length) { setStatus('Couldn’t find any “name points” lines. Put one player per line, like: Raven 3,240,000', true); return; }
  setReview(rows, { ocr: false });
  setStatus(`Read ${SC.rows.length} players${bad ? ` · skipped ${bad} line${bad > 1 ? 's' : ''} without a score` : ''}. Check the matches, then save.`);
}

/* ---------- review ---------- */

/** Up to 3 roster members whose names look closest to what was read. */
function closestMembers(name, members, limit = 3) {
  const key = ocrKey(name);
  if (!key) return [];
  return [...members.values()]
    .map((m) => ({ m, d: Math.min(...[m.name, ...(m.aliases || [])].map((n) => lev(key, ocrKey(n)))) }))
    .filter((x) => x.d <= Math.max(2, Math.ceil(key.length * 0.5)))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.m);
}

function setReview(entries, { ocr }) {
  const d = data();
  const byName = new Map();
  for (const e of entries) {
    const k = norm(e.name);
    if (!k) continue;
    const cur = byName.get(k);
    if (!cur || e.points > cur.points) byName.set(k, e);
  }
  const idx = nameIndex(d.members);
  const hasRoster = d.members.size > 0;
  SC.rows = [...byName.values()].sort((a, b) => (b.points ?? -1) - (a.points ?? -1)).map((e) => {
    const mt = matchName(e.name, idx, { ocr });
    const lowConf = ocr && e.conf != null && e.conf < LOW_CONF;
    return {
      name: e.name,
      points: e.points,
      target: mt ? mt.id : 'new',
      check: mt ? mt.fuzzy || lowConf : (ocr && (hasRoster || lowConf)),
      suggestions: mt ? [] : closestMembers(e.name, d.members),
      bad: e.points == null,
    };
  });
  renderReview();
}

function renderReview() {
  if (!SC.rows) { $('#scReview').hidden = true; return; }
  const d = data();
  const day = DAYS[Number($('#scDay').value) - 1];
  const wk = d.weeks.get(ui.weekId);
  const scores = (wk && wk.scores) || {};
  const members = [...d.members.values()].sort((a, b) => (a.status === 'left') - (b.status === 'left') || a.name.localeCompare(b.name));
  $('#scRevTitle').textContent = `Day ${day.n} · ${day.name}`;

  const tb = $('#scRows');
  tb.replaceChildren();
  SC.rows.forEach((r, i) => {
    const tr = h('tr', { dataset: { i: String(i) } });
    const badge = r.check ? h('span', { class: 'badge', text: r.target === 'new' ? 'not on roster' : 'check' }) : null;
    tr.append(h('td', { class: 'nm', title: r.name }, r.name, badge));

    const pin = h('input', { class: 'input' + (r.bad ? ' invalid' : ''), value: fmtFull(r.points), 'aria-label': 'Points for ' + r.name, inputmode: 'decimal' });
    pin.addEventListener('change', () => {
      const p = parsePoints(pin.value);
      if (p.ok && typeof p.value === 'number') { r.points = p.value; r.bad = false; pin.value = fmtFull(p.value); pin.classList.remove('invalid'); }
      else { r.bad = true; pin.classList.add('invalid'); }
      updateSave();
    });
    tr.append(h('td', { class: 'pts' }, pin));

    const opts = [h('option', { value: 'skip', text: 'Skip this row' }), h('option', { value: 'new', text: `Add “${r.name}” as new member` })];
    if (r.suggestions.length) {
      opts.push(h('optgroup', { label: 'Closest names' }, r.suggestions.map((m) => h('option', { value: m.id, text: m.name }))));
    }
    opts.push(h('optgroup', { label: 'All members' }, members.map((m) => h('option', { value: m.id, text: m.name + (m.status === 'left' ? ' (left)' : '') }))));
    const sel = h('select', { class: 'input', 'aria-label': 'Member for ' + r.name }, opts);
    sel.value = r.target;
    sel.addEventListener('change', () => { r.target = sel.value; r.check = false; renderReview(); });
    tr.append(h('td', null, sel));

    const prev = r.target !== 'new' && r.target !== 'skip' && scores[r.target] ? scores[r.target][day.key] : null;
    tr.append(h('td', { class: 'was', text: prev == null ? '' : prev === 'ex' ? 'was excused' : 'was ' + fmtCompact(prev) }));
    tb.append(tr);
  });
  $('#scReview').hidden = false;
  updateSave();
}

function updateSave() {
  const btn = $('#scSave');
  const note = $('#scNote');
  note.textContent = '';
  if (!SC.rows) { btn.disabled = true; btn.textContent = 'Save scores'; $('#scRevCounts').textContent = ''; return; }
  const dayN = Number($('#scDay').value);
  const use = SC.rows.filter((r) => r.target !== 'skip');
  const counts = {};
  for (const r of use) if (r.target !== 'new') counts[r.target] = (counts[r.target] || 0) + 1;
  const dupes = new Set(Object.keys(counts).filter((k) => counts[k] > 1));
  $$('#scRows tr').forEach((tr) => { const r = SC.rows[Number(tr.dataset.i)]; tr.classList.toggle('dupe', dupes.has(r.target)); });
  const matched = use.filter((r) => r.target !== 'new').length;
  const checks = use.filter((r) => r.check).length;
  $('#scRevCounts').textContent = `${matched} matched · ${use.length - matched} new · ${SC.rows.length - use.length} skipped${checks ? ` · ${checks} to check` : ''}`;
  const bad = use.some((r) => r.bad);
  if (dupes.size) note.textContent = 'Two rows point to the same member. Fix the highlighted rows.';
  else if (bad) note.textContent = 'Fix the points marked in red.';
  btn.disabled = SC.busy || !use.length || dupes.size > 0 || bad;
  btn.textContent = `Save Day ${dayN} for ${use.length} member${use.length === 1 ? '' : 's'}`;
}

function saveReview() {
  const dayN = Number($('#scDay').value);
  const day = DAYS[dayN - 1];
  const use = SC.rows.filter((r) => r.target !== 'skip' && !r.bad);
  if (!use.length) return;
  const since = ui.weekId < thisWeekId() ? ui.weekId : thisWeekId();
  let created = 0;
  batch(() => {
    const d = data();
    const newIds = new Map();
    const patch = {};
    for (const r of use) {
      let id = r.target;
      if (id === 'new') {
        const k = norm(r.name);
        if (!newIds.has(k)) {
          // New names first show up on this day, so earlier days aren't counted as missed.
          newIds.set(k, addMember({ name: r.name, since, sinceDay: since === ui.weekId ? dayN : 1 }));
          created++;
        }
        id = newIds.get(k);
      } else {
        const m = d.members.get(id);
        const upd = {};
        if (m && m.status === 'left') upd.status = 'active';
        if (m && m.since === ui.weekId && m.sinceDay && m.sinceDay > dayN) upd.sinceDay = dayN;
        if (Object.keys(upd).length) updateMember(id, upd);
      }
      patch[id] = { [day.key]: r.points };
    }
    setScores(ui.weekId, patch);
  });
  $('#dlgScores').close();
  toast(`Saved Day ${dayN} for ${use.length} member${use.length > 1 ? 's' : ''}${created ? ` · ${created} new on the roster` : ''}.`);
  if (ui.tab !== 'week') { ui.tab = 'week'; renderNow(); }
}

/* ---------- wiring (called once from main.js) ---------- */

export function bindScoresDialog() {
  $('#scModeShots').addEventListener('click', () => setMode('shots'));
  $('#scModePaste').addEventListener('click', () => setMode('paste'));
  $('#scFiles').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('#scDrop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  $('#dlgScores').addEventListener('paste', onPaste);
  $('#scPasteBox').addEventListener('input', () => { $('#scPasteBox').textContent = ''; });
  $('#scRead').addEventListener('click', readShots);
  $('#scStop').addEventListener('click', () => {
    SC.stopped = true;
    stopReader();
  });
  $('#scParse').addEventListener('click', readPaste);
  $('#scDay').addEventListener('change', () => { if (SC.rows) renderReview(); else updateSave(); });
  $('#scSave').addEventListener('click', saveReview);
  $('#dlgScores').addEventListener('close', () => { if (SC.busy) { SC.stopped = true; stopReader(); } });
}
