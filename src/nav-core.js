// Shared static navigation, language-aware links and the mobile drawer.
import { buildLocalizedPath } from './utils/localized-path.js';

window.__ajsee = window.__ajsee || {};
const G = window.__ajsee;
G.flags = G.flags || {};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const supportedLanguages = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const languagePrefix = /^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i;
const localizedLinks = '.main-nav > ul a, .logo-link[href], .footer-navigation a[href]';
const sectionLinks = {
  'blog-detail': 'nav-reviews',
  'review-detail': 'nav-reviews',
  'event-detail': 'nav-events',
  'london-musicals': 'nav-london-musicals'
};

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase();
  return supportedLanguages.includes(lang) ? lang : null;
}

function detectLang(fallback = 'cs') {
  const queryLang = new URLSearchParams(location.search).get('lang');
  const pathLang = location.pathname.match(languagePrefix)?.[1];
  return normalizeLang(queryLang) || normalizeLang(pathLang) || normalizeLang(fallback) || 'cs';
}

function navPath(pathname) {
  return pathname
    .replace(languagePrefix, '')
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '')
    .replace(/\/+$/, '') || '/';
}

function updateHeaderOffset() {
  const header = qs('.site-header');
  const height = header ? Math.ceil(header.getBoundingClientRect().height) : 80;
  document.documentElement.style.setProperty('--header-offset', Math.max(56, height + 8) + 'px');
}

function activateNavLink() {
  const currentPath = navPath(location.pathname);
  const sectionLink = sectionLinks[document.body?.dataset.page];

  qsa('.main-nav > ul a').forEach(link => {
    const current = navPath(new URL(link.href).pathname) === currentPath
      || link.dataset.i18nKey === sectionLink;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function updateMenuLinksWithLang(lang) {
  qsa(localizedLinks).forEach(link => {
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;

    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    url.searchParams.delete('hl');
    const path = buildLocalizedPath(url.pathname, lang) + url.search + url.hash;
    if (link.getAttribute('href') !== path) link.setAttribute('href', path);
  });
}

function initMobileMenu() {
  const hamburger = qs('.hamburger-btn');
  const nav = qs('.main-nav');
  const overlay = qs('.menu-overlay-bg');
  const closeButton = qs('.menu-close');

  if (!hamburger || !nav || !overlay) return;

  hamburger.setAttribute('aria-controls', nav.id);
  hamburger.setAttribute('aria-expanded', 'false');

  const openMenu = () => {
    nav.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('nav-open');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
    updateHeaderOffset();
    requestAnimationFrame(() => {
      if (nav.classList.contains('open')) closeButton?.focus({ preventScroll: true });
    });
  };

  const closeMenu = () => {
    if (!nav.classList.contains('open')) return;

    nav.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('nav-open');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
    if (nav.contains(document.activeElement)) hamburger.focus({ preventScroll: true });
    updateHeaderOffset();
  };

  window.__ajseeCloseMenu = closeMenu;
  hamburger.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  closeButton?.addEventListener('click', closeMenu);
  qsa('a[href]', nav).forEach(link => link.addEventListener('click', closeMenu));

  nav.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !nav.classList.contains('open')) return;

    const focusable = qsa('button:not([disabled]), a[href], summary', nav)
      .filter(element => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (document.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented) closeMenu();
  });
  window.addEventListener('resize', () => {
    if (window.getComputedStyle(hamburger).display === 'none') closeMenu();
  });
}

function bindLanguageChanges() {
  document.addEventListener('click', event => {
    const lang = normalizeLang(event.target?.closest?.('.lang-btn[data-lang]')?.dataset.lang);
    if (!lang) return;
    try {
      localStorage.setItem('ajsee.lang', lang);
    } catch {}
  });

  let lastLang = detectLang(document.documentElement.lang);
  const refresh = nextLang => {
    lastLang = nextLang;
    updateMenuLinksWithLang(nextLang);
    activateNavLink();
  };

  new MutationObserver(() => {
    const lang = detectLang(document.documentElement.lang);
    if (lang !== lastLang) refresh(lang);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.addEventListener('ajsee:lang-changed', event => {
    refresh(normalizeLang(event.detail?.lang) || detectLang(document.documentElement.lang));
  });
}

export function initNav({ lang = null } = {}) {
  if (G.flags.navCoreBooted) return;
  G.flags.navCoreBooted = true;

  updateHeaderOffset();
  window.addEventListener('resize', updateHeaderOffset);
  updateMenuLinksWithLang(normalizeLang(lang) || detectLang(document.documentElement.lang));
  activateNavLink();
  initMobileMenu();
  bindLanguageChanges();
}

export { updateMenuLinksWithLang, activateNavLink };
