// src/utils/index.js
// Jednotné utilitky (HMR-safe).

// DOM helpers
export const qs  = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

// Timing
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const ridle = (cb) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 1200 }) : setTimeout(cb, 0));

// Text & dates
export const esc = (s = '') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export const pad2 = (n) => String(n).padStart(2,'0');
export const toLocalISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

// Cookies
export const getCookie = (name) => document.cookie.split('; ')
  .find(r => r.startsWith(name + '='))?.split('=')[1];

// HMR-safe jednorázové připnutí listeneru
(function ensureAjsee(){
  window.__ajsee = window.__ajsee || {};
  window.__ajsee.state = window.__ajsee.state || {};
  window.__ajsee.state._wiredMap = window.__ajsee.state._wiredMap || new WeakMap();
})();
const _wiredMap = window.__ajsee.state._wiredMap;

/** Připojí handler jen jednou na daný element+event. */
export function wireOnce(el, evt, handler, key='') {
  if (!el) return;
  const id = `${evt}:${key||''}`;
  let set = _wiredMap.get(el);
  if (!set) { set = new Set(); _wiredMap.set(el, set); }
  if (set.has(id)) return;
  set.add(id);
  el.addEventListener(evt, handler);
}
