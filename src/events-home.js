// /src/events-home.js
// Jednotný front-end pro výpis událostí a filtry (homepage i events page)

// POZOR: date-combo.js už nenačítáme staticky! (viz loadDateCombo() níže)
// import './filters/date-combo.js';

import { fetchEvents } from './api/eventsApi.js';
import { canonForInputCity, guessCountryCodeFromCity } from './city/canonical.js';
import { setupCityTypeahead } from './city/typeahead.js';
import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';
import { attachNearMeButton } from './filters/near-me.js';
import { renderFilterChips as renderActiveChipsMod } from './filters/active-chips.js';

/* ───────────────────── global guards / helpers ───────────────────── */
(function ensureGlobals(){
  window.__ajsee = window.__ajsee || {};
  var g = window.__ajsee;
  g.flags = g.flags || {};
  g.once  = g.once  || new Set();
  g.locks = g.locks || {};
  g.state = g.state || {};
  if (!g.bus) {
    g.bus = function(type){
      return function(detail){
        try { window.dispatchEvent(new CustomEvent(type, { detail: detail })); } catch (e) {}
      };
    };
  }
})();
const G = window.__ajsee;
const SKIP_CORE_EVENTS = !!window.__AJSEE_SKIP_CORE_EVENTS;

G.state._wiredMap = G.state._wiredMap || new WeakMap();
const _wiredMap = G.state._wiredMap;
function wireOnce(el, evt, handler, key){
  if (!el) return;
  const id = String(evt) + ':' + String(key || '');
  let set = _wiredMap.get(el);
  if (!set) { set = new Set(); _wiredMap.set(el, set); }
  if (set.has(id)) return;
  set.add(id);
  el.addEventListener(evt, handler);
}

if (G.flags.eventsHomeInitialized) {
  console.info('[events-home] module reloaded — functions replaced, init will be skipped.');
} else {
  G.flags.eventsHomeInitialized = true;
}

/* ───────────────────────── jazyk & i18n ───────────────────────── */
function getLang() {
  const qs = new URLSearchParams(location.search);
  return (qs.get('lang') || document.documentElement.lang || 'cs').toLowerCase();
}
function resolveLocale(l) {
  const m = { cs:'cs-CZ', sk:'sk-SK', en:'en-GB', de:'de-DE', pl:'pl-PL', hu:'hu-HU' };
  return m[(l || 'en').slice(0,2)] || 'en-GB';
}
function mapLangToTm(l) {
  const m = { cs:'cs-cz', sk:'sk-sk', pl:'pl-pl', de:'de-de', hu:'hu-hu', en:'en-gb' };
  return m[(l || 'en').slice(0,2)] || 'en-gb';
}
function t(path, fallback){
  try {
    const root = (window.translations && (window.translations[LANG] || window.translations)) || null;
    if (!root) return fallback || '';
    const parts = String(path).split('.');
    let cur = root;
    for (let i=0;i<parts.length;i++){ cur = cur ? cur[parts[i]] : undefined; }
    return (typeof cur === 'string' && cur.trim()) ? cur : (fallback || '');
  } catch (e) { return fallback || ''; }
}
function applyTranslationsMaybe() {
  const lng = LANG;
  if (typeof window.applyTranslations === 'function') {
    try { window.applyTranslations(lng); } catch (e) {}
  }
  updateFilterLocaleTexts();
  refreshDatesComboLabel();
  try { window.dispatchEvent(new Event('AJSEE:langChanged')); } catch(e){}
}
function lf(map, enDef){ const k=(LANG||'en').slice(0,2); return map[k] || enDef; }

async function setLang(l) {
  const next = new URL(location.href);
  if (l) next.searchParams.set('lang', l); else next.searchParams.delete('lang');
  history.replaceState(null, '', next);
  document.documentElement.setAttribute('lang', l || 'cs');
  try { localStorage.setItem('site_lang', l); } catch (e) {}

  LANG = getLang();
  LOCALE = resolveLocale(LANG);
  applyTranslationsMaybe();

  const f = getFormFilters(form);
  if (SKIP_CORE_EVENTS) { emitFiltersChange(f, LANG); renderActiveChips(); }
  else { fetchAndRender(f); }
}
function initLangFromStorage() {
  let triggered = false;
  const qs = new URLSearchParams(location.search);
  if (!qs.get('lang')) {
    try {
      const saved = localStorage.getItem('site_lang');
      if (saved) { setLang(saved); triggered = true; }
    } catch (e) {}
  } else {
    document.documentElement.setAttribute('lang', qs.get('lang'));
    try { localStorage.setItem('site_lang', qs.get('lang')); } catch (e) {}
  }
  return triggered;
}
let LANG = getLang();
let LOCALE = resolveLocale(LANG);

/* ───────────── toggle „Skrýt/Zobrazit filtry“ ───────────── */
let filtersCollapsed = false;
function collapseFilters() {
  const dock = document.querySelector('form.filter-dock') || document.querySelector('.events-filters');
  if (!dock) return;
  filtersCollapsed = true;
  dock.classList.add('is-collapsed');
  updateFilterLocaleTexts();
}
function expandFilters() {
  const dock = document.querySelector('form.filter-dock') || document.querySelector('.events-filters');
  if (!dock) return;
  filtersCollapsed = false;
  dock.classList.remove('is-collapsed');
  updateFilterLocaleTexts();
}
function toggleFilters(){ if (filtersCollapsed) expandFilters(); else collapseFilters(); }

/* ───────────────────────── DOM prvky ───────────────────────── */
const list = document.getElementById('eventsList');
const form = document.getElementById('events-filters-form');
const cityInput = form ? form.querySelector('#filter-city') : null;
const RENDER_ENABLED = !!list && !SKIP_CORE_EVENTS;

function injectOnce(id, css){
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id=id; s.textContent = css; document.head.appendChild(s);
}

/* sjednocené výšky + kompaktní šířky (bez přesunu DOM) */
function activateCompactFilterSizing(){
  const dock = document.querySelector('form.filter-dock') || document.querySelector('.events-filters');
  if (!dock) return;
  dock.classList.add('dates-compact-mode');

  injectOnce('events-home-filters-layout-2025', `
    :root{ --ctrl-h:56px; --ctrl-radius:14px; }
    :where(.events-filters.filter-dock, form.filter-dock) .styled-input,
    :where(.events-filters.filter-dock, form.filter-dock) .styled-select{
      height:var(--ctrl-h); line-height:var(--ctrl-h); border-radius:var(--ctrl-radius);
    }
    :where(.events-filters.filter-dock, form.filter-dock) .segmented{ min-height:var(--ctrl-h); align-items:center; }
    :where(.events-filters.filter-dock, form.filter-dock) .segmented button{ min-height:calc(var(--ctrl-h) - 8px); }
    :where(.events-filters.filter-dock, form.filter-dock) .filters-toolbar .chip{ min-height:44px; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-keyword,
    :where(.events-filters.filter-dock, form.filter-dock) #filter-keyword{ max-width:min(680px, 100%); }
  `);
}

/* Normalizace vzhledu + doplnění for na labely */
function normalizeFilterFormUI(){
  const cat = document.querySelector('#filter-category') || document.querySelector('#events-category-filter');
  if (cat && !cat.classList.contains('styled-select')) cat.classList.add('styled-select');

  [
    '#filter-city','#events-city-filter',
    '#filter-date-from','#events-date-from',
    '#filter-date-to','#events-date-to',
    '#filter-keyword'
  ].forEach(sel=>{
    const el = document.querySelector(sel);
    if (el && !el.classList.contains('styled-input')) el.classList.add('styled-input');
  });

  const pairs = [
    ['filter-city','#filter-city,#events-city-filter'],
    ['filter-date-from','#filter-date-from,#events-date-from'],
    ['filter-date-to','#filter-date-to,#events-date-to'],
    ['filter-keyword','#filter-keyword']
  ];
  pairs.forEach(([forId, selector])=>{
    const input = document.querySelector(selector);
    if (!input) return;
    const group = input.closest('.filter-group') || input.parentElement;
    const label = group ? group.querySelector('label') : null;
    if (label && !label.getAttribute('for')) label.setAttribute('for', input.id || forId);
  });
}

/* Čištění duplicitních inline ikonek */
function stripDuplicateFieldIcons(){
  const dock = document.querySelector('form.filter-dock') || document.querySelector('.events-filters');
  if (!dock || dock.dataset.iconsCleaned === '1') return;
  dock.querySelectorAll(
    'label + .icon, label + .ico, label + .fi, label + svg, label + i,' +
    '.filter-group > .icon, .filter-group > .ico, .filter-group > .fi, .filter-group > svg, .filter-group > i'
  ).forEach(el => { try { el.remove(); } catch(e) { el.style.display = 'none'; } });
  dock.dataset.iconsCleaned = '1';
}

/* ─────────────── DATE COMBO „kotva“ + lazy import ─────────────── */
let _dateComboLoaded = false;
async function loadDateCombo(){
  if (_dateComboLoaded) return;
  _dateComboLoaded = true;
  try {
    const mod = await import('./filters/date-combo.js');
    if (mod && typeof mod.initDateCombo === 'function') {
      try {
        mod.initDateCombo({
          buttonSelector: '#date-combo-button',
          fromSelector: '#filter-date-from,#events-date-from',
          toSelector:   '#filter-date-to,#events-date-to'
        });
        const btn = document.getElementById('date-combo-button');
        if (btn) btn.setAttribute('data-date-combo', '1');
      } catch(e) { /* no-op */ }
    }
  } catch(e){
    console.error('[events-home] date-combo load failed:', e);
  }
}

function ensureDateComboAnchor(){
  const from = document.querySelector('#filter-date-from') || document.querySelector('#events-date-from');
  const to   = document.querySelector('#filter-date-to')   || document.querySelector('#events-date-to');
  const formEl = document.querySelector('form.filter-dock') || document.querySelector('.events-filters') || document;
  if (!formEl) return;

  if (formEl.querySelector('.date-combo')) { refreshDatesComboLabel(); return; }
  if (!from && !to) { return; }

  // vizuálně skryjeme, nikoli display:none (aby fungoval showPicker())
  [from, to].forEach(inp=>{
    if (!inp) return;
    const g = inp.closest('.filter-group');
    if (g) {
      g.classList.add('is-hidden');
      g.setAttribute('aria-hidden','true');
      g.style.display = 'block';
      g.style.position = 'absolute';
      g.style.width = '1px';
      g.style.height = '1px';
      g.style.overflow = 'hidden';
      g.style.clipPath = 'inset(50%)';
      g.style.whiteSpace = 'nowrap';
      g.style.border = 0;
      g.style.padding = 0;
      g.style.margin = 0;
    }
  });

  const mountAfter = (document.querySelector('#filter-city')||document.querySelector('#events-city-filter'))?.closest('.filter-group') || null;

  const wrap = document.createElement('div');
  wrap.className = 'filter-group date-combo';
  wrap.style.position = 'relative';

  const lbl = document.createElement('label');
  lbl.setAttribute('for','date-combo-button');
  lbl.textContent = t('filters.date','Datum');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'date-combo-button';
  btn.className = 'styled-select combo-button';
  btn.setAttribute('aria-expanded','false');

  const span = document.createElement('span');
  span.className = 'combo-text';
  span.textContent = t('filters.allDates','Všechny termíny');

  const caret = document.createElement('span');
  caret.className = 'select-caret';
  caret.setAttribute('aria-hidden','true');

  btn.appendChild(span);
  btn.appendChild(caret);

  const pop = document.createElement('div');
  pop.className = 'combo-popover';
  pop.hidden = true;

  wrap.appendChild(lbl);
  wrap.appendChild(btn);
  wrap.appendChild(pop);

  if (mountAfter && mountAfter.parentElement) {
    mountAfter.parentElement.insertBefore(wrap, mountAfter.nextElementSibling);
  } else {
    const fs = document.querySelector('.filters-fieldset') || formEl;
    fs.appendChild(wrap);
  }

  // Fallback: pokud se modul nenahraje / není aktivní, otevři nativní date pickery
  wireOnce(btn, 'click', () => {
    if (btn.getAttribute('data-date-combo') === '1') return;
    const fromEl = document.querySelector('#filter-date-from') || document.querySelector('#events-date-from');
    const toEl   = document.querySelector('#filter-date-to')   || document.querySelector('#events-date-to');

    const open = (el) => {
      if (!el) return;
      if (typeof el.showPicker === 'function') el.showPicker();
      else { el.focus(); el.click(); }
    };

    if (fromEl && !fromEl.value) {
      open(fromEl);
      const once = () => { refreshDatesComboLabel(); open(toEl); fromEl.removeEventListener('change', once); };
      fromEl.addEventListener('change', once);
    } else {
      open(toEl || fromEl);
    }
  }, 'datecombo-fallback');

  refreshDatesComboLabel();
}

/* ───────────────── helpers: URL <-> filtry ───────────────── */
function mapSegmentToCategory(v) {
  const m = {
    concert:'concert', concerts:'concert', music:'concert',
    sport:'sport', sports:'sport',
    theatre:'theatre', theater:'theatre', arts:'theatre',
    festival:'festival', festivals:'festival',
    comedy:'comedy', family:'family'
  };
  return m[(v || '').toLowerCase()] || '';
}
function getFiltersFromQuery() {
  const qs = new URLSearchParams(location.search);
  const f = {};
  const city = (qs.get('city') || '').trim();
  const seg  = qs.get('segment') || qs.get('category');
  const sort = qs.get('sort');
  const kw   = qs.get('keyword') || qs.get('q');
  const df   = qs.get('dateFrom') || qs.get('from');
  const dt   = qs.get('dateTo')   || qs.get('to');
  const cc   = (qs.get('country') || qs.get('cc') || '').toUpperCase();
  const rad  = qs.get('radius');

  if (city) f.city = city;
  const cat = mapSegmentToCategory(seg);
  if (cat) f.category = cat;
  if (sort === 'nearest' || sort === 'latest') f.sort = sort;
  if (kw) f.keyword = kw;
  if (df) f.dateFrom = df;
  if (dt) f.dateTo = dt;
  if (cc && /^[A-Z]{2}$/.test(cc)) f.countryCode = cc;
  if (rad && !isNaN(+rad)) f.radius = +rad;
  return f;
}
function applyFiltersToForm(f) {
  if (!form) return;
  const cat = form.querySelector('#filter-category');
  const city= form.querySelector('#filter-city');
  const sort= form.querySelector('#filter-sort');
  const kw  = form.querySelector('#filter-keyword');
  const df  = form.querySelector('#filter-date-from');
  const dt  = form.querySelector('#filter-date-to');
  if (f.category && cat) cat.value = f.category;
  if (f.city && city) city.value = f.city;
  if (f.sort && sort) sort.value = f.sort;
  if (f.keyword && kw) kw.value = f.keyword;
  if (f.dateFrom && df) df.value = f.dateFrom;
  if (f.dateTo && dt) dt.value = f.dateTo;
  if (f.countryCode && cityInput) cityInput.dataset.cc = f.countryCode;
  refreshDatesComboLabel();
}
function updateQueryFromFilters(f) {
  const next = new URL(location.href);
  next.searchParams.set('lang', LANG);
  function set(k, v){ if (v !== undefined && v !== null && v !== '') next.searchParams.set(k, v); else next.searchParams.delete(k); }
  set('city', f.city);
  set('segment', f.category);
  set('sort', f.sort);
  set('keyword', f.keyword);
  set('dateFrom', f.dateFrom);
  set('dateTo', f.dateTo);
  set('country', f.countryCode);
  if (typeof f.radius === 'number') set('radius', String(f.radius));
  history.replaceState(null, '', next);
}
function emitFiltersChange(filters, lang){
  try { window.dispatchEvent(new CustomEvent('ajsee:filters', { detail: { filters: { ...filters }, lang: lang || LANG } })); } catch (e) {}
}

/* ───────────────────── helpers: form & UI ───────────────────── */
function _val(el){ return el ? el.value : undefined; }
function getFormFilters(formEl) {
  if (!formEl) return {};
  const catSel   = _val(formEl.querySelector('#filter-category')) || 'all';
  const category = catSel === 'all' ? undefined : catSel;
  const city     = (_val(formEl.querySelector('#filter-city')) || '').trim();
  const sortSel  = _val(formEl.querySelector('#filter-sort'));
  const sort     = sortSel === 'latest' ? 'latest' : 'nearest';
  const keyword  = (_val(formEl.querySelector('#filter-keyword')) || '').trim();
  const dateFrom = _val(formEl.querySelector('#filter-date-from')) || '';
  const dateTo   = _val(formEl.querySelector('#filter-date-to')) || '';
  const ccData   = (cityInput && cityInput.dataset ? cityInput.dataset.cc : '') || guessCountryCodeFromCity(city) || '';
  const countryCode = ccData ? String(ccData).toUpperCase() : undefined;
  const near = G.state.nearMe || {};
  return { keyword, city, sort, category, dateFrom, dateTo, countryCode, nearMeLat: near.lat, nearMeLon: near.lon, nearMeRadiusKm: near.radiusKm };
}
function setFilterInputsFromState() {
  if (!form) return;
  const f = getFormFilters(form);
  const cat = form.querySelector('#filter-category');
  const sort= form.querySelector('#filter-sort');
  const df  = form.querySelector('#filter-date-from');
  const dt  = form.querySelector('#filter-date-to');
  const kw  = form.querySelector('#filter-keyword');
  if (cat) cat.value = f.category || 'all';
  if (sort) sort.value = f.sort || 'nearest';
  if (cityInput && !cityInput.matches('[data-autofromnearme="1"]')) cityInput.value = f.city || '';
  if (df) df.value = f.dateFrom || '';
  if (dt) dt.value = f.dateTo || '';
  if (kw) kw.value = f.keyword || '';
  refreshDatesComboLabel();
}
function setStateFilters(patch) {
  patch = patch || {};
  if ('nearMeLat' in patch || 'nearMeLon' in patch || 'nearMeRadiusKm' in patch) {
    if (patch.nearMeLat && patch.nearMeLon) {
      G.state.nearMe = { lat: patch.nearMeLat, lon: patch.nearMeLon, radiusKm: patch.nearMeRadiusKm || 50 };
    } else {
      G.state.nearMe = null;
    }
  }
  if ('city' in patch && cityInput) {
    cityInput.value = patch.city || '';
    if (!patch.city && cityInput.dataset) delete cityInput.dataset.cc;
  }
  function setVal(sel, val){
    const el = form ? form.querySelector(sel) : null;
    if (el) el.value = val || '';
  }
  if ('dateFrom' in patch) setVal('#filter-date-from', patch.dateFrom);
  if ('dateTo'   in patch) setVal('#filter-date-to',   patch.dateTo);
  if ('keyword'  in patch) setVal('#filter-keyword',   patch.keyword);
  if ('category' in patch) setVal('#filter-category',  patch.category || 'all');
  if ('sort'     in patch) setVal('#filter-sort',      patch.sort || 'nearest');

  refreshDatesComboLabel();
}
function hasActiveFilters() {
  const f = getFormFilters(form);
  return !!(f.category || f.city || f.dateFrom || f.dateTo || f.keyword || (f.sort && f.sort !== 'nearest') || (f.nearMeLat && f.nearMeLon));
}

/* Přepočet textu na „Dates“ tlačítku */
function refreshDatesComboLabel(){
  const host = (form || document).querySelector('.date-combo');
  if (!host) return;
  const btnText = host.querySelector('.combo-text');
  const fromEl = (form || document).querySelector('#filter-date-from');
  const toEl   = (form || document).querySelector('#filter-date-to');
  if (!btnText || !fromEl || !toEl) return;

  const a = (fromEl.value || '').trim();
  const b = (toEl.value   || '').trim();

  const fmt = (iso) => {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const d = new Date(+m[1], +m[2]-1, +m[3], 12, 0, 0, 0);
      try {
        return d.toLocaleDateString(LOCALE, { day:'2-digit', month:'2-digit', year:'numeric' });
      } catch {
        return `${m[3]}.${m[2]}.${m[1]}`;
      }
    }
    const d2 = new Date(iso);
    if (isNaN(d2)) return iso;
    try {
      return d2.toLocaleDateString(LOCALE, { day:'2-digit', month:'2-digit', year:'numeric' });
    } catch {
      return iso;
    }
  };

  let text = '';
  if (!a && !b) text = t('filters.allDates','Všechny termíny');
  else if (a && b) text = `${fmt(a)} – ${fmt(b)}`;
  else if (a) text = `${t('filters.from','Od')} ${fmt(a)}`;
  else text = `${t('filters.to','Do')} ${fmt(b)}`;

  btnText.textContent = text;
}

function updateFilterLocaleTexts(){
  function setBtnLabel(el, txt){
    if(!el) return;
    const n = el.querySelector('[data-i18n-label],.label,.btn-label');
    (n || el).textContent = txt;
  }
  const toggle = document.getElementById('filtersToggle');
  const toggleFallback = {
    cs: { show: 'Zobrazit filtry', hide: 'Skrýt filtry' },
    en: { show: 'Show filters', hide: 'Hide filters' },
    de: { show: 'Filter anzeigen', hide: 'Filter ausblenden' },
    sk: { show: 'Zobraziť filtre', hide: 'Skryť filtre' },
    pl: { show: 'Pokaż filtry', hide: 'Ukryj filtry' },
    hu: { show: 'Szűrők megjelenítése', hide: 'Szűrők elrejtése' }
  };
  function toggleLabel(mode){
    const map = toggleFallback[LANG] || toggleFallback.en;
    return t(mode==='show' ? 'filters.show' : 'filters.hide', map[mode]);
  }
  if (toggle) setBtnLabel(toggle, filtersCollapsed ? toggleLabel('show') : toggleLabel('hide'));

  const map = {
    chipToday:   t('filters.today','Today'),
    chipWeekend: t('filters.weekend','This weekend'),
    chipNearMe:  t('filters.nearMe','Near me'),
    'filter-nearme': t('filters.nearMe','Near me'),
    chipClear:   t('filters.reset','Clear')
  };
  for (const id in map){
    const el = document.getElementById(id);
    if (el) setBtnLabel(el, lf({
      cs: {chipToday:'Dnes', chipWeekend:'Tento víkend', chipNearMe:'V mém okolí', 'filter-nearme':'V mém okolí', chipClear:'Vymazat'}[id],
      sk: {chipToday:'Dnes', chipWeekend:'Tento víkend', chipNearMe:'V mojom okolí', 'filter-nearme':'V mojom okolí', chipClear:'Vymazať'}[id],
      de: {chipToday:'Heute', chipWeekend:'Dieses Wochenende', chipNearMe:'In meiner Nähe', 'filter-nearme':'In meiner Nähe', chipClear:'Zurücksetzen'}[id],
      pl: {chipToday:'Dziś', chipWeekend:'W ten weekend', chipNearMe:'Blisko mnie', 'filter-nearme':'Blisko mnie', chipClear:'Wyczyść'}[id],
      hu: {chipToday:'Ma', chipWeekend:'Hétvégén', chipNearMe:'A közelben', 'filter-nearme':'A közelben', chipClear:'Törlés'}[id]
    }, map[id]));
  }

  if (cityInput) cityInput.placeholder = lf({
    cs:'Praha, Brno...', sk:'Bratislava, Košice...', de:'Prag, Brünn...', pl:'Praga, Brno...', hu:'Prága, Brno...'
  }, 'Prague, Brno...');

  const dateLbl = document.querySelector('label[for="date-combo-button"]');
  if (dateLbl) dateLbl.textContent = lf({ cs:'Datum', sk:'Dátum', de:'Datum', pl:'Data', hu:'Dátum' }, 'Date');

  const seg = document.querySelector('.segmented');
  if (seg) {
    const [b0,b1] = seg.querySelectorAll('button');
    if (b0) b0.textContent = lf({ cs:'Nejbližší', sk:'Najbližšie', de:'Nächste', pl:'Najbliższe', hu:'Legközelebbi' }, 'Nearest');
    if (b1) b1.textContent  = lf({ cs:'Nejnovější', sk:'Najnovšie', de:'Neueste', pl:'Najnowsze',  hu:'Legújabb' },  'Latest');
  }
}

/* ───────────────────── ACTIVE CHIPS ───────────────────── */
function findChipsHost() {
  const toolbar = document.querySelector('.filters-toolbar');
  if (toolbar && toolbar.parentNode) return { parent: toolbar.parentNode, after: toolbar };
  const lst = document.getElementById('eventsList');
  if (lst && lst.parentElement) return { parent: lst.parentElement, before: lst };
  return null;
}
function renderActiveChips(){
  renderActiveChipsMod({
    t: t,
    getFilters: function(){ return getFormFilters(form); },
    setFilters: async function(patch){ setStateFilters(patch); },
    setFilterInputsFromState: setFilterInputsFromState,
    renderAndSync: async function(){ await renderAndMaybeFetch(); },
    findChipsHost: findChipsHost
  });
}

/* ─────────────────────── sort segmented (UI) ─────────────────────── */
function upgradeSortToSegmented() {
  const select = document.querySelector('#filter-sort') || document.querySelector('#events-sort-filter');
  if (!select || select.dataset.upgraded === 'segmented') return;

  select.dataset.upgraded = 'segmented';
  const wrap = document.createElement('div');
  wrap.className = 'segmented';
  wrap.setAttribute('role','tablist');
  wrap.setAttribute('aria-label', t('filters.sort','Řazení'));

  const indicator = document.createElement('div');
  indicator.className = 'seg-indicator';
  wrap.appendChild(indicator);

  const btnNearest = document.createElement('button');
  const btnLatest  = document.createElement('button');
  btnNearest.type='button'; btnLatest.type='button';
  btnNearest.textContent = t('filters.nearest','Nearest');
  btnLatest.textContent  = t('filters.latest','Latest');

  wrap.appendChild(btnNearest);
  wrap.appendChild(btnLatest);

  select.parentElement.insertBefore(wrap, select);

  function setActive(which){
    const buttons=[btnNearest, btnLatest];
    buttons.forEach((b,i)=> {
      b.classList.toggle('is-active', i===which);
      b.setAttribute('aria-selected', i===which ? 'true' : 'false');
      b.setAttribute('role','tab');
      b.tabIndex = i===which ? 0 : -1;
    });
    const target = buttons[which];
    requestAnimationFrame(()=>{
      const r = target.getBoundingClientRect();
      const rw = wrap.getBoundingClientRect();
      const left = r.left - rw.left + 6;
      wrap.style.setProperty('--indi-left', left+'px');
      wrap.style.setProperty('--indi-width', r.width+'px');
    });
  }

  setActive((select.value || 'nearest') === 'latest' ? 1 : 0);

  wireOnce(btnNearest, 'click', async ()=>{
    select.value = 'nearest';
    setActive(0);
    await renderAndMaybeFetch();
  }, 'seg-nearest');

  wireOnce(btnLatest, 'click', async ()=>{
    select.value = 'latest';
    setActive(1);
    await renderAndMaybeFetch();
  }, 'seg-latest');

  wireOnce(wrap,'keydown', async (e)=>{
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault();
    const isLatest = (select.value || 'nearest') === 'latest';
    if (e.key==='ArrowLeft' && isLatest){
      btnNearest.click();
      btnNearest.focus();
    } else if (e.key==='ArrowRight' && !isLatest){
      btnLatest.click();
      btnLatest.focus();
    }
  }, 'seg-kbd');

  wireOnce(window, 'resize', ()=> setActive((select.value || 'nearest') === 'latest' ? 1 : 0), 'seg-resize');
}

/* ─────────────────────── rendering karet ─────────────────────── */
function formatDate(isoOrLocal, loc){
  loc = loc || 'en-GB';
  if (!isoOrLocal) return '';
  const raw = String(isoOrLocal);
  const hasTime = /T\d{2}:\d{2}/.test(raw) || /\d{2}:\d{2}/.test(raw);
  const d = new Date(isoOrLocal);
  if (isNaN(d)) return String(isoOrLocal);
  const day  = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d);
  const date = new Intl.DateTimeFormat(loc, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const time = hasTime ? new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(d) : '';
  return [day, date, time].filter(Boolean).join(' • ');
}
function esc(s){
  s = s || '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeUrl(raw) {
  try {
    const u = new URL(raw, location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch (e) {}
  return '#';
}
function wrapAffiliate(url) {
  try {
    const cfg = window.__impact || window.__aff || {};
    if (cfg.clickBase && /^https?:/i.test(cfg.clickBase)) return cfg.clickBase + encodeURIComponent(url);
    if (cfg.param && cfg.value) {
      const u = new URL(url);
      if (!u.searchParams.has(cfg.param)) u.searchParams.set(cfg.param, cfg.value);
      return u.toString();
    }
  } catch (e) {}
  return url;
}
function adjustTicketmasterLanguage(rawUrl) {
  const lng = LANG;
  try {
    const u = new URL(rawUrl, location.href);
    const tmLang = mapLangToTm(lng);
    u.searchParams.set('language', tmLang);
    if (!u.searchParams.has('locale')) u.searchParams.set('locale', tmLang);
    return u.toString();
  } catch (e) { return rawUrl; }
}
function renderCard(ev) {
  const title = (ev.title && (ev.title[LANG] || ev.title.en)) || (ev.title ? Object.values(ev.title)[0] : 'Event') || 'Event';
  const img   = ev.image || '/images/placeholder-event.jpg';
  const city  = (ev.location && ev.location.city) || '';
  const date  = formatDate(ev.datetime, LOCALE);
  const rawUrl = ev.url || ev.tickets || '#';
  const url    = safeUrl(wrapAffiliate(adjustTicketmasterLanguage(rawUrl)));
  const source = ev.sourceName || 'Ticketmaster';

  const detailsTxt = t('event-details', lf({cs:'Detail', sk:'Detail', de:'Details', pl:'Szczegóły', hu:'Részletek'}, 'Details'));
  const ticketsTxt = t('event-tickets', lf({cs:'Vstupenky', sk:'Vstupenky', de:'Tickets', pl:'Bilety',   hu:'Jegyek'},    'Tickets'));

  return (
    '<article class="event-card">' +
      '<img class="event-img" src="' + esc(img) + '" alt="' + esc(title) + '" loading="lazy" />' +
      '<h3 class="event-title">' + esc(title) + '</h3>' +
      '<p class="event-date">' + (city ? esc(city) + ' • ' : '') + esc(date) + '</p>' +
      '<div class="event-buttons-group">' +
        '<a class="btn-event detail" href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(detailsTxt) + '</a>' +
        '<a class="btn-event ticket" href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(ticketsTxt) + '</a>' +
      '</div>' +
      '<small class="event-source">' + esc(source) + '</small>' +
    '</article>'
  );
}
function renderList(items) {
  items = items || [];
  if (!RENDER_ENABLED) return;
  if (!items.length) {
    list.innerHTML = '<p>' + esc(t('events.noResults','Nic jsme nenašli. Zkuste upravit filtry.')) + '</p>';
    updateResultsCount(0);
    return;
  }
  const seen = new Set();
  const out = [];
  for (let i=0;i<items.length;i++){
    const it = items[i];
    const k = it.id || (it.url || (it.title && (it.title.en || it.title)) || Math.random());
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(renderCard(it));
  }
  list.innerHTML = out.join('');
  updateResultsCount(seen.size);
}
function renderSkeleton(n) {
  n = n || 6;
  if (!RENDER_ENABLED) return;
  let html = '';
  for (let i=0;i<n;i++){
    html += '' +
    '<div class="event-card skeleton" aria-hidden="true">' +
      '<div class="ph-img"></div>' +
      '<div class="ph-line"></div>' +
      '<div class="ph-line short"></div>' +
    '</div>';
  }
  list.innerHTML = html;
}

/* results count v headeru */
function updateResultsCount(n){
  const host =
    document.querySelector('.events-header') ||
    (list ? list.parentElement : null) ||
    document.getElementById('events') ||
    document.body;

  let el = host.querySelector('#eventsResultsCount');
  if (!el){
    el = document.createElement('div');
    el.id = 'eventsResultsCount';
    el.className = 'events-results-count';
    host.appendChild(el);
  }
  const label = t('events-found','Nalezeno') || 'Nalezeno';
  el.textContent = `${label}: ${n}`;
}

/* ───────────────────────────── data ───────────────────────────── */
let fetchSeq = 0;
async function fetchAndRender(filters) {
  filters = filters || {};
  if (SKIP_CORE_EVENTS) { emitFiltersChange({ size: 12, ...filters }, LANG); renderActiveChips(); if (hasActiveFilters()) collapseFilters(); return; }
  const mySeq = ++fetchSeq;
  try {
    const items = await fetchEvents({ locale: LANG, filters: { size: 12, ...filters } });
    if (mySeq !== fetchSeq) { console.info('[events-home] stale fetch skipped'); return; }
    renderList(items);
    G.state.lastFilters = { ...filters };
    renderActiveChips();
    if (hasActiveFilters()) collapseFilters();
  } catch (e) {
    console.error(e);
    if (mySeq !== fetchSeq) return;
    if (!RENDER_ENABLED) return;
    list.innerHTML = '<p>' + esc(t('events.loadFailed','Načítání událostí selhalo.')) + '</p>';
    updateResultsCount(0);
  }
}
async function renderAndMaybeFetch() {
  const f = getFormFilters(form);
  const { nearMeLat, nearMeLon, nearMeRadiusKm, ...urlSafe } = f;
  updateQueryFromFilters(urlSafe);

  if (RENDER_ENABLED) renderSkeleton(6);

  const hasNear = !!(f.nearMeLat && f.nearMeLon);
  const out = hasNear
    ? { ...f, latlong: String(f.nearMeLat) + ',' + String(f.nearMeLon), radius: f.nearMeRadiusKm || 50, unit:'km' }
    : f;

  if (SKIP_CORE_EVENTS) {
    emitFiltersChange({ size: 12, ...out }, LANG);
    renderActiveChips();
    if (hasActiveFilters()) collapseFilters();
  } else {
    await fetchAndRender(out);
  }
}

/* ───────────────────────── bottom-sheet (mobile) ───────────────────────── */
function initFilterSheet() {
  const sheet   = document.querySelector('form.filter-dock[data-behavior="sheet"]');
  if (!sheet) return;
  const fab     = document.getElementById('filtersOpen');
  const closeBtn= document.getElementById('filtersClose');
  const overlay = document.getElementById('filtersOverlay');

  function open(){
    expandFilters();
    sheet.classList.add('is-open');
    if (overlay) { overlay.hidden = false; overlay.classList.add('is-open'); }
    document.body.style.overflow = 'hidden';
  }
  function close(){
    sheet.classList.remove('is-open');
    if (overlay) { overlay.classList.remove('is-open'); overlay.hidden = true; }
    document.body.style.overflow = '';
  }

  wireOnce(fab, 'click', open, 'sheet-open');
  wireOnce(closeBtn, 'click', close, 'sheet-close');
  wireOnce(overlay, 'click', close, 'sheet-overlay');
  wireOnce(document, 'keydown', function(e){ if (e.key === 'Escape') close(); }, 'sheet-esc');
}

/* ───────────────────────────── init ───────────────────────────── */
(async function init() {
  const hasUI = !!(document.getElementById('eventsList') || document.getElementById('events-filters-form') || document.querySelector('.events-filters'));
  if (!hasUI) { return; }

  if (G.flags.eventsHomeBooted) { console.info('[events-home] boot skipped'); return; }
  G.flags.eventsHomeBooted = true;

  ensureRuntimeStyles();
  updateHeaderOffset();
  wireOnce(window, 'resize', function(){ updateHeaderOffset(); }, 'hdr-offset');

  if (RENDER_ENABLED) list.setAttribute('aria-live', 'polite');

  const triggeredByLang = initLangFromStorage();

  const langBtns = document.querySelectorAll('.lang-btn[data-lang]');
  for (let i=0;i<langBtns.length;i++){
    const btn = langBtns[i];
    wireOnce(btn, 'click', function(){ setLang(btn.getAttribute('data-lang') || 'cs'); }, 'lang');
  }

  applyTranslationsMaybe();

  const toolbar = document.querySelector('.filters-toolbar');
  if (toolbar && !document.getElementById('filtersToggle')) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'filtersToggle';
    toggle.className = 'chip ghost filters-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-controls', 'events-filters-form');
    wireOnce(toggle, 'click', function(){ toggleFilters(); }, 'filters-toggle');
    toolbar.appendChild(toggle);
    updateFilterLocaleTexts();
  }

  activateCompactFilterSizing();
  normalizeFilterFormUI();
  stripDuplicateFieldIcons();

  // 1) vytvoř kotvu
  ensureDateComboAnchor();
  // 2) a až POTOM lazy-načti samotný picker
  await loadDateCombo();

  upgradeSortToSegmented();

  const initial = getFiltersFromQuery();
  applyFiltersToForm(initial);

  if (cityInput) {
    setupCityTypeahead(cityInput, {
      locale: LANG,
      t: t,
      countryCodes: ['GB','IE','CZ','SK','PL','HU','DE','AT','CH','FR','IT','ES','PT','NL','BE','DK','NO','SE','FI','US','CA'],
      onChoose: function(it){
        cityInput.value = it.city;
        if (it.countryCode) cityInput.dataset.cc = String(it.countryCode || '').toUpperCase();
        renderAndMaybeFetch();
      }
    });
  }

  if (RENDER_ENABLED) renderSkeleton(6);

  if (!triggeredByLang) {
    if (SKIP_CORE_EVENTS) {
      emitFiltersChange({ size: 12, ...initial }, LANG);
      renderActiveChips();
    } else {
      fetchAndRender(initial);
    }
  } else {
    renderActiveChips();
  }

  // Sync „Dates“ štítku při změně nativních inputů
  wireOnce(form && form.querySelector('#filter-date-from'), 'change', refreshDatesComboLabel, 'df-change');
  wireOnce(form && form.querySelector('#filter-date-to'),   'change', refreshDatesComboLabel, 'dt-change');

  wireOnce(form, 'submit', function(e){
    e.preventDefault();
    const f = getFormFilters(form);
    if (f.city) {
      const canon = canonForInputCity(f.city);
      const cc = f.countryCode || guessCountryCodeFromCity(f.city);
      if (cc && cityInput) cityInput.dataset.cc = String(cc).toUpperCase();
      console.info('[events-home] submit city:', f.city, 'canon:', canon, 'cc:', cc);
    }
    renderAndMaybeFetch();
    collapseFilters();
  }, 'form-submit');

  wireOnce(form, 'reset', function(e){
    e.preventDefault();
    if (cityInput) { cityInput.value=''; if (cityInput.dataset) delete cityInput.dataset.cc; }
    G.state.nearMe = null;
    const f = { sort: 'nearest' };
    applyFiltersToForm(f);
    renderAndMaybeFetch();
    expandFilters();
  }, 'form-reset');

  wireOnce(document.getElementById('chipToday'), 'click', function(){
    const today = new Date().toISOString().slice(0, 10);
    setStateFilters({ dateFrom: today, dateTo: today, sort: 'nearest' });
    renderAndMaybeFetch();
    collapseFilters();
  }, 'chipToday');

  wireOnce(document.getElementById('chipWeekend'), 'click', function(){
    const now = new Date();
    const day = now.getDay();
    const diffToSat = (6 - day + 7) % 7;
    const sat = new Date(now); sat.setDate(now.getDate() + diffToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    function d(x){ return x.toISOString().slice(0, 10); }
    setStateFilters({ dateFrom: d(sat), dateTo: d(sun), sort: 'nearest' });
    renderAndMaybeFetch();
    collapseFilters();
  }, 'chipWeekend');

  wireOnce(document.getElementById('chipClear'), 'click', function(){
    if (form) form.reset();
    if (cityInput && cityInput.dataset) delete cityInput.dataset.cc;
    G.state.nearMe = null;
    const f = { sort: 'nearest' };
    applyFiltersToForm(f);
    renderAndMaybeFetch();
    expandFilters();
  }, 'chipClear');

  attachNearMeButton({
    formEl: form || document,
    t: t,
    wireOnce: wireOnce,
    getLang: function(){ return LANG; },
    getFilters: function(){ return getFormFilters(form); },
    setFilters: function(patch){ setStateFilters(patch); },
    setFilterInputsFromState: setFilterInputsFromState,
    renderAndSync: function(){ return renderAndMaybeFetch(); }
  });

  initFilterSheet();
})();
