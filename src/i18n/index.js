// src/i18n/index.js
// i18n bridge + DOM aplikace textů + podpůrné funkce pro filtry.

let _currentLang = 'cs';
let _translations = {};

function deepMerge(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v))
      ? deepMerge(out[k] || {}, v)
      : v;
  }
  return out;
}

async function fetchJSON(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (response.ok) return await response.json();
  } catch {}
  return null;
}

export async function loadTranslations(lang) {
  const base =
    (await fetchJSON(`/locales/${lang}.json`)) ||
    (await fetchJSON(`/src/locales/${lang}.json`)) ||
    {};

  const rawPage = location.pathname.split('/').pop() || '';
  const pageName = rawPage.replace(/\.html$/i, '');

  const pagePart = pageName
    ? (await fetchJSON(`/locales/${lang}/${pageName}.json`)) ||
      (await fetchJSON(`/src/locales/${lang}/${pageName}.json`)) ||
      {}
    : {};

  return deepMerge(base, pagePart);
}

function getByPath(obj, path) {
  return path?.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function setCurrentLang(lang = 'cs') {
  const allowed = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
  _currentLang = allowed.includes((lang || '').toLowerCase())
    ? lang.toLowerCase()
    : 'cs';

  document.documentElement.lang = _currentLang;
}

export function getCurrentLang() {
  return _currentLang;
}

export function detectLang(fallback = 'cs') {
  try {
    const url = new URL(window.location.href);
    const fromUrl = (url.searchParams.get('lang') || '').toLowerCase();
    if (['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(fromUrl)) {
      return fromUrl;
    }
  } catch {}

  const fromHtml = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  if (['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(fromHtml)) {
    return fromHtml;
  }

  return fallback;
}

export function t(key, fallback) {
  const tr = _translations || {};
  const value = getByPath(tr, key) ?? tr[key];

  if (value !== undefined) return value;

  // aliasy pro filtry
  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, '');
    const alt = getByPath(tr, `filters.${tail}`);
    if (alt !== undefined) return alt;
  }

  if (key.startsWith('filters.')) {
    const flat = key.replace(/^filters\./, 'filter-');
    const alt = tr[flat];
    if (alt !== undefined) return alt;
  }

  if (key.startsWith('category-')) {
    const alt = getByPath(tr, `filters.${key.replace('category-', '')}`);
    if (alt !== undefined) return alt;
  }

  return fallback;
}

// UI helpers pro filtry
const toggleFallback = {
  cs: { show: 'Zobrazit filtry', hide: 'Skrýt filtry' },
  en: { show: 'Show filters', hide: 'Hide filters' },
  de: { show: 'Filter anzeigen', hide: 'Filter ausblenden' },
  sk: { show: 'Zobraziť filtre', hide: 'Skryť filtre' },
  pl: { show: 'Pokaż filtry', hide: 'Ukryj filtry' },
  hu: { show: 'Szűrők megjelenítése', hide: 'Szűrők elrejtése' }
};

export const toggleLabel = (mode) =>
  t(
    mode === 'show' ? 'filters.show' : 'filters.hide',
    (toggleFallback[_currentLang] || toggleFallback.en)[mode]
  );

export function setBtnLabel(el, txt) {
  if (!el) return;
  const node = el.querySelector('[data-i18n-label], .label, .btn-label');
  (node || el).textContent = txt;
}

export function updateFilterLocaleTexts() {
  const chipToday = document.querySelector('#chipToday');
  const chipWeekend = document.querySelector('#chipWeekend');
  const chipNear = document.querySelector('#chipNearMe');
  const nearBtn = document.querySelector('#filter-nearme');

  if (chipToday) chipToday.textContent = t('filters.today', 'Today');
  if (chipWeekend) chipWeekend.textContent = t('filters.weekend', 'This weekend');
  if (chipNear) chipNear.textContent = t('filters.nearMe', 'Near me');
  if (nearBtn) nearBtn.textContent = t('filters.nearMe', 'Near me');

  const city = document.querySelector('#filter-city') || document.querySelector('#events-city-filter');
  if (city) city.placeholder = t('filters.cityPlaceholder', 'Prague, Brno...');

  const kw = document.querySelector('#filter-keyword');
  if (kw) kw.placeholder = t('filters.keywordPlaceholder', 'Artist, venue, event…');

  const applyBtn =
    document.querySelector('#events-apply-filters') ||
    document.querySelector('.filter-actions .btn.btn-primary');
  if (applyBtn) setBtnLabel(applyBtn, t('filters.apply', 'Apply filters'));

  const resetBtn =
    document.querySelector('#events-clear-filters') ||
    document.querySelector('.filter-actions button[type="reset"]');
  if (resetBtn) setBtnLabel(resetBtn, t('filters.reset', 'Clear'));

  const toggleBtn = document.querySelector('#filtersToggle');
  if (toggleBtn) {
    setBtnLabel(
      toggleBtn,
      toggleBtn.getAttribute('aria-pressed') === 'true'
        ? toggleLabel('show')
        : toggleLabel('hide')
    );
  }
}

export async function applyTranslations(lang = _currentLang) {
  setCurrentLang(lang);
  _translations = await loadTranslations(_currentLang);
  window.translations = _translations; // kompatibilita se staršími částmi

  document.querySelectorAll('[data-i18n-key]').forEach((el) => {
    const key = el.getAttribute('data-i18n-key');
    const value = t(key);

    if (value === undefined || String(value).trim() === '') return;

    if (/[<][a-z]/i.test(value)) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });

  document.querySelectorAll('[data-i18n-content]').forEach((el) => {
    const key = el.getAttribute('data-i18n-content');
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return;
    el.setAttribute('content', String(value));
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return;
    el.setAttribute('placeholder', String(value));
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return;
    el.setAttribute('aria-label', String(value));
    el.setAttribute('title', String(value));
  });

  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const key = el.getAttribute('data-i18n-alt');
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return;
    el.setAttribute('alt', String(value));
  });

  updateFilterLocaleTexts();

  window.dispatchEvent(
    new CustomEvent('ajsee:i18n-applied', {
      detail: { lang: _currentLang }
    })
  );

  window.dispatchEvent(
    new CustomEvent('ajsee:lang-changed', {
      detail: { lang: _currentLang }
    })
  );
}

// Bridge pro stránky, které volají window.applyTranslations
if (!window.applyTranslations) {
  window.applyTranslations = applyTranslations;
}