// Draws whatever tab is open. Called through state.requestRender() whenever data or the view changes.
import { ui } from '../state.js';
import { data } from '../data/store.js';
import { renderHeader } from './header.js';
import { renderWeek } from './week-view.js';
import { renderHistory } from './history-view.js';
import { renderRoster } from './roster-view.js';

export function render() {
  const d = data();
  renderHeader(d);
  if (ui.tab === 'week') renderWeek(d);
  else if (ui.tab === 'history') renderHistory(d);
  else renderRoster(d);
}
