// The tracker's data and every change to it. Saved in the browser's localStorage on this device.
//
// Shape (also the backup file format):
//   config:  { allianceName, minimums: { d1..d6: number|null }, weeklyMinimum: number|null }
//   members: { <id>: { name, rank, status: 'active'|'left', aliases: [old names],
//                      since: 'YYYY-MM-DD' (Monday of first tracked week),
//                      sinceDay?: 1-6 (first Duel day tracked that week), addedAt } }
//   weeks:   { <Monday 'YYYY-MM-DD'>: { scores: { <memberId>: { d1..d6: number | 'ex' } }, updatedAt } }
//
// To share one tracker live between officers, replace load()/save() with calls to a hosted database
// (Firebase, Supabase, a Google Sheet script…). Everything else talks to this file only.

import { STORAGE_KEY } from '../config.js';
import { DAYS } from '../config.js';
import { norm } from '../lib/names.js';
import { makeSampleData } from './sample.js';

const listeners = new Set();
let live = emptyData();
let sample = null;
let usingSample = false;
let canSave = true;
let batchDepth = 0;
let dirty = false;

export function emptyData() {
  return { config: { allianceName: '', minimums: {} }, members: new Map(), weeks: new Map() };
}

/** Plain-object form for saving and backups. */
export function serialize(d = live) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    config: d.config,
    members: Object.fromEntries([...d.members].map(([id, m]) => { const { id: _drop, ...rest } = m; return [id, rest]; })),
    weeks: Object.fromEntries(d.weeks),
  };
}

/** Rebuild from a plain object, dropping anything malformed. */
export function deserialize(o) {
  const d = emptyData();
  if (!o || typeof o !== 'object') return d;
  const cfg = o.config && typeof o.config === 'object' ? o.config : {};
  d.config = {
    allianceName: typeof cfg.allianceName === 'string' ? cfg.allianceName.slice(0, 60) : '',
    minimums: {},
    weeklyMinimum: typeof cfg.weeklyMinimum === 'number' && cfg.weeklyMinimum > 0 ? cfg.weeklyMinimum : null,
  };
  for (const day of DAYS) {
    const v = cfg.minimums && cfg.minimums[day.key];
    d.config.minimums[day.key] = typeof v === 'number' && v > 0 ? v : null;
  }
  for (const [id, m] of Object.entries(o.members || {})) {
    if (!m || typeof m.name !== 'string' || !m.name.trim() || !/^[\w.~:@+-]{1,80}$/.test(id)) continue;
    d.members.set(id, {
      id,
      name: m.name.trim().slice(0, 40),
      rank: ['R1', 'R2', 'R3', 'R4', 'R5'].includes(m.rank) ? m.rank : '',
      status: m.status === 'left' ? 'left' : 'active',
      aliases: Array.isArray(m.aliases) ? m.aliases.filter((a) => typeof a === 'string').map((a) => a.slice(0, 40)) : [],
      since: typeof m.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.since) ? m.since : undefined,
      sinceDay: Number.isInteger(m.sinceDay) && m.sinceDay >= 1 && m.sinceDay <= 6 ? m.sinceDay : undefined,
      addedAt: typeof m.addedAt === 'string' ? m.addedAt : undefined,
    });
  }
  for (const [wid, w] of Object.entries(o.weeks || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wid) || !w || typeof w.scores !== 'object') continue;
    const scores = {};
    for (const [mid, s] of Object.entries(w.scores || {})) {
      if (!s || typeof s !== 'object') continue;
      const clean = {};
      for (const day of DAYS) {
        const v = s[day.key];
        if (v === 'ex' || (typeof v === 'number' && isFinite(v) && v >= 0)) clean[day.key] = v;
      }
      scores[mid] = clean;
    }
    d.weeks.set(wid, { scores, updatedAt: w.updatedAt });
  }
  return d;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) live = deserialize(JSON.parse(raw));
    canSave = true;
  } catch (e) {
    canSave = false;
  }
  // Keep two open tabs in step.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try { live = deserialize(JSON.parse(e.newValue)); emit(); } catch (err) { /* ignore */ }
  });
}

function save() {
  if (usingSample) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(live)));
    canSave = true;
  } catch (e) {
    canSave = false;
  }
}

function emit() { for (const fn of listeners) fn(); }

function commit() {
  if (batchDepth > 0) { dirty = true; return; }
  save();
  emit();
}

/** Run several changes and save once at the end. */
export function batch(fn) {
  batchDepth++;
  try { return fn(); } finally {
    batchDepth--;
    if (batchDepth === 0 && dirty) { dirty = false; save(); emit(); }
  }
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** The data on screen: the sample set while previewing, otherwise the saved tracker. */
export const data = () => (usingSample ? sample : live);
/** The saved tracker, even while the sample is on screen (used by backups). */
export const liveData = () => live;
export const isSample = () => usingSample;
export const savingWorks = () => canSave;

export function startSample() { sample = makeSampleData(); usingSample = true; emit(); }
export function stopSample() { usingSample = false; sample = null; emit(); }

export const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- changes ---------- */

/** Merge scores into a week: {memberId: {d3: 1234}}. A value of null clears that day; a member of null clears them all. */
export function setScores(weekId, patch) {
  const d = data();
  const w = d.weeks.get(weekId) || { scores: {} };
  const scores = { ...w.scores };
  for (const [id, p] of Object.entries(patch)) {
    if (p === null) { delete scores[id]; continue; }
    const cur = { ...(scores[id] || {}) };
    for (const [k, v] of Object.entries(p)) {
      if (v == null) delete cur[k]; else cur[k] = v;
    }
    scores[id] = cur;
  }
  d.weeks.set(weekId, { ...w, scores, updatedAt: new Date().toISOString() });
  commit();
}

export function addMember(fields) {
  const id = fields.id || newId();
  data().members.set(id, {
    id,
    name: fields.name.trim().slice(0, 40),
    rank: fields.rank || '',
    status: 'active',
    aliases: fields.aliases || [],
    since: fields.since,
    sinceDay: fields.sinceDay,
    addedAt: new Date().toISOString(),
  });
  commit();
  return id;
}

export function updateMember(id, patch) {
  const d = data();
  const m = d.members.get(id);
  if (!m) return;
  d.members.set(id, { ...m, ...patch });
  commit();
}

export function removeMember(id) {
  const d = data();
  d.members.delete(id);
  const updatedAt = new Date().toISOString();
  for (const [weekId, week] of d.weeks) {
    if (!week.scores || !Object.hasOwn(week.scores, id)) continue;
    const scores = { ...week.scores };
    delete scores[id];
    d.weeks.set(weekId, { ...week, scores, updatedAt });
  }
  commit();
}

/** Rename and keep the old name as an alias so screenshots with the old name still match. */
export function renameMember(id, newName) {
  const m = data().members.get(id);
  if (!m) return;
  const aliases = [...new Set([...(m.aliases || []), m.name])].filter((a) => norm(a) !== norm(newName));
  updateMember(id, { name: newName.trim().slice(0, 40), aliases });
}

/** Fold one member into another: scores move over where the target has none, names become aliases. */
export function mergeMember(fromId, toId) {
  const d = data();
  const from = d.members.get(fromId), to = d.members.get(toId);
  if (!from || !to) return;
  batch(() => {
    for (const [wid, w] of [...d.weeks]) {
      const s = w.scores && w.scores[fromId];
      if (!s) continue;
      const t = w.scores[toId] || {};
      const moved = {};
      for (const day of DAYS) if (s[day.key] != null && t[day.key] == null) moved[day.key] = s[day.key];
      const patch = { [fromId]: null };
      if (Object.keys(moved).length) patch[toId] = moved;
      setScores(wid, patch);
    }
    const aliases = [...new Set([...(to.aliases || []), from.name, ...(from.aliases || [])])].filter((a) => norm(a) !== norm(to.name));
    updateMember(toId, { aliases, status: 'active' });
    removeMember(fromId);
  });
}

export function setConfig(cfg) {
  const d = data();
  d.config = { ...d.config, ...cfg };
  commit();
}

/** Swap in a whole data set (used by backup import). */
export function replaceAll(next) {
  if (usingSample) stopSample();
  live = next;
  commit();
}
