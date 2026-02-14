// /src/i18n.js
// Modul i18n pro statické stránky (about.html, thank-you, apod.)
// Exportuje: translations (živý objekt), applyTranslations, t, detectLang.

export const translations = {}; // živý objekt – neměň referenci

const SUPPORTED = ['cs','en','de','sk','pl','hu'];
const LANG_KEY = 'ajsee.lang';

/**
 * Vite loader pro JSON v /src/locales (např. "./locales/cs/accommodation.json")
 * Klíče: "./locales/cs/accommodation.json" atd.
 */
const LOCALE_LOADERS = import.meta.glob('./locales/**/*.json', { import: 'default' });

// ✅ Fetch fallback je defaultně vypnutý (aby nevznikaly 404 v dev/prod).
// Zapni ho jen pokud máš JSONy v /public/locales a chceš fetchovat:
// window.__AJSEE_I18N_FETCH__ = true;
const ALLOW_FETCH_FALLBACK =
  typeof window !== 'undefined' && window.__AJSEE_I18N_FETCH__ === true;

/* ───────── utils ───────── */
function normalizeLang(x) {
  const v = String(x || '').trim().toLowerCase();
  return SUPPORTED.includes(v) ? v : null;
}

function deepMerge(a = {}, b = {}) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    o[k] = v && typeof v === 'object' && !Array.isArray(v)
      ? deepMerge(o[k] || {}, v)
      : v;
  }
  return o;
}

async function fetchJSON(p) {
  try {
    const r = await fetch(p, { cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

async function importJSON(importPath) {
  const loader = LOCALE_LOADERS[importPath];
  if (!loader) return null;
  try {
    const data = await loader();
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function getPageKey() {
  // preferuj <body data-page="...">, jinak z názvu souboru
  const dp = document.body?.dataset?.page;
  if (dp && typeof dp === 'string') return dp.toLowerCase();

  const fn = (location.pathname.split('/').pop() || '').toLowerCase();
  const base = fn.replace(/\.[^.]+$/, '') || 'index';
  return base === 'index' ? 'home' : base;
}

function getStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(LANG_KEY));
  } catch {
    return null;
  }
}

function persistLang(lang) {
  const l = normalizeLang(lang) || 'cs';
  try { localStorage.setItem(LANG_KEY, l); } catch {}
  try { document.documentElement.setAttribute('lang', l); } catch {}

  // sync URL (bez reloadu) – cs = čistá URL bez parametru
  try {
    const url = new URL(window.location.href);
    if (l === 'cs') url.searchParams.delete('lang');
    else url.searchParams.set('lang', l);

    if (url.toString() !== window.location.href) {
      history.replaceState({}, '', url.toString());
    }
  } catch {}

  // event pro ostatní části UI (nav linky apod.)
  try {
    window.dispatchEvent(new CustomEvent('ajsee:lang-changed', { detail: { lang: l } }));
  } catch {}
}

function isNavLinkCandidate(urlObj) {
  const p = (urlObj.pathname || '').toLowerCase();
  if (p === '/' || p.endsWith('.html')) return true;
  if (!p.includes('.')) return true;
  return false;
}

export function patchInternalLinksWithLang(lang) {
  const l = normalizeLang(lang) || 'cs';

  document.querySelectorAll('a[href]').forEach(a => {
    const raw = a.getAttribute('href');
    if (!raw) return;

    if (raw.startsWith('#')) return;
    if (/^(mailto:|tel:|javascript:)/i.test(raw)) return;
    if (/^https?:\/\//i.test(raw)) return;

    let u;
    try { u = new URL(raw, window.location.origin); } catch { return; }
    if (u.origin !== window.location.origin) return;
    if (!isNavLinkCandidate(u)) return;

    if (l === 'cs') u.searchParams.delete('lang');
    else u.searchParams.set('lang', l);

    const next =
      u.pathname +
      (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') +
      (u.hash || '');
    a.setAttribute('href', next);
  });
}

/* ───────── veřejné API ───────── */
export function detectLang() {
  const urlLang = normalizeLang(new URLSearchParams(location.search).get('lang'));
  const stored = getStoredLang();
  const htmlLang = normalizeLang(document.documentElement.getAttribute('lang'));

  // pořadí: URL -> storage -> <html lang> -> cs
  return urlLang || stored || htmlLang || 'cs';
}

function getByPath(o, p) {
  return p?.split('.').reduce((a, k) => a?.[k], o);
}

export function t(key, fb) {
  if (!key) return fb;

  // podpora aliasů ve formátu "a|b|c"
  if (typeof key === 'string' && key.includes('|')) {
    const parts = key.split('|').map(s => s.trim()).filter(Boolean);
    for (const k of parts) {
      const v = t(k);
      if (v !== undefined) return v;
    }
    return fb;
  }

  const v = getByPath(translations, key) ?? translations[key];
  if (v !== undefined) return v;

  // aliasy pro filtry (kompat s main.js)
  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, '');
    const alt = getByPath(translations, `filters.${tail}`);
    if (alt !== undefined) return alt;
  }
  if (key.startsWith('filters.')) {
    const flat = key.replace(/^filters\./, 'filter-');
    const alt = translations[flat];
    if (alt !== undefined) return alt;
  }
  if (key.startsWith('category-')) {
    const alt = getByPath(translations, `filters.${key.replace('category-', '')}`);
    if (alt !== undefined) return alt;
  }
  return fb;
}

async function mergeAllImports(paths) {
  let out = {};
  for (const p of paths) {
    const j = await importJSON(p);
    if (j && Object.keys(j).length) out = deepMerge(out, j);
  }
  return out;
}

async function mergeAllFetch(paths) {
  let out = {};
  for (const p of paths) {
    const j = await fetchJSON(p);
    if (j && Object.keys(j).length) out = deepMerge(out, j);
  }
  return out;
}

async function loadTranslations(lang) {
  const pageKey = getPageKey();

  // import candidates (src/locales)
  const baseImportCandidates = [
    `./locales/${lang}.json`,
    `./locales/${lang}/common.json`,
    `./locales/${lang}/base.json`,
  ];

  const pageImportCandidates = [
    `./locales/${lang}/${pageKey}.json`,
    `./locales/${lang}-${pageKey}.json`,
    `./locales/${pageKey}.${lang}.json`,
    `./locales/${pageKey}-${lang}.json`,
  ];

  // fetch fallback candidates (pouze /public/locales)
  const baseFetchCandidates = [
    `/locales/${lang}.json`,
    `/locales/${lang}/common.json`,
    `/locales/${lang}/base.json`,
  ];

  const pageFetchCandidates = [
    `/locales/${lang}/${pageKey}.json`,
    `/locales/${lang}-${pageKey}.json`,
    `/locales/${pageKey}.${lang}.json`,
    `/locales/${pageKey}-${lang}.json`,
  ];

  // 1) primárně import (Vite build)
  let base = await mergeAllImports(baseImportCandidates);
  let page = await mergeAllImports(pageImportCandidates);

  // 2) fallback fetch jen když explicitně povolíš a import nic nenašel
  if (ALLOW_FETCH_FALLBACK && (!Object.keys(base).length || !Object.keys(page).length)) {
    if (!Object.keys(base).length) base = deepMerge(base, await mergeAllFetch(baseFetchCandidates));
    if (!Object.keys(page).length) page = deepMerge(page, await mergeAllFetch(pageFetchCandidates));
  }

  return deepMerge(base, page);
}

export async function applyTranslations(lang = detectLang()) {
  const l = normalizeLang(lang) || 'cs';

  // 0) persist + sync URL
  persistLang(l);

  // 1) načti překlady a MUTUJ živý objekt
  const data = await loadTranslations(l);
  for (const k of Object.keys(translations)) delete translations[k];
  Object.assign(translations, data || {});

  // 2) přepiš texty v DOM
  document.querySelectorAll('[data-i18n-key]').forEach((el) => {
    const k = el.getAttribute('data-i18n-key');
    const v = t(k);
    if (v === undefined || String(v).trim() === '') return;
    if (/[<][a-z]/i.test(v)) el.innerHTML = v;
    else el.textContent = v;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const k = el.getAttribute('data-i18n-placeholder');
    const v = t(k);
    if (!v) return;
    el.setAttribute('placeholder', String(v));
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const k = el.getAttribute('data-i18n-aria');
    const v = t(k);
    if (typeof v === 'string' && v.trim()) {
      el.setAttribute('aria-label', v);
      el.setAttribute('title', v);
    }
  });

  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const k = el.getAttribute('data-i18n-alt');
    const v = t(k);
    if (!v) return;
    el.setAttribute('alt', String(v));
  });

  // meta/og content překlady (content="...")
  document.querySelectorAll('[data-i18n-content]').forEach((el) => {
    const k = el.getAttribute('data-i18n-content');
    const v = t(k);
    if (v === undefined || String(v).trim() === '') return;
    el.setAttribute('content', String(v));
  });

  // 2b) oprav interní odkazy -> přenese lang dál
  try { patchInternalLinksWithLang(l); } catch {}

  // 3) globální UI helpery
  try {
    if (typeof window.updateFilterLocaleTexts === 'function') window.updateFilterLocaleTexts();
    if (typeof window.updateDateComboLabel === 'function') window.updateDateComboLabel();
  } catch {}
}

// zpřístupni i do window (pro in-page skripty)
if (!window.applyTranslations) window.applyTranslations = applyTranslations;
if (!window.translations) window.translations = translations;
