// src/partners-entry.js
// ---------------------------------------------------------
// AJSEE – lightweight entrypoint for Partners page
// ---------------------------------------------------------
// Nahrazuje globální main.js na /faq.
// Zachovává navigaci, jazyk, cookie banner a runtime styly bez events/filter logiky.

import './identity-init.js';

import {
  applyTranslations,
  detectLang,
  t,
  patchInternalLinksWithLang
} from './i18n.js';

import { initNav } from './nav-core.js';
import { initLangDropdown } from './utils/lang-dropdown.js';

import {
  initCookieBanner,
  syncCookieBannerLanguage
} from './utils/cookie-banner.js';

import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.includes(lang) ? lang : 'cs';
}

function getCurrentLang() {
  return normalizeLang(
    new URLSearchParams(window.location.search).get('lang') ||
    window.AJSEE_LANG ||
    detectLang() ||
    document.documentElement.getAttribute('lang') ||
    'cs'
  );
}

function exposeI18nHelpers() {
  window.i18n = function i18nCompat(key, fallback) {
    return t(key, fallback);
  };

  window.applyTranslations = window.applyTranslations || applyTranslations;
}

function syncLang(lang) {
  const currentLang = normalizeLang(lang);

  document.documentElement.setAttribute('lang', currentLang);
  window.AJSEE_LANG = currentLang;

  try {
    document.cookie = `aj_lang=${encodeURIComponent(currentLang)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    localStorage.setItem('ajsee.lang', currentLang);
  } catch {
    // noop
  }
}

async function bootPartnersEntry() {
  const currentLang = getCurrentLang();

  exposeI18nHelpers();
  syncLang(currentLang);

  ensureRuntimeStyles();
  updateHeaderOffset();

  try {
    initNav({ lang: currentLang });
  } catch {
    // Partners má statický header; pokud by nav-core selhal, obsah stránky zůstane funkční.
  }

  try {
    await applyTranslations(currentLang);
  } catch {
    // Partners texty má jako fallback i src/faq.js, takže i18n nesmí stránku blokovat.
  }

  try {
    patchInternalLinksWithLang(currentLang);
  } catch {
    // noop
  }

  try {
    initLangDropdown();
  } catch {
    // noop
  }

  try {
    initCookieBanner({ lang: currentLang, source: 'partners-entry' });
    syncCookieBannerLanguage(currentLang);
  } catch {
    // noop
  }

  window.addEventListener('resize', updateHeaderOffset, { passive: true });

  window.addEventListener('ajsee:lang-changed', (event) => {
    const nextLang = normalizeLang(event?.detail?.lang || getCurrentLang());

    syncLang(nextLang);

    try {
      syncCookieBannerLanguage(nextLang);
      patchInternalLinksWithLang(nextLang);
    } catch {
      // noop
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootPartnersEntry, { once: true });
} else {
  bootPartnersEntry();
}