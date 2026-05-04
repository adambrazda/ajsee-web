// /src/blog-entry.js
// ---------------------------------------------------------
// AJSEE – Blog page entry
// Lightweight entry for /blog without global main.js.
// Keeps: i18n, nav, language dropdown, cookie banner, blog cards.
// ---------------------------------------------------------

import './identity-init.js';
import './styles/pages/blog-page.scss';

import { applyTranslations, detectLang } from './i18n.js';
import { initNav } from './nav-core.js';
import { initLangDropdown } from './utils/lang-dropdown.js';
import { initCookieBanner, syncCookieBannerLanguage } from './utils/cookie-banner.js';
import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';

// Blog listing renderer – articles + micro-guides
import './blog.js';

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const DEFAULT_LANG = 'cs';

function normalizeLang(value) {
  let lang = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  if (lang === 'cz') lang = 'cs';
  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

function currentLang() {
  return normalizeLang(detectLang?.() || document.documentElement.getAttribute('lang') || DEFAULT_LANG);
}

function bindResizeOffset() {
  if (window.__ajseeBlogResizeBound) return;
  window.__ajseeBlogResizeBound = true;

  window.addEventListener('resize', () => {
    updateHeaderOffset();
  }, { passive: true });
}

function bindCookieLanguageSync() {
  if (window.__ajseeBlogCookieLangBound) return;
  window.__ajseeBlogCookieLangBound = true;

  const sync = (event) => {
    const lang = normalizeLang(event?.detail?.lang || document.documentElement.getAttribute('lang') || currentLang());
    syncCookieBannerLanguage(lang);
  };

  window.addEventListener('AJSEE:langChanged', sync);
  window.addEventListener('ajsee:lang-changed', sync);
}

async function initBlogPage() {
  if (document.body?.dataset?.page !== 'blog') return;

  ensureRuntimeStyles();

  const lang = currentLang();
  document.documentElement.setAttribute('lang', lang);

  try {
    await applyTranslations(lang);
  } catch {
    // Blog cards mají vlastní fallback texty; stránka kvůli i18n nesmí spadnout.
  }

  initNav({ lang });
  initLangDropdown();

  initCookieBanner({
    lang,
    source: 'blog-entry',
  });

  syncCookieBannerLanguage(lang);

  updateHeaderOffset();
  bindResizeOffset();
  bindCookieLanguageSync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlogPage, { once: true });
} else {
  void initBlogPage();
}