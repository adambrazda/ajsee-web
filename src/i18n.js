// /src/i18n.js
// Modul i18n pro statické stránky (about.html, thank-you, apod.)
// Exportuje: translations (živý objekt), applyTranslations, t, detectLang.

export const translations = {}; // živý objekt – neměň referenci

/* ───────── utils ───────── */
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
function getPageKey() {
  // preferuj <body data-page="...">, jinak z názvu souboru
  const dp = document.body?.dataset?.page;
  if (dp && typeof dp === 'string') return dp.toLowerCase();
  const fn = (location.pathname.split('/').pop() || '').toLowerCase();
  const base = fn.replace(/\.[^.]+$/, '') || 'index';
  return base === 'index' ? 'home' : base;
}

/* ───────── veřejné API ───────── */
export function detectLang() {
  const urlLang = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
  const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const supported = ['cs','en','de','sk','pl','hu'];
  const pick = urlLang || htmlLang || 'cs';
  return supported.includes(pick) ? pick : 'cs';
}

function getByPath(o, p) {
  return p?.split('.').reduce((a, k) => a?.[k], o);
}

export function t(key, fb) {
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

async function loadTranslations(lang) {
  const pageKey = getPageKey();

  const baseCandidates = [
    `/locales/${lang}.json`,
    `/src/locales/${lang}.json`,
  ];
  const pageCandidates = [
    `/locales/${lang}/${pageKey}.json`,
    `/src/locales/${lang}/${pageKey}.json`,
    `/locales/${lang}-${pageKey}.json`,
    `/src/locales/${lang}-${pageKey}.json`,
    `/locales/${pageKey}.${lang}.json`,
    `/src/locales/${pageKey}.${lang}.json`,
    `/locales/${pageKey}-${lang}.json`,
    `/src/locales/${pageKey}-${lang}.json`,
  ];

  const firstOk = async (arr) => {
    for (const p of arr) {
      const j = await fetchJSON(p);
      if (j && Object.keys(j).length) return j;
    }
    return {};
  };

  const base = await firstOk(baseCandidates);
  const page = await firstOk(pageCandidates);
  return deepMerge(base, page);
}

export async function applyTranslations(lang = detectLang()) {
  // 1) načti překlady a MUTUJ živý objekt
  const data = await loadTranslations(lang);
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

  // 3) pokud je v globálu UI helper z main.js, nech ho přepsat popisky filtrů
  try {
    if (typeof window.updateFilterLocaleTexts === 'function') {
      window.updateFilterLocaleTexts();
    }
    if (typeof window.updateDateComboLabel === 'function') {
      window.updateDateComboLabel();
    }
  } catch {}
}

// zpřístupni i do window (pro in-page skripty)
if (!window.applyTranslations) window.applyTranslations = applyTranslations;
if (!window.translations) window.translations = translations;
