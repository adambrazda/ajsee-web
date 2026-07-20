// src/review-reactions.js

const API_URL = '/api/review-engagement';
const VISITOR_STORAGE_KEY = 'ajsee.review.visitor.v1';
const READ_STORAGE_PREFIX = 'ajsee.review.read.v1:';

const QUALIFIED_ACTIVE_MS = 30_000;
const QUALIFIED_PROGRESS = 0.5;
const REQUEST_TIMEOUT_MS = 8_000;
const READ_RETRY_DELAY_MS = 15_000;

const SUPPORTED_LANGS = [
  'cs',
  'en',
  'de',
  'sk',
  'pl',
  'hu'
];

const LOCALES = {
  cs: 'cs-CZ',
  en: 'en-GB',
  de: 'de-DE',
  sk: 'sk-SK',
  pl: 'pl-PL',
  hu: 'hu-HU'
};

const TEXT = {
  cs: {
    statsLabel: 'Aktivita u recenze',
    loading: 'Načítání reakcí',
    unavailable:
      'Počty přečtení a reakcí nyní nejsou dostupné.',
    like: 'To se mi líbí',
    liked: 'Líbí se mi',
    likeAria: 'Označit recenzi jako oblíbenou',
    unlikeAria: 'Odebrat označení To se mi líbí',
    likeSaved: 'Reakce byla uložena.',
    unlikeSaved: 'Reakce byla odebrána.',
    likeFailed: 'Reakci se nepodařilo uložit.'
  },

  en: {
    statsLabel: 'Review activity',
    loading: 'Loading reactions',
    unavailable:
      'Read and reaction counts are currently unavailable.',
    like: 'Like',
    liked: 'Liked',
    likeAria: 'Like this review',
    unlikeAria: 'Remove your like from this review',
    likeSaved: 'Your reaction was saved.',
    unlikeSaved: 'Your reaction was removed.',
    likeFailed: 'Your reaction could not be saved.'
  },

  de: {
    statsLabel: 'Aktivität zur Rezension',
    loading: 'Reaktionen werden geladen',
    unavailable:
      'Aufrufe und Reaktionen sind derzeit nicht verfügbar.',
    like: 'Gefällt mir',
    liked: 'Gefällt mir',
    likeAria: 'Diese Rezension mit Gefällt mir markieren',
    unlikeAria:
      'Gefällt mir von dieser Rezension entfernen',
    likeSaved: 'Ihre Reaktion wurde gespeichert.',
    unlikeSaved: 'Ihre Reaktion wurde entfernt.',
    likeFailed:
      'Ihre Reaktion konnte nicht gespeichert werden.'
  },

  sk: {
    statsLabel: 'Aktivita pri recenzii',
    loading: 'Načítavajú sa reakcie',
    unavailable:
      'Počty prečítaní a reakcií momentálne nie sú dostupné.',
    like: 'Páči sa mi',
    liked: 'Páči sa mi',
    likeAria: 'Označiť recenziu ako obľúbenú',
    unlikeAria: 'Odobrať označenie Páči sa mi',
    likeSaved: 'Reakcia bola uložená.',
    unlikeSaved: 'Reakcia bola odobratá.',
    likeFailed: 'Reakciu sa nepodarilo uložiť.'
  },

  pl: {
    statsLabel: 'Aktywność przy recenzji',
    loading: 'Wczytywanie reakcji',
    unavailable:
      'Liczba odczytów i reakcji jest obecnie niedostępna.',
    like: 'Lubię to',
    liked: 'Lubię to',
    likeAria: 'Polub tę recenzję',
    unlikeAria: 'Usuń polubienie tej recenzji',
    likeSaved: 'Reakcja została zapisana.',
    unlikeSaved: 'Reakcja została usunięta.',
    likeFailed: 'Nie udało się zapisać reakcji.'
  },

  hu: {
    statsLabel: 'A kritika aktivitása',
    loading: 'Reakciók betöltése',
    unavailable:
      'Az olvasási és reakciószám jelenleg nem érhető el.',
    like: 'Tetszik',
    liked: 'Tetszik',
    likeAria: 'A kritika kedvelése',
    unlikeAria: 'A kedvelés eltávolítása',
    likeSaved: 'A reakció mentve.',
    unlikeSaved: 'A reakció eltávolítva.',
    likeFailed: 'A reakció mentése nem sikerült.'
  }
};

const statusTimers = new WeakMap();

function normalizeLang(value = '') {
  const lang = String(value)
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return SUPPORTED_LANGS.includes(lang)
    ? lang
    : 'cs';
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function isValidVisitorId(value = '') {
  return (
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function createVisitorId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return (
      'rv_' +
      window.crypto.randomUUID().replace(/-/g, '')
    );
  }

  if (
    window.crypto &&
    typeof window.crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(18);

    window.crypto.getRandomValues(bytes);

    return (
      'rv_' +
      Array.from(bytes)
        .map(value =>
          value.toString(16).padStart(2, '0')
        )
        .join('')
    );
  }

  return (
    'rv_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 16)
  );
}

function getOrCreateVisitorId() {
  const existing = String(
    readStorage(VISITOR_STORAGE_KEY) || ''
  ).trim();

  if (isValidVisitorId(existing)) {
    return existing;
  }

  const visitorId = createVisitorId();

  writeStorage(
    VISITOR_STORAGE_KEY,
    visitorId
  );

  return visitorId;
}

function formatNumber(language, value) {
  const number = Math.max(
    0,
    Number.parseInt(value, 10) || 0
  );

  try {
    return new Intl.NumberFormat(
      LOCALES[language] || LOCALES.cs
    ).format(number);
  } catch {
    return String(number);
  }
}

function formatReadCount(language, value) {
  const count = Math.max(
    0,
    Number.parseInt(value, 10) || 0
  );

  const number = formatNumber(language, count);

  if (language === 'en') {
    return count === 1
      ? `${number} read`
      : `${number} reads`;
  }

  if (language === 'de') {
    return count === 1
      ? `${number} Aufruf`
      : `${number} Aufrufe`;
  }

  if (language === 'sk') {
    if (count === 1) {
      return `${number} prečítanie`;
    }

    const last = count % 10;
    const lastTwo = count % 100;

    if (
      last >= 2 &&
      last <= 4 &&
      (lastTwo < 12 || lastTwo > 14)
    ) {
      return `${number} prečítania`;
    }

    return `${number} prečítaní`;
  }

  if (language === 'pl') {
    if (count === 1) {
      return `${number} odczyt`;
    }

    const last = count % 10;
    const lastTwo = count % 100;

    if (
      last >= 2 &&
      last <= 4 &&
      (lastTwo < 12 || lastTwo > 14)
    ) {
      return `${number} odczyty`;
    }

    return `${number} odczytów`;
  }

  if (language === 'hu') {
    return `${number} olvasás`;
  }

  return `${number} přečtení`;
}

function normalizeState(value, slug) {
  return {
    slug,

    likes: Math.max(
      0,
      Number.parseInt(value?.likes, 10) || 0
    ),

    qualifiedReads: Math.max(
      0,
      Number.parseInt(
        value?.qualifiedReads,
        10
      ) || 0
    ),

    likedByVisitor:
      value?.likedByVisitor === true
  };
}

async function requestJson(
  url,
  options = {}
) {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const headers = new Headers(
    options.headers || {}
  );

  headers.set('Accept', 'application/json');

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error ||
        `Request failed with ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchState({
  slug,
  visitorId
}) {
  const url = new URL(
    API_URL,
    window.location.origin
  );

  url.searchParams.set('slug', slug);

  return requestJson(url.toString(), {
    method: 'GET',

    headers: {
      'X-AJSEE-Visitor-ID': visitorId
    }
  });
}

async function postAction({
  slug,
  visitorId,
  action,
  keepalive = false
}) {
  return requestJson(API_URL, {
    method: 'POST',
    keepalive,

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      slug,
      visitorId,
      action
    })
  });
}

function trackEvent(
  eventName,
  values = {}
) {
  const payload = {
    event: eventName,
    ...values,

    page_path:
      window.location.pathname +
      window.location.search,

    page_location: window.location.href,
    ts: new Date().toISOString()
  };

  try {
    window.dataLayer =
      window.dataLayer || [];

    window.dataLayer.push(payload);
  } catch {
    // Analytics must not block the UI.
  }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag(
        'event',
        eventName,
        values
      );
    }
  } catch {
    // Analytics must not block the UI.
  }
}

function announce(
  panel,
  message,
  isError = false
) {
  const status = panel.querySelector(
    '.review-engagement__status'
  );

  if (!status) {
    return;
  }

  const previousTimer =
    statusTimers.get(panel);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  status.textContent = message;

  status.classList.toggle(
    'is-error',
    Boolean(isError)
  );

  status.classList.add('is-visible');

  const timer = window.setTimeout(() => {
    if (status.textContent === message) {
      status.classList.remove('is-visible');
    }
  }, 3_500);

  statusTimers.set(panel, timer);
}

function eyeIcon() {
  return [
    '<svg viewBox="0 0 24 24"',
    ' class="review-engagement__metric-icon"',
    ' aria-hidden="true">',
    '<path d="M12 5c-5.5 0-9.5 5.2-9.7 5.4',
    'a1 1 0 0 0 0 1.2C2.5 11.8 6.5 17',
    ' 12 17s9.5-5.2 9.7-5.4a1 1 0 0 0',
    ' 0-1.2C21.5 10.2 17.5 5 12 5Zm0',
    ' 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>',
    '</svg>'
  ].join('');
}

function heartIcon() {
  return [
    '<svg viewBox="0 0 24 24"',
    ' class="review-engagement__heart"',
    ' aria-hidden="true">',
    '<path d="M12 20.4 4.2 13A5.2 5.2 0',
    ' 0 1 11.6 5.7L12 6l.4-.3A5.2 5.2',
    ' 0 0 1 19.8 13L12 20.4Z"/>',
    '</svg>'
  ].join('');
}

function initQualifiedRead({
  article,
  slug,
  visitorId,
  language,
  applyState
}) {
  const storageKey =
    READ_STORAGE_PREFIX + slug;

  if (readStorage(storageKey) === '1') {
    return;
  }

  const content =
    article.querySelector('.review-content') ||
    article;

  let activeMs = 0;
  let reachedHalf = false;
  let inFlight = false;
  let completed = false;
  let lastAttemptAt = 0;

  function checkProgress() {
    if (reachedHalf || completed) {
      return;
    }

    const rect = content.getBoundingClientRect();

    const threshold =
      window.scrollY +
      rect.top +
      Math.max(rect.height, 1) *
        QUALIFIED_PROGRESS;

    const viewportBottom =
      window.scrollY +
      window.innerHeight;

    reachedHalf =
      viewportBottom >= threshold;
  }

  async function submitRead() {
    if (
      completed ||
      inFlight ||
      !reachedHalf ||
      activeMs < QUALIFIED_ACTIVE_MS
    ) {
      return;
    }

    const now = Date.now();

    if (
      now - lastAttemptAt <
      READ_RETRY_DELAY_MS
    ) {
      return;
    }

    inFlight = true;
    lastAttemptAt = now;

    try {
      const response = await postAction({
        slug,
        visitorId,
        action: 'qualified_read',
        keepalive: true
      });

      completed = true;

      writeStorage(storageKey, '1');
      applyState(response);

      trackEvent(
        'review_qualified_read',
        {
          review_slug: slug,
          language,
          modified:
            response?.modified === true,
          active_seconds:
            Math.round(activeMs / 1000),
          progress_threshold:
            QUALIFIED_PROGRESS
        }
      );

      cleanup();
    } catch {
      inFlight = false;
    }
  }

  function tick() {
    if (completed) {
      return;
    }

    if (
      document.visibilityState ===
      'visible'
    ) {
      activeMs += 1_000;
    }

    checkProgress();
    submitRead();
  }

  function cleanup() {
    window.clearInterval(intervalId);

    window.removeEventListener(
      'scroll',
      checkProgress
    );

    window.removeEventListener(
      'resize',
      checkProgress
    );
  }

  const intervalId = window.setInterval(
    tick,
    1_000
  );

  window.addEventListener(
    'scroll',
    checkProgress,
    { passive: true }
  );

  window.addEventListener(
    'resize',
    checkProgress,
    { passive: true }
  );

  window.addEventListener(
    'pagehide',
    cleanup,
    { once: true }
  );

  checkProgress();
}

export function initReviewReactions() {
  const article = document.querySelector(
    '.review-detail[data-review-slug]'
  );

  if (!article) {
    return null;
  }

  if (
    article.dataset.reviewReactionsReady ===
    'true'
  ) {
    return article.querySelector(
      '.review-engagement__button--like'
    );
  }

  const panel = article.querySelector(
    '.review-engagement'
  );

  const content = panel?.querySelector(
    '.review-engagement__content'
  );

  const actions = panel?.querySelector(
    '.review-engagement__actions'
  );

  if (!panel || !content || !actions) {
    return null;
  }

  const slug = String(
    article.dataset.reviewSlug || ''
  ).trim();

  if (!slug) {
    return null;
  }

  const language = normalizeLang(
    document.documentElement.lang ||
    window.AJSEE_LANG ||
    'cs'
  );

  const text = TEXT[language] || TEXT.cs;
  const visitorId = getOrCreateVisitorId();

  let currentState = null;
  let requestPending = false;

  const metrics =
    document.createElement('div');

  metrics.className =
    'review-engagement__metrics';

  metrics.setAttribute('role', 'group');

  metrics.setAttribute(
    'aria-label',
    text.statsLabel
  );

  const readMetric =
    document.createElement('span');

  readMetric.className =
    'review-engagement__read-metric';

  readMetric.setAttribute(
    'aria-live',
    'polite'
  );

  readMetric.setAttribute(
    'aria-busy',
    'true'
  );

  readMetric.setAttribute(
    'aria-label',
    text.loading
  );

  const readCount =
    document.createElement('span');

  readCount.className =
    'review-engagement__read-count is-loading';

  readCount.textContent = '...';

  readMetric.innerHTML = eyeIcon();
  readMetric.appendChild(readCount);

  metrics.appendChild(readMetric);
  content.appendChild(metrics);

  const likeButton =
    document.createElement('button');

  likeButton.type = 'button';

  likeButton.className =
    'review-engagement__button ' +
    'review-engagement__button--like ' +
    'is-loading';

  likeButton.disabled = true;

  likeButton.setAttribute(
    'aria-busy',
    'true'
  );

  likeButton.setAttribute(
    'aria-pressed',
    'false'
  );

  likeButton.setAttribute(
    'aria-label',
    text.loading
  );

  likeButton.innerHTML = [
    heartIcon(),
    '<span class="review-engagement__like-label">',
    text.like,
    '</span>',
    '<span class="review-engagement__like-count"',
    ' aria-hidden="true">...</span>'
  ].join('');

  actions.insertBefore(
    likeButton,
    actions.firstChild
  );

  const likeLabel =
    likeButton.querySelector(
      '.review-engagement__like-label'
    );

  const likeCount =
    likeButton.querySelector(
      '.review-engagement__like-count'
    );

  function applyState(rawState) {
    const state = normalizeState(
      rawState,
      slug
    );

    currentState = state;

    const readsText = formatReadCount(
      language,
      state.qualifiedReads
    );

    readCount.textContent = readsText;

    readCount.classList.remove(
      'is-loading'
    );

    readMetric.removeAttribute(
      'aria-busy'
    );

    readMetric.setAttribute(
      'aria-label',
      readsText
    );

    likeCount.textContent = formatNumber(
      language,
      state.likes
    );

    likeCount.classList.remove(
      'is-loading'
    );

    likeLabel.textContent =
      state.likedByVisitor
        ? text.liked
        : text.like;

    likeButton.classList.remove(
      'is-loading',
      'is-unavailable'
    );

    likeButton.classList.toggle(
      'is-liked',
      state.likedByVisitor
    );

    likeButton.setAttribute(
      'aria-pressed',
      String(state.likedByVisitor)
    );

    likeButton.setAttribute(
      'aria-label',
      state.likedByVisitor
        ? text.unlikeAria
        : text.likeAria
    );

    likeButton.removeAttribute(
      'aria-busy'
    );

    likeButton.disabled = requestPending;
  }

  function showUnavailable() {
    readCount.textContent = '—';

    readCount.classList.remove(
      'is-loading'
    );

    readMetric.removeAttribute(
      'aria-busy'
    );

    readMetric.setAttribute(
      'aria-label',
      text.unavailable
    );

    likeCount.textContent = '—';

    likeCount.classList.remove(
      'is-loading'
    );

    likeButton.classList.remove(
      'is-loading'
    );

    likeButton.classList.add(
      'is-unavailable'
    );

    likeButton.removeAttribute(
      'aria-busy'
    );

    likeButton.disabled = true;

    likeButton.setAttribute(
      'aria-label',
      text.unavailable
    );

    announce(
      panel,
      text.unavailable,
      true
    );
  }

  likeButton.addEventListener(
    'click',
    async () => {
      if (!currentState || requestPending) {
        return;
      }

      const action =
        currentState.likedByVisitor
          ? 'unlike'
          : 'like';

      requestPending = true;
      likeButton.disabled = true;

      likeButton.setAttribute(
        'aria-busy',
        'true'
      );

      try {
        const response = await postAction({
          slug,
          visitorId,
          action
        });

        applyState(response);

        announce(
          panel,
          action === 'like'
            ? text.likeSaved
            : text.unlikeSaved
        );

        trackEvent(
          'review_like_toggle',
          {
            review_slug: slug,
            language,
            action,
            result: 'success',
            likes:
              Number.parseInt(
                response?.likes,
                10
              ) || 0
          }
        );
      } catch {
        announce(
          panel,
          text.likeFailed,
          true
        );

        trackEvent(
          'review_like_toggle',
          {
            review_slug: slug,
            language,
            action,
            result: 'error'
          }
        );
      } finally {
        requestPending = false;

        likeButton.removeAttribute(
          'aria-busy'
        );

        likeButton.disabled =
          !currentState;
      }
    }
  );

  fetchState({
    slug,
    visitorId
  })
    .then(applyState)
    .catch(showUnavailable);

  initQualifiedRead({
    article,
    slug,
    visitorId,
    language,
    applyState
  });

  article.dataset.reviewReactionsReady =
    'true';

  return likeButton;
}