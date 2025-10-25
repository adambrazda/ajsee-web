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
async function fetchJSON(p){ try{ const r=await fetch(p,{cache:'no-store'}); if(r.ok) return await r.json(); }catch{} return null; }
export async function loadTranslations(lang){
  const base = (await fetchJSON(`/locales/${lang}.json`)) || (await fetchJSON(`/src/locales/${lang}.json`)) || {};
  const page = location.pathname.split('/').pop();
  const pagePart = page === 'about.html'
    ? (await fetchJSON(`/locales/${lang}/about.json`)) || (await fetchJSON(`/src/locales/${lang}/about.json`)) || {}
    : {};
  return deepMerge(base, pagePart);
}

function getByPath(o, p){ return p?.split('.').reduce((a,k)=>a?.[k], o); }

export function setCurrentLang(lang='cs'){
  const allowed = ['cs','en','de','sk','pl','hu'];
  _currentLang = allowed.includes((lang||'').toLowerCase()) ? lang.toLowerCase() : 'cs';
  document.documentElement.lang = _currentLang;
}
export function getCurrentLang(){ return _currentLang; }

export function t(key, fb){
  const tr = _translations || {};
  const v = getByPath(tr, key) ?? tr[key];
  if (v !== undefined) return v;

  // aliasy pro filtry
  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, ''); const alt = getByPath(tr, `filters.${tail}`);
    if (alt !== undefined) return alt;
  }
  if (key.startsWith('filters.')) {
    const flat = key.replace(/^filters\./,'filter-'); const alt = tr[flat];
    if (alt !== undefined) return alt;
  }
  if (key.startsWith('category-')) {
    const alt = getByPath(tr, `filters.${key.replace('category-','')}`); if (alt !== undefined) return alt;
  }
  return fb;
}

// UI helpers pro filtry
const toggleFallback = {
  cs:{show:'Zobrazit filtry',hide:'Skrýt filtry'},
  en:{show:'Show filters',hide:'Hide filters'},
  de:{show:'Filter anzeigen',hide:'Filter ausblenden'},
  sk:{show:'Zobraziť filtre',hide:'Skryť filtre'},
  pl:{show:'Pokaż filtry',hide:'Ukryj filtry'},
  hu:{show:'Szűrők megjelenítése',hide:'Szűrők elrejtése'}
};
export const toggleLabel = (mode)=> t(mode==='show'?'filters.show':'filters.hide',
  (toggleFallback[_currentLang]||toggleFallback.en)[mode]);

export function setBtnLabel(el, txt){
  if (!el) return;
  const n = el.querySelector('[data-i18n-label], .label, .btn-label');
  (n || el).textContent = txt;
}

export function updateFilterLocaleTexts(){
  // texty tlačítek a placeholderů
  const chipToday = document.querySelector('#chipToday');
  const chipWeekend = document.querySelector('#chipWeekend');
  const chipNear = document.querySelector('#chipNearMe');
  const nearBtn = document.querySelector('#filter-nearme');
  if (chipToday) chipToday.textContent = t('filters.today','Today');
  if (chipWeekend) chipWeekend.textContent = t('filters.weekend','This weekend');
  if (chipNear) chipNear.textContent = t('filters.nearMe','Near me');
  if (nearBtn) nearBtn.textContent = t('filters.nearMe','Near me');

  const city = document.querySelector('#filter-city') || document.querySelector('#events-city-filter');
  if (city) city.placeholder = t('filters.cityPlaceholder','Prague, Brno...');

  const kw = document.querySelector('#filter-keyword');
  if (kw) kw.placeholder = t('filters.keywordPlaceholder','Artist, venue, event…');

  const applyBtn = document.querySelector('#events-apply-filters') || document.querySelector('.filter-actions .btn.btn-primary');
  if (applyBtn) setBtnLabel(applyBtn, t('filters.apply','Apply filters'));

  const resetBtn = document.querySelector('#events-clear-filters') || document.querySelector('.filter-actions button[type="reset"]');
  if (resetBtn) setBtnLabel(resetBtn, t('filters.reset','Clear'));

  const tog = document.querySelector('#filtersToggle');
  if (tog) setBtnLabel(tog, tog.getAttribute('aria-pressed') === 'true' ? toggleLabel('show') : toggleLabel('hide'));
}

export async function applyTranslations(lang = _currentLang){
  _translations = await loadTranslations(lang);
  window.translations = _translations; // kompatibilita se staršími částmi

  document.querySelectorAll('[data-i18n-key]').forEach(el=>{
    const k = el.getAttribute('data-i18n-key');
    const v = t(k);
    if (v === undefined || String(v).trim() === '') return;
    if (/[<][a-z]/i.test(v)) el.innerHTML = v; else el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const k=el.getAttribute('data-i18n-placeholder'); const v=t(k);
    if (!v) return; el.setAttribute('placeholder', String(v));
  });

  updateFilterLocaleTexts();
}

// Bridge pro stránky, které volají window.applyTranslations
if (!window.applyTranslations) window.applyTranslations = applyTranslations;
