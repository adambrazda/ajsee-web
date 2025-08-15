// src/main.js
// ---------------------------------------------------------
// AJSEE – Events UI, i18n & filters (+ city typeahead, "Near me",
// quick chips (Today/Weekend/Clear), active-filter chips,
// URL sync, calendar links, mobile sheet, geolocation w/ IP fallback,
// CLICK-ONLY pagination (Load more), collapsible filter dock, typeahead live-region fix
// ---------------------------------------------------------

import './styles/main.scss';
import { getAllEvents } from './api/eventsApi.js';
import { setupCityTypeahead } from './city/typeahead.js';
import { canonForInputCity } from './city/canonical.js';

// ------- Global state -------
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
let currentLang = 'cs';

// pagination (click-only)
const pagination = { page: 1, perPage: 12 };

// collapsible dock
let filtersCollapsed = false;

// Store last opened event for modal (optional future use)
let selectedEvent = null;

// ------- Small helpers -------
function debounce(fn, wait = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1];
}
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

function fetchWithTimeout(url, { timeout = 8000, ...opts } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(t));
}

// Inject minimal CSS (runtime) – sr-only + collapsed dock + dynamic sticky top
function ensureRuntimeStyles() {
  if (!document.getElementById('ajsee-runtime-style')) {
    const style = document.createElement('style');
    style.id = 'ajsee-runtime-style';
    style.textContent = `
      /* vizuálně skryté (pro live regiony) */
      .sr-only{
        position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
        clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;
      }
      /* sbalený filter dock */
      .filter-dock.is-collapsed .filters-fieldset{display:none;}
      .filter-dock.is-collapsed{padding-bottom:.6rem;}
      .filter-dock.is-collapsed .filters-toolbar{margin-bottom:0;}
      .filters-toggle.chip{display:inline-flex;align-items:center;gap:.5rem;}
      /* dynamický offset pod header (řeší "useknutí") */
      .events-upcoming-section .filter-dock{top:var(--header-offset, 88px);}
    `;
    document.head.appendChild(style);
  }
}

// dynamický offset podle výšky headeru
function updateHeaderOffset() {
  const header = qs('.site-header');
  const h = header ? Math.ceil(header.getBoundingClientRect().height) : 80;
  // malý bezpečný rozestup
  const safe = Math.max(56, h + 8);
  document.documentElement.style.setProperty('--header-offset', `${safe}px`);
}

// ------- Helpers: typography -------
function fixNonBreakingShortWords(text, lang = 'cs') {
  if (!text || typeof text !== 'string') return text;
  switch (lang) {
    case 'cs':
    case 'sk': return text.replace(/ ([aAiIkoOsSuUvVzZ]) /g, '\u00a0$1\u00a0');
    case 'pl': return text.replace(/ ([aAiIoOuUwWzZ]) /g, '\u00a0$1\u00a0');
    case 'hu': return text.replace(/ ([aAiIsS]) /g, '\u00a0$1\u00a0');
    case 'de':
    case 'en': return text.replace(/ ([aI]) /g, '\u00a0$1\u00a0');
    default:   return text;
  }
}

// ------- Helpers: language detection -------
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(urlLang)) return urlLang;
  const lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  return ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(lang) ? lang : 'cs';
}

// ------- Helpers: dates & URL -------
function toISODate(d) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
}
function syncURLFromFilters() {
  const u = new URL(window.location.href);
  const p = u.searchParams;
  (currentFilters.city ? p.set('city', currentFilters.city) : p.delete('city'));
  (currentFilters.dateFrom ? p.set('from', toISODate(currentFilters.dateFrom)) : p.delete('from'));
  (currentFilters.dateTo ? p.set('to', toISODate(currentFilters.dateTo)) : p.delete('to'));
  (currentFilters.category && currentFilters.category !== 'all' ? p.set('segment', currentFilters.category) : p.delete('segment'));
  (currentFilters.keyword ? p.set('q', currentFilters.keyword) : p.delete('q'));
  (currentFilters.sort && currentFilters.sort !== 'nearest' ? p.set('sort', currentFilters.sort) : p.delete('sort'));
  history.replaceState(null, '', u.toString());
}

// ------- i18n -------
async function loadTranslations(lang) {
  const resp = await fetch(`/locales/${lang}.json`);
  return await resp.json();
}
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}
function t(key, fallback) {
  const tr = window.translations || {};

  const exact = getByPath(tr, key) ?? tr[key];
  if (exact !== undefined) return exact;

  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, '');
    const v = getByPath(tr, `filters.${tail}`) ?? tr[`filters.${tail}`];
    if (v !== undefined) return v;
  }
  if (key.startsWith('filters.')) {
    const tail = key.replace(/^filters\./, '');
    const flat = `filter-${tail}`;
    const v = tr[flat];
    if (v !== undefined) return v;
  }
  if (key.startsWith('category-')) {
    const v = getByPath(tr, `filters.${key.replace('category-', '')}`);
    if (v !== undefined) return v;
  }
  return fallback;
}

// Fallback překlady pro toggle (když v JSON chybí)
const toggleFallback = {
  cs: { show: 'Zobrazit filtry', hide: 'Skrýt filtry' },
  en: { show: 'Show filters',     hide: 'Hide filters' },
  de: { show: 'Filter anzeigen',  hide: 'Filter ausblenden' },
  sk: { show: 'Zobraziť filtre',  hide: 'Skryť filtre' },
  pl: { show: 'Pokaż filtry',     hide: 'Ukryj filtry' },
  hu: { show: 'Szűrők megjelenítése', hide: 'Szűrők elrejtése' }
};
function toggleLabel(mode) { // 'show' | 'hide'
  const fb = (toggleFallback[currentLang] || toggleFallback.en)[mode];
  const key = mode === 'show' ? 'filters.show' : 'filters.hide';
  return t(key, fb);
}

/**
 * Bezpečně vybere nejlepší lokalizovaný text z mapy
 */
function pickLocalized(map, preferred = []) {
  if (!map) return '';
  if (typeof map === 'string') return map;
  if (typeof map !== 'object') return '';
  for (const k of preferred) {
    const v = map?.[k];
    if (v) return String(v);
  }
  const any = Object.values(map).find(Boolean);
  return any ? String(any) : '';
}

/** Set texts/labels/placeholders for filter UI that don't have data-i18n-* attributes */
function setBtnLabel(el, text) {
  if (!el) return;
  const lbl = el.querySelector('[data-i18n-label], .label, .btn-label');
  if (lbl) lbl.textContent = text;
  else el.textContent = text;
}
function updateFilterLocaleTexts() {
  // Quick chips
  setBtnLabel(qs('#chipToday'),   t('filters.today',   'Today'));
  setBtnLabel(qs('#chipWeekend'), t('filters.weekend', 'This weekend'));
  // Near Me – both chip and fallback ghost button
  setBtnLabel(qs('#chipNearMe'),    t('filters.nearMe', 'Near me'));
  setBtnLabel(qs('#filter-nearme'), t('filters.nearMe', 'Near me'));

  // Placeholders
  const cityInput = qs('#filter-city') || qs('#events-city-filter');
  const cityPh = t('filters.cityPlaceholder') ?? t('filters.searchCityPlaceholder') ?? 'Prague, Brno...';
  if (cityInput) cityInput.placeholder = cityPh;

  const kwInput = qs('#filter-keyword');
  const kwPh = t('filters.keywordPlaceholder') ?? t('filters.searchPlaceholder') ?? 'Artist, venue, event...';
  if (kwInput) kwInput.placeholder = kwPh;

  // Action buttons
  const applyBtn = qs('#events-apply-filters') || qs('.filter-actions .btn.btn-primary');
  if (applyBtn) setBtnLabel(applyBtn, t('filters.apply', 'Apply filters'));

  const resetBtn = qs('#events-clear-filters') || qs('.filter-actions button[type="reset"]');
  if (resetBtn) setBtnLabel(resetBtn, t('filters.reset', 'Clear'));

  // Filters toggle (runtime)
  const toggleBtn = qs('#filtersToggle');
  if (toggleBtn) setBtnLabel(toggleBtn, filtersCollapsed ? toggleLabel('show') : toggleLabel('hide'));
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations;

  document.querySelectorAll('[data-i18n-key]').forEach((el) => {
    const key = el.getAttribute('data-i18n-key');
    let value = t(key);
    if (value !== undefined) {
      if (['p', 'span'].includes(el.tagName.toLowerCase())) {
        value = fixNonBreakingShortWords(value, lang);
      }
      if (/<[a-z][\s\S]*>/i.test(value)) el.innerHTML = value;
      else el.textContent = value;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (value !== undefined) {
      el.setAttribute('placeholder', fixNonBreakingShortWords(String(value), lang));
    }
  });

  updateFilterLocaleTexts();
}

// ------- Nav -------
function activateNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isHome = (path === '/' || path.endsWith('index.html')) && (href === '/' || href === '/index.html');
    const match =
      isHome ||
      (path.endsWith('partners.html') && href.includes('partners')) ||
      (path.endsWith('about.html') && href.includes('about')) ||
      (path.endsWith('events.html') && href.includes('events'));
    link.classList.toggle('active', !!match);
  });
}
function updateMenuLinksWithLang(lang) {
  document.querySelectorAll('.main-nav a').forEach((link) => {
    let href = link.getAttribute('href') || '';
    if (!href || href.startsWith('mailto:') || href.startsWith('http')) return;

    if (href.endsWith('#blog')) {
      href = `/index.html?lang=${lang}#blog`;
    } else if (href.endsWith('#contact')) {
      href = `/index.html?lang=${lang}#contact`;
    } else {
      href = href.replace(/\?lang=[a-z]{2}/, '').replace(/&lang=[a-z]{2}/, '');
      href = href.includes('?') ? `${href}&lang=${lang}` : `${href}?lang=${lang}`;
    }
    link.setAttribute('href', href);
  });
}

/* =========================================================
   Quick chips (Today / Weekend / Clear) + Active chips + Near Me
   ========================================================= */

// --- Quick chips (Today / Weekend / Clear) ---
function pad2(n){ return String(n).padStart(2,'0'); }
function toLocalISO(d){
  const y = d.getFullYear(), m = pad2(d.getMonth()+1), day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function setTodayRange() {
  const today = new Date();
  const iso = toLocalISO(today);
  currentFilters.dateFrom = iso;
  currentFilters.dateTo   = iso;
}
function setWeekendRange() {
  const now = new Date();              // 0=Ne ... 6=So
  const day = now.getDay();
  const diffToSat = (6 - day + 7) % 7; // nejbližší sobota
  const sat = new Date(now); sat.setDate(now.getDate() + diffToSat);
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  currentFilters.dateFrom = toLocalISO(sat);
  currentFilters.dateTo   = toLocalISO(sun);
}
function applyDatesToInputs(){
  const $from = qs('#filter-date-from') || qs('#events-date-from');
  const $to   = qs('#filter-date-to')   || qs('#events-date-to');
  if ($from) $from.value = currentFilters.dateFrom || '';
  if ($to)   $to.value   = currentFilters.dateTo   || '';
}
function setupQuickChips(formEl){
  const chipToday = document.getElementById('chipToday');
  const chipWknd  = document.getElementById('chipWeekend');
  const chipClear = document.getElementById('chipClear');
  const resetBtn  = formEl?.querySelector('.filter-actions button[type="reset"]');

  if (chipClear && resetBtn) chipClear.remove();

  chipToday?.addEventListener('click', async () => {
    setTodayRange();
    applyDatesToInputs();
    await renderAndSync();
  });

  chipWknd?.addEventListener('click', async () => {
    setWeekendRange();
    applyDatesToInputs();
    await renderAndSync();
  });

  chipClear?.addEventListener('click', async () => {
    const cc = currentFilters.countryCode;
    currentFilters = {
      category:'all', sort:'nearest', city:'', dateFrom:'', dateTo:'',
      keyword:'', countryCode: cc, nearMeLat: null, nearMeLon: null, nearMeRadiusKm: 50
    };
    setFilterInputsFromState();
    expandFilters(); // po resetu rozbal
    await renderAndSync();
  });
}

// --- Reverse geocode lat/lon -> city label (best effort) ---
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      zoom: '10',
      addressdetails: '1'
    }).toString()}`;
    const r = await fetchWithTimeout(url, { timeout: 6500, headers: { 'Accept-Language': currentLang } });
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || null;
  } catch { return null; }
}

// --- Geolocation (HTML5) with IP fallback ---
async function getPositionWithFallback() {
  try {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('UNSUPPORTED'));
      navigator.geolocation.getCurrentPosition(res, (err) => {
        if (err && typeof err.code === 'number') {
          if (err.code === 1) rej(new Error('PERMISSION_DENIED'));
          else if (err.code === 2) rej(new Error('POSITION_UNAVAILABLE'));
          else if (err.code === 3) rej(new Error('TIMEOUT'));
          else rej(err);
        } else rej(err || new Error('GEO_ERROR'));
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'browser' };
  } catch (e) { /* continue with IP */ }

  try {
    const r = await fetchWithTimeout('https://ipapi.co/json/', { timeout: 7000 });
    if (r.ok) {
      const j = await r.json();
      if (j && j.latitude && j.longitude) {
        console.info('[NearMe] Using IP fallback:', { lat: j.latitude, lon: j.longitude, source: 'ipapi' });
        return { lat: j.latitude, lon: j.longitude, source: 'ipapi' };
      }
    }
  } catch { /* ignore */ }

  throw new Error('POSITION_UNAVAILABLE');
}

// --- robustní handler pro geolokaci – sdílený chip/ghost tlačítky ---
async function handleNearMeClick(btn) {
  const allBtns = [qs('#chipNearMe'), qs('#filter-nearme')].filter(Boolean);

  try {
    allBtns.forEach(b => { b.disabled = true; b.textContent = t('filters.finding', 'Detecting location…'); });

    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }
      }
    } catch { /* ignore */ }

    const { lat, lon } = await getPositionWithFallback();

    currentFilters.nearMeLat = Number(lat);
    currentFilters.nearMeLon = Number(lon);
    currentFilters.nearMeRadiusKm = 50;

    // vizuální vyplnění "Město" (nezapisujeme do currentFilters.city)
    const cityInput = qs('#filter-city') || qs('#events-city-filter');
    if (cityInput) {
      const label = (await reverseGeocode(lat, lon)) || '';
      if (label) {
        cityInput.value = `${label} (okolí)`;
        cityInput.dataset.autofromnearme = '1';
      }
    }

    currentFilters.city = ''; // priorita je nearMe
    setFilterInputsFromState();
    await renderAndSync();
  } catch (e) {
    console.warn('Geo failed:', e);
    let msg = t('filters.geoError', 'Location unavailable. Try again.');
    const em = String(e?.message || '');
    if (em.includes('PERMISSION_DENIED')) {
      msg = t('filters.geoDenied', 'Access to location denied. Enable it in the browser settings.');
    } else if (em.includes('TIMEOUT')) {
      msg = t('filters.geoTimeout', 'Getting your location took too long. Please try again.');
    }
    alert(msg);
  } finally {
    allBtns.forEach(b => { if (b) { b.disabled = false; b.textContent = t('filters.nearMe', 'Near me'); } });
  }
}

function renderFilterChips() {
  let host = qs('.chips-active');
  if (!host) {
    host = document.createElement('div');
    host.className = 'chips chips-active';
    const toolbar = qs('.filters-toolbar');
    if (toolbar?.parentNode) {
      toolbar.parentNode.insertBefore(host, toolbar.nextSibling);
    } else {
      const section = qs('.section-events .container') || qs('.events-upcoming-section .container') || document.body;
      section.insertBefore(host, qs('#eventsList') || section.firstChild);
    }
  }

  host.innerHTML = '';

  const addChip = (label, onClear) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip is-active';
    chip.textContent = label;
    chip.setAttribute('aria-label', `${label} – ${t('filters.reset','Clear')}`);
    chip.addEventListener('click', onClear);
    host.appendChild(chip);
  };

  if (currentFilters.category && currentFilters.category !== 'all') {
    addChip(`${t('filters.category','Category')}: ${t('category-'+currentFilters.category, currentFilters.category)}`, () => {
      currentFilters.category = 'all';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.city) {
    addChip(`${t('filters.city','City')}: ${currentFilters.city}`, () => {
      currentFilters.city = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.dateFrom) {
    addChip(`${t('filters.dateFrom','From')}: ${toISODate(currentFilters.dateFrom)}`, () => {
      currentFilters.dateFrom = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.dateTo) {
    addChip(`${t('filters.dateTo','To')}: ${toISODate(currentFilters.dateTo)}`, () => {
      currentFilters.dateTo = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.keyword) {
    addChip(`${t('filters.keyword','Keyword')}: ${currentFilters.keyword}`, () => {
      currentFilters.keyword = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.sort && currentFilters.sort !== 'nearest') {
    addChip(`${t('filters.sort','Sort')}: ${t('filters.latest','Latest')}`, () => {
      currentFilters.sort = 'nearest';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
    addChip(`${t('filters.nearMe','Near me')} ~${currentFilters.nearMeRadiusKm} km`, () => {
      clearNearMe();
      setFilterInputsFromState();
      renderAndSync();
    });
  }
}

// Vloží / naváže „V mém okolí“ – bez duplicit
function attachNearMeButton(formEl) {
  if (!formEl) return;

  const chipNear = qs('#chipNearMe', formEl) || qs('#chipNearMe');
  const actions = qs('.filter-actions', formEl) || (() => {
    const div = document.createElement('div');
    div.className = 'filter-actions';
    formEl.appendChild(div);
    return div;
  })();

  const oldGhost = qs('#filter-nearme', actions);
  if (chipNear && oldGhost) oldGhost.remove();

  if (chipNear) {
    chipNear.removeEventListener('click', chipNear.__handler || (() => {}));
    chipNear.__handler = () => handleNearMeClick(chipNear);
    chipNear.addEventListener('click', chipNear.__handler);
    return;
  }

  if (!qs('#filter-nearme', actions)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'filter-nearme';
    btn.className = 'btn btn-ghost';
    btn.textContent = t('filters.nearMe', 'Near me');
    btn.addEventListener('click', () => handleNearMeClick(btn));
    actions.prepend(btn);
  }
}

function clearNearMe() {
  currentFilters.nearMeLat = null;
  currentFilters.nearMeLon = null;
}

// props -> inputy
function setFilterInputsFromState() {
  const $cat = qs('#filter-category') || qs('#events-category-filter');
  const $sort = qs('#filter-sort') || qs('#events-sort-filter');
  const $city = qs('#filter-city') || qs('#events-city-filter');
  const $from = qs('#filter-date-from') || qs('#events-date-from');
  const $to = qs('#filter-date-to') || qs('#events-date-to');
  const $keyword = qs('#filter-keyword');

  if ($cat) $cat.value = currentFilters.category || 'all';
  if ($sort) $sort.value = currentFilters.sort || 'nearest';
  if ($city && !$city.matches('[data-autofromnearme="1"]')) $city.value = currentFilters.city || '';
  if ($from) $from.value = currentFilters.dateFrom || '';
  if ($to) $to.value = currentFilters.dateTo || '';
  if ($keyword) $keyword.value = currentFilters.keyword || '';
}

function hasActiveFilters() {
  return (
    (currentFilters.category && currentFilters.category !== 'all') ||
    !!currentFilters.city ||
    !!currentFilters.dateFrom ||
    !!currentFilters.dateTo ||
    !!currentFilters.keyword ||
    (currentFilters.sort && currentFilters.sort !== 'nearest') ||
    (currentFilters.nearMeLat && currentFilters.nearMeLon)
  );
}

// Collapsible dock controls
function collapseFilters() {
  const dock = qs('form.filter-dock') || qs('.events-filters');
  if (!dock) return;
  filtersCollapsed = true;
  dock.classList.add('is-collapsed');
  const toggle = qs('#filtersToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', 'true');
    setBtnLabel(toggle, toggleLabel('show'));
  }
}
function expandFilters() {
  const dock = qs('form.filter-dock') || qs('.events-filters');
  if (!dock) return;
  filtersCollapsed = false;
  dock.classList.remove('is-collapsed');
  const toggle = qs('#filtersToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', 'false');
    setBtnLabel(toggle, toggleLabel('hide'));
  }
}
function toggleFilters() { (filtersCollapsed ? expandFilters : collapseFilters)(); }

// central render + url + chips
async function renderAndSync({ resetPage = true } = {}) {
  if (resetPage) pagination.page = 1;
  syncURLFromFilters();
  await renderEvents(currentLang, currentFilters);
  renderFilterChips();
  if (hasActiveFilters()) collapseFilters();
}

/* =========================================================
   Mobile bottom sheet (FAB „Filtry“)
   ========================================================= */
function initFilterSheet() {
  const sheet = qs('form.filter-dock[data-behavior="sheet"]');
  if (!sheet) return;
  const fab = qs('#filtersOpen');
  const closeBtn = qs('#filtersClose', sheet);
  const overlay = qs('#filtersOverlay');

  const open = () => {
    expandFilters();
    sheet.classList.add('is-open');
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add('is-open');
    }
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    sheet.classList.remove('is-open');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.hidden = true;
    }
    document.body.style.overflow = '';
  };

  fab?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ------- DOM Ready -------
document.addEventListener('DOMContentLoaded', async () => {
  ensureRuntimeStyles();
  updateHeaderOffset();
  window.addEventListener('resize', debounce(updateHeaderOffset, 150));

  currentLang = detectLang();

  // Simple mapping lang -> countryCode
  const langToCountry = { cs:'CZ', sk:'SK', de:'DE', pl:'PL', hu:'HU', en:'CZ' };
  const ccCookie = getCookie('aj_country');
  currentFilters.countryCode = (ccCookie || langToCountry[currentLang] || 'CZ').toUpperCase();

  updateMenuLinksWithLang(currentLang);
  await applyTranslations(currentLang);
  activateNavLink();

  // Jazykové přepínače
  qsa('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = btn.dataset.lang;
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.location.href = url.toString();
    });
  });

  // Zachování lang v odkazech
  ['events.html', 'about.html'].forEach((page) => {
    qsa(`a[href="/${page}"], a.btn-secondary[href="/${page}"]`).forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/${page}?lang=${currentLang}`;
      });
    });
  });

  // Home CTA
  const homeLink = qs('a[data-i18n-key="nav-home"]');
  if (homeLink) {
    homeLink.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `/?lang=${currentLang}`;
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await applyTranslations(currentLang);
      renderAndSync();
    });
  }

  // Mobile menu
  const hamburger = document.querySelector('.hamburger-btn');
  const nav = document.querySelector('.main-nav');
  const overlayNav = document.querySelector('.menu-overlay-bg');
  const closeBtnNav = document.querySelector('.menu-close');

  if (hamburger && nav && overlayNav && closeBtnNav) {
    nav.classList.remove('open');
    overlayNav.classList.remove('active');
    overlayNav.style.pointerEvents = 'none';
    overlayNav.style.opacity = '0';
    document.body.classList.remove('nav-open');
    document.body.style.overflow = '';

    const openMenu = () => {
      nav.classList.add('open');
      overlayNav.classList.add('active');
      overlayNav.style.pointerEvents = 'auto';
      overlayNav.style.opacity = '1';
      document.body.classList.add('nav-open');
      document.body.style.overflow = 'hidden';
      updateHeaderOffset(); // header může změnit výšku
    };

    const closeMenu = () => {
      nav.classList.remove('open');
      overlayNav.classList.remove('active');
      overlayNav.style.pointerEvents = 'none';
      overlayNav.style.opacity = '0';
      document.body.classList.remove('nav-open');
      document.body.style.overflow = '';
      updateHeaderOffset();
    };

    hamburger.addEventListener('click', openMenu);
    closeBtnNav.addEventListener('click', closeMenu);
    overlayNav.addEventListener('click', closeMenu);
    document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }

  // ------- Filters -------
  const eventsList = qs('#eventsList');
  const formEl = qs('#events-filters-form');

  if (eventsList) {
    const qsUrl = new URLSearchParams(window.location.search);
    if (qsUrl.get('city')) currentFilters.city = qsUrl.get('city') || '';
    if (qsUrl.get('from')) currentFilters.dateFrom = qsUrl.get('from') || '';
    if (qsUrl.get('to')) currentFilters.dateTo = qsUrl.get('to') || '';
    if (qsUrl.get('segment')) currentFilters.category = qsUrl.get('segment') || 'all';
    if (qsUrl.get('q')) currentFilters.keyword = qsUrl.get('q') || '';
    if (qsUrl.get('sort')) currentFilters.sort = qsUrl.get('sort') || 'nearest';

    const $cat = qs('#filter-category') || qs('#events-category-filter');
    const $sort = qs('#filter-sort') || qs('#events-sort-filter');
    const $city = qs('#filter-city') || qs('#events-city-filter');
    const $from = qs('#filter-date-from') || qs('#events-date-from');
    const $to   = qs('#filter-date-to')   || qs('#events-date-to');
    const $keyword = qs('#filter-keyword');
    const $form = formEl;
    const $applyBtnOnEventsPage = qs('#events-apply-filters');

    setFilterInputsFromState();

    // Filters toggle button (runtime, no HTML change)
    const toolbar = qs('.filters-toolbar', $form || document);
    if (toolbar && !qs('#filtersToggle', toolbar)) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'filtersToggle';
      toggle.className = 'chip ghost filters-toggle';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-controls', 'events-filters-form');
      toggle.addEventListener('click', () => toggleFilters());
      toolbar.appendChild(toggle);
      updateFilterLocaleTexts();
    }

    // City typeahead
    if ($city) {
      setupCityTypeahead($city, {
        locale: currentLang,
        t,
        countryCodes: ['CZ','SK','PL','HU','DE','AT'],
        onChoose: (it) => {
          $city.value = it.city;
          currentFilters.city = it.city;
          clearNearMe();
          renderAndSync().then(() => collapseFilters());
        }
      });
    }

    // Quick chips
    setupQuickChips($form || qs('.events-filters'));

    // Near Me – chip/ghost
    attachNearMeButton($form || qs('.events-filters'));

    // Pokud přicházíme s aktivními filtry (z URL), rovnou zobraz a sbal
    await renderAndSync();
    if (hasActiveFilters()) collapseFilters();

    // Handlery
    $cat?.addEventListener('change', async (e) => {
      currentFilters.category = e.target.value || 'all';
      await renderAndSync();
    });
    $sort?.addEventListener('change', async (e) => {
      currentFilters.sort = e.target.value || 'nearest';
      await renderAndSync();
    });
    $city?.addEventListener('input', async (e) => {
      currentFilters.city = e.target.value.trim();
      if (currentFilters.city) clearNearMe();
      $city.removeAttribute('data-autofromnearme');
    });
    $from?.addEventListener('change', (e) => (currentFilters.dateFrom = e.target.value || ''));
    $to?.addEventListener('change',   (e) => (currentFilters.dateTo   = e.target.value || ''));
    $keyword?.addEventListener('input', (e) => (currentFilters.keyword = e.target.value.trim()));

    if ($form) {
      $form.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        [$from, $to].forEach((input) => input?.classList.remove('input-error'));

        if ($from?.value && $to?.value && new Date($from.value) > new Date($to.value)) {
          valid = false;
          [$from, $to].forEach((input) => input?.classList.add('input-error'));
        }

        if (valid) {
          await renderAndSync(); // resetuje page=1
          collapseFilters();     // po aplikaci filtrů sbal
        }
      });

      $form.addEventListener('reset', async () => {
        const cc = currentFilters.countryCode;
        currentFilters = { category: 'all', sort: 'nearest', city: '', dateFrom: '', dateTo: '', keyword: '', countryCode: cc, nearMeLat: null, nearMeLon: null, nearMeRadiusKm: 50 };
        setFilterInputsFromState();
        expandFilters(); // po resetu rozbal
        await renderAndSync();
      });
    }

    // Events page (div + vlastní Apply button)
    if ($applyBtnOnEventsPage) {
      $applyBtnOnEventsPage.addEventListener('click', async () => {
        if ($from?.value && $to?.value && new Date($from.value) > new Date($to?.value)) {
          [$from, $to].forEach((input) => input?.classList.add('input-error'));
          return;
        }
        await renderAndSync();
        collapseFilters();
      });
    }
  }

  // spodní sheet (mobil)
  initFilterSheet();

  // ------- Contact form validation -------
  const form = qs('#contact-form');
  const errorMsg = qs('#contact-error');

  function hideAllFieldErrors(formEl) {
    formEl.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
      el.classList.remove('active');
    });
    formEl.querySelectorAll('input, textarea').forEach((el) => {
      el.classList.remove('input-error');
    });
  }
  function showFieldError(formEl, fieldName, msg) {
    const errEl = formEl.querySelector(`#error-${fieldName}`);
    const inputEl = formEl.querySelector(`[name="${fieldName}"]`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('active');
    }
    if (inputEl) {
      inputEl.classList.add('input-error');
    }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      hideAllFieldErrors(form);
      if (errorMsg) errorMsg.style.display = 'none';

      let lang = 'cs';
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang && ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(urlLang)) lang = urlLang;
      form.setAttribute('action', `/thank-you.html?lang=${lang}`);

      if (form.querySelector('input[name="bot-field"]')?.value) {
        e.preventDefault();
        return;
      }

      const name = form.name?.value?.trim();
      const email = form.email?.value?.trim();
      const message = form.message?.value?.trim();

      let valid = true;
      if (!name) {
        showFieldError(form, 'name', t('contact-error-name', 'Enter your name.'));
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(form, 'email', t('contact-error-email', 'Enter a valid e-mail.'));
        valid = false;
      }
      if (!message) {
        showFieldError(form, 'message', t('contact-error-message', 'Write a message.'));
        valid = false;
      }
      if (!valid) e.preventDefault();
    });
  }

  // ------- Partners page -------
  const pathname = window.location.pathname.split('/').pop();
  if (pathname === 'partners.html') {
    import('./partners.js');
  }

  // ------- Modal close -------
  const closeBtnModal = qs('#modalClose');
  const modalEl = qs('#eventModal');
  if (closeBtnModal) closeBtnModal.addEventListener('click', closeEventModal);
  if (modalEl) {
    window.addEventListener('click', (e) => {
      if (e.target === modalEl) closeEventModal();
    });
  }
});

// ------- Render events (with click-only pagination) -------
async function renderEvents(locale = 'cs', filters = currentFilters) {
  const eventsList = document.getElementById('eventsList');
  if (!eventsList) return;

  try {
    // kanonizuj město pro Ticketmaster (Praha → Prague apod.)
    const apiFilters = { ...filters };
    if (apiFilters.city) {
      apiFilters.city = canonForInputCity(apiFilters.city);
    }

    const events = await getAllEvents({ locale, filters: apiFilters });

    if (!window.translations) {
      window.translations = await loadTranslations(locale);
    }

    const fallbackImages = {
      concert: ['/images/fallbacks/concert0.jpg', '/images/fallbacks/concert1.jpg', '/images/fallbacks/concert2.jpg'],
      sport: ['/images/fallbacks/sport0.jpg', '/images/fallbacks/sport1.jpg'],
      festival: ['/images/fallbacks/festival0.jpg', '/images/fallbacks/festival1.jpg'],
      theatre: ['/images/fallbacks/theatre0.jpg', '/images/fallbacks/theatre1.jpg'],
      default: '/images/fallbacks/concert0.jpg'
    };
    const getRandomFallback = (category) => {
      const imgs = fallbackImages[category] || fallbackImages.default;
      return Array.isArray(imgs) ? imgs[Math.floor(Math.random() * imgs.length)] : imgs;
    };

    const preferredLocales = [locale, 'en', 'cs'];

    let filtered = [...events];
    filtered.forEach((event, index) => {
      if (!event.id) event.id = `event-${index}-${Math.random().toString(36).slice(2, 8)}`;
    });

    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter((e) => e.category === filters.category);
    }

    if (filters.sort === 'nearest') {
      filtered.sort((a, b) => new Date(a.datetime || a.date) - new Date(b.datetime || b.date));
    } else if (filters.sort === 'latest') {
      filtered.sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    }

    const isHomepage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
    let showAllLink = false;
    let toRender = filtered;

    if (isHomepage) {
      if (filtered.length > 6) {
        toRender = filtered.slice(0, 6);
        showAllLink = true;
      }
    } else {
      // events page – click-only pagination
      const end = pagination.page * pagination.perPage;
      toRender = filtered.slice(0, end);
    }

    eventsList.innerHTML = toRender
      .map((event) => {
        const title = pickLocalized(event.title, preferredLocales) || 'Untitled';
        const description = fixNonBreakingShortWords(pickLocalized(event.description, preferredLocales) || '', locale);

        const dateVal = event.datetime || event.date;
        const date = dateVal
          ? new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
          : '';

        const image = event.image || getRandomFallback(event.category);
        const isDemoDetail = !event.url || event.url.includes('example');
        const isDemoTickets = !event.tickets || String(event.tickets).includes('example');

        const detailLabel = fixNonBreakingShortWords(t(isDemoDetail ? 'event-details-demo' : 'event-details', 'Details'), locale);
        const ticketLabel = fixNonBreakingShortWords(t(isDemoTickets ? 'event-tickets-demo' : 'event-tickets', 'Tickets'), locale);

        const cardClasses = ['event-card'];
        if (event.promo) cardClasses.push('event-card-promo');

        return `
          <div class="${cardClasses.join(' ')}">
            <img src="${image}" alt="${title}" class="event-img" />
            <div class="event-content">
              <h3 class="event-title">${title}</h3>
              <p class="event-date">${date}</p>
              <p class="event-description">${description}</p>
              <div class="event-buttons-group">
                ${
                  event.partner === 'ticketmaster'
                    ? `<a href="${event.url}" class="btn-event detail" target="_blank" rel="noopener">${detailLabel}</a>`
                    : `<button class="btn-event detail" data-event-id="${event.id}">${detailLabel}</button>`
                }
                ${
                  isDemoTickets
                    ? `<span class="btn-event ticket demo">${ticketLabel}</span>`
                    : `<a href="${event.tickets}" class="btn-event ticket" target="_blank" rel="noopener">${ticketLabel}</a>`
                }
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Load more (events page only)
    if (!isHomepage) {
      const hasMore = filtered.length > toRender.length;
      const wrapperId = 'eventsLoadMoreWrap';

      const oldWrap = document.getElementById(wrapperId);
      if (oldWrap) oldWrap.remove();

      if (hasMore) {
        const wrap = document.createElement('div');
        wrap.className = 'events-load-more-wrap';
        wrap.id = wrapperId;
        wrap.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btnLoadMore">
            ${t('events-load-more','Load more')}
          </button>
        `;
        eventsList.parentElement.appendChild(wrap);

        const btn = qs('#btnLoadMore', wrap);
        if (btn) {
          btn.addEventListener('click', async () => {
            pagination.page += 1;
            await renderAndSync({ resetPage: false });
            if (filtersCollapsed) collapseFilters();
            btn.scrollIntoView({ block: 'center' });
          });
        }
      }
    }

    if (isHomepage && showAllLink) {
      eventsList.innerHTML += `
        <div class="events-show-all-btn">
          <a href="/events.html?lang=${locale}" class="btn btn-primary show-all-events-btn">
            ${t('events-show-all', 'Show all events')}
          </a>
        </div>
      `;
    }

    // Detail modalu
    qsa('.btn-event.detail').forEach((button) => {
      if (button.tagName.toLowerCase() === 'button') {
        button.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-event-id');
          const eventData = toRender.find((ev) => ev.id === id) || filtered.find((ev) => ev.id === id);
          if (eventData) openEventModal(eventData, locale);
        });
      }
    });
  } catch (e) {
    console.error(e);
    const msg = t('events-load-error', 'Unable to load events. Try again later.');
    const list = document.getElementById('eventsList');
    if (list) list.innerHTML = `<p>${msg}</p>`;
  }
}

// ------- Calendar links -------
function toCalDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
function buildICS({ title, description, location, start, end }) {
  const dtStart = toCalDate(start);
  const dtEnd = toCalDate(end || start);
  const esc = (s) => String(s || '').replace(/[\n\r]/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AJSEE//Events//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// ------- Modal -------
async function openEventModal(eventData, locale = 'cs') {
  const modal = document.getElementById('eventModal');
  if (!modal) {
    console.error('Modal #eventModal not found!');
    return;
  }

  const titleEl = modal.querySelector('#modalTitle');
  const imageEl = modal.querySelector('#modalImage');
  const dateEl = modal.querySelector('#modalDate');
  const locationEl = modal.querySelector('#modalLocation');
  const descEl = modal.querySelector('#modalDescription');
  const categoryEl = modal.querySelector('#modalCategory');

  if (!titleEl || !imageEl || !dateEl || !locationEl || !descEl || !categoryEl) {
    console.error('Missing modal element(s)', { modal, titleEl, imageEl, dateEl, locationEl, descEl, categoryEl });
    return;
  }

  if (!window.translations) {
    window.translations = await loadTranslations(locale);
  }

  const preferredLocales = [locale, 'en', 'cs'];

  const categoryKey = eventData.category || '';
  const categoryTranslated = fixNonBreakingShortWords(t(`category-${categoryKey}`, categoryKey), locale);

  const title = pickLocalized(eventData.title, preferredLocales) || 'Untitled';
  const description = fixNonBreakingShortWords(pickLocalized(eventData.description, preferredLocales) || '', locale);
  const image = eventData.image || '/images/fallbacks/concert0.jpg';
  const dateVal = eventData.datetime || eventData.date;
  const date = dateVal
    ? new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const location = eventData.location?.city || eventData.location || '';

  titleEl.textContent = title;
  imageEl.src = image;
  imageEl.alt = title;
  dateEl.textContent = date;
  locationEl.textContent = location;
  descEl.textContent = description;
  categoryEl.textContent = categoryTranslated;

  // Calendar links
  try {
    const start = toISODate(dateVal);
    const end = start; // jednodenní
    const details = description;

    const gParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${toCalDate(start)}/${toCalDate(end)}`,
      details,
      location
    });
    const gLink = modal.querySelector('#googleCalendarLink');
    if (gLink) gLink.href = `https://calendar.google.com/calendar/render?${gParams.toString()}`;

    const oParams = new URLSearchParams({
      path: '/calendar/action/compose',
      ri: '0',
      subject: title,
      body: details,
      location
    });
    const oLink = modal.querySelector('#outlookCalendarLink');
    if (oLink) oLink.href = `https://outlook.office.com/calendar/0/deeplink/compose?${oParams.toString()}`;

    const icsText = buildICS({ title, description: details, location, start, end });
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const aLink = modal.querySelector('#appleCalendarLink');
    if (aLink) aLink.href = URL.createObjectURL(blob);
  } catch (e) {
    console.warn('Calendar links build failed:', e);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}
