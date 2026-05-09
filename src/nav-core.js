// src/nav-core.js
// Navigace, aktivní odkaz, jazykové URL, mobilní menu, overlay, bezpečný header offset

(function ensureGlobals(){
  window.__ajsee = window.__ajsee || {};
  const g = window.__ajsee;
  g.flags = g.flags || {};
})();

const G = window.__ajsee;

// ——— helpers ———
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const LANG_KEY = 'ajsee.lang';

/* AJSEE language URL helpers: canonical path-prefix URLs, no runtime ?lang links. */
const AJSEE_CANONICAL_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

function ajseeCanonicalLang(value) {
  const lang = String(value || '').trim().toLowerCase().slice(0, 2);
  return AJSEE_CANONICAL_LANGS.includes(lang) ? lang : 'cs';
}

function ajseePathLang(pathname = window.location.pathname) {
  const match = String(pathname || '').match(/^\/(cs|en|de|sk|pl|hu)(?:\/|$)/i);
  return match ? ajseeCanonicalLang(match[1]) : '';
}

function ajseeStripLangPrefix(pathname = '/') {
  let path = String(pathname || '/');
  path = path.replace(/^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i, '');
  if (!path) path = '/';
  if (!path.startsWith('/')) path = '/' + path;
  return path;
}

function ajseeBuildLocalizedPath(pathname = '/', lang = 'cs') {
  const targetLang = ajseeCanonicalLang(lang);
  let path = ajseeStripLangPrefix(pathname || '/');

  path = path.replace(/\/index\.html$/i, '/');
  path = path.replace(/\.html$/i, '');
  path = path.replace(/\/{2,}/g, '/');

  if (!path.startsWith('/')) path = '/' + path;
  if (path !== '/' && !path.endsWith('/')) path += '/';

  return targetLang === 'cs'
    ? path
    : '/' + targetLang + (path === '/' ? '/' : path);
}

function ajseeLocalizedUrlForLang(lang, href = window.location.href) {
  const targetLang = ajseeCanonicalLang(lang);

  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    url.searchParams.delete('hl');
    url.pathname = ajseeBuildLocalizedPath(url.pathname, targetLang);

    const search = url.searchParams.toString();
    return url.pathname + (search ? '?' + search : '') + (url.hash || '');
  } catch {
    return targetLang === 'cs' ? '/' : '/' + targetLang + '/';
  }
}

function ajseeLocalizeInternalHref(rawHref, lang) {
  if (!rawHref) return rawHref;
  if (String(rawHref).startsWith('#')) return rawHref;
  if (/^(mailto:|tel:|javascript:)/i.test(String(rawHref))) return rawHref;
  if (/^https?:\/\//i.test(String(rawHref)) && !String(rawHref).startsWith(window.location.origin)) return rawHref;

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) return rawHref;

    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    url.searchParams.delete('hl');
    url.pathname = ajseeBuildLocalizedPath(url.pathname, lang);

    const search = url.searchParams.toString();
    return url.pathname + (search ? '?' + search : '') + (url.hash || '');
  } catch {
    return rawHref;
  }
}


function normalizeLang(x) {
  const v = String(x || '').trim().toLowerCase();
  return SUPPORTED_LANGS.includes(v) ? v : null;
}

function getStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(LANG_KEY));
  } catch {
    return null;
  }
}

function detectLangSmart(fallback = 'cs') {
  const urlLang = normalizeLang(new URLSearchParams(location.search).get('lang'));
  const pathLang = ajseePathLang(location.pathname);
  return urlLang || pathLang || normalizeLang(fallback) || 'cs';
}

function persistLangOnly(lang) {
  const l = normalizeLang(lang);
  if (!l) return;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {}
}

function onHomePage() {
  return location.pathname === '/' || location.pathname.endsWith('index.html');
}

function navPathWithoutLangPrefix(rawHref = '') {
  const raw = String(rawHref || '').trim();

  if (!raw) return '';
  if (raw.startsWith('#')) return raw.toLowerCase();

  try {
    const u = new URL(raw, window.location.origin);

    if (u.origin !== window.location.origin) return '';

    let path = String(u.pathname || '/').toLowerCase();

    path = path.replace(/^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i, '');
    path = path.replace(/\/index\.html$/i, '/');
    path = path.replace(/\.html$/i, '');
    path = path.replace(/\/+$/g, '') || '/';

    return path;
  } catch {
    let path = raw.split('?')[0].split('#')[0].toLowerCase();

    path = path.replace(/^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i, '');
    path = path.replace(/\/index\.html$/i, '/');
    path = path.replace(/\.html$/i, '');
    path = path.replace(/\/+$/g, '') || '/';

    return path;
  }
}

function isFaqHref(rawHref = '') {
  const raw = String(rawHref || '').trim().toLowerCase();
  return raw.endsWith('#faq') || navPathWithoutLangPrefix(rawHref) === '/faq';
}

function isContactHref(rawHref = '') {
  const raw = String(rawHref || '').trim().toLowerCase();
  return raw.endsWith('#contact') || navPathWithoutLangPrefix(rawHref) === '/contact';
}

function updateHeaderOffset() {
  const header = qs('.site-header');
  const h = header ? Math.ceil(header.getBoundingClientRect().height) : 80;
  const safe = Math.max(56, h + 8);
  document.documentElement.style.setProperty('--header-offset', `${safe}px`);
}

function setLangOnInternalHref(rawHref, lang) {
  return ajseeLocalizeInternalHref(rawHref, lang);
}

// Aktivace aktivní položky v hlavním menu
function activateNavLink() {
  const path = window.location.pathname;
  const hash = window.location.hash || '';
  const isHomePath = (path === '/' || path.endsWith('index.html'));

  const state = {
    home:          () => isHomePath && (hash === '' || hash === '#top' || hash === '#'),
    events:        () => /\/events(\.html)?$/i.test(path),
    partners:      () => /\/partners(\.html)?$/i.test(path),
    accommodation: () => /\/accommodation(\.html)?$/i.test(path),
    about:         () => /\/about(\.html)?$/i.test(path),
    blog:          () => /\/blog(\.html)?$/i.test(path) || (isHomePath && hash === '#blog'),
    faq:           () => /\/faq(\.html)?$/i.test(path),
    contact:       () => isHomePath && hash === '#contact',
  };

  const keyForLink = (href) => {
    if (!href) return null;
    if (href.includes('events')) return 'events';
    if (href.includes('partners')) return 'partners';
    if (href.includes('accommodation')) return 'accommodation';
    if (href.includes('about')) return 'about';
    if (href.includes('faq')) return 'faq';
    if (href.includes('#blog') || /\/blog(\.html)?$/i.test(href)) return 'blog';
    if (href.includes('#contact') || /\/contact(\.html)?$/i.test(href)) return 'contact';
    if (href === '/' || href.includes('index.html')) return 'home';
    return null;
  };

  qsa('.main-nav a, [data-lang-link]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const key = keyForLink(href);
    const isCurrent = key ? !!state[key]() : false;

    link.classList.toggle('active', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// Přidej/normalizuj FAQ položku jako samostatnou stránku
function ensureFaqNavLink() {
  const nav = qs('.main-nav');
  if (!nav) return;

  // Důležité:
  // FAQ už má být ve statickém HTML / localized buildu.
  // Nevkládáme ho za běhu, protože to na /en/... stránkách způsobovalo
  // duplicitní FAQ a layout shift v menu.
  normalizeFaqInNav(detectLangSmart('cs'));
}

function normalizeFaqInNav(lang) {
  const nav = qs('.main-nav');
  if (!nav) return;

  const faqLinks = Array.from(nav.querySelectorAll('a')).filter((a) =>
    isFaqHref(a.getAttribute('href') || '')
  );

  if (faqLinks.length === 0) return;

  const keep = faqLinks[0];
  const targetHref = setLangOnInternalHref('/faq', lang);

  if (keep.getAttribute('href') !== targetHref) {
    keep.setAttribute('href', targetHref);
  }

  faqLinks.slice(1).forEach((a) => {
    (a.closest('li') || a).remove();
  });

  const contact = Array.from(nav.querySelectorAll('a')).find((a) =>
    isContactHref(a.getAttribute('href') || '') ||
    String(a.getAttribute('href') || '').toLowerCase().includes('#contact')
  );

  const keepItem = keep.closest('li') || keep;
  const contactItem = contact?.closest('li') || contact;

  const faqAlreadyBeforeContact =
    contactItem &&
    keepItem &&
    keepItem.parentElement === contactItem.parentElement &&
    keepItem.nextElementSibling === contactItem;

  if (contactItem && contactItem.parentElement && !faqAlreadyBeforeContact) {
    contactItem.parentElement.insertBefore(keepItem, contactItem);
  }
}

// Doplnění jazykového prefixu do odkazů v menu + CS bez prefixu
function updateMenuLinksWithLang(lang) {
  const l = normalizeLang(lang) || 'cs';

  qsa('.main-nav a').forEach((link) => {
    let href = link.getAttribute('href') || '';

    if (!href) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return;

    const lower = href.toLowerCase();

    if (lower.endsWith('#blog')) {
      href = '/#blog';
    } else if (lower.endsWith('#contact')) {
      href = '/#contact';
    } else if (isFaqHref(href)) {
      href = '/faq';
    }

    const nextHref = setLangOnInternalHref(href, l);

    if (link.getAttribute('href') !== nextHref) {
      link.setAttribute('href', nextHref);
    }
  });
}

// Mobilní menu (hamburger + overlay)
function initMobileMenu() {
  const hamburger = qs('.hamburger-btn');
  const nav = qs('.main-nav');
  const overlay = qs('.menu-overlay-bg');
  const closeBtn = qs('.menu-close');

  if (!hamburger || !nav || !overlay) return;

  nav.classList.remove('open');
  overlay.classList.remove('active');
  overlay.style.pointerEvents = 'none';
  overlay.style.opacity = '0';
  document.body.classList.remove('nav-open');
  document.body.style.overflow = '';

  const openMenu = () => {
    nav.classList.add('open');
    overlay.classList.add('active');
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    document.body.classList.add('nav-open');
    document.body.style.overflow = 'hidden';
    updateHeaderOffset();
  };

  const closeMenu = () => {
    nav.classList.remove('open');
    overlay.classList.remove('active');
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    document.body.classList.remove('nav-open');
    document.body.style.overflow = '';
    updateHeaderOffset();
  };

  window.__ajseeCloseMenu = closeMenu;

  hamburger.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  closeBtn?.addEventListener('click', closeMenu);
  qsa('.main-nav a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

function bindLangPersistenceAndNavRefresh() {
  if (G.flags.langWatchBound) return;
  G.flags.langWatchBound = true;

  // 1) když user klikne na .lang-btn, aspoň ulož volbu
  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.lang-btn[data-lang]');
    if (!btn) return;
    persistLangOnly(btn.dataset.lang);
  });

  // 2) když se změní <html lang>, aktualizuj menu linky
  let last = detectLangSmart('cs');
  const mo = new MutationObserver(() => {
    const cur = detectLangSmart('cs');
    if (cur === last) return;
    last = cur;

    updateMenuLinksWithLang(cur);
    normalizeFaqInNav(cur);
    activateNavLink();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // 3) pokud i18n dispatchne event, tak také
  window.addEventListener('ajsee:lang-changed', (ev) => {
    const cur = normalizeLang(ev?.detail?.lang) || detectLangSmart('cs');
    updateMenuLinksWithLang(cur);
    normalizeFaqInNav(cur);
    activateNavLink();
  });
}

// Inicializace celého nav stacku
export function initNav({ lang = null } = {}) {
  if (G.flags.navCoreBooted) return;
  G.flags.navCoreBooted = true;

  const currentLang = normalizeLang(lang) || detectLangSmart('cs');

  updateHeaderOffset();
  window.addEventListener('resize', () => updateHeaderOffset());

  ensureFaqNavLink();
  updateMenuLinksWithLang(currentLang);
  normalizeFaqInNav(currentLang);

  activateNavLink();
  window.addEventListener('hashchange', activateNavLink);

  // Home link smooth + lang přepis
  const homeLink = qs('a[data-i18n-key="nav-home"]');
  if (homeLink) {
    homeLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ajseeCloseMenu?.();

      const isHome = onHomePage();
      if (!isHome) {
        const navLang = detectLangSmart('cs');
        window.location.href = ajseeLocalizeInternalHref('/', navLang);
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Contact link – explicitní chování
  const contactLinks = qsa('a[data-i18n-key="nav-contact"]');
  contactLinks.forEach((contactLink) => {
    contactLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ajseeCloseMenu?.();

      const targetHash = '#contact';
      const isHome = onHomePage();

      if (!isHome) {
        window.location.href = (currentLang === 'cs')
          ? `/${targetHash}`
          : `/?lang=${currentLang}${targetHash}`;
        return;
      }

      const target = document.querySelector(targetHash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.hash = targetHash;
      }
    });
  });

  initMobileMenu();
  bindLangPersistenceAndNavRefresh();
}

export { updateMenuLinksWithLang, activateNavLink };