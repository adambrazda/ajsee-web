// src/main.js
// ---------------------------------------------------------
// AJSEE – Events UI, i18n & filters (+ city typeahead, "Near me",
// active-filter chips, URL sync, calendar links)
// ---------------------------------------------------------

import './styles/main.scss';
import { getAllEvents } from './api/eventsApi.js';

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

// malý helper pro yyyy-mm-dd
function fmtISO(d) {
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
}

// ------- Helpers: typography -------
function fixNonBreakingShortWords(text, lang = 'cs') {
  if (!text || typeof text !== 'string') return text;
  switch (lang) {
    case 'cs':
    case 'sk':
      return text.replace(/ ([aAiIkoOsSuUvVzZ]) /g, '\u00a0$1\u00a0');
    case 'pl':
      return text.replace(/ ([aAiIoOuUwWzZ]) /g, '\u00a0$1\u00a0');
    case 'hu':
      return text.replace(/ ([aAiIsS]) /g, '\u00a0$1\u00a0');
    case 'de':
    case 'en':
      return text.replace(/ ([aI]) /g, '\u00a0$1\u00a0');
    default:
      return text;
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
  // store only "clean" params
  (currentFilters.city ? p.set('city', currentFilters.city) : p.delete('city'));
  (currentFilters.dateFrom ? p.set('from', toISODate(currentFilters.dateFrom)) : p.delete('from'));
  (currentFilters.dateTo ? p.set('to', toISODate(currentFilters.dateTo)) : p.delete('to'));
  (currentFilters.category && currentFilters.category !== 'all' ? p.set('segment', currentFilters.category) : p.delete('segment'));
  (currentFilters.keyword ? p.set('q', currentFilters.keyword) : p.delete('q'));
  (currentFilters.sort && currentFilters.sort !== 'nearest' ? p.set('sort', currentFilters.sort) : p.delete('sort'));
  // pro soukromí lat/lon do URL nedáváme
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
// Resolve translation with both directions of legacy aliases
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
   Ticketmaster Discovery API – city suggest (frontend side)
   (Proxy endpoint: /.netlify/functions/ticketmasterCitySuggest)
   ========================================================= */
const citySuggestCache = new Map();

async function suggestCities({ locale = 'cs', countryCode = 'CZ', keyword = '', size = 50 } = {}) {
  const q = keyword.trim();
  if (q.length < 2) return [];
  const cacheKey = `${locale}|${countryCode}|${q.toLowerCase()}|${size}`;
  if (citySuggestCache.has(cacheKey)) return citySuggestCache.get(cacheKey);

  const qs = new URLSearchParams({ locale, countryCode, keyword: q, size: String(size) });
  try {
    const r = await fetch(`/.netlify/functions/ticketmasterCitySuggest?${qs.toString()}`);
    if (!r.ok) {
      citySuggestCache.set(cacheKey, []);
      return [];
    }
    const data = await r.json();

    // Normalizace do jednotného tvaru
    const out = (Array.isArray(data.cities) ? data.cities : []).map((c) => ({
      city: c.label || c.name || c.value || '',
      countryCode: c.countryCode || c.country || '',
      lat: c.lat !== undefined ? Number(c.lat) : undefined,
      lon: c.lon !== undefined ? Number(c.lon) : undefined,
      score: typeof c.score === 'number' ? c.score : undefined
    }));
    citySuggestCache.set(cacheKey, out);
    return out;
  } catch {
    citySuggestCache.set(cacheKey, []);
    return [];
  }
}

/* UI binder pro input Město */
function setupCityTypeahead(inputEl) {
  if (!inputEl) return;
  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.style.display = 'none';
  inputEl.parentElement.appendChild(panel);

  let items = [];
  let activeIndex = -1;

  const open = () => { panel.style.display = 'block'; };
  const close = () => { panel.style.display = 'none'; activeIndex = -1; };
  const isOpen = () => panel.style.display !== 'none';

  const render = () => {
    if (!items.length) {
      panel.innerHTML = `<div class="typeahead-empty">${t('filters.noResults','Žádné výsledky')}</div>`;
      return;
    }
    panel.innerHTML = items.map((it, i) => {
      const metaParts = [it.state, it.countryCode].filter(Boolean);
      const meta = metaParts.join(', ');
      const score = it.score ? ` • ${it.score}` : '';
      return `
        <div class="typeahead-item ${i === activeIndex ? 'active' : ''}" role="option" data-index="${i}">
          <span class="ti-city">${it.city}</span>
          <span class="ti-meta">${meta}${score}</span>
        </div>
      `;
    }).join('');
  };

  const choose = (idx) => {
    const it = items[idx]; if (!it) return;
    inputEl.value = it.city;
    currentFilters.city = it.city;
    // pokud uživatel vybral město, vypneme Near me
    clearNearMe();
    close();
  };

  panel.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (el) choose(parseInt(el.dataset.index, 10));
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== inputEl) close();
  });

  inputEl.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) choose(activeIndex); else close(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  const load = debounce(async () => {
    const q = inputEl.value.trim();
    currentFilters.city = q;
    if (q.length < 2) { close(); return; }
    const cc = (currentFilters.countryCode || 'CZ').toUpperCase();
    items = await suggestCities({ locale: currentLang, countryCode: cc, keyword: q, size: 80 });
    activeIndex = -1; render(); open();
  }, 180);

  inputEl.addEventListener('input', load);
  inputEl.addEventListener('focus', () => {
    if (inputEl.value.trim().length >= 2 && items.length) { render(); open(); }
  });
}

/* =========================================================
   Active filter chips toolbar + Near Me
   ========================================================= */

// požádá o polohu a zapne Near Me (případně přepíná stav)
async function enableNearMeViaGeolocate(triggerEl) {
  try {
    if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
      // toggle off
      clearNearMe();
      setFilterInputsFromState();
      await renderAndSync();
      return;
    }
    if (triggerEl) {
      triggerEl.disabled = true;
      triggerEl.textContent = t('filters.finding','Zjišťuji polohu…');
    }
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('no geo'));
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
    currentFilters.nearMeLat = pos.coords.latitude;
    currentFilters.nearMeLon = pos.coords.longitude;
    currentFilters.nearMeRadiusKm = 50;
    // pokud zapneme near me, zrušíme město (aby se neovlivňovalo)
    currentFilters.city = '';
    setFilterInputsFromState();
    await renderAndSync();
  } catch (e) {
    console.warn('Geo failed:', e);
    alert(t('filters.geoError', 'Nepodařilo se získat polohu.'));
  } finally {
    if (triggerEl) {
      triggerEl.disabled = false;
      triggerEl.textContent = t('filters.nearMe', 'V mém okolí');
    }
  }
}

// rychločipy: Dnes / Tento víkend / Vymazat + Blízko mě
function setupQuickChips() {
  const todayBtn   = qs('#chipToday');
  const weekendBtn = qs('#chipWeekend');
  const clearBtn   = qs('#chipClear');
  const nearBtn    = qs('#chipNearMe');

  const setActive = (btn) => {
    [todayBtn, weekendBtn, clearBtn].forEach(b => b?.classList.remove('is-active'));
    btn?.classList.add('is-active');
  };

  todayBtn?.addEventListener('click', async () => {
    const d = new Date();
    currentFilters.dateFrom = fmtISO(d);
    currentFilters.dateTo   = fmtISO(d);
    setFilterInputsFromState();
    setActive(todayBtn);
    await renderAndSync();
  });

  weekendBtn?.addEventListener('click', async () => {
    const d = new Date();
    const day = d.getDay(); // 0=Ne, 6=So
    const diffToSat = (6 - day + 7) % 7;
    const sat = new Date(d); sat.setDate(d.getDate() + diffToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    currentFilters.dateFrom = fmtISO(sat);
    currentFilters.dateTo   = fmtISO(sun);
    setFilterInputsFromState();
    setActive(weekendBtn);
    await renderAndSync();
  });

  clearBtn?.addEventListener('click', async () => {
    const cc = currentFilters.countryCode;
    currentFilters = {
      category: 'all', sort: 'nearest', city: '',
      dateFrom: '', dateTo: '', keyword: '',
      countryCode: cc, nearMeLat: null, nearMeLon: null, nearMeRadiusKm: 50
    };
    setFilterInputsFromState();
    setActive(clearBtn);
    await renderAndSync();
  });

  nearBtn?.addEventListener('click', async (e) => {
    // toggle near me
    await enableNearMeViaGeolocate(e.currentTarget);
  });
}

function renderFilterChips() {
  const existing = qs('.filters-toolbar');
  const host = existing || (() => {
    // fallback – toolbar nad gridem/sekcí
    const section = qs('.section-events .container') || qs('.events-upcoming-section .container') || document.body;
    const bar = document.createElement('div');
    bar.className = 'filters-toolbar';
    // jednoduché defaultní styly (když by neexistovaly v CSS)
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.gap = '8px';
    bar.style.margin = '0 0 8px 2px';
    section.insertBefore(bar, qs('#eventsList') || section.firstChild);
    return bar;
  })();

  // NEmažeme obsah toolbaru (statické čipy musí zůstat vidět)!
  // Statické čipy (Dnes/Víkend/Vymazat/Blízko mě) necháme v .chips-static (případně označíme)
  let staticWrap = host.querySelector('.chips-static') || host.querySelector('.chips');
  if (staticWrap) staticWrap.classList.add('chips-static');

  // Aktivní čipy rendrujeme do separátního bloku .chips-active
  let activeWrap = host.querySelector('.chips-active');
  if (!activeWrap) {
    activeWrap = document.createElement('div');
    activeWrap.className = 'chips chips-active';
    if (staticWrap && staticWrap.nextSibling) {
      host.insertBefore(activeWrap, staticWrap.nextSibling);
    } else if (staticWrap) {
      host.appendChild(activeWrap);
    } else {
      host.insertBefore(activeWrap, host.firstChild);
    }
  }
  activeWrap.innerHTML = '';

  const addChip = (label, onClear) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.setAttribute('aria-label', `${label} – ${t('filters.reset','Vymazat')}`);
    chip.addEventListener('click', onClear);
    activeWrap.appendChild(chip);
  };

  if (currentFilters.category && currentFilters.category !== 'all') {
    addChip(`${t('filters.category','Kategorie')}: ${t('category-'+currentFilters.category, currentFilters.category)}`, () => {
      currentFilters.category = 'all';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.city) {
    addChip(`${t('filters.city','Město')}: ${currentFilters.city}`, () => {
      currentFilters.city = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.dateFrom) {
    addChip(`${t('filters.dateFrom','Od')}: ${toISODate(currentFilters.dateFrom)}`, () => {
      currentFilters.dateFrom = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.dateTo) {
    addChip(`${t('filters.dateTo','Do')}: ${toISODate(currentFilters.dateTo)}`, () => {
      currentFilters.dateTo = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.keyword) {
    addChip(`${t('filters.keyword','Klíčové slovo')}: ${currentFilters.keyword}`, () => {
      currentFilters.keyword = '';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.sort && currentFilters.sort !== 'nearest') {
    addChip(`${t('filters.sort','Řazení')}: ${t('filters.latest','Nejnovější')}`, () => {
      currentFilters.sort = 'nearest';
      setFilterInputsFromState();
      renderAndSync();
    });
  }
  if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
    addChip(`${t('filters.nearMe','V mém okolí')} ~${currentFilters.nearMeRadiusKm} km`, () => {
      clearNearMe();
      setFilterInputsFromState();
      renderAndSync();
    });
  }
}

function attachNearMeButton(formEl) {
  if (!formEl) return;
  if (qs('#filter-nearme', formEl)) return; // už existuje

  const actions = qs('.filter-actions', formEl) || (() => {
    const div = document.createElement('div');
    div.className = 'filter-actions';
    formEl.appendChild(div);
    return div;
  })();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'filter-nearme';
  btn.className = 'btn btn-ghost';
  btn.textContent = t('filters.nearMe', 'V mém okolí');
  actions.prepend(btn);

  btn.addEventListener('click', async () => {
    await enableNearMeViaGeolocate(btn);
  });
}

function clearNearMe() {
  currentFilters.nearMeLat = null;
  currentFilters.nearMeLon = null;
}

// pomocné – props -> inputy
function setFilterInputsFromState() {
  const $cat = qs('#filter-category') || qs('#events-category-filter');
  const $sort = qs('#filter-sort') || qs('#events-sort-filter');
  const $city = qs('#filter-city') || qs('#events-city-filter');
  const $from = qs('#filter-date-from') || qs('#events-date-from');
  const $to = qs('#filter-date-to') || qs('#events-date-to');
  const $keyword = qs('#filter-keyword');

  if ($cat) $cat.value = currentFilters.category || 'all';
  if ($sort) $sort.value = currentFilters.sort || 'nearest';
  if ($city) $city.value = currentFilters.city || '';
  if ($from) $from.value = currentFilters.dateFrom || '';
  if ($to) $to.value = currentFilters.dateTo || '';
  if ($keyword) $keyword.value = currentFilters.keyword || '';
}

// central render + url + chips
async function renderAndSync() {
  syncURLFromFilters();
  await renderEvents(currentLang, currentFilters);
  renderFilterChips();
}

/* =========================================================
   Bottom sheet (mobile) – otevření/zavření
   ========================================================= */
function setupFilterDockSheet() {
  const sheet   = qs('.filter-dock[data-behavior="sheet"]');
  const openBtn = qs('#filtersOpen');
  const closeBtn= qs('#filtersClose');
  const overlay = qs('#filtersOverlay');

  if (!sheet || !openBtn || !overlay) return;

  const open = () => {
    sheet.classList.add('is-open');
    overlay.hidden = false;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    sheet.classList.remove('is-open');
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    document.body.style.overflow = '';
  };

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!isMobile()) close(); });
}

// ------- DOM Ready -------
document.addEventListener('DOMContentLoaded', async () => {
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
const closeBtn = document.querySelector('.menu-close');

if (hamburger && nav && overlayNav && closeBtn) {
  // Bezpečný výchozí stav (některé buildy nechaly overlay aktivní)
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
  };

  const closeMenu = () => {
    nav.classList.remove('open');
    overlayNav.classList.remove('active');
    overlayNav.style.pointerEvents = 'none';
    overlayNav.style.opacity = '0';
    document.body.classList.remove('nav-open');
    document.body.style.overflow = '';
  };

  hamburger.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  overlayNav.addEventListener('click', closeMenu);
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}


  // ------- Filters -------
  const eventsList = qs('#eventsList');
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
    const $to = qs('#filter-date-to') || qs('#events-date-to');
    const $keyword = qs('#filter-keyword');
    const $form = qs('#events-filters-form');
    const $applyBtnOnEventsPage = qs('#events-apply-filters');

    setFilterInputsFromState();

    // City typeahead – aktivace
    if ($city) setupCityTypeahead($city);

    // Near Me – button v actions
    attachNearMeButton($form || qs('.events-filters'));

    // Rychločipy (Dnes / Tento víkend / Vymazat / Blízko mě)
    setupQuickChips();

    // Bottom-sheet na mobilech
    setupFilterDockSheet();

    await renderAndSync();

    $cat?.addEventListener('change', (e) => {
      currentFilters.category = e.target.value || 'all';
      renderAndSync();
    });
    $sort?.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value || 'nearest';
      renderAndSync();
    });
    $city?.addEventListener('input', (e) => {
      currentFilters.city = e.target.value.trim();
      if (currentFilters.city) clearNearMe(); // ruší Near me
    });
    $from?.addEventListener('change', (e) => (currentFilters.dateFrom = e.target.value || ''));
    $to?.addEventListener('change', (e) => (currentFilters.dateTo = e.target.value || ''));
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

        if (valid) await renderAndSync();
      });

      $form.addEventListener('reset', async () => {
        const cc = currentFilters.countryCode;
        currentFilters = { category: 'all', sort: 'nearest', city: '', dateFrom: '', dateTo: '', keyword: '', countryCode: cc, nearMeLat: null, nearMeLon: null, nearMeRadiusKm: 50 };
        setFilterInputsFromState();
        await renderAndSync();
      });
    }

    // Events page (div + vlastní Apply button)
    if ($applyBtnOnEventsPage) {
      $applyBtnOnEventsPage.addEventListener('click', async () => {
        // jednoduché ověření datumu
        if ($from?.value && $to?.value && new Date($from.value) > new Date($to.value)) {
          [$from, $to].forEach((input) => input?.classList.add('input-error'));
          return;
        }
        await renderAndSync();
      });
    }
  }

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
        showFieldError(form, 'name', t('contact-error-name', 'Zadejte své jméno.'));
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(form, 'email', t('contact-error-email', 'Zadejte platný e-mail.'));
        valid = false;
      }
      if (!message) {
        showFieldError(form, 'message', t('contact-error-message', 'Napište zprávu.'));
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

// ------- Render events -------
async function renderEvents(locale = 'cs', filters = currentFilters) {
  const eventsList = document.getElementById('eventsList');
  if (!eventsList) return;

  try {
    // getAllEvents může (ale nemusí) rozumět nearMeLat/Lon; předáme bezpodmínečně
    const events = await getAllEvents({ locale, filters });
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
    if (isHomepage && filtered.length > 6) {
      filtered = filtered.slice(0, 6);
      showAllLink = true;
    }

    eventsList.innerHTML = filtered
      .map((event) => {
        const title = event.title?.[locale] || event.title?.cs || 'Bez názvu';
        const description = fixNonBreakingShortWords(event.description?.[locale] || event.description?.cs || '', locale);

        const dateVal = event.datetime || event.date;
        const date = dateVal
          ? new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
          : '';

        const image = event.image || getRandomFallback(event.category);
        const isDemoDetail = !event.url || event.url.includes('example');
        const isDemoTickets = !event.tickets || String(event.tickets).includes('example');

        const detailLabel = fixNonBreakingShortWords(t(isDemoDetail ? 'event-details-demo' : 'event-details', 'Zjistit více'), locale);
        const ticketLabel = fixNonBreakingShortWords(t(isDemoTickets ? 'event-tickets-demo' : 'event-tickets', 'Vstupenky'), locale);

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

    if (isHomepage && showAllLink) {
      eventsList.innerHTML += `
        <div class="events-show-all-btn">
          <a href="/events.html?lang=${locale}" class="btn btn-primary show-all-events-btn">
            ${t('events-show-all', 'Zobrazit všechny události')}
          </a>
        </div>
      `;
    }

    // Detail modalu
    qsa('.btn-event.detail').forEach((button) => {
      if (button.tagName.toLowerCase() === 'button') {
        button.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-event-id');
          const eventData = filtered.find((ev) => ev.id === id) || events.find((ev) => ev.id === id);
          if (eventData) openEventModal(eventData, locale);
        });
      }
    });
  } catch (e) {
    console.error(e);
    const msg = t('events-load-error', 'Události nelze načíst. Zkuste to později.');
    if (eventsList) eventsList.innerHTML = `<p>${msg}</p>`;
  }
}

// ------- Calendar links -------
function toCalDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // UTC-less fallback – použij „local“ bez Z (lepší pro jednodenní akce)
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

  const categoryKey = eventData.category || '';
  const categoryTranslated = fixNonBreakingShortWords(t(`category-${categoryKey}`, categoryKey), locale);

  const title = eventData.title?.[locale] || eventData.title?.cs || 'Bez názvu';
  const description = fixNonBreakingShortWords(eventData.description?.[locale] || eventData.description?.cs || '', locale);
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
      location,
      // Outlook web neumí jednoduše YYYYMMDD bez času, necháme bez začátku/konce
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
