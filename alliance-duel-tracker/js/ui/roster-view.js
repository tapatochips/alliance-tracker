// The Roster tab: add, rename, set rank, mark as left, merge duplicates, and delete members.
import { RANK_ORDER } from '../config.js';
import { $, h, toast } from '../lib/dom.js';
import { fmtDate, parseYmd, thisWeekId } from '../lib/dates.js';
import { norm, nameIndex } from '../lib/names.js';
import { ui, renderNow, flushRender } from '../state.js';
import { data, batch, addMember, updateMember, renameMember, removeMember, mergeMember } from '../data/store.js';

export function renderRoster(d) {
  const box = $('#rosterList');
  box.replaceChildren();
  const ms = [...d.members.values()].sort((a, b) =>
    (a.status === 'left') - (b.status === 'left') ||
    RANK_ORDER[a.rank || ''] - RANK_ORDER[b.rank || ''] ||
    a.name.localeCompare(b.name));
  const active = ms.filter((m) => m.status !== 'left').length;
  $('#rosterCount').textContent = `${active} active${ms.length > active ? ` · ${ms.length - active} left` : ''}`;
  if (!ms.length) { box.append(h('p', { class: 'muted', text: 'No members yet.' })); return; }

  const tb = h('tbody');
  for (const m of ms) {
    const tr = h('tr', { class: m.status === 'left' ? 'left' : null });
    tr.append(h('td', null, nameCell(m, d), m.aliases && m.aliases.length ? h('div', { class: 'aka', text: 'Also: ' + m.aliases.join(', ') }) : null));
    const sel = h('select', { class: 'input', 'aria-label': 'Rank of ' + m.name },
      ['', 'R5', 'R4', 'R3', 'R2', 'R1'].map((r) => h('option', { value: r, text: r || '—' })));
    sel.value = m.rank || '';
    sel.addEventListener('change', () => updateMember(m.id, { rank: sel.value }));
    tr.append(h('td', null, sel));
    tr.append(h('td', { class: 'muted', text: (m.since ? fmtDate(parseYmd(m.since)) : '—') + (m.status === 'left' ? ' · left' : '') }));
    tr.append(h('td', null, rowActions(m, d)));
    tb.append(tr);
  }
  box.append(h('table', { class: 'list' },
    h('thead', null, h('tr', null, h('th', { text: 'Name' }), h('th', { text: 'Rank' }), h('th', { text: 'Tracked since' }), h('th', { text: '' }))),
    tb));
}

function nameCell(m, d) {
  const wrap = h('div', { class: 'row roster-name' });
  wrap.append(
    h('span', { class: 'mname', text: m.name, title: m.name }),
    h('button', { class: 'btn small ghost', text: 'Edit name', 'aria-label': `Edit name ${m.name}`,
      onclick: () => editName(wrap, m, d) }));
  return wrap;
}

function editName(wrap, m, d) {
  const inp = h('input', { class: 'input', value: m.name, 'aria-label': 'Name of ' + m.name, maxlength: '40' });
  const finish = () => { ui.editing = null; renderNow(); };
  const save = () => {
    const value = inp.value.trim();
    if (!value) { toast('A member name cannot be blank.'); finish(); return; }
    const clash = [...d.members.values()].find((o) => o.id !== m.id && norm(o.name) === norm(value));
    if (clash) { toast(`${clash.name} is already on the roster. Use Merge to combine them.`); finish(); return; }
    if (value === m.name) { finish(); return; }
    renameMember(m.id, value);
    ui.editing = null;
    flushRender();
    toast(`Renamed to ${value}. The old name still matches.`);
  };
  ui.editing = 'roster';
  wrap.classList.add('roster-editor');
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(); }
  });
  wrap.replaceChildren(
    inp,
    h('button', { class: 'btn small primary', text: 'Save', onclick: save }),
    h('button', { class: 'btn small ghost', text: 'Cancel', onclick: finish }));
  inp.focus();
  inp.select();
}

function rowActions(m, d) {
  const rc = ui.rosterConfirm;
  const cancel = () => { ui.rosterConfirm = null; renderNow(); };
  if (rc && rc.from === m.id && rc.type === 'merge') {
    const target = d.members.get(rc.to);
    return h('div', { class: 'confirm' },
      h('span', { text: `Merge into ${target ? target.name : '?'}? Scores move over.` }),
      h('button', { class: 'btn small primary', text: 'Merge', onclick: () => {
        ui.rosterConfirm = null; const from = m.name;
        mergeMember(m.id, rc.to); toast(`Merged ${from} into ${target ? target.name : 'the other member'}.`);
      } }),
      h('button', { class: 'btn small ghost', text: 'Cancel', onclick: cancel }));
  }
  if (rc && rc.from === m.id && rc.type === 'delete') {
    return h('div', { class: 'confirm' },
      h('span', { text: `Permanently delete ${m.name} and all their saved scores?` }),
      h('button', { class: 'btn small danger', text: 'Delete permanently', onclick: () => { ui.rosterConfirm = null; removeMember(m.id); toast(`Removed ${m.name} and their saved scores.`); } }),
      h('button', { class: 'btn small ghost', text: 'Cancel', onclick: cancel }));
  }

  const wrap = h('div', { class: 'row nowrap' });
  wrap.append(m.status === 'left'
    ? h('button', { class: 'btn small', text: 'Restore', onclick: () => updateMember(m.id, { status: 'active' }) })
    : h('button', { class: 'btn small', text: 'Left alliance', title: 'Keeps their history but stops tracking them',
      onclick: () => updateMember(m.id, { status: 'left' }) }));
  const others = [...d.members.values()].filter((o) => o.id !== m.id).sort((a, b) => a.name.localeCompare(b.name));
  if (others.length) {
    const sel = h('select', { class: 'input', 'aria-label': `Merge ${m.name} into another member`, style: 'max-width:150px' },
      h('option', { value: '', text: 'Merge into…' }),
      others.map((o) => h('option', { value: o.id, text: o.name })));
    sel.addEventListener('change', () => { if (sel.value) { ui.rosterConfirm = { type: 'merge', from: m.id, to: sel.value }; renderNow(); } });
    wrap.append(sel);
  }
  wrap.append(h('button', { class: 'btn small ghost', text: 'Delete', onclick: () => { ui.rosterConfirm = { type: 'delete', from: m.id }; renderNow(); } }));
  return wrap;
}

/** "Add to roster" button: one name per line; skips names already there, restores members who left. */
export function addMembersFromBox() {
  const ta = $('#rosterAdd');
  const names = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!names.length) { toast('Type at least one name.'); return; }
  const d = data();
  const idx = nameIndex(d.members);
  const seen = new Set();
  const rank = $('#rosterAddRank').value;
  let added = 0, restored = 0, dup = 0;
  batch(() => {
    for (const name of names) {
      const k = norm(name);
      if (!k || seen.has(k)) { dup++; continue; }
      seen.add(k);
      if (idx.has(k)) {
        const m = d.members.get(idx.get(k));
        if (m && m.status === 'left') { updateMember(m.id, { status: 'active' }); restored++; } else dup++;
        continue;
      }
      addMember({ name, rank, since: thisWeekId() });
      added++;
    }
  });
  ta.value = '';
  const parts = [];
  if (added) parts.push(`Added ${added}`);
  if (restored) parts.push(`restored ${restored}`);
  if (dup) parts.push(`${dup} already on the roster`);
  toast(parts.join(' · ') || 'Nothing to add.');
}
