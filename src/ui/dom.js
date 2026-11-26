// Tiny DOM helpers. All user-provided strings go through esc() before entering innerHTML.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
