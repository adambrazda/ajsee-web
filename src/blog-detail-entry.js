// src/blog-detail-entry.js
// ---------------------------------------------------------
// AJSEE – lightweight entrypoint for blog detail
// ---------------------------------------------------------
// Nahrazuje globální main.js na /blog/:slug a /blog-detail.
// Cíl: ponechat základní runtime služby bez tahání events/filter logiky.

import './identity-init.js';

import {
  applyTranslations,
  detectLang,
  t,
  patchInternalLinksWithLang
} from './i18n.js';

import {
  initCookieBanner,
  syncCookieBannerLanguage
} from './utils/cookie-banner.js';

import { initLangDropdown } from './utils/lang-dropdown.js';
import { ensureRuntimeStyles, updateHeaderOffset } from './runtime-style.js';
import { initNav } from './nav-core.js';
import { initReviewEngagement } from './review-engagement.js';
import { initReviewReactions } from './review-reactions.js';

import {
  initializeArticleComments
} from './article-comments.js';

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

function normalizeCommentPostId(
  value
) {
  const postId =
    String(value || '')
      .trim()
      .toLowerCase();

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    postId
  )
    ? postId
    : '';
}

function getCommentPostIdFromPath(
  postType
) {
  const collection =
    postType === 'review'
      ? 'reviews'
      : 'blog';

  const segments =
    window.location.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(
            segment
          );
        } catch {
          return segment;
        }
      });

  const collectionIndex =
    segments.lastIndexOf(
      collection
    );

  if (
    collectionIndex < 0 ||
    collectionIndex >=
      segments.length - 1
  ) {
    return '';
  }

  return normalizeCommentPostId(
    segments[
      collectionIndex + 1
    ]
  );
}

function resolveCommentPostId(
  postType
) {
  const query =
    new URLSearchParams(
      window.location.search
    );

  const queryPostId =
    normalizeCommentPostId(
      query.get('slug') ||
      query.get('id')
    );

  if (queryPostId) {
    return queryPostId;
  }

  if (postType === 'review') {
    const reviewArticle =
      document.querySelector(
        '[data-review-slug]'
      );

    const reviewPostId =
      normalizeCommentPostId(
        reviewArticle
          ?.dataset
          ?.reviewSlug
      );

    if (reviewPostId) {
      return reviewPostId;
    }
  }

  return getCommentPostIdFromPath(
    postType
  );
}

function initializeCommentsForPage(
  language
) {
  const root =
    document.getElementById(
      'articleComments'
    );

  if (!root) {
    return;
  }

  const postType =
    document.body.dataset.page ===
    'review-detail'
      ? 'review'
      : 'blog';

  const postId =
    resolveCommentPostId(
      postType
    );

  if (!postId) {
    root.hidden =
      true;

    return;
  }

  root.hidden =
    false;

  root.dataset.articleComments =
    '';

  root.dataset.postType =
    postType;

  root.dataset.postId =
    postId;

  root.dataset.lang =
    normalizeLang(
      language
    );

  initializeArticleComments(
    root
  );
}

async function bootBlogDetailEntry() {
  const currentLang = getCurrentLang();

  exposeI18nHelpers();
  syncLang(currentLang);

  ensureRuntimeStyles();
  updateHeaderOffset();

  try {
    initNav();
  } catch {
    // Navigation must not block the article.
  }

  try {
    await applyTranslations(currentLang);
  } catch {
    // Blog detail se renderuje přes blog-detail.js, takže i18n nesmí blokovat článek.
  }

  try {
    patchInternalLinksWithLang(currentLang);
  } catch {
    // noop
  }

  try {
    initCookieBanner({ lang: currentLang, source: 'blog-detail-entry' });
    syncCookieBannerLanguage(currentLang);
  } catch {
    // noop
  }

  try {
    initLangDropdown();
  } catch {
    // Header je na blog detailu aktuálně placeholder, absence dropdownu nevadí.
  }

  try {
    initReviewEngagement();
  } catch {
    // Engagement controls must not block the article.
  }

  try {
    initReviewReactions();
  } catch {
    // Read and like controls must not block the article.
  }

  try {
    initializeCommentsForPage(
      currentLang
    );
  } catch {
    // Comments must not block the article.
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
  document.addEventListener('DOMContentLoaded', bootBlogDetailEntry, { once: true });
} else {
  bootBlogDetailEntry();
}