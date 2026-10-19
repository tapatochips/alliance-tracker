// Small building blocks shared by the views.
import { h } from '../lib/dom.js';

/** A stat tile: label, big value, small line under it. */
export function stat(label, value, sub, tone) {
  return h('div', { class: 'stat' + (tone ? ' ' + tone : '') },
    h('div', { class: 'k', text: label }),
    h('div', { class: 'v', text: value, title: value }),
    h('div', { class: 's', text: sub }));
}

/** A clickable column header that sorts by `key`. `content` replaces the plain label when given. */
export function sortHeader(label, key, sortState, onSort, content) {
  const active = sortState.key === key;
  const mark = active ? h('span', { class: 'sortmark', text: sortState.dir > 0 ? '▲' : '▼' }) : null;
  const inner = content || h('div', { class: 'th-k' }, label);
  if (mark) (inner.classList.contains('th-k') ? inner : inner.querySelector('.th-k')).append(mark);
  return h('button', { class: 'sortbtn', onclick: () => onSort(key) }, inner);
}

export const ariaSort = (sortState, key) =>
  sortState.key === key ? (sortState.dir > 0 ? 'ascending' : 'descending') : null;
