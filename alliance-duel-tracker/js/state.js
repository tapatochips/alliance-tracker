// What's on screen right now (not saved): selected week and tab, sorting, filters, edits in progress.
import { thisWeekId } from './lib/dates.js';

export const ui = {
  weekId: thisWeekId(),
  tab: 'week', // week | history | roster
  sort: { key: 'total', dir: -1 },
  historySort: { key: 'flags', dir: -1 },
  filter: 'all', // all | flag
  query: '',
  editing: null, // set while a score cell or roster name is being edited, so re-renders wait
  lastOrder: [], // member ids in the order the grid last showed them (for Enter/Tab navigation)
  rosterConfirm: null, // {type: 'merge'|'delete', from, to?}
};

let renderer = () => {};
let pending = false;
let frame = 0;

export function setRenderer(fn) { renderer = fn; }

/** Ask for a redraw. Waits while someone is typing in a cell, and batches several requests into one frame. */
export function requestRender() {
  if (ui.editing) { pending = true; return; }
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderNow(); });
}

export function renderNow() {
  if (ui.editing) { pending = true; return; }
  pending = false;
  renderer();
}

/** Call when an edit finishes, to catch up on anything that changed meanwhile. */
export function flushRender() {
  if (pending) requestRender();
}
