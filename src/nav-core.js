// src/nav-core.js
// Navigace, aktivní odkaz, jazykové URL, mobilní menu, overlay, bezpečný header offset

(function ensureGlobals(){
  window.__ajsee = window.__ajsee || {};
  const g = window.__ajsee;
  g.flags = g.flags || {};
})();

const G = window.__ajsee;

// ——— helpers ———
const qs  = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));

function onHomePage() {
  return location.pathname === '/' || location.pathname.endsWith('index.html');
}

function updateHeaderOffset() {
  const header = qs('.site-header');
  const h = header ? Math.ceil(header.getBoundingClientRect().height) : 80;
  const safe = Math.max(56, h + 8);
  document.documentElement.style.setProperty('--header-offset', `${safe}px`);
}

// Aktivace aktivní položky v hlavním menu
function activateNavLink() {
  const path = window.location.pathname;
  const hash = window.location.hash || '';
  const isHomePath = (path === '/' || path.endsWith('index.html'));

  const state = {
    home:     () => isHomePath && (hash === '' || hash === '#top' || hash === '#'),
    events:   () => /\/events(\.html)?$/i.test(path),
    partners: () => /\/partners(\.html)?$/i.test(path),
    about:    () => /\/about(\.html)?$/i.test(path),
    blog:     () => /\/blog(\.html)?$/i.test(path) || (isHomePath && hash === '#blog'),
    faq:      () => /\/faq(\.html)?$/i.test(path)  || (isHomePath && hash === '#faq'),
    contact:  () => /\/contact(\.html)?$/i.test(path) || (isHomePath && hash === '#contact'),
  };

  const keyForLink = (href) => {
    if (!href) return null;
    if (href.includes('events')) return 'events';
    if (href.includes('partners')) return 'partners';
    if (href.includes('about')) return 'about';
    if (href.includes('faq')) return 'faq';
    if (href.includes('#blog') || /\/blog(\.html)?$/i.test(href)) return 'blog';
    if (href.includes('#contact') || /\/contact(\.html)?$/i.test(href)) return 'contact';
    if (href === '/' || href.includes('index.html')) return 'home';
    return null;
  };

  qsa('.main-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const key = keyForLink(href);
    const isCurrent = key ? !!state[key]() : false;

    link.classList.toggle('active', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// Přidej/normalizuj FAQ položku (kotva na homepage vs. samostatná stránka)
function ensureFaqNavLink() {
  const nav = qs('.main-nav');
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll('a'));
  const alreadyHasFaq = links.some(a => {
    const raw = (a.getAttribute('href') || '').toLowerCase();
    const h = raw.split('?')[0];
    return /(^|\/)faq(\.html)?$/.test(h) || raw.endsWith('#faq');
  });
  if (alreadyHasFaq) return;

  const proto = nav.querySelector('a[href*="contact"]') || nav.querySelector('a');

  const a = document.createElement('a');
  if (proto) a.className = proto.className;
  a.setAttribute('data-i18n-key', 'nav-faq');
  a.textContent = (window.translations?.['nav-faq']) || 'FAQ';
  a.href = onHomePage() ? `/index.html#faq` : `/faq.html`;

  const contact = nav.querySelector('a[href*="contact"], a[href$="#contact"]');
  const useList = !!nav.querySelector('li > a');
  const nodeToInsert = useList ? (()=>{ const li = document.createElement('li'); li.appendChild(a); return li; })() : a;

  const contactItem = contact?.closest('li') || contact;
  if (contactItem && contactItem.parentElement) {
    contactItem.parentElement.insertBefore(nodeToInsert, contactItem);
  } else {
    (useList ? (nav.querySelector('ul') || nav) : nav).appendChild(nodeToInsert);
  }
}

function normalizeFaqInNav(lang) {
  const nav = qs('.main-nav');
  if (!nav) return;

  const faqLinks = Array.from(nav.querySelectorAll('a')).filter(a => {
    const raw = (a.getAttribute('href') || '').toLowerCase();
    const base = raw.split('?')[0];
    return /(^|\/)faq(\.html)?$/.test(base) || raw.endsWith('#faq');
  });
  if (faqLinks.length === 0) return;

  const preferAnchor = onHomePage();
  let keep = preferAnchor
    ? faqLinks.find(a => (a.getAttribute('href') || '').toLowerCase().endsWith('#faq'))
    : faqLinks.find(a => /(^|\/)faq(\.html)?($|\?)/.test((a.getAttribute('href') || '').toLowerCase()));
  if (!keep) keep = faqLinks[0];

  keep.setAttribute('href', preferAnchor ? `/index.html?lang=${lang}#faq` : `/faq.html?lang=${lang}`);

  faqLinks.forEach(a => {
    if (a !== keep) (a.closest('li') || a).remove();
  });

  const contact = nav.querySelector('a[href*="contact"], a[href$="#contact"]');
  const keepItem = keep.closest('li') || keep;
  const contactItem = contact?.closest('li') || contact;
  if (contactItem && contactItem.parentElement && keepItem !== contactItem.previousSibling) {
    contactItem.parentElement.insertBefore(keepItem, contactItem);
  }
}

// Doplnění ?lang= do odkazů v menu (včetně #blog/#contact/#faq)
function updateMenuLinksWithLang(lang) {
  const isHome = onHomePage();
  qsa('.main-nav a').forEach((link) => {
    let href = link.getAttribute('href') || '';
    if (!href || href.startsWith('mailto:') || href.startsWith('http')) return;

    if (href.endsWith('#blog')) {
      href = `/index.html?lang=${lang}#blog`;
    } else if (href.endsWith('#contact')) {
      href = `/index.html?lang=${lang}#contact`;
    } else if (href.endsWith('#faq')) {
      href = isHome ? `/index.html?lang=${lang}#faq` : `/faq.html?lang=${lang}`;
    } else {
      href = href.replace(/\?lang=[a-z]{2}/, '').replace(/&lang=[a-z]{2}/, '');
      href = href.includes('?') ? `${href}&lang=${lang}` : `${href}?lang=${lang}`;
    }
    link.setAttribute('href', href);
  });
}

// Mobilní menu (hamburger + overlay)
function initMobileMenu() {
  const hamburger = qs('.hamburger-btn');
  const nav       = qs('.main-nav');
  const overlay   = qs('.menu-overlay-bg');
  const closeBtn  = qs('.menu-close');

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

// Inicializace celého nav stacku
export function initNav({ lang = 'cs' } = {}) {
  if (G.flags.navCoreBooted) return;
  G.flags.navCoreBooted = true;

  updateHeaderOffset();
  window.addEventListener('resize', () => updateHeaderOffset());

  ensureFaqNavLink();
  updateMenuLinksWithLang(lang);
  normalizeFaqInNav(lang);

  activateNavLink();
  window.addEventListener('hashchange', activateNavLink);

  // přesměrování pro odkazy na /events.html a /about.html s lang param
  ['events.html', 'about.html'].forEach((page) => {
    qsa(`a[href="/${page}"], a.btn-secondary[href="/${page}"]`).forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.__ajseeCloseMenu?.();
        window.location.href = `/${page}?lang=${lang}`;
      });
    });
  });

  // Home link smooth + lang přepis
  const homeLink = qs('a[data-i18n-key="nav-home"]');
  if (homeLink) {
    homeLink.addEventListener('click', async (e) => {
      e.preventDefault();
      window.__ajseeCloseMenu?.();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `/?lang=${lang}`;
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  initMobileMenu();
}

export { updateMenuLinksWithLang, activateNavLink };
