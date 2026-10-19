// Backup files: save the whole tracker as JSON, and load one back (replace, or combine with what's here).
import { BACKUP_APP_ID, DAYS } from '../config.js';
import { serialize, deserialize, liveData, replaceAll, newId } from './store.js';
import { nameIndex, norm } from '../lib/names.js';
import { thisWeekId } from '../lib/dates.js';

export function backupText() {
  return JSON.stringify({ app: BACKUP_APP_ID, ...serialize(liveData()) });
}

export const backupFilename = () => `alliance-duel-backup-${thisWeekId()}.json`;

/** Parse backup text. Throws an Error with a person-readable message if it isn't a tracker backup. */
export function parseBackup(text) {
  let o;
  try { o = JSON.parse(String(text).trim()); } catch (e) {
    throw new Error('That isn’t a backup. Paste the whole backup text, starting with {');
  }
  if (!o || o.app !== BACKUP_APP_ID) throw new Error('That file isn’t an Alliance Duel Tracker backup.');
  return deserialize(o);
}

/**
 * Combine an incoming backup with the current data.
 * Members are matched by name (or old name), so two officers who built rosters separately still line up.
 * Incoming scores fill empty days; where both have a score, the current one is kept and counted as a conflict.
 */
export function mergeBackup(incoming) {
  const next = deserialize(serialize(liveData())); // deep copy of the saved tracker
  const idx = nameIndex(next.members);
  const idMap = new Map();
  let addedMembers = 0, filled = 0, conflicts = 0;

  for (const m of incoming.members.values()) {
    let id = next.members.has(m.id) && norm(next.members.get(m.id).name) === norm(m.name) ? m.id : null;
    if (!id) for (const n of [m.name, ...(m.aliases || [])]) { const hit = idx.get(norm(n)); if (hit) { id = hit; break; } }
    if (id) {
      const mine = next.members.get(id);
      const aliases = [...new Set([...(mine.aliases || []), ...(m.aliases || []), ...(norm(m.name) !== norm(mine.name) ? [m.name] : [])])];
      next.members.set(id, { ...mine, aliases, rank: mine.rank || m.rank,
        since: [mine.since, m.since].filter(Boolean).sort()[0] });
    } else {
      id = next.members.has(m.id) ? newId() : m.id;
      next.members.set(id, { ...m, id });
      for (const n of [m.name, ...(m.aliases || [])]) idx.set(norm(n), id);
      addedMembers++;
    }
    idMap.set(m.id, id);
  }

  for (const [wid, w] of incoming.weeks) {
    const mine = next.weeks.get(wid) || { scores: {} };
    const scores = { ...mine.scores };
    for (const [mid, s] of Object.entries(w.scores || {})) {
      const id = idMap.get(mid);
      if (!id) continue;
      const row = { ...(scores[id] || {}) };
      for (const day of DAYS) {
        const v = s[day.key];
        if (v == null) continue;
        if (row[day.key] == null) { row[day.key] = v; filled++; }
        else if (row[day.key] !== v) conflicts++;
      }
      scores[id] = row;
    }
    next.weeks.set(wid, { ...mine, scores, updatedAt: new Date().toISOString() });
  }

  if (!next.config.allianceName && incoming.config.allianceName) next.config.allianceName = incoming.config.allianceName;
  for (const day of DAYS) {
    if (next.config.minimums[day.key] == null && incoming.config.minimums[day.key] != null) {
      next.config.minimums[day.key] = incoming.config.minimums[day.key];
    }
  }
  if (next.config.weeklyMinimum == null && incoming.config.weeklyMinimum != null) {
    next.config.weeklyMinimum = incoming.config.weeklyMinimum;
  }

  replaceAll(next);
  return { addedMembers, filled, conflicts };
}

export function replaceWithBackup(incoming) {
  replaceAll(incoming);
  return { members: incoming.members.size, weeks: incoming.weeks.size };
}
