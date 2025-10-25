// /src/main.js
// ---------------------------------------------------------
// AJSEE – Events UI, i18n & filters (sjednocení s homepage)
// ---------------------------------------------------------

import './styles/main.scss';
import './identity-init.js';
import './filters/date-combo.js';     // Ticketmaster-like date picker (auto-upgrade)
import './utils/date-popover.old.js';     // globální window.ajseePositionDatePopover(anchor, popover)

import { getAllEvents } from './api/eventsApi.js';
import { setupCityTypeahead } from './city/typeahead.js';
import { canonForInputCity } from './city/canonical.js';

import { getSortedBlogArticles } from './blogArticles.js';
import { initNav } from './nav-core.js';
import { initContactFormValidation } from './contact-validate.js';
import { initEventModal } from './event-modal.js';

import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';
import { attachNearMeButton } from './filters/near-me.js';
import { renderFilterChips as renderActiveChips } from './filters/active-chips.js';

/* ───────── global guard ───────── */
(function ensureGlobals(){
  window.__ajsee = window.__ajsee || {};
  const g = window.__ajsee;
  g.flags = g.flags || {};
  g.once  = g.once  || new Set();
  g.locks = g.locks || {};
  g.state = g.state || {};
  g.bus   = g.bus   || (type => detail => { try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {} });
})();
const G = window.__ajsee;

G.state._wiredMap = G.state._wiredMap || new WeakMap();
const _wiredMap = G.state._wiredMap;
function wireOnce(el, evt, handler, key=''){
  if (!el) return;
  const id = `${evt}:${key||''}`;
  let set = _wiredMap.get(el);
  if (!set) { set = new Set(); _wiredMap.set(el, set); }
  if (set.has(id)) return;
  set.add(id);
  el.addEventListener(evt, handler);
}

if (G.flags.mainInitialized) {
  console.info('[main] module reloaded — functions replaced, boot will skip.');
} else {
  G.flags.mainInitialized = true;
}

const SKIP_CORE_EVENTS = !!window.__AJSEE_SKIP_CORE_EVENTS;

/* ───────── state ───────── */
let currentFilters = {
  category: 'all',
  sort: 'nearest',
  city: '',
  dateFrom: '',
  dateTo: '',
  keyword: '',
  countryCode: 'CZ',
  nearMeLat: null,
  nearMeLon: null,
  nearMeRadiusKm: 50
};

// — jazyk: vždy preferuj ?lang → <html lang> → cs
function getUILang(){
  const urlLang = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
  const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const supported = ['cs','en','de','sk','pl','hu'];
  const pick = urlLang || htmlLang || 'cs';
  return supported.includes(pick) ? pick : 'cs';
}
let currentLang = getUILang();

const pagination = { page: 1, perPage: 12 };
let filtersCollapsed = false;

/* ───────── utils ───────── */
const qs  = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
const debounce = (fn, ms=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const isHome = () => location.pathname==='/' || location.pathname.endsWith('index.html');
const ridle = (cb)=> (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 1200 }) : setTimeout(cb, 0));
function getCookie(name){ return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1]; }
function esc(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function pad2(n){ return String(n).padStart(2,'0'); }
function toLocalISO(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

/* small store for UI prefs */
const store = {
  get(k, d=null){ try{ return JSON.parse(sessionStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch{} }
};

/* live region for announcements (a11y) */
function ensureLiveRegion(){
  let r = document.getElementById('ajsee-live');
  if (!r){
    r = document.createElement('div');
    r.id='ajsee-live';
    r.setAttribute('aria-live','polite');
    r.setAttribute('aria-atomic','true');
    r.style.position='absolute';
    r.style.width='1px';
    r.style.height='1px';
    r.style.overflow='hidden';
    r.style.clip='rect(1px,1px,1px,1px)';
    r.style.clipPath='inset(50%)';
    r.style.whiteSpace='nowrap';
    document.body.appendChild(r);
  }
  return r;
}
const announce = (msg)=>{ ensureLiveRegion().textContent = msg||''; };

/* busy state helpers */
function setBusy(v){
  const form = qs('form.filter-dock') || qs('.events-filters');
  const list = qs('#eventsList');
  if (form){
    form.setAttribute('aria-busy', v?'true':'false');
    qsa('input,select,button', form).forEach(el=> el.disabled = !!v && !el.classList.contains('filters-toggle'));
  }
  if (list) list.setAttribute('aria-busy', v?'true':'false');
}

/* ───────── i18n ───────── */
function deepMerge(a={},b={}){ const o={...a}; for(const[k,v]of Object.entries(b)) o[k]=v&&typeof v==='object'&&!Array.isArray(v)?deepMerge(o[k]||{},v):v; return o; }
async function fetchJSON(p){ try{ const r=await fetch(p,{cache:'no-store'}); if(r.ok) return await r.json(); }catch{} return null; }
async function loadTranslations(lang){
  const base = (await fetchJSON(`/locales/${lang}.json`)) || (await fetchJSON(`/src/locales/${lang}.json`)) || {};
  const page = location.pathname.split('/').pop();
  const pagePart = page==='about.html'
    ? (await fetchJSON(`/locales/${lang}/about.json`)) || (await fetchJSON(`/src/locales/${lang}/about.json`)) || {}
    : {};
  return deepMerge(base, pagePart);
}
function getByPath(o,p){ return p?.split('.').reduce((a,k)=>a?.[k],o); }
function t(key, fb){
  const tr = window.translations || {};
  const v = getByPath(tr, key) ?? tr[key];
  if (v !== undefined) return v;
  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, ''); const alt = getByPath(tr, `filters.${tail}`); if (alt !== undefined) return alt;
  }
  if (key.startsWith('filters.')) {
    const flat = key.replace(/^filters\./,'filter-'); const alt = tr[flat]; if (alt !== undefined) return alt;
  }
  if (key.startsWith('category-')) {
    const alt = getByPath(tr, `filters.${key.replace('category-','')}`); if (alt !== undefined) return alt;
  }
  return fb;
}

// fallbacky pro toggle — čteme VŽDY z aktuálního <html lang>
const toggleFallback = {
  cs:{show:'Zobrazit filtry',hide:'Skrýt filtry'},
  en:{show:'Show filters',hide:'Hide filters'},
  de:{show:'Filter anzeigen',hide:'Filter ausblenden'},
  sk:{show:'Zobraziť filtre',hide:'Skryť filtre'},
  pl:{show:'Pokaż filtry',hide:'Ukryj filtry'},
  hu:{show:'Szűrők megjelenítése',hide:'Szűrők elrejtése'}
};
const toggleLabel = (mode)=>{
  const lang = getUILang();
  const tryKeys = [
    `filters.toggle.${mode}`,
    mode==='show' ? 'filters.show' : 'filters.hide'
  ];
  for (const k of tryKeys){
    const v = t(k);
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return (toggleFallback[lang]||toggleFallback.cs)[mode];
};

// a11y hlášky pro rozbalení/sbalení panelu
const ariaToggleFallback = {
  cs:{collapsed:'Filtry jsou skryté.', expanded:'Filtry jsou zobrazené.'},
  en:{collapsed:'Filters are hidden.',  expanded:'Filters are visible.'},
  de:{collapsed:'Filter sind ausgeblendet.', expanded:'Filter sind sichtbar.'},
  sk:{collapsed:'Filtre sú skryté.', expanded:'Filtre sú zobrazené.'},
  pl:{collapsed:'Filtry są ukryte.', expanded:'Filtry są widoczne.'},
  hu:{collapsed:'A szűrők rejtve vannak.', expanded:'A szűrők láthatók.'}
};
const ariaToggleText = (state)=> {
  const lang = getUILang();
  return state==='collapsed'
    ? (t('filters.aria.collapsed',  (ariaToggleFallback[lang]||ariaToggleFallback.cs).collapsed))
    : (t('filters.aria.expanded',   (ariaToggleFallback[lang]||ariaToggleFallback.cs).expanded));
};

const setBtnLabel = (el,txt)=>{ if(!el)return; const n=el.querySelector('[data-i18n-label],.label,.btn-label'); (n||el).textContent=txt; };

function updateFilterLocaleTexts(){
  setBtnLabel(qs('#chipToday'), t('filters.today','Today'));
  setBtnLabel(qs('#chipWeekend'), t('filters.weekend','This weekend'));
  setBtnLabel(qs('#chipNearMe'), t('filters.nearMe','Near me'));
  setBtnLabel(qs('#filter-nearme'), t('filters.nearMe','Near me'));
  const city = qs('#filter-city') || qs('#events-city-filter');
  if (city) city.placeholder = t('filters.cityPlaceholder','Prague, Brno...');
  const kw = qs('#filter-keyword'); if (kw) kw.placeholder = t('filters.keywordPlaceholder','Artist, venue, event…');
  const applyBtn = qs('#events-apply-filters') || qs('.filter-actions .btn.btn-primary'); if (applyBtn) setBtnLabel(applyBtn, t('filters.apply','Apply filters'));
  const resetBtn = qs('#events-clear-filters') || qs('.filter-actions button[type="reset"]'); if (resetBtn) setBtnLabel(resetBtn, t('filters.reset','Clear'));
  const tog = qs('#filtersToggle'); if (tog) setBtnLabel(tog, filtersCollapsed ? toggleLabel('show') : toggleLabel('hide'));

  const seg = qs('.segmented');
  if (seg) {
    const [b0, b1] = seg.querySelectorAll('button');
    if (b0) b0.textContent = t('filters.nearest','Nearest');
    if (b1) b1.textContent = t('filters.latest','Latest');
  }

  // label „DATUM“ u combo ovladače + samotný text tlačítka
  const dateLbl = qs('label[for="date-combo-button"]');
  if (dateLbl) dateLbl.textContent = t('filters.date','Datum');
  updateDateComboLabel();
}
// zpřístupnit pro i18n modul (pokud se načte dřív)
if (!window.updateFilterLocaleTexts) window.updateFilterLocaleTexts = updateFilterLocaleTexts;

if (!window.applyTranslations) window.applyTranslations = applyTranslations;

/* --- i18n guard: reaguj na změnu <html lang> --- */
(function observeLangAttr(){
  try{
    const mo = new MutationObserver(async () => {
      currentLang = getUILang();
      await ensureTranslations(currentLang);
    });
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  }catch{}
})();

async function applyTranslations(lang){
  window.translations = await loadTranslations(lang);
  document.querySelectorAll('[data-i18n-key]').forEach(el=>{
    const k=el.getAttribute('data-i18n-key'); const v=t(k);
    if (v===undefined || String(v).trim()==='') return;
    if (/[<][a-z]/i.test(v)) el.innerHTML=v; else el.textContent=v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const k=el.getAttribute('data-i18n-placeholder'); const v=t(k); if(!v) return; el.setAttribute('placeholder', String(v));
  });
  updateFilterLocaleTexts();
}
async function ensureTranslations(lang){
  if (typeof window.applyTranslations === 'function') return window.applyTranslations(lang);
  window.translations = await loadTranslations(lang);
  updateFilterLocaleTexts();
}

/* ───────── UI helpers ───────── */
function findChipsHost(){
  const toolbar = qs('.filters-toolbar');
  if (toolbar?.parentNode) return { parent: toolbar.parentNode, after: toolbar };
  const list = qs('#eventsList');
  if (list?.parentElement) return { parent: list.parentElement, before: list };
  return null;
}
function collapseFilters(){
  const dock = qs('form.filter-dock') || qs('.events-filters'); if (!dock) return;
  filtersCollapsed = true; dock.classList.add('is-collapsed');
  const tgl = qs('#filtersToggle'); if (tgl){ tgl.setAttribute('aria-pressed','true'); setBtnLabel(tgl, toggleLabel('show')); }
  store.set('filtersCollapsed', true);
  announce(ariaToggleText('collapsed'));
}
function expandFilters(){
  const dock = qs('form.filter-dock') || qs('.events-filters'); if (!dock) return;
  filtersCollapsed = false; dock.classList.remove('is-collapsed');
  const tgl = qs('#filtersToggle'); if (tgl){ tgl.setAttribute('aria-pressed','false'); setBtnLabel(tgl, toggleLabel('hide')); }
  store.set('filtersCollapsed', false);
  announce(ariaToggleText('expanded'));
}
const toggleFilters = ()=> (filtersCollapsed ? expandFilters() : collapseFilters());

/* badge – počet aktivních filtrů */
function computeActiveFiltersCount(f=currentFilters){
  let c = 0;
  if (f.category && f.category !== 'all') c++;
  if (f.city) c++;
  if (f.keyword) c++;
  if (f.sort && f.sort !== 'nearest') c++;
  if (f.dateFrom || f.dateTo) c++;
  if (f.nearMeLat && f.nearMeLon) c++;
  return c;
}
function updateToggleBadge(){
  const btn = qs('#filtersToggle');
  if (!btn) return;
  const cnt = computeActiveFiltersCount();
  let badge = btn.querySelector('.badge');
  if (!badge){
    badge = document.createElement('span');
    badge.className = 'badge';
    btn.appendChild(badge);
  }
  badge.textContent = String(cnt);
  const base = filtersCollapsed ? toggleLabel('show') : toggleLabel('hide');
  btn.setAttribute('aria-label', cnt ? `${base} (${cnt})` : base);
}

/* results count in header */
function updateResultsCount(n){
  const host = qs('.events-header') || qs('#events') || document;
  let el = qs('#eventsResultsCount', host);
  if (!el){
    el = document.createElement('div');
    el.id = 'eventsResultsCount';
    el.className = 'events-results-count';
    host.appendChild(el);
  }
  const label = t('events-found','Nalezeno') || 'Nalezeno';
  el.textContent = `${label}: ${n}`;
}

/* swap dates if reversed */
function normalizeDates(){
  if (!currentFilters.dateFrom || !currentFilters.dateTo) return;
  const a = new Date(currentFilters.dateFrom);
  const b = new Date(currentFilters.dateTo);
  if (a > b){
    const tmp = currentFilters.dateFrom;
    currentFilters.dateFrom = currentFilters.dateTo;
    currentFilters.dateTo = tmp;
    setFilterInputsFromState();
  }
}

function setFilterInputsFromState(){
  const $cat=qs('#filter-category')||qs('#events-category-filter');
  const $sort=qs('#filter-sort')||qs('#events-sort-filter');
  const $city=qs('#filter-city')||qs('#events-city-filter');
  const $from=qs('#filter-date-from')||qs('#events-date-from');
  const $to  =qs('#filter-date-to')  ||qs('#events-date-to');
  const $kw  =qs('#filter-keyword');
  if ($cat) $cat.value = currentFilters.category || 'all';
  if ($sort) $sort.value = currentFilters.sort || 'nearest';
  if ($city && !$city.matches('[data-autofromnearme="1"]')) $city.value = currentFilters.city || '';
  if ($from) $from.value = currentFilters.dateFrom || '';
  if ($to) $to.value = currentFilters.dateTo || '';
  if ($kw) $kw.value = currentFilters.keyword || '';
  // sync i combo tlačítko
  updateDateComboLabel();
}
function hasActiveFilters(){ return computeActiveFiltersCount(currentFilters) > 0; }

function syncURLFromFilters(){
  const u = new URL(location.href), p=u.searchParams;
  (currentFilters.city ? p.set('city', currentFilters.city) : p.delete('city'));
  (currentFilters.dateFrom ? p.set('from', currentFilters.dateFrom) : p.delete('from'));
  (currentFilters.dateTo ? p.set('to', currentFilters.dateTo) : p.delete('to'));
  (currentFilters.category && currentFilters.category!=='all' ? p.set('segment', currentFilters.category) : p.delete('segment'));
  (currentFilters.keyword ? p.set('q', currentFilters.keyword) : p.delete('q'));
  (currentFilters.sort && currentFilters.sort!=='nearest' ? p.set('sort', currentFilters.sort) : p.delete('sort'));
  history.replaceState(null,'',u.toString());
}

/* ───────── Elegantní SEGMENTED pro „Řazení“ ───────── */
function upgradeSortToSegmented() {
  const select = qs('#filter-sort') || qs('#events-sort-filter');
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

  setActive(currentFilters.sort === 'latest' ? 1 : 0);

  wireOnce(btnNearest, 'click', async ()=>{
    currentFilters.sort = 'nearest';
    select.value = 'nearest';
    setActive(0);
    await renderAndSync({ resetPage:true, autoCollapse:false });
  }, 'seg-nearest');

  wireOnce(btnLatest, 'click', async ()=>{
    currentFilters.sort = 'latest';
    select.value = 'latest';
    setActive(1);
    await renderAndSync({ resetPage:true, autoCollapse:false });
  }, 'seg-latest');

  wireOnce(wrap,'keydown', async (e)=>{
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault();
    const isLatest = currentFilters.sort==='latest';
    if (e.key==='ArrowLeft' && isLatest){
      btnNearest.click();
      btnNearest.focus();
    } else if (e.key==='ArrowRight' && !isLatest){
      btnLatest.click();
      btnLatest.focus();
    }
  }, 'seg-kbd');

  wireOnce(window, 'resize', ()=> setActive(currentFilters.sort==='latest'?1:0), 'seg-resize');
}

/* ───────── Runtime polish: sjednocení tříd + fix ikon/duplicit ───────── */
function injectOnce(id, css){
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id=id; s.textContent = css; document.head.appendChild(s);
}

/* ▼▼▼ NEW (bez přesunu DOM): sjednocené výšky + kompaktní šířky + date-combo fixy ▼▼▼ */
function activateCompactFilterSizing(){
  const dock = qs('form.filter-dock') || qs('.events-filters');
  if (!dock) return;

  dock.classList.add('dates-compact-mode');

  injectOnce('ajsee-filters-layout-2025', `
    :root{ --ctrl-h:56px; --ctrl-radius:14px; }

    :where(.events-filters.filter-dock, form.filter-dock) .styled-input,
    :where(.events-filters.filter-dock, form.filter-dock) .styled-select{
      height:var(--ctrl-h); line-height:var(--ctrl-h); border-radius:var(--ctrl-radius);
    }
    :where(.events-filters.filter-dock, form.filter-dock) .segmented{
      min-height:var(--ctrl-h);
      align-items:center;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .segmented button{
      min-height:calc(var(--ctrl-h) - 8px);
    }
    :where(.events-filters.filter-dock, form.filter-dock) .filters-toolbar .chip{ min-height:44px; }

    /* Klíčové slovo – příliš široké → strop */
    :where(.events-filters.filter-dock, form.filter-dock) .filter-keyword,
    :where(.events-filters.filter-dock, form.filter-dock) #filter-keyword{
      max-width:min(680px, 100%);
    }

    /* DATUM (COMBO) – pole uvnitř gridu nepřetéká */
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.date-combo{
      flex: 0 1 340px;
      min-width: 240px;
      max-width: 360px;
    }
    :where(.events-filters.filter-dock, form.filter-dock) #date-combo-button{
      width:100%; height:var(--ctrl-h); border-radius:var(--ctrl-radius);
      display:flex; align-items:center; justify-content:flex-start; gap:.5rem;
      padding: 0 16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .date-combo .combo-text{
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;
      max-width:100%;
    }

    /* Fallback pro klasická "od/do" pole když není combo aktivní */
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      .filter-group:has(#filter-date-from),
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      .filter-group:has(#filter-date-to){
      min-width:160px; max-width:220px;
    }
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      #filter-date-from,
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      #filter-date-to{
      max-width:220px;
    }
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      label[for="filter-date-from"],
    :where(.events-filters.filter-dock.dates-compact-mode, form.filter-dock.dates-compact-mode)
      label[for="filter-date-to"]{
      margin-bottom:6px;
    }

    /* === POPUP kalendář – ukotvení a rozměry po vzoru TM === */
    .ajsee-date-popover{
      position: fixed; z-index: 1200;
      max-width: 720px; width: min(720px, calc(100vw - 32px));
      background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
      overflow: hidden;
    }
    .ajsee-date-popover[data-compact="1"]{ max-width: 520px; }
  `);
}

function normalizeFilterFormUI(){
  // 1) sjednotit vzhled inputů/selectu (homepage i events)
  const cat = qs('#filter-category') || qs('#events-category-filter');
  if (cat && !cat.classList.contains('styled-select')) cat.classList.add('styled-select');

  [
    '#filter-city','#events-city-filter',
    '#filter-date-from','#events-date-from',
    '#filter-date-to','#events-date-to',
    '#filter-keyword'
  ].forEach(sel=>{
    const el = qs(sel);
    if (el && !el.classList.contains('styled-input')) el.classList.add('styled-input');
  });

  // 2) label-ikony: whitelist + masky
  injectOnce('ajsee-filters-icons-whitelist', `
    :where(.events-filters.filter-dock, form.filter-dock) label::before{ display:none; }
    :where(.events-filters.filter-dock, form.filter-dock) label[for="filter-city"]::before,
    :where(.events-filters.filter-dock, form.filter-dock) label[for="events-city-filter"]::before{
      display:inline-block; content:""; flex:0 0 18px; height:18px; opacity:.7; background: currentColor;
      -webkit-mask-repeat:no-repeat; -webkit-mask-position:center; -webkit-mask-size:18px 18px;
              mask-repeat:no-repeat;         mask-position:center;         mask-size:18px 18px;
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z'/%3E%3C/svg%3E");
              mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z'/%3E%3C/svg%3E");
    }
    :where(.events-filters.filter-dock, form.filter-dock) label[for="filter-date-from"]::before,
    :where(.events-filters.filter-dock, form.filter-dock) label[for="events-date-from"]::before,
    :where(.events-filters.filter-dock, form.filter-dock) label[for="filter-date-to"]::before,
    :where(.events-filters.filter-dock, form.filter-dock) label[for="events-date-to"]::before{
      display:inline-block; content:""; flex:0 0 18px; height:18px; opacity:.7; background: currentColor;
      -webkit-mask-repeat:no-repeat; -webkit-mask-position:center; -webkit-mask-size:18px 18px;
              mask-repeat:no-repeat;         mask-position:center;         mask-size:18px 18px;
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 2v3m10-3v3M3 9h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' stroke='black' stroke-width='2' fill='none'/%3E%3C/svg%3E");
              mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 2v3m10-3v3M3 9h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' stroke='black' stroke-width='2' fill='none'/%3E%3C/svg%3E");
    }
    :where(.events-filters.filter-dock, form.filter-dock) label[for="filter-keyword"]::before{
      display:inline-block; content:""; flex:0 0 18px; height:18px; opacity:.7; background: currentColor;
      -webkit-mask-repeat:no-repeat; -webkit-mask-position:center; -webkit-mask-size:18px 18px;
              mask-repeat:no-repeat;         mask-position:center;         mask-size:18px 18px;
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm10 16-4.3-4.3' stroke='black' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
              mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm10 16-4.3-4.3' stroke='black' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    }
  `);

  // 3) doplň 'for' na labely, pokud chybí
  const pairs = [
    ['filter-city','#filter-city,#events-city-filter'],
    ['filter-date-from','#filter-date-from,#events-date-from'],
    ['filter-date-to','#filter-date-to,#events-date-to'],
    ['filter-keyword','#filter-keyword']
  ];
  pairs.forEach(([forId, selector])=>{
    const input = qs(selector);
    if (!input) return;
    const group = input.closest('.filter-group') || input.parentElement;
    const label = group ? qs('label', group) : null;
    if (label && !label.getAttribute('for')) label.setAttribute('for', input.id || forId);
  });

  // 4) kompaktní sizing (bez přeskupení DOM)
  activateCompactFilterSizing();
}

/* ──────────────── DATE COMBO – jen „kotva“; logiku řeší ./filters/date-combo.js ─────────────── */
function parseISODateMidday(iso){
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2]-1, +m[3], 12, 0, 0, 0); // poledne → žádný UTC posun
}
function formatDateForLabel(iso){
  if (!iso) return '';
  try {
    const d = parseISODateMidday(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(getUILang(), { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return String(iso); }
}
function updateDateComboLabel(){
  const btnTxt = qs('.date-combo .combo-text');
  if (!btnTxt) return;
  const all = t('filters.allDates','Všechny termíny');
  const fromLbl = t('filters.from','Od');
  const toLbl   = t('filters.to','Do');

  const a = currentFilters.dateFrom ? `${fromLbl} ${formatDateForLabel(currentFilters.dateFrom)}` : '';
  const b = currentFilters.dateTo   ? `${toLbl} ${formatDateForLabel(currentFilters.dateTo)}`     : '';
  btnTxt.textContent = (a||b) ? [a,b].filter(Boolean).join(' – ') : all;
}
// export pro date-combo.js (pokud si potřebuje přepsat text tlačítka)
if (!window.updateDateComboLabel) window.updateDateComboLabel = updateDateComboLabel;

function ensureDateComboAnchor(){
  const from = qs('#filter-date-from') || qs('#events-date-from');
  const to   = qs('#filter-date-to')   || qs('#events-date-to');
  const form = qs('form.filter-dock') || qs('.events-filters');
  if (!form) return;

  // už existuje kotva / picker si ji sám upraví
  if (qs('.date-combo', form)) { updateDateComboLabel(); return; }

  if (!from && !to) return;

  // skryj původní skupiny (zůstanou pro kompatibilitu s odesláním formuláře)
  [from, to].forEach(inp=>{
    if (!inp) return;
    const g = inp.closest('.filter-group'); if (g) g.classList.add('is-hidden');
  });

  // vlož prázdnou kotvu za skupinu s městem; ./filters/date-combo.js ji „upgraduje“
  const mountAfter = (qs('#filter-city')||qs('#events-city-filter'))?.closest('.filter-group') || null;
  const wrap = document.createElement('div');
  wrap.className = 'filter-group date-combo';
  wrap.style.position = 'relative';
  if (mountAfter && mountAfter.parentElement) {
    mountAfter.parentElement.insertBefore(wrap, mountAfter.nextElementSibling);
  } else {
    form.appendChild(wrap);
  }
}

/* === Popover: detekce + umístění (smart; preferuje util) === */
const DATE_POPOVER_SELECTORS = [
  '.ajsee-date-popover',
  '.date-combo-popover',
  '.date-range-popover',
  '.date-range-popup',
  '.date-picker-popover',
  '.datepicker-popover',
  '.daterangepicker'
];
function findDatePopover(){
  for (const s of DATE_POPOVER_SELECTORS){
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}
function ensurePopoverWrapper(){
  let pop = findDatePopover();
  if (!pop) return null;
  if (!pop.classList.contains('ajsee-date-popover')){
    const wrap = document.createElement('div');
    wrap.className = 'ajsee-date-popover';
    pop.parentNode.insertBefore(wrap, pop);
    wrap.appendChild(pop);
    pop = wrap;
  }
  return pop;
}
function getDateAnchor(){
  return qs('#date-combo-button') || qs('.date-combo button, .date-combo .combo-trigger');
}
function positionDatePopoverInternal(){
  const anchor = getDateAnchor();
  let pop = ensurePopoverWrapper();
  if (!anchor || !pop) return;

  const ar = anchor.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;

  const maxW = Math.min(720, vw - 32);
  pop.style.maxWidth = maxW + 'px';
  pop.style.width = `min(720px, calc(100vw - 32px))`;

  const desiredLeft = ar.left + (ar.width/2) - (maxW/2);
  const left = clamp(Math.round(desiredLeft), 16, Math.max(16, vw - maxW - 16));
  const top = clamp(Math.round(ar.bottom + 8), 12, Math.max(12, vh - 12));

  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
function positionDatePopoverSmart(){
  const anchor = getDateAnchor();
  let pop = ensurePopoverWrapper();
  if (!anchor || !pop) return;
  if (typeof window.ajseePositionDatePopover === 'function') {
    window.ajseePositionDatePopover(anchor, pop);
  } else {
    positionDatePopoverInternal();
  }
}
function initDatePopoverPositioning(){
  if (document.querySelector('.date-combo .combo-popover')) return;

  const anchor = getDateAnchor();
  if (anchor){
    wireOnce(anchor, 'click', ()=>{
      setTimeout(positionDatePopoverSmart, 0);
      setTimeout(positionDatePopoverSmart, 30);
      setTimeout(positionDatePopoverSmart, 120);
    }, 'date-popover-open');
  }

  try{
    const mo = new MutationObserver(() => positionDatePopoverSmart());
    mo.observe(document.body, { childList:true, subtree:true });
  }catch{}

  wireOnce(window, 'resize', debounce(positionDatePopoverSmart, 80), 'date-popover-resize');
  wireOnce(window, 'scroll', debounce(positionDatePopoverSmart, 80), 'date-popover-scroll');
}

/* ───────── render events ───────── */
function mapLangToTm(l){ const m={cs:'cs-cz',sk:'sk-sk',pl:'pl-pl',de:'de-de',hu:'hu-hu',en:'en-gb'}; return m[(l||'en').slice(0,2)]||'en-gb'; }
function safeUrl(raw){ try{ const u=new URL(raw,location.href); if(/^https?:/i.test(u.protocol)) return u.toString(); }catch{} return '#'; }
function adjustTicketmasterLanguage(rawUrl,lang=getUILang()){ try{ const u=new URL(rawUrl,location.href); const val=mapLangToTm(lang); u.searchParams.set('language',val); if(!u.searchParams.has('locale')) u.searchParams.set('locale',val); return u.toString(); }catch{ return rawUrl; } }
function wrapAffiliate(url){ try{ const cfg=window.__impact||window.__aff||{}; if (cfg.clickBase) return cfg.clickBase+encodeURIComponent(url); if(cfg.param&&cfg.value){ const u=new URL(url); if(!u.searchParams.has(cfg.param)) u.searchParams.set(cfg.param,cfg.value); return u.toString(); } }catch{} return url; }

async function renderEvents(locale='cs',filters=currentFilters){
  const list = document.getElementById('eventsList'); if(!list) return;
  list.setAttribute('aria-live', 'polite');

  setBusy(true);
  try{
    const api = { ...filters, city: filters.city ? canonForInputCity(filters.city) : '' };
    const events = await getAllEvents({ locale, filters: api });

    if (!window.translations) window.translations = await loadTranslations(locale);

    let out=[...events];
    if (filters.category && filters.category!=='all') out=out.filter(e=>e.category===filters.category);

    if (filters.sort==='nearest') out.sort((a,b)=> new Date(a.datetime||a.date)-new Date(b.datetime||b.date));
    else out.sort((a,b)=> new Date(b.datetime||b.date)-new Date(a.datetime||a.date));

    updateResultsCount(out.length);

    const isHp = isHome();
    let toRender = out;
    let showAll = false;

    if (isHp) {
      if (out.length>6) { toRender = out.slice(0,6); showAll = true; }
    } else {
      const end = pagination.page * pagination.perPage;
      toRender = out.slice(0, end);
    }

    list.innerHTML = toRender.map(ev=>{
      const titleRaw = (typeof ev.title==='string'?ev.title:(ev.title?.[locale]||ev.title?.en||ev.title?.cs||Object.values(ev.title||{})[0])) || 'Untitled';
      const title = esc(titleRaw);
      const dateVal = ev.datetime || ev.date;
      const date = dateVal ? esc(new Date(dateVal).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})) : '';
      const img = ev.image || '/images/fallbacks/concert0.jpg';
      const detailHref = safeUrl(wrapAffiliate(adjustTicketmasterLanguage(ev.url||'', locale)));
      const ticketsHref= safeUrl(wrapAffiliate(adjustTicketmasterLanguage(ev.tickets||ev.url||'', locale)));
      const detailLabel = esc(t('event-details','Details'));
      const ticketLabel = esc(t('event-tickets','Tickets'));
      return `
        <article class="event-card">
          <img src="${esc(img)}" alt="${title}" class="event-img" loading="lazy"/>
          <div class="event-content">
            <h3 class="event-title">${title}</h3>
            <p class="event-date">${date}</p>
            <div class="event-buttons-group">
              <a href="${detailHref}" class="btn-event detail" target="_blank" rel="noopener noreferrer">${detailLabel}</a>
              <a href="${ticketsHref}" class="btn-event ticket" target="_blank" rel="noopener noreferrer">${ticketLabel}</a>
            </div>
          </div>
        </article>`;
    }).join('');

    if (!isHp) {
      const hasMore = toRender.length < out.length;
      const wrapId='eventsLoadMoreWrap'; document.getElementById(wrapId)?.remove();
      if (hasMore) {
        const w=document.createElement('div'); w.id=wrapId; w.className='events-load-more-wrap';
        w.innerHTML=`<button type="button" class="btn btn-secondary" id="btnLoadMore">${esc(t('events-load-more','Load more'))}</button>`;
        list.parentElement.appendChild(w);
        const btn = qs('#btnLoadMore', w);
        wireOnce(btn,'click', async ()=>{
          pagination.page += 1;
          await renderAndSync({ resetPage:false, autoCollapse:false });
          btn?.scrollIntoView({ block:'center' });
        }, 'loadmore');
      }
    }

    if (isHp && showAll){
      list.insertAdjacentHTML('beforeend', `
        <div class="events-show-all-btn">
          <a href="/events.html?lang=${locale}" class="btn btn-primary show-all-events-btn">${esc(t('events-show-all','Show all events'))}</a>
        </div>`);
    }

    announce(`${t('events-found','Nalezeno')||'Nalezeno'} ${out.length}`);
  }catch(e){
    console.error(e);
    list.innerHTML = `<p>${esc(t('events-load-error','Unable to load events. Try again later.'))}</p>`;
  } finally {
    setBusy(false);
  }
}

/* render & sync */
async function renderAndSync({resetPage=true, autoCollapse=false}={}){
  if (resetPage) pagination.page=1;
  normalizeDates();
  syncURLFromFilters();

  if (SKIP_CORE_EVENTS){
    G.bus('ajsee:filters')({ filters: { ...currentFilters }, lang: currentLang });
    renderActiveChips({
      t,
      getFilters: () => {
        const f = { ...currentFilters };
        if (f.category === 'all') delete f.category;
        return f;
      },
      setFilters: (patch)=>{ currentFilters = { ...currentFilters, ...patch }; },
      setFilterInputsFromState,
      renderAndSync,
      findChipsHost
    });
    updateToggleBadge();
    if (autoCollapse && hasActiveFilters()) collapseFilters();
    return;
  }

  await renderEvents(currentLang,currentFilters);
  renderActiveChips({
    t,
    getFilters: () => {
      const f = { ...currentFilters };
      if (f.category === 'all') delete f.category;
      return f;
    },
    setFilters: (patch)=>{ currentFilters = { ...currentFilters, ...patch }; },
    setFilterInputsFromState,
    renderAndSync,
    findChipsHost
  });
  updateToggleBadge();
  if (autoCollapse && hasActiveFilters()) collapseFilters();

  if (!isHome()) {
    const list = qs('#eventsList');
    if (list) list.scrollIntoView({ behavior:'smooth', block:'start' });
  }
}

/* ───────── DOM Ready ───────── */
document.addEventListener('DOMContentLoaded', async ()=>{
  ensureRuntimeStyles();
  updateHeaderOffset();
  wireOnce(window,'resize', debounce(updateHeaderOffset,150), 'hdr-offset');

  // jazyk & země
  currentLang = getUILang();
  document.documentElement.lang = currentLang;
  const langToCountry = { cs:'CZ', sk:'SK', de:'DE', pl:'PL', hu:'HU', en:'CZ' };
  const ccCookie = getCookie('aj_country');
  currentFilters.countryCode = (ccCookie || langToCountry[currentLang] || 'CZ').toUpperCase();

  await ensureTranslations(currentLang);
  initNav({ lang: currentLang });
  initContactFormValidation({ lang: currentLang, t });
  initEventModal();

  const formEl = qs('#events-filters-form');

  // zamez duplicitnímu reset tlačítku
  qsa('.filter-actions button[type="reset"]').forEach(btn => btn.remove());

  // toggle „Skrýt/Zobrazit filtry“
  const toolbar = qs('.filters-toolbar');
  if (toolbar && !qs('#filtersToggle', toolbar)) {
    const toggle = document.createElement('button');
    toggle.type='button';
    toggle.id='filtersToggle';
    toggle.className='chip ghost filters-toggle';
    toggle.setAttribute('aria-pressed','false');
    toggle.setAttribute('aria-controls','events-filters-form');

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = toggleLabel('hide');

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '0';

    toggle.appendChild(label);
    toggle.appendChild(badge);

    wireOnce(toggle,'click', ()=>toggleFilters(), 'filters-toggle');
    toolbar.appendChild(toggle);
    updateFilterLocaleTexts();
    updateToggleBadge();
  }

  window.addEventListener('AJSEE:langChanged', async (e)=>{
    currentLang = (e?.detail?.lang || getUILang());
    document.documentElement.lang = currentLang;
    await ensureTranslations(currentLang);
  });

  const savedCollapsed = store.get('filtersCollapsed', null);
  if (savedCollapsed === true) collapseFilters();

  upgradeSortToSegmented();

  // sjednocení vzhledu + kompaktní šířky (bez přesunu DOM)
  normalizeFilterFormUI();

  // >>> NEW: jen vytvoř „kotvu“ pro Ticketmaster-like DATE picker
  ensureDateComboAnchor();

  // a hned nastav hlídač pro umístění/rozměry popupu (preferuje util)
  initDatePopoverPositioning();

  // ------- Events page -------
  const eventsList = qs('#eventsList');
  if (eventsList && !SKIP_CORE_EVENTS) {
    const sp=new URLSearchParams(location.search);
    if (sp.get('city')) currentFilters.city = sp.get('city')||'';
    if (sp.get('from')) currentFilters.dateFrom = sp.get('from')||'';
    if (sp.get('to')) currentFilters.dateTo = sp.get('to')||'';
    if (sp.get('segment')) currentFilters.category = sp.get('segment')||'all';
    if (sp.get('q')) currentFilters.keyword = sp.get('q')||'';
    if (sp.get('sort')) currentFilters.sort = sp.get('sort')||'nearest';
    setFilterInputsFromState();
    updateToggleBadge();

    const $city = qs('#filter-city') || qs('#events-city-filter');
    if ($city) {
      setupCityTypeahead($city, {
        locale: currentLang,
        t,
        countryCodes: ['CZ','SK','PL','HU','DE','AT'],
        onChoose: (it)=>{
          $city.value=it.city; currentFilters.city=it.city;
          currentFilters.nearMeLat=null; currentFilters.nearMeLon=null;
          renderAndSync({autoCollapse:false}).then(()=>expandFilters());
        }
      });
    }

    wireOnce(document.getElementById('chipToday'),'click', async()=>{
      const d=new Date(); const iso=toLocalISO(d);
      currentFilters.dateFrom=iso; currentFilters.dateTo=iso; setFilterInputsFromState();
      await renderAndSync({autoCollapse:true});
    }, 'chipToday');

    wireOnce(document.getElementById('chipWeekend'),'click', async()=>{
      const now=new Date(); const day=now.getDay(); const diffToSat=(6-day+7)%7;
      const sat=new Date(now); sat.setDate(now.getDate()+diffToSat);
      const sun=new Date(sat); sun.setDate(sat.getDate()+1);
      currentFilters.dateFrom=toLocalISO(sat); currentFilters.dateTo=toLocalISO(sun);
      setFilterInputsFromState(); await renderAndSync({autoCollapse:true});
    }, 'chipWeekend');

    wireOnce(document.getElementById('chipClear'),'click', async()=>{
      const cc=currentFilters.countryCode;
      currentFilters={category:'all',sort:'nearest',city:'',dateFrom:'',dateTo:'',keyword:'',countryCode:cc,nearMeLat:null,nearMeLon:null,nearMeRadiusKm:50};
      setFilterInputsFromState(); expandFilters(); await renderAndSync({autoCollapse:false});
    }, 'chipClear');

    attachNearMeButton({
      formEl: formEl || qs('.events-filters'),
      t,
      wireOnce,
      getLang: () => currentLang,
      getFilters: () => ({ ...currentFilters }),
      setFilters: (patch) => { currentFilters = { ...currentFilters, ...patch }; },
      setFilterInputsFromState,
      renderAndSync
    });

    const $cat=qs('#filter-category');
    const $sort=qs('#filter-sort') || qs('#events-sort-filter');
    const $from=qs('#filter-date-from');
    const $to=qs('#filter-date-to');
    const $kw=qs('#filter-keyword');

    if ($cat) wireOnce($cat,'change', async e=>{ currentFilters.category=e.target.value||'all'; await renderAndSync({autoCollapse:false}); }, 'cat');
    if ($sort) wireOnce($sort,'change', async e=>{ currentFilters.sort=e.target.value||'nearest'; await renderAndSync({autoCollapse:false}); }, 'sort');
    if ($from) wireOnce($from,'change', e=> { currentFilters.dateFrom=e.target.value||''; updateDateComboLabel(); updateToggleBadge(); }, 'from');
    if ($to)   wireOnce($to,'change',   e=> { currentFilters.dateTo  =e.target.value||''; updateDateComboLabel(); updateToggleBadge(); }, 'to');
    if ($kw)   wireOnce($kw,'input',    e=> { currentFilters.keyword =e.target.value.trim(); updateToggleBadge(); }, 'kw');

    if (formEl) {
      wireOnce(formEl,'submit', async e=>{
        e.preventDefault();
        await renderAndSync({autoCollapse:true});
      }, 'submit');
      wireOnce(formEl,'reset',  async ()=>{
        const cc=currentFilters.countryCode;
        currentFilters={category:'all',sort:'nearest',city:'',dateFrom:'',dateTo:'',keyword:'',countryCode:cc,nearMeLat:null,nearMeLon:null,nearMeRadiusKm:50};
        setFilterInputsFromState(); expandFilters(); await renderAndSync({autoCollapse:false});
      }, 'reset');
    }

    await renderAndSync({autoCollapse:false});
  }

  // ------- Mobile sheet -------
  (function initFilterSheet(){
    const sheet = qs('form.filter-dock[data-behavior="sheet"]'); if (!sheet) return;
    const fab=qs('#filtersOpen'); const closeBtn=qs('#filtersClose',sheet); const overlay=qs('#filtersOverlay');
    const open=()=>{ expandFilters(); sheet.classList.add('is-open'); if(overlay){ overlay.hidden=false; overlay.classList.add('is-open'); } document.body.style.overflow='hidden'; };
    const close=()=>{ sheet.classList.remove('is-open'); if(overlay){ overlay.classList.remove('is-open'); overlay.hidden=true; } document.body.style.overflow=''; };
    wireOnce(fab,'click',open,'sheet-open'); wireOnce(closeBtn,'click',close,'sheet-close'); wireOnce(overlay,'click',close,'sheet-over'); wireOnce(document,'keydown',e=>{ if(e.key==='Escape') close(); },'sheet-esc');
  })();

  // ------- Home: TOP 3 blog (lazy) -------
  ridle(async ()=>{
    const onBlog = /\/blog(\.html)?$/i.test(location.pathname) || !!document.querySelector('main#blog');
    if (onBlog) return;
    const host = document.querySelector('[data-home-blog]') || document.querySelector('#blog .blog-cards') || document.querySelector('.blog .blog-cards');
    if (!host) return;

    const render = async () => {
      let micro=[];
      try{
        const r=await fetch('/content/microguides/index.json',{cache:'no-store'}); const raw=r.ok?await r.json():[]; const arr=Array.isArray(raw)?raw:(raw?.items||[]);
        micro=(arr||[]).filter(it=>((it.language||currentLang)||'').toLowerCase()===currentLang).map(it=>({type:'microguide',slug:it.slug,lang:it.language||currentLang,title:it.title||'',lead:it.summary||'',image:it.cover||'',ts:Date.parse(it.publishedAt||0)||0}));
      }catch{}
      const arts=getSortedBlogArticles(currentLang).map(a=>({type:'article',slug:a.slug,lang:currentLang,title:a.titleText,lead:a.leadText,image:a.image,ts:a._ts}));
      const all=[...micro,...arts].sort((a,b)=>b.ts-a.ts).slice(0,3);
      const href=(c)=> c.type==='microguide' ? `/microguides/?slug=${encodeURIComponent(c.slug)}&lang=${encodeURIComponent(c.lang)}` : `/blog-detail.html?slug=${encodeURIComponent(c.slug)}&lang=${encodeURIComponent(c.lang)}`;
      host.innerHTML = all.map(c=>`
        <div class="blog-card" data-type="${c.type}">
          <a href="${href(c)}">
            ${c.image ? `<div class="card-media"><img src="${esc(c.image)}" alt=""></div>` : ''}
            <div class="blog-card-body">
              <h3 class="blog-card-title">${esc(c.title)}</h3>
              <div class="blog-card-lead">${esc(c.lead)}</div>
              <div class="blog-card-actions"><span class="blog-readmore">${esc(t('blog-read-more','Read more'))}</span></div>
            </div>
          </a>
        </div>`).join('');
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries)=>{
        const e = entries.find(x=>x.isIntersecting);
        if (e){ io.disconnect(); void render(); }
      }, { rootMargin: '200px' });
      io.observe(host);
    } else {
      void render();
    }
  });
});
