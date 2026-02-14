// /src/main.js
// ---------------------------------------------------------
// AJSEE – Events UI, i18n & filters (sjednocení s homepage)
// ---------------------------------------------------------

//import './styles/main.scss';

import './identity-init.js';

// nový AJSEE date popover – engine + 2-měsíční range picker s i18n
import './utils/ajsee-date-popover.js';

// ✅ NEW: desktop language dropdown (mamma-mia style)
import { initLangDropdown } from './utils/lang-dropdown.js';

import { getAllEvents } from './api/eventsApi.js';
import { setupCityTypeahead } from './city/typeahead.js';
import { canonForInputCity } from './city/canonical.js';

import { getSortedBlogArticles } from './blogArticles.js';
import { initNav } from './nav-core.js';
import { initContactFormValidation } from './contact-validate.js';
import { initEventModal } from './event-modal.js';

import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';

/* ───────── global guard ───────── */
(function ensureGlobals () {
  window.__ajsee = window.__ajsee || {};
  const g = window.__ajsee;
  g.flags = g.flags || {};
  g.once  = g.once  || new Set();
  g.locks = g.locks || {};
  g.state = g.state || {};
  g.bus   = g.bus   || (type => detail => {
    try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch { /* noop */ }
  });
})();

const G = window.__ajsee;

G.state._wiredMap = G.state._wiredMap || new WeakMap();
const _wiredMap = G.state._wiredMap;

function wireOnce (el, evt, handler, key = '', opts) {
  if (!el) return;
  const id = `${evt}:${key || ''}`;
  let set = _wiredMap.get(el);
  if (!set) { set = new Set(); _wiredMap.set(el, set); }
  if (set.has(id)) return;
  set.add(id);
  el.addEventListener(evt, handler, opts);
}

if (G.flags.mainInitialized) {
  // hot reload: nic neděláme, jen nahradíme funkce
} else {
  G.flags.mainInitialized = true;
}

const SKIP_CORE_EVENTS = !!window.__AJSEE_SKIP_CORE_EVENTS;

/* ───────── state ───────── */
let currentFilters = {
  category: 'all',
  sort: 'nearest',
  city: '',
  cityLabel: '',             // ⬅️ co ukazujeme v UI (lokalizovaně)
  dateFrom: '',
  dateTo: '',
  keyword: '',
  countryCode: 'CZ',
  nearMeLat: null,
  nearMeLon: null,
  nearMeRadiusKm: 50
};

const pagination = { page: 1, perPage: 12 };
let filtersCollapsed = false;

// render re-entrancy guard
let _renderInflight = false;
let _renderQueued = false;

// fetch dedupe signatura posledního dotazu
let _lastFetchSig = '';

// ✅ scroll guard – na první load nikdy nescrollovat
let _hasDoneFirstRender = false;
let _userInteractedWithFilters = false;

/* Lang detection */
function getUILang () {
  const sp = new URLSearchParams(location.search);
  const p1 = (sp.get('lang') || sp.get('locale') || sp.get('hl') || '').toLowerCase();
  const m = location.pathname.match(/^\/(cs|en|de|sk|pl|hu)(?:\/|$)/i);
  const p2 = (m && m[1] || '').toLowerCase();
  const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const cookieLang = (document.cookie.split('; ').find(r => r.startsWith('aj_lang=')) || '').split('=')[1] || '';
  const supported = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
  const pick = [p1, p2, htmlLang, cookieLang, 'cs'].find(x => supported.includes(String(x).toLowerCase()));
  return pick || 'cs';
}
let currentLang = getUILang();

function setLangCookie (lang) {
  try { document.cookie = `aj_lang=${lang};path=/;max-age=${60 * 60 * 24 * 365}`; } catch { /* noop */ }
}

/* ───────── utils ───────── */
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ✅ home detekce i pro /cs/, /en/ apod.
const isHome = () => {
  const p = (location.pathname || '/').replace(/\/+$/, '/');
  if (p === '/' || p.endsWith('/index.html')) return true;
  return /^\/(cs|en|de|sk|pl|hu)\/?$/.test((location.pathname || '').replace(/\/+$/, ''));
};

function getCookie (name) { return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]; }
function esc (s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function pad2 (n) { return String(n).padStart(2, '0'); }
function toLocalISO (d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const isVisible = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;

const store = {
  get (k, d = null) { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } },
  set (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } }
};

/* ───────── header metrics + popover z-index (under header) ───────── */
function _parseZ (v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function getHeaderEl () {
  return document.querySelector('header.site-header') ||
         document.querySelector('.site-header') ||
         document.querySelector('header');
}
function getHeaderMetrics () {
  const el = getHeaderEl();
  if (!el) return { el: null, bottom: 0, z: null, rect: null };
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  const z = _parseZ(cs.zIndex);
  const bottom = Math.max(0, rect.bottom || 0);
  return { el, rect, bottom, z };
}
function syncPopoverZIndex () {
  const { z } = getHeaderMetrics();
  const desired = (typeof z === 'number' && Number.isFinite(z))
    ? Math.max(10, z - 1)
    : 10020;
  document.documentElement.style.setProperty('--ajsee-popover-z', String(desired));
  return desired;
}
function isElementInViewportBelowHeader (el, pad = 4) {
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
  const { bottom: hdrBottom } = getHeaderMetrics();
  const sizeOk = r.width > 0 && r.height > 0;
  return sizeOk && (r.bottom > hdrBottom + pad) && (r.top < vpH - pad);
}

/* ───────── scroll parents (fix: popovers drifting on inner scroll containers) ───────── */
function getScrollParents (el) {
  const out = [];
  const seen = new Set();
  const overflowRe = /(auto|scroll|overlay)/;

  let node = el;
  while (node && node !== document.body && node !== document.documentElement) {
    node = node.parentElement;
    if (!node) break;
    try {
      const st = window.getComputedStyle(node);
      const oy = st.overflowY || st.overflow || '';
      const ox = st.overflowX || st.overflow || '';
      const scrollable = overflowRe.test(oy) || overflowRe.test(ox);
      const canScroll = (node.scrollHeight > node.clientHeight) || (node.scrollWidth > node.clientWidth);
      if (scrollable && canScroll && !seen.has(node)) {
        seen.add(node);
        out.push(node);
      }
    } catch { /* noop */ }
  }

  const se = document.scrollingElement || document.documentElement;
  if (se && !seen.has(se)) out.push(se);

  out.push(window);
  return out;
}

// když je scroll uvnitř wrapperu, “probudíme” listenery na window (date popover engine / některé UI)
function installPopoverScrollBridges () {
  const city = qs('#filter-city') || qs('#events-city-filter');
  if (city) {
    const anchor = city.closest('.filter-group') || city;
    getScrollParents(anchor).forEach(p => {
      if (p === window) return;
      wireOnce(p, 'scroll', () => {
        try { window.dispatchEvent(new Event('scroll')); } catch { /* noop */ }
      }, 'bridge-city-scroll', { passive: true });
    });
  }

  const dateBtn = qs('#date-combo-button');
  if (dateBtn) {
    const anchor = dateBtn.closest('.filter-group') || dateBtn;
    getScrollParents(anchor).forEach(p => {
      if (p === window) return;
      wireOnce(p, 'scroll', () => {
        try { window.dispatchEvent(new Event('scroll')); } catch { /* noop */ }
      }, 'bridge-date-scroll', { passive: true });
    });
  }
}

/* --- Custom positioning for AJSEE date popover (align under "Date" cell) --- */
window.ajseePositionDatePopover = function (ctx = {}) {
  try {
    const anchorEl =
      ctx.anchor ||
      document.getElementById('date-combo-button') ||
      null;

    const anchorRect =
      ctx.anchorRect ||
      (anchorEl && anchorEl.getBoundingClientRect && anchorEl.getBoundingClientRect());

    if (!anchorRect) return null;

    let baseRect = anchorRect;
    if (anchorEl && anchorEl.closest) {
      const group = anchorEl.closest('.filter-group');
      if (group) baseRect = group.getBoundingClientRect();
    }

    const panelRect =
      ctx.panelRect ||
      (ctx.panel && ctx.panel.getBoundingClientRect && ctx.panel.getBoundingClientRect()) ||
      { width: 360, height: 280 };

    const vpW = ctx.viewportWidth || window.innerWidth || document.documentElement.clientWidth || 1024;
    const vpH = ctx.viewportHeight || window.innerHeight || document.documentElement.clientHeight || 768;

    const GAP = typeof ctx.gap === 'number' ? ctx.gap : 0;
    const SAFE = 8;

    let top = baseRect.bottom + GAP;
    let left = baseRect.left;

    if (left < SAFE) left = SAFE;
    if (left + panelRect.width + SAFE > vpW) {
      left = Math.max(SAFE, vpW - panelRect.width - SAFE);
    }

    if (top + panelRect.height + SAFE > vpH) {
      const above = baseRect.top - GAP - panelRect.height;
      if (above >= SAFE) {
        top = above;
      } else {
        top = Math.max(SAFE, vpH - panelRect.height - SAFE);
      }
    }

    const maxHeight = Math.max(200, vpH - SAFE * 2);
    return { top, left, maxHeight };
  } catch (e) {
    return null;
  }
};

/* ───────── language-aware fallback měst ───────── */
const CITY_SYNONYMS = {
  prague:     { cs:'Praha', en:'Prague', de:'Prag', sk:'Praha', pl:'Praga', hu:'Prága' },
  brno:       { cs:'Brno', en:'Brno', de:'Brünn', sk:'Brno', pl:'Brno', hu:'Brünn' },
  ostrava:    { cs:'Ostrava', en:'Ostrava', de:'Ostrau', sk:'Ostrava', pl:'Ostrawa', hu:'Ostrava' },
  plzen:      { cs:'Plzeň', en:'Pilsen', de:'Pilsen', sk:'Plzeň', pl:'Pilzno', hu:'Plzeň' },
  liberec:    { cs:'Liberec', en:'Liberec', de:'Reichenberg', sk:'Liberec', pl:'Liberec', hu:'Liberec' },
  olomouc:    { cs:'Olomouc', en:'Olomouc', de:'Olmütz', sk:'Olomouc', pl:'Ołomuniec', hu:'Olmütz' },
  cbudejovice:{ cs:'České Budějovice', en:'České Budějovice', de:'Budweis', sk:'České Budějovice', pl:'Czeskie Budziejowice', hu:'Budweis' },
  hkralove:   { cs:'Hradec Králové', en:'Hradec Králové', de:'Königgrätz', sk:'Hradec Králové', pl:'Hradec Králové', hu:'Königgrätz' },
  pardubice:  { cs:'Pardubice', en:'Pardubice', de:'Pardubitz', sk:'Pardubice', pl:'Pardubice', hu:'Pardubice' },

  bratislava: { cs:'Bratislava', en:'Bratislava', de:'Pressburg', sk:'Bratislava', pl:'Bratysława', hu:'Pozsony' },
  kosice:     { cs:'Košice', en:'Kosice', de:'Kaschau', sk:'Košice', pl:'Koszyce', hu:'Kassa' },

  wien:       { cs:'Vídeň', en:'Vienna', de:'Wien', sk:'Viedeň', pl:'Wiedeń', hu:'Bécs' },
  graz:       { cs:'Štýrský Hradec', en:'Graz', de:'Graz', sk:'Štajerský Hradec', pl:'Graz', hu:'Graz' },
  linz:       { cs:'Linec', en:'Linz', de:'Linz', sk:'Linz', pl:'Linz', hu:'Linz' },
  salzburg:   { cs:'Salcburk', en:'Salzburg', de:'Salzburg', sk:'Salzburg', pl:'Salzburg', hu:'Salzburg' },
  innsbruck:  { cs:'Innsbruck', en:'Innsbruck', de:'Innsbruck', sk:'Innsbruck', pl:'Innsbruck', hu:'Innsbruck' },
  klagenfurt: { cs:'Klagenfurt', en:'Klagenfurt', de:'Klagenfurt', sk:'Klagenfurt', pl:'Klagenfurt', hu:'Klagenfurt' },

  berlin:     { cs:'Berlín', en:'Berlin', de:'Berlin', sk:'Berlín', pl:'Berlin', hu:'Berlin' },
  hamburg:    { cs:'Hamburk', en:'Hamburg', de:'Hamburg', sk:'Hamburg', pl:'Hamburg', hu:'Hamburg' },
  munchen:    { cs:'Mnichov', en:'Munich', de:'München', sk:'Mníchov', pl:'Monachium', hu:'München' },
  koln:       { cs:'Kolín nad Rýnem', en:'Cologne', de:'Köln', sk:'Kolín nad Rýnom', pl:'Kolonia', hu:'Köln' },
  frankfurt:  { cs:'Frankfurt', en:'Frankfurt', de:'Frankfurt', sk:'Frankfurt', pl:'Frankfurt', hu:'Frankfurt' },
  stuttgart:  { cs:'Stuttgart', en:'Stuttgart', de:'Stuttgart', sk:'Stuttgart', pl:'Stuttgart', hu:'Stuttgart' },
  dusseldorf: { cs:'Düsseldorf', en:'Düsseldorf', de:'Düsseldorf', sk:'Düsseldorf', pl:'Düsseldorf', hu:'Düsseldorf' },
  dresden:    { cs:'Drážďany', en:'Dresden', de:'Dresden', sk:'Drážďany', pl:'Drezno', hu:'Drezda' },
  leipzig:    { cs:'Lipsko', en:'Leipzig', de:'Leipzig', sk:'Lipsko', pl:'Lipsk', hu:'Lipcse' },

  warszawa:   { cs:'Varšava', en:'Warsaw', de:'Warschau', sk:'Varšava', pl:'Warszawa', hu:'Varsó' },
  krakow:     { cs:'Krakov', en:'Krakow', de:'Krakau', sk:'Krakov', pl:'Kraków', hu:'Krakkó' },
  lodz:       { cs:'Lodž', en:'Łódź', de:'Łódź', sk:'Lodž', pl:'Łódź', hu:'Łódź' },
  wroclaw:    { cs:'Vratislav', en:'Wroclaw', de:'Breslau', sk:'Vroclav', pl:'Wrocław', hu:'Wroclaw' },
  poznan:     { cs:'Poznaň', en:'Poznan', de:'Posen', sk:'Poznaň', pl:'Poznań', hu:'Poznań' },
  gdansk:     { cs:'Gdaňsk', en:'Gdansk', de:'Danzig', sk:'Gdansk', pl:'Gdańsk', hu:'Gdansk' },
  szczecin:   { cs:'Štětín', en:'Szczecin', de:'Stettin', sk:'Štetín', pl:'Szczecin', hu:'Szczecin' },
  bydgoszcz:  { cs:'Bydhošť', en:'Bydgoszcz', de:'Bromberg', sk:'Bydgoszcz', pl:'Bydgoszcz', hu:'Bydgoszcz' },

  budapest:   { cs:'Budapešť', en:'Budapest', de:'Budapest', sk:'Budapešť', pl:'Budapeszt', hu:'Budapest' },
  debrecen:   { cs:'Debrecín', en:'Debrecen', de:'Debrecen', sk:'Debrecín', pl:'Debreczyn', hu:'Debrecen' },
  szeged:     { cs:'Szeged', en:'Szeged', de:'Szeged', sk:'Szeged', pl:'Szeged', hu:'Szeged' },
  miskolc:    { cs:'Miškovec', en:'Miskolc', de:'Miskolc', sk:'Miškovec', pl:'Miszkolc', hu:'Miskolc' },
  pecs:       { cs:'Péč', en:'Pécs', de:'Pécs', sk:'Pécs', pl:'Pecz', hu:'Pécs' },
  gyor:       { cs:'Ráb', en:'Győr', de:'Raab', sk:'Győr', pl:'Győr', hu:'Győr' },

  london:     { cs:'Londýn', en:'London', de:'London', sk:'Londýn', pl:'Londyn', hu:'London' },
  paris:      { cs:'Paříž', en:'Paris', de:'Paris', sk:'Paríž', pl:'Paryż', hu:'Párizs' }
};
const LANGS = ['cs','en','de','sk','pl','hu'];
const slugList = Object.keys(CITY_SYNONYMS);

const norm = s => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '')
  .toLowerCase();

function localizedCityLabel (slug, lang) {
  const m = CITY_SYNONYMS[slug];
  return (m && m[lang]) || (m && m.cs) || slug;
}
function getFallbackCitiesForLang (lang) {
  return slugList.map(slug => localizedCityLabel(slug, lang));
}
function findSlugByAnyLabel (label) {
  const n = norm(label);
  for (const slug of slugList) {
    const m = CITY_SYNONYMS[slug];
    for (const l of LANGS) {
      if (norm(m[l]) === n) return slug;
    }
  }
  return null;
}
function canonPreferredCity (label, lang) {
  const slug = findSlugByAnyLabel(label) || null;
  if (!slug) return canonForInputCity(label);
  const forApi = CITY_SYNONYMS[slug].en || CITY_SYNONYMS[slug].cs || label;
  return canonForInputCity(forApi);
}

/* ───────── helper: force-inline filters + homepage blog fix ───────── */
function forceInlineFilters (doc = document) {
  const form = doc.getElementById('events-filters-form') || qs('form.filter-dock') || qs('.events-filters');
  if (!form) return;

  if (form.getAttribute('data-behavior') === 'sheet') form.removeAttribute('data-behavior');

  ['#filtersOpen', '#filtersClose', '#filtersOverlay', '.filters-fab', '.filters-toggle', '.filters-summary', '.filters-sheet-toggle']
    .forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

  const toolbar = doc.querySelector('.filters-toolbar');
  if (toolbar) toolbar.remove();

  form.hidden = false;
  form.classList.remove('is-hidden', 'is-collapsed', 'is-open');
  form.style.removeProperty('display');
  doc.body.style.removeProperty('overflow');
}

/**
 * ✅ Homepage BLOG wrapper musí odpovídat produkci:
 * <section class="homepage-blog" id="blog">
 *   <div class="container">
 *     <div class="homepage-blog-cards" id="homepage-blog-list"></div>
 *     <a class="homepage-blog-more" ...>
 *   </div>
 * </section>
 *
 * Produkční CSS typicky cílí na `.homepage-blog-cards > a.blog-card` (grid),
 * proto musí být host i markup přesně.
 *
 * ⚠️ DŮLEŽITÉ: V DEV HTML často zůstává `blog` / `blog-cards`, které přepíší layout
 * (úzký sloupec, column stack). Na homepage je proto odstraníme.
 */
function fixHomeBlog () {
  if (!isHome()) return;

  const blog = document.getElementById('blog') || qs('section#blog');
  if (!blog) return;

  // ✅ produkce: homepage-blog bez "blog" (jinak ti CSS z blog listingu rozbije layout)
  blog.classList.add('homepage-blog');
  blog.classList.remove('blog');

  // ✅ host musí být #homepage-blog-list.homepage-blog-cards (bez blog-cards)
  const container = blog.querySelector('.container') || blog;

  let host =
    container.querySelector('#homepage-blog-list') ||
    container.querySelector('[data-home-blog]') ||
    container.querySelector('.homepage-blog-cards');

  if (!host) {
    host = document.createElement('div');
    container.appendChild(host);
  }

  host.id = 'homepage-blog-list';
  host.classList.add('homepage-blog-cards');
  host.classList.remove('blog-cards');
}

/* ───────── Homepage BLOG render (TOP 3) ───────── */
function _pickLocalized (val, lang) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val[lang] || val[lang?.slice(0,2)] || val.cs || val.en || Object.values(val)[0] || '';
  }
  return String(val);
}
function _withLangParam (href, lang) {
  try {
    const u = new URL(href, location.origin);
    // jen same-origin
    if (u.origin !== location.origin) return u.toString();
    if (!u.searchParams.has('lang')) u.searchParams.set('lang', lang);
    return u.toString();
  } catch {
    // relativní
    if (typeof href === 'string' && href.startsWith('/')) {
      try {
        const u = new URL(href, location.origin);
        if (!u.searchParams.has('lang')) u.searchParams.set('lang', lang);
        return u.toString();
      } catch { /* noop */ }
    }
    return href || '#';
  }
}
function _tAny (keys = [], fb = '') {
  for (const k of keys) {
    const v = t(k);
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fb;
}

function getHomeBlogHost () {
  const blog = document.getElementById('blog') || qs('section#blog');
  if (!blog) return null;
  return blog.querySelector('#homepage-blog-list') || blog.querySelector('[data-home-blog]') || blog.querySelector('.homepage-blog-cards');
}

function renderHomeBlog () {
  if (!isHome()) return;

  fixHomeBlog();

  const blog = document.getElementById('blog') || qs('section#blog');
  const host = getHomeBlogHost();
  if (!blog || !host) return;

  // ✅ vynutit produkční class na hostu (a odstranit konfliktní blog-cards)
  host.classList.add('homepage-blog-cards');
  host.classList.remove('blog-cards');

  // ✅ link "Zobrazit všechny články" – přidej lang param
  const more = blog.querySelector('a.homepage-blog-more') || blog.querySelector('a[data-i18n-key="blog-show-all"]');
  if (more) {
    more.classList.add('homepage-blog-more');
    const raw = more.getAttribute('href') || more.href || '/blog';
    more.href = _withLangParam(raw, currentLang);
  }

  // ✅ zabránit zbytečnému re-renderu ve stejném jazyce
  if (host.dataset.ajRenderedLang === currentLang && host.children.length) return;

  let articles = [];
  try { articles = getSortedBlogArticles?.() || []; } catch { articles = []; }
  const top = (Array.isArray(articles) ? articles : []).slice(0, 3);

  if (!top.length) {
    host.innerHTML = '';
    host.dataset.ajRenderedLang = currentLang;
    return;
  }

  const readMore =
    (t('blog.readMore') && String(t('blog.readMore')).trim()) ? t('blog.readMore') :
    (currentLang === 'en') ? 'Read more' :
    (currentLang === 'de') ? 'Mehr lesen' :
    (currentLang === 'sk') ? 'Čítať ďalej' :
    (currentLang === 'pl') ? 'Czytaj dalej' :
    (currentLang === 'hu') ? 'Tovább' :
    'Číst dál';

  host.innerHTML = top.map((a) => {
    const title = esc(_pickLocalized(a.title || a.name || a.heading, currentLang) || '');
    const excerpt = esc(_pickLocalized(a.excerpt || a.perex || a.summary || a.description, currentLang) || '');
    const img = esc(a.image || a.cover || a.hero || a.thumb || '/images/fallbacks/concert0.jpg');

    const rawHref = a.url || a.href || a.link || a.path || '/blog';
    const href = esc(_withLangParam(rawHref, currentLang));

    // ✅ pro kompatibilitu se styly: homepage-blog-card + blog-card
    return `
      <a class="homepage-blog-card blog-card" href="${href}" aria-label="${title}">
        <img src="${img}" alt="${title}" loading="lazy" />
        <div class="blog-card-content">
          <h3>${title}</h3>
          ${excerpt ? `<p>${excerpt}</p>` : ``}
          <span class="btn-primary">${esc(readMore)}</span>
        </div>
      </a>
    `;
  }).join('');

  host.dataset.ajRenderedLang = currentLang;
}

/* live region */
function ensureLiveRegion () {
  let r = document.getElementById('ajsee-live');
  if (!r) {
    r = document.createElement('div');
    r.id = 'ajsee-live';
    r.setAttribute('aria-live', 'polite');
    r.setAttribute('aria-atomic', 'true');
    r.style.position = 'absolute';
    r.style.width = '1px';
    r.style.height = '1px';
    r.style.overflow = 'hidden';
    r.style.clip = 'rect(1px,1px,1px,1px)';
    r.style.clipPath = 'inset(50%)';
    r.style.whiteSpace = 'nowrap';
    document.body.appendChild(r);
  }
  return r;
}
const announce = (msg) => { ensureLiveRegion().textContent = msg || ''; };

function setBusy (v) {
  const form = qs('form.filter-dock') || qs('.events-filters');
  const list = qs('#eventsList');
  if (form) {
    form.setAttribute('aria-busy', v ? 'true' : 'false');
    qsa('input,select,button', form).forEach(el => { el.disabled = !!v && !el.classList.contains('filters-toggle'); });
  }
  if (list) list.setAttribute('aria-busy', v ? 'true' : 'false');
}

/* ───────── i18n ───────── */
function deepMerge (a = {}, b = {}) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(o[k] || {}, v) : v;
  return o;
}
async function fetchJSON (p) { try { const r = await fetch(p, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { /* noop */ } return null; }
async function loadTranslations (lang) {
  const base = (await fetchJSON(`/locales/${lang}.json`)) || (await fetchJSON(`/src/locales/${lang}.json`)) || {};
  const page = location.pathname.split('/').pop();
  const pagePart = page === 'about.html'
    ? (await fetchJSON(`/locales/${lang}/about.json`)) || (await fetchJSON(`/src/locales/${lang}/about.json`)) || {}
    : {};
  return deepMerge(base, pagePart);
}
function getByPath (o, p) { return p?.split('.').reduce((a, k) => a?.[k], o); }
function t (key, fb) {
  const tr = window.translations || {};
  const v = getByPath(tr, key) ?? tr[key];
  if (v !== undefined) return v;
  if (key.startsWith('filter-')) {
    const tail = key.replace(/^filter-/, ''); const alt = getByPath(tr, `filters.${tail}`); if (alt !== undefined) return alt;
  }
  if (key.startsWith('filters.')) {
    const flat = key.replace(/^filters\./, 'filter-'); const alt = tr[flat]; if (alt !== undefined) return alt;
  }
  if (key.startsWith('category-')) {
    const alt = getByPath(tr, `filters.${key.replace('category-', '')}`); if (alt !== undefined) return alt;
  }
  return fb;
}

const toggleFallback = {
  cs: { show: 'Zobrazit filtry', hide: 'Skrýt filtry' },
  en: { show: 'Show filters', hide: 'Hide filters' },
  de: { show: 'Filter anzeigen', hide: 'Filter ausblenden' },
  sk: { show: 'Zobraziť filtre', hide: 'Skryť filtre' },
  pl: { show: 'Pokaż filtry', hide: 'Ukryj filtre' },
  hu: { show: 'Szűrők megjelenítése', hide: 'Szűrők elrejtése' }
};

function toggleLabel (mode = 'hide') {
  const lang = currentLang || getUILang();
  const fb = toggleFallback[lang] || toggleFallback.cs;
  if (mode === 'show') return t('filters.show', fb.show);
  return t('filters.hide', fb.hide);
}

const ariaToggleFallback = {
  cs: { collapsed: 'Filtry jsou skryté.', expanded: 'Filtry jsou zobrazené.' },
  en: { collapsed: 'Filters are hidden.', expanded: 'Filters are visible.' },
  de: { collapsed: 'Filter sind ausgeblendet.', expanded: 'Filter sind sichtbar.' },
  sk: { collapsed: 'Filtre sú skryté.', expanded: 'Filtre sú zobrazené.' },
  pl: { collapsed: 'Filtry są ukryte.', expanded: 'Filtry są widoczne.' },
  hu: { collapsed: 'A szűrők rejtve vannak.', expanded: 'A szűrők láthatók.' }
};
const ariaToggleText = (state) => {
  const lang = currentLang || getUILang();
  return state === 'collapsed'
    ? (t('filters.aria.collapsed', (ariaToggleFallback[lang] || ariaToggleFallback.cs).collapsed))
    : (t('filters.aria.expanded', (ariaToggleFallback[lang] || ariaToggleFallback.cs).expanded));
};

/* ✅ NEW: language-aware fallbacks for date-related filter labels */
const filtersFallback = {
  cs: { date: 'Datum', anytime: 'Kdykoliv' },
  en: { date: 'Date', anytime: 'Anytime' },
  de: { date: 'Datum', anytime: 'Beliebig' },
  sk: { date: 'Dátum', anytime: 'Kedykoľvek' },
  pl: { date: 'Data', anytime: 'Kiedykolwiek' },
  hu: { date: 'Dátum', anytime: 'Bármikor' }
};
const fbFilters = (k) => {
  const lang = currentLang || getUILang();
  return (filtersFallback[lang] || filtersFallback.cs)[k] || (filtersFallback.cs)[k] || '';
};

const setBtnLabel = (el, txt) => { if (!el) return; const n = el.querySelector('[data-i18n-label],.label,.btn-label'); (n || el).textContent = txt; };

/* ───────── visual patch ───────── */
function injectOnce (id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id = id; s.textContent = css; (document.head || document.documentElement).appendChild(s);
}
function patchFilterVisuals () {
  injectOnce('ajsee-filters-visual-fix', String.raw`
    :root{ --ajsee-ctrl-h:56px; --ajsee-ctrl-radius:14px; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group{ position:relative; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group > label{
      position:absolute; top:8px; left:16px; font-size:12px; font-weight:700;
      letter-spacing:.04em; text-transform:uppercase; color:#0A3D62; opacity:.85; pointer-events:none;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .styled-input,
    :where(.events-filters.filter-dock, form.filter-dock) .styled-select{
      height:var(--ajsee-ctrl-h); line-height:1.25; border-radius:var(--ajsee-ctrl-radius);
      padding:26px 16px 10px 16px !important;
      display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .field .styled-input{ width:100%; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.date-combo #date-combo-button{
      height:var(--ajsee-ctrl-h); border-radius:var(--ajsee-ctrl-radius);
      padding:26px 16px 10px 16px; display:flex; align-items:center; justify-content:flex-start;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis; width:100%;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .date-combo .combo-text{
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; width:100%;
    }

    /* fallback našeptávač měst */
    .ajsee-city-fallback{
      position:fixed;
      z-index:var(--ajsee-popover-z, 10020);
      background:#fff; border-radius:12px;
      box-shadow:0 14px 40px rgba(9,30,66,.2);
      overflow:auto; max-height:320px; min-width:220px;
    }

    /* native typeahead (různé možné implementace) – vždy pod header */
    [role="listbox"][data-city-ta],
    [data-city-ta][role="listbox"],
    .tm-city-suggest,
    .tm-city-suggest [role="listbox"],
    [class*="city"][role="listbox"]{
      z-index:var(--ajsee-popover-z, 10020) !important;
    }

    .ajsee-city-fallback ul{ list-style:none; margin:6px 0; padding:0; }
    .ajsee-city-fallback li{ margin:0; padding:0; }
    .ajsee-city-fallback button{
      width:100%; text-align:left; background:none; border:0;
      padding:10px 14px; font:inherit; cursor:pointer;
    }
    .ajsee-city-fallback button:hover,
    .ajsee-city-fallback [aria-selected="true"]{ background:#F0F6FF; }
    .ajsee-city-fallback .section{
      padding:6px 12px; font-size:12px; opacity:.7; text-transform:uppercase;
    }
  `);

  injectOnce('ajsee-nearme-inline-css', String.raw`
    .filter-group .btn-nearme-inline{
      position:absolute; right:12px; top:14px; border:0; background:none; padding:6px;
      font-size:18px; line-height:1; cursor:pointer; opacity:.8;
    }
    .filter-group .btn-nearme-inline:hover{ opacity:1; }
  `);

  injectOnce('ajsee-date-fallback-css', String.raw`
    .ajsee-date-fallback{
      position:fixed; background:#fff; border-radius:12px;
      box-shadow:0 14px 40px rgba(9,30,66,.2); padding:14px;
      z-index:var(--ajsee-popover-z, 10020);
    }
    .ajsee-date-fallback .row{ display:flex; gap:10px; align-items:center; margin:6px 0; }
    .ajsee-date-fallback label{ width:46px; font-size:12px; opacity:.8; }
    .ajsee-date-fallback input[type="date"]{
      height:38px; padding:6px 10px; border-radius:10px; border:1px solid #d9e1ef;
    }
    .ajsee-date-fallback .actions{
      display:flex; gap:8px; justify-content:flex-end; margin-top:10px;
    }
  `);

  injectOnce('ajsee-popover-glue-css', String.raw`
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.is-open-city .styled-input,
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.is-open-city .styled-select{
      border-bottom-left-radius:0 !important;
      border-bottom-right-radius:0 !important;
      border-bottom-color: transparent !important;
    }

    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.date-combo.is-open #date-combo-button{
      border-bottom-left-radius:0 !important;
      border-bottom-right-radius:0 !important;
      border-bottom-color: transparent !important;
    }

    .ajsee-city-fallback{
      border:1px solid #d9e1ef;
      border-top-left-radius:0 !important;
      border-top-right-radius:0 !important;
      margin-top:-1px;
    }

    .ajsee-date-fallback,
    .ajsee-date-popover,
    #ajsee-date-popover,
    [data-ajsee-date-popover],
    [data-ajsee="date-popover"]{
      border:1px solid #d9e1ef;
      border-top-left-radius:0 !important;
      border-top-right-radius:0 !important;
      margin-top:-1px;
      z-index:var(--ajsee-popover-z, 10020) !important;
    }
  `);
}

/* ───────── i18n helpers ───────── */
function updateFilterLocaleTexts () {
  const city = qs('#filter-city') || qs('#events-city-filter');
  if (city) city.placeholder = t('filters.cityPlaceholder', 'Praha, Brno…');
  const kw = qs('#filter-keyword'); if (kw) kw.placeholder = t('filters.keywordPlaceholder', 'Umělec, místo, akce…');

  const applyBtn = qs('#events-apply-filters') || qs('.filter-actions .btn.btn-primary');
  if (applyBtn) setBtnLabel(applyBtn, t('filters.apply', 'Použít filtry'));

  const lblCat = qs('label[for="filter-category"]') || qs('label[for="events-category-filter"]');
  if (lblCat) lblCat.textContent = t('filters.category', 'Kategorie');
  const lblCity = qs('label[for="filter-city"]') || qs('label[for="events-city-filter"]');
  if (lblCity) lblCity.textContent = t('filters.city', 'Město');
  const lblKw = qs('label[for="filter-keyword"]');
  if (lblKw) lblKw.textContent = t('filters.keyword', 'Klíčové slovo');

  const segLbl = qs('.segmented .inline-label');
  if (segLbl) segLbl.textContent = t('filters.sort', 'Řazení');

  // ✅ date label + a11y name for the combo button (same localized string)
  const dateLabel = t('filters.date', fbFilters('date'));

  const dateLbl = qs('label[for="date-combo-button"]');
  if (dateLbl) dateLbl.textContent = dateLabel;

  const dateBtn = qs('#date-combo-button');
  if (dateBtn) dateBtn.setAttribute('aria-label', dateLabel);

  updateDateComboLabel();
}
async function applyTranslations (lang) {
  window.translations = await loadTranslations(lang);
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const k = el.getAttribute('data-i18n-key'); const v = t(k);
    if (v === undefined || String(v).trim() === '') return;
    if (/[<][a-z]/i.test(v)) el.innerHTML = v; else el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const k = el.getAttribute('data-i18n-placeholder'); const v = t(k); if (!v) return; el.setAttribute('placeholder', String(v));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const k = el.getAttribute('data-i18n-aria'); const v = t(k); if (!v) return; el.setAttribute('aria-label', String(v));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const k = el.getAttribute('data-i18n-alt'); const v = t(k); if (!v) return; el.setAttribute('alt', String(v));
  });
  updateFilterLocaleTexts();

  // ✅ při změně jazyka znovu vykresli homepage blog (lokalizované titulky/CTA)
  renderHomeBlog();
}
if (!window.applyTranslations) window.applyTranslations = applyTranslations;

(function observeLangAttr () {
  try {
    const mo = new MutationObserver(async () => {
      currentLang = getUILang();
      setLangCookie(currentLang);
      await ensureTranslations(currentLang);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch { /* noop */ }
})();

async function ensureTranslations (lang) {
  if (typeof window.applyTranslations === 'function') return window.applyTranslations(lang);
  window.translations = await loadTranslations(lang);
  updateFilterLocaleTexts();
  renderHomeBlog();
}

/* ───────── UI helpers ───────── */
function expandFilters () {
  const dock = qs('form.filter-dock') || qs('.events-filters'); if (!dock) return;
  filtersCollapsed = false; dock.classList.remove('is-collapsed');
  const tgl = qs('#filtersToggle'); if (tgl) { tgl.setAttribute('aria-pressed', 'false'); setBtnLabel(tgl, toggleLabel('hide')); }
  store.set('filtersCollapsed', false);
  announce(ariaToggleText('expanded'));
}

function computeActiveFiltersCount (f = currentFilters) {
  let c = 0;
  if (f.category && f.category !== 'all') c++;
  if (f.city || f.cityLabel) c++;
  if (f.keyword) c++;
  if (f.sort && f.sort !== 'nearest') c++;
  if (f.dateFrom || f.dateTo) c++;
  if (f.nearMeLat && f.nearMeLon) c++;
  return c;
}
function updateToggleBadge () {
  const btn = qs('#filtersToggle');
  if (!btn) return;
  const cnt = computeActiveFiltersCount();
  let badge = btn.querySelector('.badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge';
    btn.appendChild(badge);
  }
  badge.textContent = String(cnt);
  const base = toggleLabel('hide');
  btn.setAttribute('aria-label', cnt ? `${base} (${cnt})` : base);
}

function updateResultsCount (n) {
  const host =
    qs('.events-upcoming-section .container') ||
    qs('#upcoming-events .container') ||
    (qs('#eventsList') ? qs('#eventsList').parentElement : null) ||
    document.body;

  let el = host.querySelector('#eventsResultsCount');
  if (!el) {
    el = document.createElement('div');
    el.id = 'eventsResultsCount';
    el.className = 'events-results-count';
    const list = qs('#eventsList');
    if (list && list.parentElement === host) {
      host.insertBefore(el, list);
    } else {
      host.appendChild(el);
    }
  }
  const label = t('events-found', 'Nalezeno') || 'Nalezeno';
  el.textContent = `${label}: ${n}`;
}

/* ───────── DATE – centrální aplikace range (popover + fallback inputs) ───────── */
function applyDateRangeFromDetail (detail = {}, options = {}) {
  const { triggerRender = true } = options || {};
  const todayISO = toLocalISO(new Date());
  const src = detail || {};

  let mode = src.mode || 'range';

  let from = src.from || src.start || src.dateFrom || '';
  let to   = src.to   || src.end   || src.dateTo   || '';

  from = from || '';
  to = to || '';

  if (mode === 'anytime') {
    from = '';
    to = '';
  } else if (mode === 'today') {
    from = todayISO;
    to = todayISO;
  }

  if (from && from < todayISO) from = todayISO;
  if (to && to < todayISO)     to   = todayISO;

  if (from && to && from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  currentFilters.dateFrom = from;
  currentFilters.dateTo   = to;

  setFilterInputsFromState();
  updateToggleBadge();

  if (triggerRender) {
    void renderAndSync({ resetPage: true });
  }
}

function normalizeDates () {
  if (!currentFilters.dateFrom && !currentFilters.dateTo) return;
  applyDateRangeFromDetail({
    from: currentFilters.dateFrom,
    to: currentFilters.dateTo,
    mode: (currentFilters.dateFrom || currentFilters.dateTo) ? 'range' : 'anytime'
  }, { triggerRender: false });
}

function setFilterInputsFromState () {
  const $cat = qs('#filter-category') || qs('#events-category-filter');
  const $sort = qs('#filter-sort') || qs('#events-sort-filter');
  const $city = qs('#filter-city') || qs('#events-city-filter');
  const $from = qs('#filter-date-from') || qs('#events-date-from');
  const $to = qs('#filter-date-to') || qs('#events-date-to');
  const $kw = qs('#filter-keyword');
  if ($cat) $cat.value = currentFilters.category || 'all';
  if ($sort) $sort.value = currentFilters.sort || 'nearest';
  if ($city && !$city.matches('[data-autofromnearme="1"]')) $city.value = (currentFilters.cityLabel || currentFilters.city || '');
  if ($from) $from.value = currentFilters.dateFrom || '';
  if ($to) $to.value = currentFilters.dateTo || '';
  if ($kw) $kw.value = currentFilters.keyword || '';
  updateDateComboLabel();
}

function syncURLFromFilters () {
  const u = new URL(location.href), p = u.searchParams;
  (currentFilters.city ? p.set('city', currentFilters.city) : p.delete('city'));
  (currentFilters.dateFrom ? p.set('from', currentFilters.dateFrom) : p.delete('from'));
  (currentFilters.dateTo ? p.set('to', currentFilters.dateTo) : p.delete('to'));
  (currentFilters.category && currentFilters.category !== 'all' ? p.set('segment', currentFilters.category) : p.delete('segment'));
  (currentFilters.keyword ? p.set('q', currentFilters.keyword) : p.delete('q'));
  (currentFilters.sort && currentFilters.sort !== 'nearest' ? p.set('sort', currentFilters.sort) : p.delete('sort'));
  if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
    p.set('lat', String(currentFilters.nearMeLat));
    p.set('lon', String(currentFilters.nearMeLon));
    p.set('radius', String(currentFilters.nearMeRadiusKm || 50));
  } else {
    p.delete('lat'); p.delete('lon'); p.delete('radius');
  }
  history.replaceState(null, '', u.toString());
}

/* ───────── Sort segmented ───────── */
function upgradeSortToSegmented () {
  const select = qs('#filter-sort') || qs('#events-sort-filter');
  if (!select || select.dataset.upgraded === 'segmented') return;

  select.dataset.upgraded = 'segmented';
  const wrap = document.createElement('div');
  wrap.className = 'segmented';
  wrap.setAttribute('role', 'tablist');
  wrap.setAttribute('aria-label', t('filters.sort', 'Řazení'));

  const visLabel = document.createElement('span');
  visLabel.className = 'inline-label';
  visLabel.textContent = t('filters.sort', 'Řazení');
  wrap.appendChild(visLabel);

  const indicator = document.createElement('div');
  indicator.className = 'seg-indicator';
  wrap.appendChild(indicator);

  const btnNearest = document.createElement('button');
  const btnLatest = document.createElement('button');
  btnNearest.type = 'button'; btnLatest.type = 'button';
  btnNearest.textContent = t('filters.nearest', 'Nearest');
  btnLatest.textContent = t('filters.latest', 'Latest');

  wrap.appendChild(btnNearest);
  wrap.appendChild(btnLatest);

  select.parentElement.insertBefore(wrap, select);
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.style.display = 'none';

  function setActive (which) {
    const buttons = [btnNearest, btnLatest];
    buttons.forEach((b, i) => {
      b.classList.toggle('is-active', i === which);
      b.setAttribute('aria-selected', i === which ? 'true' : 'false');
      b.setAttribute('role', 'tab');
      b.tabIndex = i === which ? 0 : -1;
    });
    const target = buttons[which];
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const rw = wrap.getBoundingClientRect();
      const left = r.left - rw.left + 6;
      wrap.style.setProperty('--indi-left', left + 'px');
      wrap.style.setProperty('--indi-width', r.width + 'px');
    });
  }

  setActive(currentFilters.sort === 'latest' ? 1 : 0);

  wireOnce(btnNearest, 'click', async () => {
    currentFilters.sort = 'nearest';
    setActive(0);
    await renderAndSync({ resetPage: true });
  }, 'seg-nearest');

  wireOnce(btnLatest, 'click', async () => {
    currentFilters.sort = 'latest';
    setActive(1);
    await renderAndSync({ resetPage: true });
  }, 'seg-latest');

  wireOnce(wrap, 'keydown', async (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const isLatest = currentFilters.sort === 'latest';
    if (e.key === 'ArrowLeft' && isLatest) {
      btnNearest.click();
      btnNearest.focus();
    } else if (e.key === 'ArrowRight' && !isLatest) {
      btnLatest.click();
      btnLatest.focus();
    }
  }, 'seg-kbd');

  wireOnce(window, 'resize', () => setActive(currentFilters.sort === 'latest' ? 1 : 0), 'seg-resize', { passive: true });
}

/* ───────── „light“ normalizace polí ───────── */
function normalizeFilterFormUI () {
  const cat = qs('#filter-category') || qs('#events-category-filter');
  if (cat && !cat.classList.contains('styled-select')) cat.classList.add('styled-select');

  ['#filter-city', '#events-city-filter', '#filter-date-from', '#events-date-from', '#filter-date-to', '#events-date-to', '#filter-keyword']
    .forEach(sel => {
      const el = qs(sel);
      if (el && !el.classList.contains('styled-input')) el.classList.add('styled-input');
    });

  patchFilterVisuals();
}

/* ───────── DATE COMBO – label & helpers ───────── */
function parseISODateMidday (iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
}
function formatDMY (d) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
function formatDateRangeCompact (aISO, bISO) {
  if (aISO && !bISO) return formatDMY(parseISODateMidday(aISO));
  if (bISO && !aISO) return formatDMY(parseISODateMidday(bISO));
  if (!aISO && !bISO) return '';
  const A = parseISODateMidday(aISO);
  const B = parseISODateMidday(bISO);
  if (isNaN(A) || isNaN(B)) return `${aISO || ''}${aISO && bISO ? ' - ' : ''}${bISO || ''}`;

  const sameYear = A.getFullYear() === B.getFullYear();
  const sameMonth = sameYear && A.getMonth() === B.getMonth();
  if (sameMonth) {
    const dd1 = pad2(A.getDate());
    const dd2 = pad2(B.getDate());
    const mm = pad2(A.getMonth() + 1);
    return `${dd1}-${dd2}.${mm}.${A.getFullYear()}`;
  }
  if (sameYear) {
    const ddm1 = `${pad2(A.getDate())}.${pad2(A.getMonth() + 1)}`;
    const ddm2 = `${pad2(B.getDate())}.${pad2(B.getMonth() + 1)}.${B.getFullYear()}`;
    return `${ddm1} - ${ddm2}`;
  }
  return `${formatDMY(A)} - ${formatDMY(B)}`;
}
function updateDateComboLabel () {
  const btnTxt = qs('.date-combo .combo-text');
  if (!btnTxt) return;
  const all = t('filters.anytime', fbFilters('anytime'));
  const label = (currentFilters.dateFrom || currentFilters.dateTo)
    ? formatDateRangeCompact(currentFilters.dateFrom, currentFilters.dateTo)
    : all;
  btnTxt.textContent = label;
  btnTxt.title = label;
}
if (!window.updateDateComboLabel) window.updateDateComboLabel = updateDateComboLabel;

/* ───────── Date popover helpers (autohide like city) ───────── */
function getDatePopoverPanel () {
  return document.querySelector(
    '.ajsee-date-fallback, .ajsee-date-popover, #ajsee-date-popover, [data-ajsee-date-popover], [data-ajsee="date-popover"]'
  );
}
function isDatePopoverPanelVisible (p) {
  if (!p) return false;
  const cs = window.getComputedStyle(p);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = p.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function closeDatePopover () {
  const p = getDatePopoverPanel();
  if (!p) return;

  const btn =
    p.querySelector('[data-ajsee-close], [data-close], .btn-close, .close, button[aria-label*="close" i], button[aria-label*="zavř" i], button[aria-label*="zavri" i]');

  if (btn && typeof btn.click === 'function') {
    btn.click();
    return;
  }

  const overlay = document.querySelector('.ajsee-date-popover-overlay, [data-ajsee-date-overlay], .ajsee-popover-overlay');
  if (overlay && typeof overlay.click === 'function') {
    overlay.click();
    return;
  }

  try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch { /* noop */ }

  try {
    p.style.display = 'none';
    p.setAttribute('data-ajsee-force-hidden', '1');
  } catch { /* noop */ }
}
function bindDatePopoverUnhideOnOpen () {
  const btn = qs('#date-combo-button');
  if (!btn) return;

  const unhide = () => {
    requestAnimationFrame(() => {
      const p = getDatePopoverPanel();
      if (p && p.hasAttribute('data-ajsee-force-hidden')) {
        p.style.removeProperty('display');
        p.removeAttribute('data-ajsee-force-hidden');
      }
    });
  };

  wireOnce(btn, 'pointerdown', unhide, 'date-unhide-pointer');
  wireOnce(btn, 'click', unhide, 'date-unhide-click');
}
function installDatePopoverAutoHide () {
  const btn = qs('#date-combo-button');
  const group = (btn && btn.closest('.filter-group')) || qs('.filter-group.date-combo');
  if (!group) return;

  let raf = 0;
  const check = () => {
    raf = 0;
    const p = getDatePopoverPanel();
    if (!isDatePopoverPanelVisible(p)) return;

    if (!isElementInViewportBelowHeader(group, 4)) {
      closeDatePopover();
      group.classList.remove('is-open');
      try { btn?.setAttribute('aria-expanded', 'false'); } catch { /* noop */ }
    }
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };

  getScrollParents(group).forEach(sp => {
    wireOnce(sp, 'scroll', schedule, 'date-autohide-scroll', { passive: true });
  });
  wireOnce(window, 'resize', schedule, 'date-autohide-resize', { passive: true });

  schedule();
}

function bindDatePopoverGlue () {
  const group = qs('.filter-group.date-combo') || (qs('#date-combo-button')?.closest('.filter-group'));
  const btn = qs('#date-combo-button');
  if (!group) return;

  try { G.state._dateGlueMO?.disconnect?.(); } catch { /* noop */ }

  const getPanel = () =>
    document.querySelector('.ajsee-date-fallback, .ajsee-date-popover, #ajsee-date-popover, [data-ajsee-date-popover], [data-ajsee="date-popover"]');

  const isOpen = () => {
    const p = getPanel();
    if (!p) return false;
    const cs = window.getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return p.getBoundingClientRect().width > 0;
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    const open = isOpen();
    group.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });

  G.state._dateGlueMO = mo;

  wireOnce(window, 'scroll', schedule, 'date-glue-scroll', { passive: true });
  wireOnce(window, 'resize', schedule, 'date-glue-resize', { passive: true });

  schedule();
}

wireOnce(window, 'AJSEE:dateRangeApply', (e) => {
  applyDateRangeFromDetail(e && e.detail ? e.detail : {}, { triggerRender: true });
}, 'dateRangeApply');

wireOnce(window, 'AJSEE:date-popover:apply', (e) => {
  const d = (e && e.detail) || {};
  applyDateRangeFromDetail(d, { triggerRender: true });
}, 'datePopoverApply');

/* === City typeahead + NearMe === */

async function acquireGeolocation ({ timeout = 15000, highAccuracy = false } = {}) {
  if (!('geolocation' in navigator)) {
    const e = new Error('no-geo'); e.code = 'NO_GEO'; throw e;
  }
  try {
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'geolocation' });
      if (p.state === 'denied') {
        const e = new Error('permission-denied'); e.code = 1; throw e;
      }
    }
  } catch { /* ignore */ }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: +pos.coords.latitude.toFixed(5),
        lon: +pos.coords.longitude.toFixed(5)
      }),
      err => reject(err),
      { enableHighAccuracy: !!highAccuracy, timeout, maximumAge: 300000 }
    );
  });
}

async function fallbackGeoFromEdge () {
  const res = await fetch('/api/geo', { cache: 'no-store' });
  if (!res.ok) throw new Error('edge-failed');
  const j = await res.json();
  const lat = Number(j?.geo?.latitude ?? j?.latitude);
  const lon = Number(j?.geo?.longitude ?? j?.longitude);
  if (isFinite(lat) && isFinite(lon)) {
    return { lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
  }
  throw new Error('edge-no-coords');
}

function geoErrorMessage (err) {
  const code = Number(err?.code);
  switch (code) {
    case 1: return t('geo.permissionDenied', 'Přístup k poloze byl zamítnut v prohlížeči.');
    case 2: return t('geo.unavailable', 'Poloha není dostupná (zkuste vypnout VPN/zkontrolovat služby určování polohy).');
    case 3: return t('geo.timeout', 'Zjišťování polohy vypršelo. Zkuste to znovu.');
    default: return t('geo.denied', 'Nepodařilo se zjistit polohu. Povolte prosím přístup k poloze ve vašem prohlížeči.');
  }
}

const nearMeLabel = () => t('filters.nearMe', 'V mém okolí');

function isNearMeTyped (input) {
  const v = norm(input?.value || '');
  const candidates = [nearMeLabel(), 'v mem okoli', 'vmojemokoli', 'near me', 'nearme', 'aroundme'];
  return candidates.some(x => norm(x) === v);
}

async function activateNearMeViaGeo (input) {
  const setState = ({ lat, lon }) => {
    currentFilters.city = '';
    currentFilters.cityLabel = nearMeLabel();
    currentFilters.nearMeLat = lat;
    currentFilters.nearMeLon = lon;
    currentFilters.nearMeRadiusKm = currentFilters.nearMeRadiusKm || 50;
    if (input) {
      input.value = nearMeLabel();
      input.setAttribute('data-autofromnearme', '1');
    }
  };

  try {
    const coords = await acquireGeolocation({ timeout: 15000, highAccuracy: false });
    setState(coords);
  } catch (err1) {
    try {
      const coords = await fallbackGeoFromEdge();
      setState(coords);
    } catch (err2) {
      announce(geoErrorMessage(err1) + ' ' + t('geo.edgeFailed', '(Záložní určení podle IP nebylo k dispozici.)'));
      return;
    }
  }

  await renderAndSync({ resetPage: true });
  expandFilters();
}

function ensureNearMeInlineButton () {
  const input = qs('#filter-city') || qs('#events-city-filter');
  if (!input) return;
  const host = input.closest('.filter-group') || input.parentElement;
  if (!host || host.querySelector('.btn-nearme-inline')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-nearme-inline';
  btn.setAttribute('aria-label', nearMeLabel());
  btn.title = nearMeLabel();
  btn.textContent = '📍';

  host.style.position = 'relative';
  host.appendChild(btn);

  btn.addEventListener('click', () => { void activateNearMeViaGeo(input); });
}

/* ───────── Native city typeahead auto-hide (STEJNÉ jako fallback) ───────── */
function _isPanelVisible (el) {
  if (!el) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function findNativeCityPanel (input) {
  if (!input) return null;

  const id = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
  if (id) {
    const el = document.getElementById(id);
    if (el) return el;
  }

  const candidates = [
    ...qsa('[role="listbox"][data-city-ta]'),
    ...qsa('.tm-city-suggest'),
    ...qsa('.tm-city-suggest [role="listbox"]')
  ].filter(Boolean);

  if (!candidates.length) return null;

  const ir = input.getBoundingClientRect();
  let best = null;
  let bestScore = Infinity;

  for (const c of candidates) {
    if (!_isPanelVisible(c)) continue;
    const r = c.getBoundingClientRect();
    const dy = Math.abs(r.top - ir.bottom);
    const dx = Math.abs(r.left - ir.left);
    const score = dy * 2 + dx;
    if (score < bestScore) { bestScore = score; best = c; }
  }

  return best || candidates[0] || null;
}
function closeNativeCityPanel (input, reason = '') {
  const panel = findNativeCityPanel(input);
  if (!panel) return;

  try { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch { /* noop */ }
  try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch { /* noop */ }

  try {
    panel.style.display = 'none';
    panel.setAttribute('data-ajsee-force-hidden', '1');
  } catch { /* noop */ }

  if (reason === 'out-of-view') {
    try { if (document.activeElement === input) input.blur(); } catch { /* noop */ }
  }
}
function bindNativeCityUnhideOnOpen (input) {
  if (!input) return;

  const unhide = () => {
    requestAnimationFrame(() => {
      const p = findNativeCityPanel(input);
      if (p && p.hasAttribute('data-ajsee-force-hidden')) {
        p.style.removeProperty('display');
        p.removeAttribute('data-ajsee-force-hidden');
      }
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch { /* noop */ }
    });
  };

  wireOnce(input, 'pointerdown', unhide, 'native-city-unhide-pointer');
  wireOnce(input, 'click', unhide, 'native-city-unhide-click');
}
function installNativeCityAutoHide (input) {
  if (!input) return;
  const group = input.closest('.filter-group') || input;
  let raf = 0;

  const check = () => {
    raf = 0;
    const panel = findNativeCityPanel(input);
    if (!_isPanelVisible(panel)) return;

    if (!isElementInViewportBelowHeader(group, 4)) {
      closeNativeCityPanel(input, 'out-of-view');
    }
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };

  getScrollParents(group).forEach(sp => {
    wireOnce(sp, 'scroll', schedule, 'native-city-autohide-scroll', { passive: true });
  });
  wireOnce(window, 'resize', schedule, 'native-city-autohide-resize', { passive: true });

  schedule();
}

/* === Fallback typeahead (lokalizovaný, otevře se i na focus bez psaní) === */
function initCityTypeaheadFallback (input) {
  if (!input) return;

  Array.from(document.querySelectorAll('.ajsee-city-fallback')).forEach(el => el.remove());

  let menu = null;
  let open = false;

  const group = input.closest('.filter-group') || input.parentElement;
  const setOpenState = (v) => { if (group) group.classList.toggle('is-open-city', !!v); };

  const ensureMenu = () => {
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'ajsee-city-fallback';
      menu.setAttribute('role', 'listbox');
    }
    if (!document.body.contains(menu)) {
      document.body.appendChild(menu);
    }
    return menu;
  };

  const close = (reason = '') => {
    open = false;
    setOpenState(false);
    if (menu) menu.style.display = 'none';
    if (reason === 'out-of-view') {
      try { if (document.activeElement === input) input.blur(); } catch { /* noop */ }
    }
  };

  const position = () => {
    if (!menu || !open) return;

    const anchor = input.closest('.filter-group') || input;

    if (!isElementInViewportBelowHeader(anchor, 4)) {
      close('out-of-view');
      return;
    }

    const r = anchor.getBoundingClientRect();
    const SAFE = 8;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    const width = Math.min(Math.max(r.width, 220), vpW - SAFE * 2);

    let left = r.left;
    left = Math.max(left, SAFE);
    left = Math.min(left, vpW - SAFE - width);

    const panelH = menu.offsetHeight || 260;
    let top = r.bottom;

    if (top + panelH > vpH - SAFE) {
      const above = r.top - panelH;
      if (above >= SAFE) {
        top = above;
      } else {
        top = Math.max(SAFE, vpH - SAFE - panelH);
      }
    }

    menu.style.position = 'fixed';
    menu.style.left = Math.round(left) + 'px';
    menu.style.top  = Math.round(top)  + 'px';
    menu.style.minWidth = width + 'px';
    menu.style.maxWidth = width + 'px';
  };

  const pick = (label) => {
    currentFilters.city = canonPreferredCity(label, currentLang);
    currentFilters.cityLabel = label;
    currentFilters.nearMeLat = null;
    currentFilters.nearMeLon = null;
    input.value = label || '';
    input.removeAttribute('data-autofromnearme');
    close();
    renderAndSync({ resetPage: true }).then(() => expandFilters());
  };

  const pickNearMe = async () => {
    const prevVal = input.value;
    try {
      await activateNearMeViaGeo(input);
      close();
    } catch {
      input.value = prevVal;
      input.removeAttribute('data-autofromnearme');
      currentFilters.nearMeLat = null;
      currentFilters.nearMeLon = null;
      announce(t('geo.denied', 'Nepodařilo se zjistit polohu. Povolte prosím přístup k poloze ve vašem prohlížeči.'));
      close();
    }
  };

  const normalizeCities = (arr = []) => {
    const seen = new Set();
    const nearNorm = norm(nearMeLabel());
    const out = [];
    for (const raw of arr) {
      const lbl = typeof raw === 'string' ? raw : (raw?.city || raw?.name || raw?.label || '');
      if (!lbl) continue;
      const n = norm(lbl);
      if (n === nearNorm || seen.has(n)) continue;
      seen.add(n);
      const slug = findSlugByAnyLabel(lbl);
      out.push(slug ? localizedCityLabel(slug, currentLang) : lbl);
    }
    return out;
  };

  const fromEndpoint = async (q) => {
    const url = new URL('/.netlify/functions/ticketmasterCitySuggest', location.origin);
    url.searchParams.set('locale', currentLang);
    url.searchParams.set('keyword', q);
    url.searchParams.set('size', '80');
    url.searchParams.set('countryCode', 'CZ,SK,PL,HU,DE,AT');
    try {
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = res.ok ? await res.json() : null;
      const arr = Array.isArray(json) ? json
        : (Array.isArray(json?.items) ? json.items
        : (Array.isArray(json?.cities) ? json.cities : []));
      return normalizeCities(arr);
    } catch {
      return [];
    }
  };

  const renderList = (labels = []) => {
    const host = ensureMenu();
    host.innerHTML = '';
    host.style.display = 'block';
    setOpenState(true);

    const suggFallback = {
      cs: 'Návrhy měst',
      en: 'City suggestions',
      de: 'Stadtvorschläge',
      sk: 'Návrhy miest',
      pl: 'Propozycje miast',
      hu: 'Városjavaslatok'
    };
    const lang = currentLang || getUILang();
    const head = document.createElement('div');
    head.className = 'section';
    head.textContent = t('filters.suggestions', suggFallback[lang] || suggFallback.cs);
    host.appendChild(head);

    const liNear = document.createElement('li');
    const btnNear = document.createElement('button');
    btnNear.type = 'button';
    btnNear.textContent = nearMeLabel();
    btnNear.setAttribute('data-nearme', '1');
    liNear.appendChild(btnNear);
    host.appendChild(liNear);

    const ul = document.createElement('ul');
    normalizeCities(labels).forEach(lbl => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = lbl;
      b.setAttribute('role', 'option');
      b.setAttribute('data-city', lbl);
      li.appendChild(b);
      ul.appendChild(li);
    });
    host.appendChild(ul);

    open = true;
    position();

    host.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-nearme')) void pickNearMe();
      else pick(b.getAttribute('data-city') || '');
    };
  };

  const search = debounce(async () => {
    const q = (input.value || '').trim();
    let labels = [];

    if (q.length >= 2) {
      labels = await fromEndpoint(q);
      if (!labels.length) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const nearNorm = norm(nearMeLabel());
        const seen = new Set();
        labels = getFallbackCitiesForLang(currentLang)
          .filter(c => rx.test(c))
          .filter(c => {
            const n = norm(c);
            if (n === nearNorm || seen.has(n)) return false;
            seen.add(n);
            return true;
          })
          .slice(0, 12);
      }
    } else {
      labels = getFallbackCitiesForLang(currentLang).slice(0, 12);
    }

    renderList(labels);
  }, 180);

  const anchorForScroll = input.closest('.filter-group') || input;
  getScrollParents(anchorForScroll).forEach(p => {
    wireOnce(p, 'scroll', position, 'city-fallback-scroll', { passive: true });
  });
  wireOnce(window, 'resize', position, 'city-fallback-resize', { passive: true });

  wireOnce(input, 'input', search, 'city-fallback-input');
  wireOnce(input, 'focus', () => { search(); }, 'city-fallback-focus');

  wireOnce(input, 'pointerdown', () => { if (!open) search(); }, 'city-fallback-pointerdown');
  wireOnce(input, 'click', () => { if (!open) search(); }, 'city-fallback-click');

  document.addEventListener('click', (e) => {
    if (menu && (menu.contains(e.target) || input.contains(e.target))) return;
    close();
  }, true);

  wireOnce(document, 'keydown', (e) => { if (e.key === 'Escape') close(); }, 'city-fallback-esc');
}

/* === Reinit City Typeahead po změně jazyka === */
async function reinitCityTypeahead(newLang) {
  const input = document.querySelector('#filter-city, #events-city-filter');
  if (!input) return;

  document.querySelectorAll('.ajsee-city-fallback').forEach(el => el.remove());

  try {
    setupCityTypeahead(input, {
      locale: newLang,
      t,
      minChars: 2,
      debounceMs: 250,
      countryCodes: ['CZ','SK','PL','HU','DE','AT'],
      onChoose: (it) => {
        const label = it?.city || it?.label || it?.name || '';
        currentFilters.city = canonPreferredCity(label, newLang);
        currentFilters.cityLabel = label;
        currentFilters.nearMeLat = null;
        currentFilters.nearMeLon = null;
        input.value = label;
        renderAndSync({ resetPage: true }).then(() => expandFilters());
      },
      onNearMe: async ({ lat, lon } = {}) => {
        if (typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && (Math.abs(lat) + Math.abs(lon) > 0)) {
          currentFilters.city = '';
          currentFilters.cityLabel = nearMeLabel();
          currentFilters.nearMeLat = +lat;
          currentFilters.nearMeLon = +lon;
          input.value = nearMeLabel();
          input.setAttribute('data-autofromnearme','1');
          await renderAndSync({ resetPage: true });
          expandFilters();
        } else {
          await activateNearMeViaGeo(input);
        }
      }
    });
    input.dataset.hasNativeTypeahead = '1';
  } catch {
    // fallback níže
  }

  setTimeout(() => {
    const hasAnySuggestUI =
      document.querySelector('[role="listbox"][data-city-ta]') ||
      document.querySelector('.tm-city-suggest') ||
      document.querySelector('.ajsee-city-fallback');
    if (!hasAnySuggestUI) {
      initCityTypeaheadFallback(input);
    }
  }, 700);

  bindNativeCityUnhideOnOpen(input);
  installNativeCityAutoHide(input);

  ensureNearMeInlineButton();
}

/* ───────── render events ───────── */
function mapLangToTm (l) { const m = { cs: 'cs-cz', sk: 'sk-sk', pl: 'pl-pl', de: 'de-de', hu: 'hu-hu', en: 'en-gb' }; return m[(l || 'en').slice(0, 2)] || 'en-gb'; }
function safeUrl (raw) { try { const u = new URL(raw, location.href); if (/^https?:/i.test(u.protocol)) return u.toString(); } catch { /* noop */ } return '#'; }
function adjustTicketmasterLanguage (rawUrl, lang = getUILang()) { try { const u = new URL(rawUrl, location.href); const val = mapLangToTm(lang); u.searchParams.set('language', val); if (!u.searchParams.has('locale')) u.searchParams.set('locale', val); return u.toString(); } catch { return rawUrl; } }
function wrapAffiliate (url) { try { const cfg = window.__impact || window.__aff || {}; if (cfg.clickBase) return cfg.clickBase + encodeURIComponent(url); if (cfg.param && cfg.value) { const u = new URL(url); if (!u.searchParams.has(cfg.param)) u.searchParams.set(cfg.param, cfg.value); return u.toString(); } } catch { /* noop */ } return url; }

function makeFetchSig (locale, api, page, perPage) {
  const core = {
    locale,
    page,
    perPage,
    category: api.category || 'all',
    sort: api.sort || 'nearest',
    city: api.city || '',
    dateFrom: api.dateFrom || '',
    dateTo: api.dateTo || '',
    keyword: api.keyword || '',
    countryCode: api.countryCode || 'CZ',
    nearMeLat: api.nearMeLat != null ? +Number(api.nearMeLat).toFixed(5) : null,
    nearMeLon: api.nearMeLon != null ? +Number(api.nearMeLon).toFixed(5) : null,
    radiusKm: api.nearMeRadiusKm != null ? +api.nearMeRadiusKm : null
  };
  return JSON.stringify(core);
}

async function renderEvents (locale = 'cs', filters = currentFilters) {
  const list = document.getElementById('eventsList'); if (!list) return;
  list.setAttribute('aria-live', 'polite');

  setBusy(true);
  try {
    const api = { ...filters, city: filters.city ? canonForInputCity(filters.city) : '' };

    const latOk = typeof api.nearMeLat === 'number' && isFinite(api.nearMeLat);
    const lonOk = typeof api.nearMeLon === 'number' && isFinite(api.nearMeLon);
    const nonZero = (Math.abs(api.nearMeLat || 0) > 0.001) || (Math.abs(api.nearMeLon || 0) > 0.001);
    if (latOk && lonOk && nonZero) {
      const lat = +api.nearMeLat, lon = +api.nearMeLon;
      const radius = clamp(+api.nearMeRadiusKm || 50, 10, 300);
      Object.assign(api, {
        city: '',
        nearMe: 1,
        lat, lon,
        latitude: lat, longitude: lon,
        latlon: `${lat},${lon}`,
        latlong: `${lat},${lon}`,
        geoPoint: `${lat},${lon}`,
        radiusKm: radius,
        radius: radius,
        unit: 'km'
      });
    } else {
      delete api.nearMeLat; delete api.nearMeLon;
    }

    const sig = makeFetchSig(locale, api, pagination.page, pagination.perPage);
    if (sig === _lastFetchSig) return;
    _lastFetchSig = sig;

    const events = await getAllEvents({ locale, filters: api }) || [];

    if (!window.translations) window.translations = await loadTranslations(locale);

    let out = [...events];
    if (filters.category && filters.category !== 'all') out = out.filter(e => e.category === filters.category);

    if (filters.sort === 'nearest') out.sort((a, b) => new Date(a.datetime || a.date) - new Date(b.datetime || b.date));
    else out.sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));

    updateResultsCount(out.length);

    const isHp = isHome();
    let toRender = out;

    if (isHp) {
      if (out.length > 6) toRender = out.slice(0, 6);
    } else {
      const end = pagination.page * pagination.perPage;
      toRender = out.slice(0, end);
    }

    list.innerHTML = toRender.map(ev => {
      const titleRaw = (typeof ev.title === 'string' ? ev.title : (ev.title?.[locale] || ev.title?.en || ev.title?.cs || Object.values(ev.title || {})[0])) || 'Untitled';
      const title = esc(titleRaw);
      const dateVal = ev.datetime || ev.date;
      const date = dateVal ? esc(new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })) : '';
      const img = ev.image || '/images/fallbacks/concert0.jpg';
      const detailHref = safeUrl(wrapAffiliate(adjustTicketmasterLanguage(ev.url || '', locale)));
      const ticketsHref = safeUrl(wrapAffiliate(adjustTicketmasterLanguage(ev.tickets || ev.url || '', locale)));
      const detailLabel = esc(t('event-details', 'Details'));
      const ticketLabel = esc(t('event-tickets', 'Tickets'));
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

    announce(`${t('events-found', 'Nalezeno') || 'Nalezeno'} ${out.length}`);
  } catch (e) {
    const list = document.getElementById('eventsList');
    if (list) list.innerHTML = `<p>${esc(t('events-load-error', 'Unable to load events. Try again later.'))}</p>`;
  } finally {
    setBusy(false);
  }
}

/* render & sync (s reentrancy lockem) */
async function renderAndSync ({ resetPage = true } = {}) {
  if (_renderInflight) { _renderQueued = true; return; }
  _renderInflight = true;

  try {
    if (resetPage) pagination.page = 1;
    normalizeDates();
    syncURLFromFilters();

    if (SKIP_CORE_EVENTS) {
      G.bus('ajsee:filters')({ filters: { ...currentFilters }, lang: currentLang });
      updateToggleBadge();
      expandFilters();
      return;
    }

    await renderEvents(currentLang, currentFilters);
    updateToggleBadge();
    expandFilters();

    // ✅ FIX: nescrolluj na prvním renderu (to byl ten “samovolný scroll”)
    // Scroll jen po tom, co uživatel reálně interagoval s filtry.
    if (!isHome()) {
      const shouldScroll = _hasDoneFirstRender && _userInteractedWithFilters;
      if (shouldScroll) {
        const list = qs('#eventsList');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  } finally {
    _renderInflight = false;
    _hasDoneFirstRender = true;

    if (_renderQueued) {
      _renderQueued = false;
      void renderAndSync({ resetPage: false });
    }
  }
}

function initEventsScrollGuard () {
  // jen na events page (ne homepage)
  const path = (location.pathname || '').toLowerCase();
  const isEvents = path.endsWith('/events.html') || path.endsWith('events.html');
  if (!isEvents) return;

  // zabrání "obnově scrollu" prohlížečem (někdy umí taky cuknout)
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch { /* noop */ }

  const form =
    qs('#events-filters-form') ||
    qs('form.filter-dock') ||
    qs('.events-filters');

  if (!form) return;

  const mark = () => { _userInteractedWithFilters = true; };

  // stačí pár událostí, tohle pokryje real usage
  wireOnce(form, 'input',  mark, 'usr-int-input');
  wireOnce(form, 'change', mark, 'usr-int-change');
  wireOnce(form, 'click',  mark, 'usr-int-click');
  wireOnce(form, 'submit', mark, 'usr-int-submit');
  wireOnce(form, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') mark();
  }, 'usr-int-keydown');
}

/* ───────── Language change helper (single source of truth) ───────── */
function changeLangTo (lang) {
  const l = String(lang || '').toLowerCase();
  if (!l || l === currentLang) return;

  currentLang = l;
  setLangCookie(currentLang);
  document.documentElement.lang = currentLang;

  const u = new URL(location.href);
  u.searchParams.set('lang', currentLang);
  history.replaceState(null, '', u.toString());

  window.dispatchEvent(new CustomEvent('AJSEE:langChanged', { detail: { lang: currentLang } }));
}

/* ───────── Desktop dropdown fallback (robust, not clipped by overflow) ───────── */
function initLangDropdownFallback () {
  injectOnce('ajsee-lang-dropdown-fallback-css', String.raw`
    .ajsee-lang-menu{
      position:fixed;
      z-index:var(--ajsee-popover-z, 10020);
      background:#fff;
      border-radius:12px;
      border:1px solid #d9e1ef;
      box-shadow:0 14px 40px rgba(9,30,66,.2);
      padding:6px;
      min-width:200px;
      max-width:min(320px, calc(100vw - 16px));
    }
    .ajsee-lang-menu .lang-btn{
      display:flex !important;
      width:100%;
      align-items:center;
      gap:10px;
      border:0;
      background:none;
      padding:10px 12px;
      border-radius:10px;
      cursor:pointer;
      font:inherit;
    }
    .ajsee-lang-menu .lang-btn:hover{ background:#F0F6FF; }
    .ajsee-lang-menu .lang-btn.is-active{ background:#F0F6FF; }
    .ajsee-lang-menu img{ width:22px; height:16px; display:block; }
  `);

  const roots = qsa('[data-lang-dropdown], .language-switcher, .lang-switcher, .lang-dropdown')
    .filter(r => r && (r.closest('header') || r.hasAttribute('data-lang-dropdown')));

  if (!roots.length) return;

  const state = G.state._langDD || (G.state._langDD = { open: false, root: null, menu: null });

  const close = () => {
    if (!state.open) return;
    state.open = false;
    try { state.menu?.remove?.(); } catch { /* noop */ }
    state.menu = null;
    if (state.root) {
      state.root.classList.remove('is-open');
      const active = state.root.querySelector('.lang-btn.is-active');
      if (active) active.setAttribute('aria-expanded', 'false');
    }
    state.root = null;
  };

  const syncActive = (root) => {
    const btns = qsa('.lang-btn', root);
    btns.forEach(b => {
      const l = (b.getAttribute('data-lang') || b.getAttribute('data-locale') || '').toLowerCase();
      const isA = !!l && l === currentLang;
      b.classList.toggle('is-active', isA);
      if (isA) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  };

  const positionMenu = (menu, anchorRect) => {
    if (!menu || !anchorRect) return;
    const SAFE = 8;
    const vpW = window.innerWidth || 1024;
    const vpH = window.innerHeight || 768;

    // ensure measurable
    menu.style.left = '0px';
    menu.style.top = '0px';

    const r = menu.getBoundingClientRect();
    const w = r.width || 240;
    const h = r.height || 200;

    // align right edge with anchor right (typicky vpravo v headeru)
    let left = anchorRect.right - w;
    let top = anchorRect.bottom;

    left = Math.max(SAFE, Math.min(left, vpW - SAFE - w));

    if (top + h > vpH - SAFE) {
      const above = anchorRect.top - h;
      if (above >= SAFE) top = above;
      else top = Math.max(SAFE, vpH - SAFE - h);
    }

    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
  };

  const openForRoot = (root) => {
    if (!root) return;

    close();
    syncPopoverZIndex();
    syncActive(root);

    const btnActive = root.querySelector('.lang-btn.is-active') || root.querySelector('.lang-btn');
    const anchorRect = btnActive?.getBoundingClientRect?.();
    if (!anchorRect) return;

    const menu = document.createElement('div');
    menu.className = 'ajsee-lang-menu';
    menu.setAttribute('role', 'menu');

    const btns = qsa('.lang-btn', root).filter(Boolean);
    btns.forEach(src => {
      const clone = src.cloneNode(true);
      clone.removeAttribute('id');
      clone.setAttribute('type', 'button');
      const l = (clone.getAttribute('data-lang') || clone.getAttribute('data-locale') || '').toLowerCase();
      clone.classList.toggle('is-active', l === currentLang);

      clone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!l) return;
        close();
        if (l !== currentLang) changeLangTo(l);
      });

      menu.appendChild(clone);
    });

    document.body.appendChild(menu);
    positionMenu(menu, anchorRect);

    state.open = true;
    state.root = root;
    state.menu = menu;

    root.classList.add('is-open');
    if (btnActive) btnActive.setAttribute('aria-expanded', 'true');

    // keep in viewport / close when out of view
    const schedule = () => {
      if (!state.open || !state.menu || !state.root) return;
      const act = state.root.querySelector('.lang-btn.is-active') || state.root.querySelector('.lang-btn');
      const r = act?.getBoundingClientRect?.();
      if (!r) { close(); return; }
      // pokud header/anchor zmizí (scroll), zavřít jako u popoverů
      if (!isElementInViewportBelowHeader(act, 2)) { close(); return; }
      positionMenu(state.menu, r);
    };

    getScrollParents(root).forEach(sp => {
      wireOnce(sp, 'scroll', schedule, 'langdd-scroll', { passive: true });
    });
    wireOnce(window, 'resize', schedule, 'langdd-resize', { passive: true });

    // outside click / escape
    wireOnce(document, 'click', (e) => {
      if (!state.open) return;
      if (state.menu && state.menu.contains(e.target)) return;
      if (state.root && state.root.contains(e.target)) return;
      close();
    }, 'langdd-outside', true);

    wireOnce(document, 'keydown', (e) => {
      if (e.key === 'Escape') close();
    }, 'langdd-esc');
  };

  roots.forEach(root => {
    if (!root) return;
    if (root.dataset.ajLangDropdownWired === '1') return;
    const btns = qsa('.lang-btn', root);
    if (btns.length < 2) return;

    root.dataset.ajLangDropdownWired = '1';
    syncActive(root);

    // klik na aktivní jazyk = otevřít menu (přesně ten bug, co jste měli)
    wireOnce(root, 'click', (e) => {
      const btn = e.target.closest('.lang-btn');
      if (!btn || !root.contains(btn)) return;

      const l = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
      if (!l) return;

      e.preventDefault();
      e.stopPropagation();

      if (l === currentLang) {
        // toggle open/close
        if (state.open && state.root === root) close();
        else openForRoot(root);
      } else {
        // pokud někdo klikne na jiný jazyk v inline markup (když není skrytý),
        // přepni a zavři případné menu
        close();
        changeLangTo(l);
      }
    }, `langdd-click-${Math.random().toString(16).slice(2)}`);

    // po změně jazyka přeznačit active
    wireOnce(window, 'AJSEE:langChanged', () => syncActive(root), 'langdd-sync');
  });
}

/* ✅ Safe init: use external module if present, then always ensure fallback works */
function safeInitLangDropdown () {
  // 1) zkus externí util (pokud existuje a funguje)
  try {
    if (typeof initLangDropdown === 'function') initLangDropdown();
  } catch { /* noop */ }

  // 2) fallback (řeší přesně bug “klik na aktivní nic nedělá” + řeší clipping)
  initLangDropdownFallback();
}

/* ───────── Lang dropdown compat (HTML uses <details>, CSS expects aria-expanded) ───────── */
function patchLangDropdownStyles () {
  injectOnce('ajsee-lang-dropdown-compat-css', String.raw`
    /* hide native marker */
    details.lang-dropdown > summary::-webkit-details-marker{ display:none; }
    details.lang-dropdown > summary{ list-style:none; }

    /* IMPORTANT: open <details> must show menu (SCSS uses .lang-trigger[aria-expanded], but HTML uses <details>) */
    details.lang-dropdown[open] > .lang-menu{ display:flex !important; }

    /* mobile: some builds hide .lang-dropdown under 950px (kills mobile dropdown too) */
    @media (max-width: 950px){
      .main-nav .language-switcher.mobile-switcher details.lang-dropdown{ display:block !important; }
    }
  `);
}

function syncLangDropdownUI (lang) {
  const target = (lang || getUILang() || 'cs').toLowerCase().slice(0, 2);

  qsa('details.lang-dropdown').forEach(dd => {
    const summary = dd.querySelector('summary');
    if (!summary) return;

    const currentFlag =
      summary.querySelector('.lang-current-flag') ||
      summary.querySelector('img.flag') ||
      null;

    const currentLabel =
      summary.querySelector('.lang-current-label') ||
      summary.querySelector('.lang-current') ||
      null;

    const buttons = qsa('.lang-btn', dd);
    buttons.forEach(btn => {
      const l = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
      const selected = (l === target);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');

      if (selected) {
        const img = btn.querySelector('img');
        if (img && currentFlag) {
          currentFlag.src = img.getAttribute('src') || img.src;
          currentFlag.alt = img.getAttribute('alt') || img.alt || '';
        }
        const txt = (btn.textContent || '').trim();
        if (currentLabel && txt) currentLabel.textContent = txt;
      }
    });
  });
}

function initLangDropdownCompat () {
  patchLangDropdownStyles();

  const dropdowns = qsa('details.lang-dropdown');
  if (!dropdowns.length) return;

  dropdowns.forEach((dd, idx) => {
    const summary = dd.querySelector('summary');
    const menu = dd.querySelector('.lang-menu');
    if (!summary || !menu) return;

    // normalize classes to match SCSS (.lang-trigger + .lang-option)
    summary.classList.add('lang-trigger');

    const caret = summary.querySelector('.lang-caret');
    if (caret) caret.classList.add('chevron');

    const flag = summary.querySelector('.lang-current-flag');
    if (flag) flag.classList.add('flag');

    const label = summary.querySelector('.lang-current-label');
    if (label) label.classList.add('lang-current');

    qsa('.lang-btn', menu).forEach(btn => btn.classList.add('lang-option'));

    const syncOpen = () => {
      summary.setAttribute('aria-expanded', dd.open ? 'true' : 'false');
      if (dd.open) menu.removeAttribute('hidden');
      else menu.setAttribute('hidden', '');
    };

    syncOpen();
    wireOnce(dd, 'toggle', syncOpen, `lang-dd-toggle-${idx}`);

    // close on option click (language change itself is handled by initLanguageSwitchers())
    qsa('.lang-btn', menu).forEach(btn => {
      wireOnce(btn, 'click', () => {
        dd.open = false;
        syncOpen();
      }, `lang-dd-close-${idx}`);
    });

    // close on outside click
    wireOnce(document, 'click', (e) => {
      if (!dd.open) return;
      if (dd.contains(e.target)) return;
      dd.open = false;
      syncOpen();
    }, `lang-dd-doc-${idx}`, { capture: true });

    // close on ESC
    wireOnce(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!dd.open) return;
      dd.open = false;
      syncOpen();
      try { summary.blur(); } catch { /* noop */ }
    }, `lang-dd-esc-${idx}`);
  });

  // initial UI sync
  syncLangDropdownUI(currentLang || getUILang());

  // keep UI in sync after lang changes
  wireOnce(window, 'AJSEE:langChanged', (e) => {
    const l = (e?.detail?.lang || getUILang());
    syncLangDropdownUI(l);
  }, 'lang-dd-sync');
}

/* ───────── Homepage CTA helpers (waitlist + demo badge) ───────── */
function updateHomeCtasWithLang () {
  const SUPPORTED = ['cs','en','de','sk','pl','hu'];
  const lang = (currentLang || getUILang() || 'cs').toLowerCase();

  const wl = document.getElementById('hpWaitlist');
  const wlCta = document.getElementById('hpWaitlistCta');
  const wlClose = document.getElementById('hpWaitlistClose');

  if (wlCta) {
    try {
      const u = new URL(wlCta.getAttribute('href') || wlCta.href || '/coming-soon', location.origin);
      if (SUPPORTED.includes(lang)) u.searchParams.set('lang', lang);
      wlCta.href = u.toString();
    } catch { /* noop */ }

    wireOnce(wlCta, 'click', () => {
      if (window.gtag) window.gtag('event', 'click_waitlist', { source: 'home_banner', lang });
    }, 'wl-gtag');
  }

  if (wlClose && wl) {
    wireOnce(wlClose, 'click', () => { try { wl.remove(); } catch { /* noop */ } }, 'wl-close');
  }

  const demoCta = document.getElementById('demoBadgeCta');
  if (demoCta) {
    try {
      const u = new URL(demoCta.getAttribute('href') || demoCta.href || '/coming-soon', location.origin);
      u.searchParams.set('lang', lang);
      demoCta.href = u.toString();
    } catch { /* noop */ }

    wireOnce(demoCta, 'click', () => {
      if (window.gtag) window.gtag('event', 'click_demo_badge', { source: 'home_demo_pill', lang });
    }, 'demo-gtag');
  }
}

/* ───────── Jazykové přepínače (mobil / dropdown options) ───────── */
function initLanguageSwitchers () {
  qsa('.lang-btn').forEach(btn => {
    const lang = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
    if (!lang) return;

    // pokud by někde byla .lang-btn uvnitř summary/triggeru, neshazuj nativní toggle
    const inDetailsSummary = !!(btn.closest('details.lang-dropdown') && btn.closest('summary'));
    const isTriggerLike = btn.classList.contains('lang-trigger') || !!btn.closest('.lang-trigger') || btn.hasAttribute('aria-expanded');
    if (inDetailsSummary || isTriggerLike) return;

    wireOnce(btn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // zavřít všechny otevřené dropdowny (<details> desktop i mobile)
      qsa('details.lang-dropdown[open]').forEach(d => {
        try { d.open = false; } catch { /* noop */ }
      });

      // i když už je vybraný jazyk, chceme zavření + sync UI (flag/label)
      if (lang === currentLang) {
        syncLangDropdownUI(currentLang);
        return;
      }

      // sync UI hned (flag + label)
      syncLangDropdownUI(lang);

      // central change (spustí AJSEE:langChanged)
      changeLangTo(lang);
    }, `lang-${lang}`);
  });
}

/* ───────── DOM Ready ───────── */
document.addEventListener('DOMContentLoaded', async () => {
  ensureRuntimeStyles();
  updateHeaderOffset();
  syncPopoverZIndex();

  wireOnce(window, 'resize', debounce(() => {
    updateHeaderOffset();
    syncPopoverZIndex();
  }, 150), 'hdr-offset-z', { passive: true });

  forceInlineFilters();
  initEventsScrollGuard();

  fixHomeBlog();

  currentLang = getUILang();
  setLangCookie(currentLang);
  document.documentElement.lang = currentLang;

  const langToCountry = { cs: 'CZ', sk: 'SK', de: 'DE', pl: 'PL', hu: 'HU', en: 'CZ' };
  const ccCookie = getCookie('aj_country');
  currentFilters.countryCode = (ccCookie || langToCountry[currentLang] || 'CZ').toUpperCase();

  await ensureTranslations(currentLang);

  // ✅ homepage blog render po startu (aby to sedělo i ve Vite)
  renderHomeBlog();

  // ✅ CTA (waitlist + demo badge) včetně lang param
  updateHomeCtasWithLang();

  initNav({ lang: currentLang });
  initContactFormValidation({ lang: currentLang, t });
  initEventModal();

  // ✅ <details> lang dropdown compat (CSS patch + classy + open/close)
  initLangDropdownCompat();

  // ✅ klik na .lang-btn přepíná jazyk všude (a zavře <details>)
  initLanguageSwitchers();

  // ✅ NEW: desktop dropdown jazyků (mamma-mia style) + fallback jistota
  safeInitLangDropdown();

  const formEl = qs('#events-filters-form');

  const topToolbar = document.querySelector('.filters-toolbar');
  if (topToolbar) topToolbar.remove();

  const legacyNearBtn = document.getElementById('filter-nearme');
  if (legacyNearBtn) legacyNearBtn.remove();

  window.addEventListener('AJSEE:langChanged', async (e) => {
    currentLang = (e?.detail?.lang || getUILang());
    setLangCookie(currentLang);
    document.documentElement.lang = currentLang;

    await ensureTranslations(currentLang);
    setFilterInputsFromState();

    await reinitCityTypeahead(currentLang);

    installPopoverScrollBridges();
    bindDatePopoverGlue();
    bindDatePopoverUnhideOnOpen();
    installDatePopoverAutoHide();

    syncPopoverZIndex();

    // ✅ i blog (kvůli CTA/lang paramům)
    fixHomeBlog();
    renderHomeBlog();

    // ✅ CTA update na nový jazyk
    updateHomeCtasWithLang();

    // ✅ language dropdown compat + fallback re-sync
    initLangDropdownCompat();
    safeInitLangDropdown();

    await renderAndSync({ resetPage: true });
  });

  upgradeSortToSegmented();
  normalizeFilterFormUI();

  installPopoverScrollBridges();
  bindDatePopoverGlue();
  bindDatePopoverUnhideOnOpen();
  installDatePopoverAutoHide();

  const eventsList = qs('#eventsList');
  if (eventsList && !SKIP_CORE_EVENTS) {
    const sp = new URLSearchParams(location.search);
    if (sp.get('city')) {
      const raw = sp.get('city') || '';
      const slug = findSlugByAnyLabel(raw);
      currentFilters.cityLabel = slug ? localizedCityLabel(slug, currentLang) : raw;
      currentFilters.city = canonPreferredCity(raw, currentLang);
    }
    if (sp.get('from')) currentFilters.dateFrom = sp.get('from') || '';
    if (sp.get('to')) currentFilters.dateTo = sp.get('to') || '';
    if (sp.get('segment')) currentFilters.category = sp.get('segment') || 'all';
    if (sp.get('q')) currentFilters.keyword = sp.get('q') || '';
    if (sp.get('sort')) currentFilters.sort = sp.get('sort') || 'nearest';
    if (sp.get('lat') && sp.get('lon')) {
      currentFilters.nearMeLat = +sp.get('lat');
      currentFilters.nearMeLon = +sp.get('lon');
      currentFilters.nearMeRadiusKm = clamp(+(sp.get('radius') || 50), 10, 300);
      const $c = qs('#filter-city') || qs('#events-city-filter');
      if ($c) { $c.value = nearMeLabel(); currentFilters.cityLabel = nearMeLabel(); $c.setAttribute('data-autofromnearme', '1'); }
    }
    setFilterInputsFromState();
    updateToggleBadge();

    const $city = qs('#filter-city') || qs('#events-city-filter');
    if ($city) {
      let nativeTA = false;
      try {
        setupCityTypeahead($city, {
          locale: currentLang,
          t,
          minChars: 2,
          debounceMs: 250,
          countryCodes: ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'],

          onChoose: (it) => {
            const label = it && it.city ? it.city : (it?.label || it?.name || '');
            currentFilters.city = canonPreferredCity(label, currentLang);
            currentFilters.cityLabel = label;
            $city.value = label;
            currentFilters.nearMeLat = null;
            currentFilters.nearMeLon = null;
            renderAndSync({ resetPage: true }).then(() => expandFilters());
          },

          onNearMe: async ({ lat, lon } = {}) => {
            if (typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && (Math.abs(lat) + Math.abs(lon) > 0)) {
              currentFilters.city = '';
              currentFilters.cityLabel = nearMeLabel();
              currentFilters.nearMeLat = +lat;
              currentFilters.nearMeLon = +lon;
              $city.value = nearMeLabel();
              $city.setAttribute('data-autofromnearme', '1');
              await renderAndSync({ resetPage: true });
              expandFilters();
            } else {
              await activateNearMeViaGeo($city);
            }
          }
        });
        nativeTA = true;
        $city.dataset.hasNativeTypeahead = '1';
      } catch {
        // fallback níže
      }

      if (!nativeTA) initCityTypeaheadFallback($city);

      setTimeout(() => {
        const hasAnySuggestUI =
          document.querySelector('.ajsee-city-fallback') ||
          document.querySelector('[role="listbox"][data-city-ta]') ||
          document.querySelector('.tm-city-suggest') ||
          false;
        if (!hasAnySuggestUI) {
          // ✅ bez varování do konzole, fallback tiše
          initCityTypeaheadFallback($city);
        }
      }, 700);

      bindNativeCityUnhideOnOpen($city);
      installNativeCityAutoHide($city);

      ensureNearMeInlineButton();

      const tryNearMeFromInput = async () => {
        if (!$city) return;
        if (isNearMeTyped($city) && !(currentFilters.nearMeLat && currentFilters.nearMeLon)) {
          await activateNearMeViaGeo($city);
        }
      };
      wireOnce($city, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void tryNearMeFromInput(); } }, 'city-enter-nearme');
      wireOnce($city, 'blur', () => { void tryNearMeFromInput(); }, 'city-blur-nearme');

      if (formEl) {
        wireOnce(formEl, 'submit', async (e) => {
          e.preventDefault();
          await tryNearMeFromInput();
          await renderAndSync({ resetPage: true });
        }, 'submit');
      }
    }
  }

  await renderAndSync({ resetPage: true });
});
