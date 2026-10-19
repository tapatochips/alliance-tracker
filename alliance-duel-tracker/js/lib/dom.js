// Small DOM helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Create an element: h('td', {class: 'x', text: 'hi', onclick: fn}, ...children).
 * Text always goes in as text (never HTML), so player names can't inject markup.
 */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (typeof v === 'boolean' || k === 'value') el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}

let toastTimer = 0;
/** Show a short message at the bottom of the screen. */
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
}

/** Copy text to the clipboard; falls back to selecting a textarea so the person can copy it themselves. */
export async function copyText(text, fallbackTextarea) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    if (fallbackTextarea) { fallbackTextarea.focus(); fallbackTextarea.select(); }
    return false;
  }
}
