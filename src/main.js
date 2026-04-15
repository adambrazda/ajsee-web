// /src/main.js
// ---------------------------------------------------------
// AJSEE – Events UI, i18n & filters (sjednocení s homepage)
// ---------------------------------------------------------

import './identity-init.js';
import './utils/ajsee-date-popover.js';

import { initLangDropdown } from './utils/lang-dropdown.js';
import { initCookieBanner, syncCookieBannerLanguage } from './utils/cookie-banner.js';

import { getAllEvents } from './api/eventsApi.js';
import { setupCityTypeahead } from './city/typeahead.js';
import { canonForInputCity } from './city/canonical.js';

import { getSortedBlogArticles } from './blogArticles.js';
import { initNav } from './nav-core.js';
import { initContactFormValidation } from './contact-validate.js';
import { initEventModal } from './event-modal.js';

import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';

/* ───────── global guard ───────── */
(function ensureGlobals() {
  window.__ajsee = window.__ajsee || {};
  const g = window.__ajsee;
  g.flags = g.flags || {};
  g.once = g.once || new Set();
  g.locks = g.locks || {};
  g.state = g.state || {};
  g.bus = g.bus || (type => detail => {
    try {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
      /* noop */
    }
  });
})();

const G = window.__ajsee;
const SKIP_CORE_EVENTS = !!window.__AJSEE_SKIP_CORE_EVENTS;

G.state._wiredMap = G.state._wiredMap || new WeakMap();
const _wiredMap = G.state._wiredMap;

function wireOnce(el, evt, handler, key = '', opts) {
  if (!el) return;
  const id = `${evt}:${key || ''}`;
  let set = _wiredMap.get(el);
  if (!set) {
    set = new Set();
    _wiredMap.set(el, set);
  }
  if (set.has(id)) return;
  set.add(id);
  el.addEventListener(evt, handler, opts);
}

if (!G.flags.mainInitialized) {
  G.flags.mainInitialized = true;
}

/* ───────── state ───────── */
let currentFilters = {
  category: 'all',
  sort: 'nearest',
  city: '',
  cityLabel: '',
  dateFrom: '',
  dateTo: '',
  keyword: '',
  countryCode: 'CZ',
  nearMeLat: null,
  nearMeLon: null,
  nearMeRadiusKm: 50
};

const pagination = { page: 1, perPage: 12 };
let _renderInflight = false;
let _renderQueued = false;
let _lastFetchSig = '';
let _hasDoneFirstRender = false;
let _userInteractedWithFilters = false;
let currentLang = getUILang();

/* ───────── utils ───────── */
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const debounce = (fn, ms = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

function getUILang() {
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

function setLangCookie(lang) {
  try {
    document.cookie = `aj_lang=${lang};path=/;max-age=${60 * 60 * 24 * 365}`;
  } catch {
    /* noop */
  }
}

function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1];
}

function isHome() {
  if (document.body?.dataset?.page === 'home') return true;
  const p = (location.pathname || '/').replace(/\/+$/, '/');
  if (p === '/' || p.endsWith('/index.html')) return true;
  return /^\/(cs|en|de|sk|pl|hu)\/?$/.test((location.pathname || '').replace(/\/+$/, ''));
}

function isEventsPage() {
  if (document.body?.dataset?.page === 'events') return true;
  const p = (location.pathname || '').toLowerCase().replace(/\/+$/, '');
  return p.endsWith('/events') || p.endsWith('/events.html');
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const store = {
  get(k, d = null) {
    try {
      return JSON.parse(sessionStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* noop */
    }
  }
};

/* ───────── header metrics + popover z-index ───────── */
function parseZ(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function getHeaderEl() {
  return document.querySelector('header.site-header') ||
    document.querySelector('.site-header') ||
    document.querySelector('header');
}

function getHeaderMetrics() {
  const el = getHeaderEl();
  if (!el) return { el: null, bottom: 0, z: null, rect: null };
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  const z = parseZ(cs.zIndex);
  const bottom = Math.max(0, rect.bottom || 0);
  return { el, rect, bottom, z };
}

function syncPopoverZIndex() {
  const { z } = getHeaderMetrics();
  const desired = (typeof z === 'number' && Number.isFinite(z)) ? Math.max(10, z - 1) : 10020;
  document.documentElement.style.setProperty('--ajsee-popover-z', String(desired));
  return desired;
}

function isElementInViewportBelowHeader(el, pad = 4) {
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
  const { bottom: hdrBottom } = getHeaderMetrics();
  const sizeOk = r.width > 0 && r.height > 0;
  return sizeOk && (r.bottom > hdrBottom + pad) && (r.top < vpH - pad);
}

/* ───────── scroll parents ───────── */
function getScrollParents(el) {
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
    } catch {
      /* noop */
    }
  }

  const se = document.scrollingElement || document.documentElement;
  if (se && !seen.has(se)) out.push(se);
  out.push(window);
  return out;
}

function installDatePopoverScrollBridges() {
  const dateBtn = qs('#date-combo-button');
  if (!dateBtn) return;
  const anchor = dateBtn.closest('.filter-group') || dateBtn;
  getScrollParents(anchor).forEach(p => {
    if (p === window) return;
    wireOnce(p, 'scroll', () => {
      try {
        window.dispatchEvent(new Event('scroll'));
      } catch {
        /* noop */
      }
    }, 'bridge-date-scroll', { passive: true });
  });
}

/* ───────── date popover positioning hook ───────── */
window.ajseePositionDatePopover = function ajseePositionDatePopover(ctx = {}) {
  try {
    const anchorEl = ctx.anchor || document.getElementById('date-combo-button') || null;
    const anchorRect = ctx.anchorRect || (anchorEl && anchorEl.getBoundingClientRect && anchorEl.getBoundingClientRect());
    if (!anchorRect) return null;

    let baseRect = anchorRect;
    if (anchorEl && anchorEl.closest) {
      const group = anchorEl.closest('.filter-group');
      if (group) baseRect = group.getBoundingClientRect();
    }

    const panelRect = ctx.panelRect ||
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
      if (above >= SAFE) top = above;
      else top = Math.max(SAFE, vpH - panelRect.height - SAFE);
    }

    const maxHeight = Math.max(200, vpH - SAFE * 2);
    return { top, left, maxHeight };
  } catch {
    return null;
  }
};

/* ───────── cities / localization ───────── */
const CITY_SYNONYMS = {
  prague:      { cs: 'Praha', en: 'Prague', de: 'Prag', sk: 'Praha', pl: 'Praga', hu: 'Prága' },
  brno:        { cs: 'Brno', en: 'Brno', de: 'Brünn', sk: 'Brno', pl: 'Brno', hu: 'Brünn' },
  ostrava:     { cs: 'Ostrava', en: 'Ostrava', de: 'Ostrau', sk: 'Ostrava', pl: 'Ostrawa', hu: 'Ostrava' },
  plzen:       { cs: 'Plzeň', en: 'Pilsen', de: 'Pilsen', sk: 'Plzeň', pl: 'Pilzno', hu: 'Plzeň' },
  liberec:     { cs: 'Liberec', en: 'Liberec', de: 'Reichenberg', sk: 'Liberec', pl: 'Liberec', hu: 'Liberec' },
  olomouc:     { cs: 'Olomouc', en: 'Olomouc', de: 'Olmütz', sk: 'Olomouc', pl: 'Ołomuniec', hu: 'Olmütz' },
  cbudejovice: { cs: 'České Budějovice', en: 'České Budějovice', de: 'Budweis', sk: 'České Budějovice', pl: 'Czeskie Budziejowice', hu: 'Budweis' },
  hkralove:    { cs: 'Hradec Králové', en: 'Hradec Králové', de: 'Königgrätz', sk: 'Hradec Králové', pl: 'Hradec Králové', hu: 'Königgrätz' },
  pardubice:   { cs: 'Pardubice', en: 'Pardubice', de: 'Pardubitz', sk: 'Pardubice', pl: 'Pardubice', hu: 'Pardubice' },

  bratislava:  { cs: 'Bratislava', en: 'Bratislava', de: 'Pressburg', sk: 'Bratislava', pl: 'Bratysława', hu: 'Pozsony' },
  kosice:      { cs: 'Košice', en: 'Kosice', de: 'Kaschau', sk: 'Košice', pl: 'Koszyce', hu: 'Kassa' },

  wien:        { cs: 'Vídeň', en: 'Vienna', de: 'Wien', sk: 'Viedeň', pl: 'Wiedeń', hu: 'Bécs' },
  graz:        { cs: 'Štýrský Hradec', en: 'Graz', de: 'Graz', sk: 'Štajerský Hradec', pl: 'Graz', hu: 'Graz' },
  linz:        { cs: 'Linec', en: 'Linz', de: 'Linz', sk: 'Linz', pl: 'Linz', hu: 'Linz' },
  salzburg:    { cs: 'Salcburk', en: 'Salzburg', de: 'Salzburg', sk: 'Salzburg', pl: 'Salzburg', hu: 'Salzburg' },
  innsbruck:   { cs: 'Innsbruck', en: 'Innsbruck', de: 'Innsbruck', sk: 'Innsbruck', pl: 'Innsbruck', hu: 'Innsbruck' },
  klagenfurt:  { cs: 'Klagenfurt', en: 'Klagenfurt', de: 'Klagenfurt', sk: 'Klagenfurt', pl: 'Klagenfurt', hu: 'Klagenfurt' },

  berlin:      { cs: 'Berlín', en: 'Berlin', de: 'Berlin', sk: 'Berlín', pl: 'Berlin', hu: 'Berlin' },
  hamburg:     { cs: 'Hamburk', en: 'Hamburg', de: 'Hamburg', sk: 'Hamburg', pl: 'Hamburg', hu: 'Hamburg' },
  munchen:     { cs: 'Mnichov', en: 'Munich', de: 'München', sk: 'Mníchov', pl: 'Monachium', hu: 'München' },
  koln:        { cs: 'Kolín nad Rýnem', en: 'Cologne', de: 'Köln', sk: 'Kolín nad Rýnom', pl: 'Kolonia', hu: 'Köln' },
  frankfurt:   { cs: 'Frankfurt', en: 'Frankfurt', de: 'Frankfurt', sk: 'Frankfurt', pl: 'Frankfurt', hu: 'Frankfurt' },
  stuttgart:   { cs: 'Stuttgart', en: 'Stuttgart', de: 'Stuttgart', sk: 'Stuttgart', pl: 'Stuttgart', hu: 'Stuttgart' },
  dusseldorf:  { cs: 'Düsseldorf', en: 'Düsseldorf', de: 'Düsseldorf', sk: 'Düsseldorf', pl: 'Düsseldorf', hu: 'Düsseldorf' },
  dresden:     { cs: 'Drážďany', en: 'Dresden', de: 'Dresden', sk: 'Drážďany', pl: 'Drezno', hu: 'Drezda' },
  leipzig:     { cs: 'Lipsko', en: 'Leipzig', de: 'Leipzig', sk: 'Lipsko', pl: 'Lipsk', hu: 'Lipcse' },

  warszawa:    { cs: 'Varšava', en: 'Warsaw', de: 'Warschau', sk: 'Varšava', pl: 'Warszawa', hu: 'Varsó' },
  krakow:      { cs: 'Krakov', en: 'Krakow', de: 'Krakau', sk: 'Krakov', pl: 'Kraków', hu: 'Krakkó' },
  lodz:        { cs: 'Lodž', en: 'Łódź', de: 'Łódź', sk: 'Lodž', pl: 'Łódź', hu: 'Łódź' },
  wroclaw:     { cs: 'Vratislav', en: 'Wroclaw', de: 'Breslau', sk: 'Vroclav', pl: 'Wrocław', hu: 'Wroclaw' },
  poznan:      { cs: 'Poznaň', en: 'Poznan', de: 'Posen', sk: 'Poznaň', pl: 'Poznań', hu: 'Poznań' },
  gdansk:      { cs: 'Gdaňsk', en: 'Gdansk', de: 'Danzig', sk: 'Gdansk', pl: 'Gdańsk', hu: 'Gdansk' },
  szczecin:    { cs: 'Štětín', en: 'Szczecin', de: 'Stettin', sk: 'Štetín', pl: 'Szczecin', hu: 'Szczecin' },
  bydgoszcz:   { cs: 'Bydhošť', en: 'Bydgoszcz', de: 'Bromberg', sk: 'Bydgoszcz', pl: 'Bydgoszcz', hu: 'Bydgoszcz' },

  budapest:    { cs: 'Budapešť', en: 'Budapest', de: 'Budapest', sk: 'Budapešť', pl: 'Budapeszt', hu: 'Budapest' },
  debrecen:    { cs: 'Debrecín', en: 'Debrecen', de: 'Debrecen', sk: 'Debrecín', pl: 'Debreczyn', hu: 'Debrecen' },
  szeged:      { cs: 'Szeged', en: 'Szeged', de: 'Szeged', sk: 'Szeged', pl: 'Szeged', hu: 'Szeged' },
  miskolc:     { cs: 'Miškovec', en: 'Miskolc', de: 'Miskolc', sk: 'Miškovec', pl: 'Miszkolc', hu: 'Miskolc' },
  pecs:        { cs: 'Péč', en: 'Pécs', de: 'Pécs', sk: 'Pécs', pl: 'Pecz', hu: 'Pécs' },
  gyor:        { cs: 'Ráb', en: 'Győr', de: 'Raab', sk: 'Győr', pl: 'Győr', hu: 'Győr' },

  london:      { cs: 'Londýn', en: 'London', de: 'London', sk: 'Londýn', pl: 'Londyn', hu: 'London' },
  paris:       { cs: 'Paříž', en: 'Paris', de: 'Paris', sk: 'Paríž', pl: 'Paryż', hu: 'Párizs' }
};

const LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const slugList = Object.keys(CITY_SYNONYMS);

const normKey = s => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '')
  .toLowerCase();

function localizedCityLabel(slug, lang) {
  const map = CITY_SYNONYMS[slug];
  return (map && map[lang]) || (map && map.cs) || slug;
}

function findSlugByAnyLabel(label) {
  const n = normKey(label);
  for (const slug of slugList) {
    const map = CITY_SYNONYMS[slug];
    for (const l of LANGS) {
      if (normKey(map[l]) === n) return slug;
    }
  }
  return null;
}

function canonPreferredCity(label) {
  const slug = findSlugByAnyLabel(label) || findSlugByAnyLabel(currentFilters.city || '') || null;
  if (!slug) return canonForInputCity(label);
  const forApi = CITY_SYNONYMS[slug].en || CITY_SYNONYMS[slug].cs || label;
  return canonForInputCity(forApi);
}

function syncLocalizedCityLabelFromCurrentState() {
  if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
    currentFilters.cityLabel = nearMeLabel();
    return;
  }
  const slug = findSlugByAnyLabel(currentFilters.cityLabel || currentFilters.city || '');
  if (slug) currentFilters.cityLabel = localizedCityLabel(slug, currentLang);
}

/* ───────── helper: force-inline filters + homepage blog fix ───────── */
function forceInlineFilters(doc = document) {
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

function fixHomeBlog() {
  if (!isHome()) return;

  const blog = document.getElementById('blog') || qs('section#blog');
  if (!blog) return;

  blog.classList.add('homepage-blog');
  blog.classList.remove('blog');

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

function pickLocalized(val, lang) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val[lang] || val[lang?.slice(0, 2)] || val.cs || val.en || Object.values(val)[0] || '';
  }
  return String(val);
}

function withLangParam(href, lang) {
  try {
    const u = new URL(href, location.origin);
    if (u.origin !== location.origin) return u.toString();
    if (!u.searchParams.has('lang')) u.searchParams.set('lang', lang);
    return u.toString();
  } catch {
    if (typeof href === 'string' && href.startsWith('/')) {
      try {
        const u = new URL(href, location.origin);
        if (!u.searchParams.has('lang')) u.searchParams.set('lang', lang);
        return u.toString();
      } catch {
        /* noop */
      }
    }
    return href || '#';
  }
}

function getHomeBlogHost() {
  const blog = document.getElementById('blog') || qs('section#blog');
  if (!blog) return null;
  return blog.querySelector('#homepage-blog-list') || blog.querySelector('[data-home-blog]') || blog.querySelector('.homepage-blog-cards');
}

function renderHomeBlog() {
  if (!isHome()) return;

  fixHomeBlog();

  const blog = document.getElementById('blog') || qs('section#blog');
  const host = getHomeBlogHost();
  if (!blog || !host) return;

  host.classList.add('homepage-blog-cards');
  host.classList.remove('blog-cards');

  const more = blog.querySelector('a.homepage-blog-more') || blog.querySelector('a[data-i18n-key="blog-show-all"]');
  if (more) {
    more.classList.add('homepage-blog-more');
    const raw = more.getAttribute('href') || more.href || '/blog';
    more.href = withLangParam(raw, currentLang);
  }

  if (host.dataset.ajRenderedLang === currentLang && host.children.length) return;

  let articles = [];
  try {
    articles = getSortedBlogArticles?.() || [];
  } catch {
    articles = [];
  }

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

  host.innerHTML = top.map(article => {
    const title = esc(pickLocalized(article.title || article.name || article.heading, currentLang) || '');
    const excerpt = esc(pickLocalized(article.excerpt || article.perex || article.summary || article.description, currentLang) || '');
    const img = esc(article.image || article.cover || article.hero || article.thumb || '/images/fallbacks/concert0.jpg');
    const rawHref = article.url || article.href || article.link || article.path || '/blog';
    const href = esc(withLangParam(rawHref, currentLang));

    return `
      <a class="homepage-blog-card blog-card" href="${href}" aria-label="${title}">
        <img src="${img}" alt="${title}" loading="lazy" />
        <div class="blog-card-content">
          <h3>${title}</h3>
          ${excerpt ? `<p>${excerpt}</p>` : ''}
          <span class="btn-primary">${esc(readMore)}</span>
        </div>
      </a>
    `;
  }).join('');

  host.dataset.ajRenderedLang = currentLang;
}

/* ───────── live region ───────── */
function ensureLiveRegion() {
  let region = document.getElementById('ajsee-live');
  if (!region) {
    region = document.createElement('div');
    region.id = 'ajsee-live';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    region.style.clip = 'rect(1px,1px,1px,1px)';
    region.style.clipPath = 'inset(50%)';
    region.style.whiteSpace = 'nowrap';
    document.body.appendChild(region);
  }
  return region;
}

const announce = msg => {
  ensureLiveRegion().textContent = msg || '';
};

function setBusy(v) {
  const form = qs('form.filter-dock') || qs('.events-filters');
  const list = qs('#eventsList');

  if (form) {
    form.setAttribute('aria-busy', v ? 'true' : 'false');
    qsa('input,select,button', form).forEach(el => {
      el.disabled = !!v && !el.classList.contains('filters-toggle');
    });
  }

  if (list) list.setAttribute('aria-busy', v ? 'true' : 'false');
}

/* ───────── i18n ───────── */
function deepMerge(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k] || {}, v) : v;
  }
  return out;
}

async function fetchJSON(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {
    /* noop */
  }
  return null;
}

async function loadTranslations(lang) {
  const base = (await fetchJSON(`/locales/${lang}.json`)) || (await fetchJSON(`/src/locales/${lang}.json`)) || {};
  const page = location.pathname.split('/').pop();
  const pagePart = page === 'about.html'
    ? (await fetchJSON(`/locales/${lang}/about.json`)) || (await fetchJSON(`/src/locales/${lang}/about.json`)) || {}
    : {};
  return deepMerge(base, pagePart);
}

function getByPath(obj, path) {
  return path?.split('.').reduce((acc, key) => acc?.[key], obj);
}

function t(key, fallback) {
  const tr = window.translations || {};
  const value = getByPath(tr, key) ?? tr[key];
  if (value !== undefined) return value;

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

const toggleFallback = {
  cs: { show: 'Zobrazit filtry', hide: 'Skrýt filtry' },
  en: { show: 'Show filters', hide: 'Hide filters' },
  de: { show: 'Filter anzeigen', hide: 'Filter ausblenden' },
  sk: { show: 'Zobraziť filtre', hide: 'Skryť filtre' },
  pl: { show: 'Pokaż filtry', hide: 'Ukryj filtre' },
  hu: { show: 'Szűrők megjelenítése', hide: 'Szűrők elrejtése' }
};

function toggleLabel(mode = 'hide') {
  const lang = currentLang || getUILang();
  const fb = toggleFallback[lang] || toggleFallback.cs;
  return mode === 'show' ? t('filters.show', fb.show) : t('filters.hide', fb.hide);
}

const ariaToggleFallback = {
  cs: { collapsed: 'Filtry jsou skryté.', expanded: 'Filtry jsou zobrazené.' },
  en: { collapsed: 'Filters are hidden.', expanded: 'Filters are visible.' },
  de: { collapsed: 'Filter sind ausgeblendet.', expanded: 'Filter sind sichtbar.' },
  sk: { collapsed: 'Filtre sú skryté.', expanded: 'Filtre sú zobrazené.' },
  pl: { collapsed: 'Filtry są ukryte.', expanded: 'Filtry są widoczne.' },
  hu: { collapsed: 'A szűrők rejtve vannak.', expanded: 'A szűrők láthatók.' }
};

const ariaToggleText = state => {
  const lang = currentLang || getUILang();
  return state === 'collapsed'
    ? t('filters.aria.collapsed', (ariaToggleFallback[lang] || ariaToggleFallback.cs).collapsed)
    : t('filters.aria.expanded', (ariaToggleFallback[lang] || ariaToggleFallback.cs).expanded);
};

const filtersFallback = {
  cs: { date: 'Datum', anytime: 'Kdykoliv' },
  en: { date: 'Date', anytime: 'Anytime' },
  de: { date: 'Datum', anytime: 'Beliebig' },
  sk: { date: 'Dátum', anytime: 'Kedykoľvek' },
  pl: { date: 'Data', anytime: 'Kiedykolwiek' },
  hu: { date: 'Dátum', anytime: 'Bármikor' }
};

function fbFilters(key) {
  const lang = currentLang || getUILang();
  return (filtersFallback[lang] || filtersFallback.cs)[key] || (filtersFallback.cs)[key] || '';
}

function setBtnLabel(el, txt) {
  if (!el) return;
  const node = el.querySelector('[data-i18n-label],.label,.btn-label');
  (node || el).textContent = txt;
}

async function applyTranslations(lang) {
  window.translations = await loadTranslations(lang);

  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return;
    if (/[<][a-z]/i.test(value)) el.innerHTML = value;
    else el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (!value) return;
    el.setAttribute('placeholder', String(value));
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    const value = t(key);
    if (!value) return;
    el.setAttribute('aria-label', String(value));
  });

  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.getAttribute('data-i18n-alt');
    const value = t(key);
    if (!value) return;
    el.setAttribute('alt', String(value));
  });

  syncLocalizedCityLabelFromCurrentState();
  updateFilterLocaleTexts();
  renderHomeBlog();
  emitI18nReady(lang);
}

if (!window.applyTranslations) window.applyTranslations = applyTranslations;

function emitI18nReady(lang) {
  try {
    window.dispatchEvent(new CustomEvent('ajsee:i18n-applied', { detail: { lang } }));
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new CustomEvent('ajsee:lang-changed', { detail: { lang } }));
  } catch {
    /* noop */
  }
}

async function ensureTranslations(lang) {
  if (typeof window.applyTranslations === 'function') return window.applyTranslations(lang);
  window.translations = await loadTranslations(lang);
  syncLocalizedCityLabelFromCurrentState();
  updateFilterLocaleTexts();
  renderHomeBlog();
  emitI18nReady(lang);
}

function syncCookieBanner() {
  try {
    initCookieBanner({ lang: currentLang, source: 'main-i18n' });
  } catch {
    /* noop */
  }
}

(function observeLangAttr() {
  try {
    const mo = new MutationObserver(async () => {
      const nextLang = getUILang();
      if (!nextLang || nextLang === currentLang) return;
      currentLang = nextLang;
      setLangCookie(currentLang);
      await ensureTranslations(currentLang);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch {
    /* noop */
  }
})();

/* ───────── visual patch / compat styles ───────── */
function injectOnce(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

function patchFilterVisuals() {
  injectOnce('ajsee-filters-visual-fix', String.raw`
    :root{ --ajsee-ctrl-h:56px; --ajsee-ctrl-radius:14px; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group{ position:relative; }
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group > label{
      position:absolute; top:8px; left:16px; font-size:12px; font-weight:700;
      letter-spacing:.04em; text-transform:uppercase; color:#0A3D62; opacity:.85; pointer-events:none;
    }
    :where(.events-filters.filter-dock, form.filter-dock) .field{ position:relative; }
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
  `);

  injectOnce('ajsee-nearme-inline-css', String.raw`
    .filter-group .btn-nearme-inline{
      position:absolute; right:12px; top:14px; border:0; background:none; padding:6px;
      font-size:18px; line-height:1; cursor:pointer; opacity:.8; z-index:2;
    }
    .filter-group .btn-nearme-inline:hover{ opacity:1; }
    .filter-group .btn-nearme-inline:focus-visible{ outline:2px solid #2f6bff; outline-offset:2px; border-radius:999px; }
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
    :where(.events-filters.filter-dock, form.filter-dock) .filter-group.date-combo.is-open #date-combo-button{
      border-bottom-left-radius:0 !important;
      border-bottom-right-radius:0 !important;
      border-bottom-color:transparent !important;
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

  injectOnce('ajsee-city-typeahead-compat-css', String.raw`
    .typeahead-panel[hidden],
    .city-sheet-backdrop[hidden]{ display:none !important; }

    .typeahead-panel{
      position:absolute;
      left:0;
      right:0;
      top:calc(100% + 10px);
      z-index:var(--ajsee-popover-z, 10020);
      background:rgba(255,255,255,.96);
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
      border:1px solid rgba(217,225,239,.92);
      border-radius:20px;
      box-shadow:0 18px 50px rgba(9,30,66,.16);
      padding:8px;
      max-height:min(360px, 50vh);
      overflow:auto;
    }

    .typeahead-loading,
    .typeahead-empty{
      padding:14px 16px;
      font-size:15px;
      color:#667085;
    }

    .typeahead-item{
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:14px 16px;
      border-radius:16px;
      cursor:pointer;
      transition:background-color .18s ease, transform .18s ease;
    }

    .typeahead-item.active,
    .typeahead-item:hover{
      background:#eef5ff;
    }

    .typeahead-item.nearme{
      background:linear-gradient(135deg, rgba(227,245,250,.95), rgba(233,242,255,.95));
      margin-bottom:4px;
    }

    .ti-city{
      font-size:17px;
      font-weight:700;
      color:#14213d;
    }

    .ti-city mark{
      background:rgba(20,194,197,.14);
      color:inherit;
      border-radius:6px;
      padding:0 .08em;
    }

    .ti-meta{
      font-size:13px;
      color:#667085;
    }

    body.city-picker-open{
      position:fixed;
      overflow:hidden;
      width:100%;
      left:0;
      right:0;
    }

    .city-sheet-backdrop{
      position:fixed;
      inset:0;
      z-index:calc(var(--ajsee-popover-z, 10020) + 1);
      display:flex;
      align-items:flex-end;
      justify-content:center;
      background:rgba(11,16,32,.28);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      opacity:0;
      pointer-events:none;
      transition:opacity .18s ease;
      padding:12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
    }

    .city-sheet-backdrop.is-open{
      opacity:1;
      pointer-events:auto;
    }

    .city-sheet{
      width:min(100%, 720px);
      max-height:calc(var(--city-sheet-vh, 100vh) - env(safe-area-inset-top, 0px) - 16px);
      background:rgba(255,255,255,.98);
      backdrop-filter:blur(22px);
      -webkit-backdrop-filter:blur(22px);
      border:1px solid rgba(217,225,239,.98);
      border-radius:28px;
      box-shadow:0 24px 60px rgba(9,30,66,.24);
      overflow:hidden;
      display:flex;
      flex-direction:column;
      transform:translateY(18px);
      transition:transform .18s ease;
    }

    .city-sheet-backdrop.is-open .city-sheet{ transform:translateY(0); }

    .city-sheet__grab{
      width:48px;
      height:5px;
      border-radius:999px;
      background:rgba(71,84,103,.22);
      margin:10px auto 2px;
      flex:0 0 auto;
    }

    .city-sheet__header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      padding:16px 18px 12px;
      flex:0 0 auto;
    }

    .city-sheet__title{
      margin:0;
      font-size:22px;
      line-height:1.15;
      color:#101828;
    }

    .city-sheet__subtitle{
      margin:6px 0 0;
      font-size:14px;
      color:#667085;
    }

    .city-sheet__close{
      border:0;
      background:#f2f4f7;
      width:40px;
      height:40px;
      border-radius:999px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-size:28px;
      line-height:1;
      cursor:pointer;
      color:#344054;
      flex:0 0 auto;
    }

    .city-sheet__search-wrap{
      padding:0 18px 12px;
      flex:0 0 auto;
    }

    .city-sheet__search{
      width:100%;
      height:56px;
      border-radius:18px;
      border:1px solid #d9e1ef;
      background:#fff;
      padding:0 16px;
      font:inherit;
      font-size:16px;
      color:#101828;
      outline:none;
    }

    .city-sheet__search:focus{
      border-color:#7aa7ff;
      box-shadow:0 0 0 4px rgba(47,107,255,.10);
    }

    .city-sheet__content{
      flex:1 1 auto;
      min-height:0;
      overflow:auto;
      padding:0 18px 18px;
      -webkit-overflow-scrolling:touch;
    }

    .city-sheet__nearme{
      width:100%;
      border:1px solid #9cc0f0;
      background:linear-gradient(135deg, rgba(227,245,250,.95), rgba(233,242,255,.95));
      border-radius:22px;
      padding:18px 18px;
      text-align:left;
      display:flex;
      flex-direction:column;
      gap:4px;
      margin:0 0 16px;
      cursor:pointer;
      box-shadow:0 12px 28px rgba(9,30,66,.08);
    }

    .city-sheet__nearme-title{
      font-size:18px;
      font-weight:800;
      color:#2f5fd0;
    }

    .city-sheet__nearme-sub{
      font-size:14px;
      color:#667085;
    }

    .city-sheet__section-title{
      font-size:13px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.04em;
      color:#667085;
      margin:0 0 10px;
    }

    .city-sheet__hint,
    .city-sheet__state{
      font-size:15px;
      color:#667085;
      padding:8px 4px 4px;
    }

    .city-sheet__results{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding-bottom:max(8px, env(safe-area-inset-bottom, 0px));
    }

    .city-sheet__option{
      width:100%;
      border:1px solid rgba(217,225,239,.88);
      background:#fff;
      border-radius:18px;
      padding:14px 16px;
      text-align:left;
      display:flex;
      flex-direction:column;
      gap:4px;
      box-shadow:0 8px 18px rgba(9,30,66,.05);
      cursor:pointer;
    }

    .city-sheet__option-city{
      font-size:17px;
      font-weight:700;
      color:#14213d;
    }

    .city-sheet__option-city mark{
      background:rgba(20,194,197,.14);
      color:inherit;
      border-radius:6px;
      padding:0 .08em;
    }

    .city-sheet__option-meta{
      font-size:13px;
      color:#667085;
    }
  `);
}

/* ───────── UI / filter text sync ───────── */
function updateFilterLocaleTexts() {
  const city = qs('#filter-city') || qs('#events-city-filter');
  if (city) city.placeholder = t('filters.cityPlaceholder', 'Praha, Brno…');

  const kw = qs('#filter-keyword');
  if (kw) kw.placeholder = t('filters.keywordPlaceholder', 'Umělec, místo, akce…');

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

  const dateLabel = t('filters.date', fbFilters('date'));
  const dateLbl = qs('label[for="date-combo-button"]');
  if (dateLbl) dateLbl.textContent = dateLabel;

  const dateBtn = qs('#date-combo-button');
  if (dateBtn) dateBtn.setAttribute('aria-label', dateLabel);

  updateDateComboLabel();
}

function expandFilters() {
  const dock = qs('form.filter-dock') || qs('.events-filters');
  if (!dock) return;
  dock.classList.remove('is-collapsed');
  const toggle = qs('#filtersToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', 'false');
    setBtnLabel(toggle, toggleLabel('hide'));
  }
  store.set('filtersCollapsed', false);
  announce(ariaToggleText('expanded'));
}

function computeActiveFiltersCount(filters = currentFilters) {
  let count = 0;
  if (filters.category && filters.category !== 'all') count++;
  if (filters.city || filters.cityLabel) count++;
  if (filters.keyword) count++;
  if (filters.sort && filters.sort !== 'nearest') count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.nearMeLat && filters.nearMeLon) count++;
  return count;
}

function updateToggleBadge() {
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

function updateResultsCount(n) {
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
    if (list && list.parentElement === host) host.insertBefore(el, list);
    else host.appendChild(el);
  }

  const label = t('events-found', 'Nalezeno') || 'Nalezeno';
  el.textContent = `${label}: ${n}`;
}

/* ───────── date range / combo label ───────── */
function applyDateRangeFromDetail(detail = {}, options = {}) {
  const { triggerRender = true } = options || {};
  const todayISO = toLocalISO(new Date());

  let mode = detail.mode || 'range';
  let from = detail.from || detail.start || detail.dateFrom || '';
  let to = detail.to || detail.end || detail.dateTo || '';

  if (mode === 'anytime') {
    from = '';
    to = '';
  } else if (mode === 'today') {
    from = todayISO;
    to = todayISO;
  }

  if (from && from < todayISO) from = todayISO;
  if (to && to < todayISO) to = todayISO;

  if (from && to && from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  currentFilters.dateFrom = from || '';
  currentFilters.dateTo = to || '';

  setFilterInputsFromState();
  updateToggleBadge();

  if (triggerRender) {
    void renderAndSync({ resetPage: true });
  }
}

function normalizeDates() {
  if (!currentFilters.dateFrom && !currentFilters.dateTo) return;
  applyDateRangeFromDetail({
    from: currentFilters.dateFrom,
    to: currentFilters.dateTo,
    mode: (currentFilters.dateFrom || currentFilters.dateTo) ? 'range' : 'anytime'
  }, { triggerRender: false });
}

function parseISODateMidday(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
}

function formatDMY(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatDateRangeCompact(aISO, bISO) {
  if (aISO && !bISO) return formatDMY(parseISODateMidday(aISO));
  if (bISO && !aISO) return formatDMY(parseISODateMidday(bISO));
  if (!aISO && !bISO) return '';

  const A = parseISODateMidday(aISO);
  const B = parseISODateMidday(bISO);
  if (isNaN(A) || isNaN(B)) return `${aISO || ''}${aISO && bISO ? ' - ' : ''}${bISO || ''}`;

  const sameYear = A.getFullYear() === B.getFullYear();
  const sameMonth = sameYear && A.getMonth() === B.getMonth();

  if (sameMonth) {
    return `${pad2(A.getDate())}-${pad2(B.getDate())}.${pad2(A.getMonth() + 1)}.${A.getFullYear()}`;
  }

  if (sameYear) {
    return `${pad2(A.getDate())}.${pad2(A.getMonth() + 1)} - ${pad2(B.getDate())}.${pad2(B.getMonth() + 1)}.${B.getFullYear()}`;
  }

  return `${formatDMY(A)} - ${formatDMY(B)}`;
}

function updateDateComboLabel() {
  const btnTxt = qs('.date-combo .combo-text');
  if (!btnTxt) return;
  const anytime = t('filters.anytime', fbFilters('anytime'));
  const label = (currentFilters.dateFrom || currentFilters.dateTo)
    ? formatDateRangeCompact(currentFilters.dateFrom, currentFilters.dateTo)
    : anytime;
  btnTxt.textContent = label;
  btnTxt.title = label;
}

if (!window.updateDateComboLabel) window.updateDateComboLabel = updateDateComboLabel;

/* ───────── form sync ───────── */
function setFilterInputsFromState() {
  const cat = qs('#filter-category') || qs('#events-category-filter');
  const sort = qs('#filter-sort') || qs('#events-sort-filter');
  const city = qs('#filter-city') || qs('#events-city-filter');
  const from = qs('#filter-date-from') || qs('#events-date-from');
  const to = qs('#filter-date-to') || qs('#events-date-to');
  const kw = qs('#filter-keyword');

  if (cat) cat.value = currentFilters.category || 'all';
  if (sort) sort.value = currentFilters.sort || 'nearest';

  if (city) {
    if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
      city.value = nearMeLabel();
      city.setAttribute('data-autofromnearme', '1');
    } else {
      city.value = currentFilters.cityLabel || currentFilters.city || '';
      city.removeAttribute('data-autofromnearme');
    }
  }

  if (from) from.value = currentFilters.dateFrom || '';
  if (to) to.value = currentFilters.dateTo || '';
  if (kw) kw.value = currentFilters.keyword || '';

  updateDateComboLabel();
}

function syncFiltersFromForm() {
  const cat = qs('#filter-category') || qs('#events-category-filter');
  const sort = qs('#filter-sort') || qs('#events-sort-filter');
  const city = qs('#filter-city') || qs('#events-city-filter');
  const from = qs('#filter-date-from') || qs('#events-date-from');
  const to = qs('#filter-date-to') || qs('#events-date-to');
  const kw = qs('#filter-keyword');

  currentFilters.category = cat?.value || 'all';
  currentFilters.sort = sort?.value || 'nearest';
  currentFilters.keyword = (kw?.value || '').trim();
  currentFilters.dateFrom = from?.value || currentFilters.dateFrom || '';
  currentFilters.dateTo = to?.value || currentFilters.dateTo || '';

  if (city && !city.matches('[data-autofromnearme="1"]')) {
    const rawCity = (city.value || '').trim();
    currentFilters.cityLabel = rawCity;
    currentFilters.city = rawCity ? canonPreferredCity(rawCity) : '';

    if (!rawCity) {
      currentFilters.nearMeLat = null;
      currentFilters.nearMeLon = null;
      city.removeAttribute('data-autofromnearme');
    }
  }

  updateDateComboLabel();
  updateToggleBadge();
}

function syncURLFromFilters() {
  const u = new URL(location.href);
  const p = u.searchParams;

  currentFilters.city ? p.set('city', currentFilters.city) : p.delete('city');
  currentFilters.dateFrom ? p.set('from', currentFilters.dateFrom) : p.delete('from');
  currentFilters.dateTo ? p.set('to', currentFilters.dateTo) : p.delete('to');
  (currentFilters.category && currentFilters.category !== 'all') ? p.set('segment', currentFilters.category) : p.delete('segment');
  currentFilters.keyword ? p.set('q', currentFilters.keyword) : p.delete('q');
  (currentFilters.sort && currentFilters.sort !== 'nearest') ? p.set('sort', currentFilters.sort) : p.delete('sort');

  if (currentFilters.nearMeLat && currentFilters.nearMeLon) {
    p.set('lat', String(currentFilters.nearMeLat));
    p.set('lon', String(currentFilters.nearMeLon));
    p.set('radius', String(currentFilters.nearMeRadiusKm || 50));
  } else {
    p.delete('lat');
    p.delete('lon');
    p.delete('radius');
  }

  history.replaceState(null, '', u.toString());
}

/* ───────── sort segmented ───────── */
function upgradeSortToSegmented() {
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
  btnNearest.type = 'button';
  btnLatest.type = 'button';
  btnNearest.textContent = t('filters.nearest', 'Nearest');
  btnLatest.textContent = t('filters.latest', 'Latest');
  wrap.appendChild(btnNearest);
  wrap.appendChild(btnLatest);

  select.parentElement.insertBefore(wrap, select);
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.style.display = 'none';

  function setActive(which) {
    const buttons = [btnNearest, btnLatest];
    buttons.forEach((btn, idx) => {
      btn.classList.toggle('is-active', idx === which);
      btn.setAttribute('aria-selected', idx === which ? 'true' : 'false');
      btn.setAttribute('role', 'tab');
      btn.tabIndex = idx === which ? 0 : -1;
    });

    const target = buttons[which];
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const rw = wrap.getBoundingClientRect();
      wrap.style.setProperty('--indi-left', (r.left - rw.left + 6) + 'px');
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

  wireOnce(wrap, 'keydown', async e => {
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

function normalizeFilterFormUI() {
  const cat = qs('#filter-category') || qs('#events-category-filter');
  if (cat && !cat.classList.contains('styled-select')) cat.classList.add('styled-select');

  ['#filter-city', '#events-city-filter', '#filter-date-from', '#events-date-from', '#filter-date-to', '#events-date-to', '#filter-keyword']
    .forEach(sel => {
      const el = qs(sel);
      if (el && !el.classList.contains('styled-input')) el.classList.add('styled-input');
    });

  patchFilterVisuals();
}

/* ───────── date popover helpers ───────── */
function getDatePopoverPanel() {
  return document.querySelector('.ajsee-date-fallback, .ajsee-date-popover, #ajsee-date-popover, [data-ajsee-date-popover], [data-ajsee="date-popover"]');
}

function isDatePopoverPanelVisible(panel) {
  if (!panel) return false;
  const cs = window.getComputedStyle(panel);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = panel.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function closeDatePopover() {
  const panel = getDatePopoverPanel();
  if (!panel) return;

  const btn = panel.querySelector('[data-ajsee-close], [data-close], .btn-close, .close, button[aria-label*="close" i], button[aria-label*="zavř" i], button[aria-label*="zavri" i]');
  if (btn && typeof btn.click === 'function') {
    btn.click();
    return;
  }

  const overlay = document.querySelector('.ajsee-date-popover-overlay, [data-ajsee-date-overlay], .ajsee-popover-overlay');
  if (overlay && typeof overlay.click === 'function') {
    overlay.click();
    return;
  }

  try {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  } catch {
    /* noop */
  }

  try {
    panel.style.display = 'none';
    panel.setAttribute('data-ajsee-force-hidden', '1');
  } catch {
    /* noop */
  }
}

function bindDatePopoverUnhideOnOpen() {
  const btn = qs('#date-combo-button');
  if (!btn) return;

  const unhide = () => {
    requestAnimationFrame(() => {
      const panel = getDatePopoverPanel();
      if (panel && panel.hasAttribute('data-ajsee-force-hidden')) {
        panel.style.removeProperty('display');
        panel.removeAttribute('data-ajsee-force-hidden');
      }
    });
  };

  wireOnce(btn, 'pointerdown', unhide, 'date-unhide-pointer');
  wireOnce(btn, 'click', unhide, 'date-unhide-click');
}

function installDatePopoverAutoHide() {
  const btn = qs('#date-combo-button');
  const group = (btn && btn.closest('.filter-group')) || qs('.filter-group.date-combo');
  if (!group) return;

  let raf = 0;
  const check = () => {
    raf = 0;
    const panel = getDatePopoverPanel();
    if (!isDatePopoverPanelVisible(panel)) return;
    if (!isElementInViewportBelowHeader(group, 4)) {
      closeDatePopover();
      group.classList.remove('is-open');
      try {
        btn?.setAttribute('aria-expanded', 'false');
      } catch {
        /* noop */
      }
    }
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(check);
  };

  getScrollParents(group).forEach(sp => {
    wireOnce(sp, 'scroll', schedule, 'date-autohide-scroll', { passive: true });
  });
  wireOnce(window, 'resize', schedule, 'date-autohide-resize', { passive: true });

  schedule();
}

function bindDatePopoverGlue() {
  const group = qs('.filter-group.date-combo') || (qs('#date-combo-button')?.closest('.filter-group'));
  const btn = qs('#date-combo-button');
  if (!group) return;

  try {
    G.state._dateGlueMO?.disconnect?.();
  } catch {
    /* noop */
  }

  const isOpen = () => {
    const panel = getDatePopoverPanel();
    if (!panel) return false;
    const cs = window.getComputedStyle(panel);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return panel.getBoundingClientRect().width > 0;
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    const open = isOpen();
    group.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  G.state._dateGlueMO = mo;

  wireOnce(window, 'scroll', schedule, 'date-glue-scroll', { passive: true });
  wireOnce(window, 'resize', schedule, 'date-glue-resize', { passive: true });

  schedule();
}

wireOnce(window, 'AJSEE:dateRangeApply', e => {
  applyDateRangeFromDetail(e?.detail || {}, { triggerRender: true });
}, 'dateRangeApply');

wireOnce(window, 'AJSEE:date-popover:apply', e => {
  applyDateRangeFromDetail(e?.detail || {}, { triggerRender: true });
}, 'datePopoverApply');

/* ───────── geolocation / near me ───────── */
async function acquireGeolocation({ timeout = 15000, highAccuracy = false } = {}) {
  if (!('geolocation' in navigator)) {
    const err = new Error('no-geo');
    err.code = 'NO_GEO';
    throw err;
  }

  try {
    if (navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'denied') {
        const err = new Error('permission-denied');
        err.code = 1;
        throw err;
      }
    }
  } catch {
    /* ignore */
  }

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

async function fallbackGeoFromEdge() {
  const res = await fetch('/api/geo', { cache: 'no-store' });
  if (!res.ok) throw new Error('edge-failed');
  const json = await res.json();
  const lat = Number(json?.geo?.latitude ?? json?.latitude);
  const lon = Number(json?.geo?.longitude ?? json?.longitude);
  if (isFinite(lat) && isFinite(lon)) {
    return { lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
  }
  throw new Error('edge-no-coords');
}

function geoErrorMessage(err) {
  const code = Number(err?.code);
  switch (code) {
    case 1:
      return t('geo.permissionDenied', 'Přístup k poloze byl zamítnut v prohlížeči.');
    case 2:
      return t('geo.unavailable', 'Poloha není dostupná (zkuste vypnout VPN/zkontrolovat služby určování polohy).');
    case 3:
      return t('geo.timeout', 'Zjišťování polohy vypršelo. Zkuste to znovu.');
    default:
      return t('geo.denied', 'Nepodařilo se zjistit polohu. Povolte prosím přístup k poloze ve vašem prohlížeči.');
  }
}

const nearMeLabel = () => t('filters.nearMe', 'V mém okolí');

function isNearMeTyped(input) {
  const value = normKey(input?.value || '');
  const candidates = [nearMeLabel(), 'v mem okoli', 'vmojemokoli', 'near me', 'nearme', 'aroundme'];
  return candidates.some(x => normKey(x) === value);
}

async function activateNearMeViaGeo(input) {
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
    } catch {
      announce(geoErrorMessage(err1) + ' ' + t('geo.edgeFailed', '(Záložní určení podle IP nebylo k dispozici.)'));
      return;
    }
  }

  await renderAndSync({ resetPage: true });
  expandFilters();
}

function ensureNearMeInlineButton(input) {
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

  btn.addEventListener('click', () => {
    void activateNearMeViaGeo(input);
  });
}

/* ───────── city typeahead integration ───────── */
function buildCityTypeaheadOptions(input, locale) {
  return {
    locale,
    t,
    minChars: 2,
    debounceMs: 220,
    countryCodes: ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'],
    onChoose: item => {
      const label = item?.city || item?.label || item?.name || '';
      currentFilters.city = canonPreferredCity(label);
      currentFilters.cityLabel = label;
      currentFilters.nearMeLat = null;
      currentFilters.nearMeLon = null;
      input.value = label;
      input.removeAttribute('data-autofromnearme');
      void renderAndSync({ resetPage: true }).then(() => expandFilters());
    },
    onNearMe: async ({ lat, lon } = {}) => {
      if (typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon) && ((Math.abs(lat) + Math.abs(lon)) > 0)) {
        currentFilters.city = '';
        currentFilters.cityLabel = nearMeLabel();
        currentFilters.nearMeLat = +lat;
        currentFilters.nearMeLon = +lon;
        input.value = nearMeLabel();
        input.setAttribute('data-autofromnearme', '1');
        await renderAndSync({ resetPage: true });
        expandFilters();
      } else {
        await activateNearMeViaGeo(input);
      }
    }
  };
}

function bindCityInputShortcuts(input) {
  if (!input) return;

  const tryNearMeFromInput = async () => {
    if (isNearMeTyped(input) && !(currentFilters.nearMeLat && currentFilters.nearMeLon)) {
      await activateNearMeViaGeo(input);
    }
  };

  wireOnce(input, 'keydown', e => {
    if (e.key !== 'Enter') return;
    if (input.hasAttribute('readonly')) return;
    e.preventDefault();
    void tryNearMeFromInput();
  }, 'city-enter-nearme');

  wireOnce(input, 'blur', () => {
    if (input.hasAttribute('readonly')) return;
    void tryNearMeFromInput();
  }, 'city-blur-nearme');
}

function rebuildCityInput(input) {
  if (!input) return null;
  const clone = input.cloneNode(true);
  clone.value = input.value;
  input.replaceWith(clone);
  return clone;
}

function initCityTypeahead(locale, { rebuild = false } = {}) {
  let input = qs('#filter-city') || qs('#events-city-filter');
  if (!input) return null;

  if (rebuild || input.dataset.ajTypeaheadBound === '1') {
    input = rebuildCityInput(input);
  }

  setupCityTypeahead(input, buildCityTypeaheadOptions(input, locale));
  input.dataset.ajTypeaheadBound = '1';

  bindCityInputShortcuts(input);
  ensureNearMeInlineButton(input);
  setFilterInputsFromState();

  return input;
}

/* ───────── render events ───────── */
function mapLangToTm(lang) {
  const map = { cs: 'cs-cz', sk: 'sk-sk', pl: 'pl-pl', de: 'de-de', hu: 'hu-hu', en: 'en-gb' };
  return map[(lang || 'en').slice(0, 2)] || 'en-gb';
}

function safeUrl(raw) {
  try {
    const u = new URL(raw, location.href);
    if (/^https?:/i.test(u.protocol)) return u.toString();
  } catch {
    /* noop */
  }
  return '#';
}

function adjustTicketmasterLanguage(rawUrl, lang = getUILang()) {
  try {
    const u = new URL(rawUrl, location.href);
    const val = mapLangToTm(lang);
    u.searchParams.set('language', val);
    if (!u.searchParams.has('locale')) u.searchParams.set('locale', val);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function wrapAffiliate(url) {
  try {
    const cfg = window.__impact || window.__aff || {};
    if (cfg.clickBase) return cfg.clickBase + encodeURIComponent(url);
    if (cfg.param && cfg.value) {
      const u = new URL(url);
      if (!u.searchParams.has(cfg.param)) u.searchParams.set(cfg.param, cfg.value);
      return u.toString();
    }
  } catch {
    /* noop */
  }
  return url;
}

function makeFetchSig(locale, api, page, perPage) {
  return JSON.stringify({
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
  });
}

async function renderEvents(locale = 'cs', filters = currentFilters) {
  const list = document.getElementById('eventsList');
  if (!list) return;

  list.setAttribute('aria-live', 'polite');
  setBusy(true);

  try {
    const api = { ...filters, city: filters.city ? canonForInputCity(filters.city) : '' };

    const latOk = typeof api.nearMeLat === 'number' && isFinite(api.nearMeLat);
    const lonOk = typeof api.nearMeLon === 'number' && isFinite(api.nearMeLon);
    const nonZero = (Math.abs(api.nearMeLat || 0) > 0.001) || (Math.abs(api.nearMeLon || 0) > 0.001);

    if (latOk && lonOk && nonZero) {
      const lat = +api.nearMeLat;
      const lon = +api.nearMeLon;
      const radius = clamp(+api.nearMeRadiusKm || 50, 10, 300);
      Object.assign(api, {
        city: '',
        nearMe: 1,
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        latlon: `${lat},${lon}`,
        latlong: `${lat},${lon}`,
        geoPoint: `${lat},${lon}`,
        radiusKm: radius,
        radius,
        unit: 'km'
      });
    } else {
      delete api.nearMeLat;
      delete api.nearMeLon;
    }

    const sig = makeFetchSig(locale, api, pagination.page, pagination.perPage);
    if (sig === _lastFetchSig) return;
    _lastFetchSig = sig;

    const events = await getAllEvents({ locale, filters: api }) || [];
    if (!window.translations) window.translations = await loadTranslations(locale);

    let out = [...events];
    if (filters.category && filters.category !== 'all') {
      out = out.filter(e => e.category === filters.category);
    }

    if (filters.sort === 'nearest') {
      out.sort((a, b) => new Date(a.datetime || a.date) - new Date(b.datetime || b.date));
    } else {
      out.sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    }

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
      const titleRaw = (typeof ev.title === 'string'
        ? ev.title
        : (ev.title?.[locale] || ev.title?.en || ev.title?.cs || Object.values(ev.title || {})[0])) || 'Untitled';
      const title = esc(titleRaw);
      const dateVal = ev.datetime || ev.date;
      const date = dateVal
        ? esc(new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }))
        : '';
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
        </article>
      `;
    }).join('');

    announce(`${t('events-found', 'Nalezeno') || 'Nalezeno'} ${out.length}`);
  } catch {
    if (list) {
      list.innerHTML = `<p>${esc(t('events-load-error', 'Unable to load events. Try again later.'))}</p>`;
    }
  } finally {
    setBusy(false);
  }
}

async function renderAndSync({ resetPage = true } = {}) {
  if (_renderInflight) {
    _renderQueued = true;
    return;
  }
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

function initEventsScrollGuard() {
  if (!isEventsPage()) return;

  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch {
    /* noop */
  }

  const form = qs('#events-filters-form') || qs('form.filter-dock') || qs('.events-filters');
  if (!form) return;

  const mark = () => {
    _userInteractedWithFilters = true;
  };

  wireOnce(form, 'input', mark, 'usr-int-input');
  wireOnce(form, 'change', mark, 'usr-int-change');
  wireOnce(form, 'click', mark, 'usr-int-click');
  wireOnce(form, 'submit', mark, 'usr-int-submit');
  wireOnce(form, 'keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') mark();
  }, 'usr-int-keydown');
}

/* ───────── language change helper ───────── */
function changeLangTo(lang) {
  const next = String(lang || '').toLowerCase();
  if (!next || next === currentLang) return;

  currentLang = next;
  setLangCookie(currentLang);
  document.documentElement.lang = currentLang;

  const u = new URL(location.href);
  u.searchParams.set('lang', currentLang);
  history.replaceState(null, '', u.toString());

  window.dispatchEvent(new CustomEvent('AJSEE:langChanged', { detail: { lang: currentLang } }));
}

/* ───────── desktop language dropdown fallback ───────── */
function initLangDropdownFallback() {
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
    .filter(root => root && (root.closest('header') || root.hasAttribute('data-lang-dropdown')));
  if (!roots.length) return;

  const state = G.state._langDD || (G.state._langDD = { open: false, root: null, menu: null });

  const close = () => {
    if (!state.open) return;
    state.open = false;
    try {
      state.menu?.remove?.();
    } catch {
      /* noop */
    }
    state.menu = null;
    if (state.root) {
      state.root.classList.remove('is-open');
      const active = state.root.querySelector('.lang-btn.is-active');
      if (active) active.setAttribute('aria-expanded', 'false');
    }
    state.root = null;
  };

  const syncActive = root => {
    qsa('.lang-btn', root).forEach(btn => {
      const lang = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
      const isActive = !!lang && lang === currentLang;
      btn.classList.toggle('is-active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  };

  const positionMenu = (menu, anchorRect) => {
    if (!menu || !anchorRect) return;
    const SAFE = 8;
    const vpW = window.innerWidth || 1024;
    const vpH = window.innerHeight || 768;

    menu.style.left = '0px';
    menu.style.top = '0px';

    const r = menu.getBoundingClientRect();
    const w = r.width || 240;
    const h = r.height || 200;

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

  const openForRoot = root => {
    close();
    syncPopoverZIndex();
    syncActive(root);

    const btnActive = root.querySelector('.lang-btn.is-active') || root.querySelector('.lang-btn');
    const anchorRect = btnActive?.getBoundingClientRect?.();
    if (!anchorRect) return;

    const menu = document.createElement('div');
    menu.className = 'ajsee-lang-menu';
    menu.setAttribute('role', 'menu');

    qsa('.lang-btn', root).forEach(src => {
      const clone = src.cloneNode(true);
      clone.removeAttribute('id');
      clone.setAttribute('type', 'button');
      const lang = (clone.getAttribute('data-lang') || clone.getAttribute('data-locale') || '').toLowerCase();
      clone.classList.toggle('is-active', lang === currentLang);
      clone.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (!lang) return;
        close();
        if (lang !== currentLang) changeLangTo(lang);
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

    const schedule = () => {
      if (!state.open || !state.menu || !state.root) return;
      const active = state.root.querySelector('.lang-btn.is-active') || state.root.querySelector('.lang-btn');
      const r = active?.getBoundingClientRect?.();
      if (!r) {
        close();
        return;
      }
      if (!isElementInViewportBelowHeader(active, 2)) {
        close();
        return;
      }
      positionMenu(state.menu, r);
    };

    getScrollParents(root).forEach(sp => {
      wireOnce(sp, 'scroll', schedule, 'langdd-scroll', { passive: true });
    });
    wireOnce(window, 'resize', schedule, 'langdd-resize', { passive: true });

    wireOnce(document, 'click', e => {
      if (!state.open) return;
      if (state.menu && state.menu.contains(e.target)) return;
      if (state.root && state.root.contains(e.target)) return;
      close();
    }, 'langdd-outside', true);

    wireOnce(document, 'keydown', e => {
      if (e.key === 'Escape') close();
    }, 'langdd-esc');
  };

  roots.forEach(root => {
    if (!root || root.dataset.ajLangDropdownWired === '1') return;
    const btns = qsa('.lang-btn', root);
    if (btns.length < 2) return;

    root.dataset.ajLangDropdownWired = '1';
    syncActive(root);

    wireOnce(root, 'click', e => {
      const btn = e.target.closest('.lang-btn');
      if (!btn || !root.contains(btn)) return;

      const lang = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
      if (!lang) return;

      e.preventDefault();
      e.stopPropagation();

      if (lang === currentLang) {
        if (state.open && state.root === root) close();
        else openForRoot(root);
      } else {
        close();
        changeLangTo(lang);
      }
    }, `langdd-click-${Math.random().toString(16).slice(2)}`);

    wireOnce(window, 'AJSEE:langChanged', () => syncActive(root), 'langdd-sync');
  });
}

function safeInitLangDropdown() {
  try {
    if (typeof initLangDropdown === 'function') initLangDropdown();
  } catch {
    /* noop */
  }
  initLangDropdownFallback();
}

/* ───────── lang dropdown compat ───────── */
function patchLangDropdownStyles() {
  injectOnce('ajsee-lang-dropdown-compat-css', String.raw`
    details.lang-dropdown > summary::-webkit-details-marker{ display:none; }
    details.lang-dropdown > summary{ list-style:none; }
    details.lang-dropdown[open] > .lang-menu{ display:flex !important; }
    @media (max-width: 950px){
      .main-nav .language-switcher.mobile-switcher details.lang-dropdown{ display:block !important; }
    }
  `);
}

function syncLangDropdownUI(lang) {
  const target = (lang || getUILang() || 'cs').toLowerCase().slice(0, 2);

  qsa('details.lang-dropdown').forEach(dd => {
    const summary = dd.querySelector('summary');
    if (!summary) return;

    const currentFlag = summary.querySelector('.lang-current-flag') || summary.querySelector('img.flag') || null;
    const currentLabel = summary.querySelector('.lang-current-label') || summary.querySelector('.lang-current') || null;

    qsa('.lang-btn', dd).forEach(btn => {
      const langValue = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
      const selected = langValue === target;
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

function initLangDropdownCompat() {
  patchLangDropdownStyles();

  const dropdowns = qsa('details.lang-dropdown');
  if (!dropdowns.length) return;

  dropdowns.forEach((dd, idx) => {
    const summary = dd.querySelector('summary');
    const menu = dd.querySelector('.lang-menu');
    if (!summary || !menu) return;

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

    qsa('.lang-btn', menu).forEach(btn => {
      wireOnce(btn, 'click', () => {
        dd.open = false;
        syncOpen();
      }, `lang-dd-close-${idx}`);
    });

    wireOnce(document, 'click', e => {
      if (!dd.open) return;
      if (dd.contains(e.target)) return;
      dd.open = false;
      syncOpen();
    }, `lang-dd-doc-${idx}`, { capture: true });

    wireOnce(document, 'keydown', e => {
      if (e.key !== 'Escape' || !dd.open) return;
      dd.open = false;
      syncOpen();
      try {
        summary.blur();
      } catch {
        /* noop */
      }
    }, `lang-dd-esc-${idx}`);
  });

  syncLangDropdownUI(currentLang || getUILang());
  wireOnce(window, 'AJSEE:langChanged', e => {
    syncLangDropdownUI(e?.detail?.lang || getUILang());
  }, 'lang-dd-sync');
}

/* ───────── homepage CTA helpers ───────── */
function updateHomeCtasWithLang() {
  const SUPPORTED = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
  const lang = (currentLang || getUILang() || 'cs').toLowerCase();

  const wl = document.getElementById('hpWaitlist');
  const wlCta = document.getElementById('hpWaitlistCta');
  const wlClose = document.getElementById('hpWaitlistClose');

  if (wlCta) {
    try {
      const u = new URL(wlCta.getAttribute('href') || wlCta.href || '/coming-soon', location.origin);
      if (SUPPORTED.includes(lang)) u.searchParams.set('lang', lang);
      wlCta.href = u.toString();
    } catch {
      /* noop */
    }

    wireOnce(wlCta, 'click', () => {
      if (window.gtag) window.gtag('event', 'click_waitlist', { source: 'home_banner', lang });
    }, 'wl-gtag');
  }

  if (wlClose && wl) {
    wireOnce(wlClose, 'click', () => {
      try {
        wl.remove();
      } catch {
        /* noop */
      }
    }, 'wl-close');
  }

  const demoCta = document.getElementById('demoBadgeCta');
  if (demoCta) {
    try {
      const u = new URL(demoCta.getAttribute('href') || demoCta.href || '/coming-soon', location.origin);
      u.searchParams.set('lang', lang);
      demoCta.href = u.toString();
    } catch {
      /* noop */
    }

    wireOnce(demoCta, 'click', () => {
      if (window.gtag) window.gtag('event', 'click_demo_badge', { source: 'home_demo_pill', lang });
    }, 'demo-gtag');
  }
}

/* ───────── jazykové přepínače ───────── */
function initLanguageSwitchers() {
  qsa('.lang-btn').forEach(btn => {
    const lang = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();
    if (!lang) return;

    const inDetailsSummary = !!(btn.closest('details.lang-dropdown') && btn.closest('summary'));
    const isTriggerLike = btn.classList.contains('lang-trigger') || !!btn.closest('.lang-trigger') || btn.hasAttribute('aria-expanded');
    if (inDetailsSummary || isTriggerLike) return;

    wireOnce(btn, 'click', e => {
      e.preventDefault();
      e.stopPropagation();

      qsa('details.lang-dropdown[open]').forEach(d => {
        try {
          d.open = false;
        } catch {
          /* noop */
        }
      });

      if (lang === currentLang) {
        syncLangDropdownUI(currentLang);
        return;
      }

      syncLangDropdownUI(lang);
      changeLangTo(lang);
    }, `lang-${lang}`);
  });
}

/* ───────── initialization helpers ───────── */
function initFiltersFromURL() {
  const sp = new URLSearchParams(location.search);

  if (sp.get('city')) {
    const raw = sp.get('city') || '';
    currentFilters.city = canonPreferredCity(raw);
    currentFilters.cityLabel = raw;
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
    currentFilters.cityLabel = nearMeLabel();
    currentFilters.city = '';
  }

  syncLocalizedCityLabelFromCurrentState();
}

function bindFilterFormInteractions(formEl) {
  if (!formEl) return;

  const category = qs('#filter-category') || qs('#events-category-filter');
  if (category) {
    wireOnce(category, 'change', async () => {
      syncFiltersFromForm();
      await renderAndSync({ resetPage: true });
    }, 'category-change');
  }

  wireOnce(formEl, 'submit', async e => {
    e.preventDefault();
    syncFiltersFromForm();
    const city = qs('#filter-city') || qs('#events-city-filter');
    if (city && !city.hasAttribute('readonly') && isNearMeTyped(city) && !(currentFilters.nearMeLat && currentFilters.nearMeLon)) {
      await activateNearMeViaGeo(city);
      syncFiltersFromForm();
    }
    await renderAndSync({ resetPage: true });
  }, 'submit');
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

  initFiltersFromURL();

  await ensureTranslations(currentLang);
  syncCookieBanner();

  renderHomeBlog();
  updateHomeCtasWithLang();

  initNav({ lang: currentLang });
  initContactFormValidation({ lang: currentLang, t });
  initEventModal();

  initLangDropdownCompat();
  initLanguageSwitchers();
  safeInitLangDropdown();

  const formEl = qs('#events-filters-form');
  const topToolbar = document.querySelector('.filters-toolbar');
  if (topToolbar) topToolbar.remove();
  const legacyNearBtn = document.getElementById('filter-nearme');
  if (legacyNearBtn) legacyNearBtn.remove();

  upgradeSortToSegmented();
  normalizeFilterFormUI();
  bindFilterFormInteractions(formEl);

  installDatePopoverScrollBridges();
  bindDatePopoverGlue();
  bindDatePopoverUnhideOnOpen();
  installDatePopoverAutoHide();

  initCityTypeahead(currentLang, { rebuild: false });
  setFilterInputsFromState();
  updateToggleBadge();

  wireOnce(window, 'AJSEE:langChanged', async e => {
    currentLang = e?.detail?.lang || getUILang();
    setLangCookie(currentLang);
    document.documentElement.lang = currentLang;

    syncLocalizedCityLabelFromCurrentState();
    await ensureTranslations(currentLang);
    syncCookieBannerLanguage(currentLang);

    initCityTypeahead(currentLang, { rebuild: true });
    setFilterInputsFromState();

    installDatePopoverScrollBridges();
    bindDatePopoverGlue();
    bindDatePopoverUnhideOnOpen();
    installDatePopoverAutoHide();
    syncPopoverZIndex();

    fixHomeBlog();
    renderHomeBlog();
    updateHomeCtasWithLang();

    initLangDropdownCompat();
    safeInitLangDropdown();

    await renderAndSync({ resetPage: true });
  }, 'ajsee-lang-change-main');

  await renderAndSync({ resetPage: true });
});
