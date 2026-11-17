import { GA4_MEASUREMENT_ID } from '../utils/analytics-config.js';

const EVENT_NAME =
  'ai_event_search_result';

const SUPPORTED_LOCALES =
  new Set([
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]);

const SUPPORTED_OUTCOMES =
  new Set([
    'success',
    'partial',
    'clarification',
    'guidance',
    'error',
    'manual'
  ]);

function normalizeLocale(value) {
  const locale =
    String(value || '')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

  return SUPPORTED_LOCALES.has(
    locale
  )
    ? locale
    : 'unknown';
}

function normalizeOutcome(value) {
  const outcome =
    String(value || '')
      .trim()
      .toLowerCase();

  return SUPPORTED_OUTCOMES.has(
    outcome
  )
    ? outcome
    : 'error';
}

function normalizePagePath(value) {
  const path =
    String(value || '')
      .split(/[?#]/)[0]
      .trim();

  /*
   * AI Search currently exists only
   * on homepage and /events.
   *
   * Keep analytics deliberately
   * coarse so user-entered content
   * can never leak through a URL.
   */
  return /^\/(?:(?:en|de|sk|pl|hu)\/)?events(?:\.html)?\/?$/.test(path)
    ? '/events'
    : '/';
}

function normalizeInteger(
  value,
  {
    min = 0,
    max = Number.MAX_SAFE_INTEGER
  } = {}
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return min;
  }

  return Math.min(
    max,
    Math.max(
      min,
      Math.round(number)
    )
  );
}

function normalizeHttpStatus(
  value
) {
  const status =
    normalizeInteger(
      value,
      {
        min:
          0,
        max:
          599
      }
    );

  return status >= 100
    ? status
    : 0;
}

function normalizeErrorCode(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        64
      );

  return normalized ||
    'none';
}

export function buildAiSearchAnalyticsPayload({
  outcome = '',
  locale = '',
  pagePath = '/',
  durationMs = 0,
  httpStatus = 0,
  errorCode = '',
  clarificationRound = 0
} = {}) {
  return {
    event:
      EVENT_NAME,

    source:
      'ai_event_search',

    page_path:
      normalizePagePath(
        pagePath
      ),

    locale:
      normalizeLocale(
        locale
      ),

    outcome:
      normalizeOutcome(
        outcome
      ),

    duration_ms:
      normalizeInteger(
        durationMs,
        {
          min:
            0,

          max:
            120_000
        }
      ),

    http_status:
      normalizeHttpStatus(
        httpStatus
      ),

    error_code:
      normalizeErrorCode(
        errorCode
      ),

    clarification_round:
      normalizeInteger(
        clarificationRound,
        {
          min:
            0,

          max:
            10
        }
      )
  };
}

export function trackAiSearchOutcome(
  context = {},
  target = globalThis,
  {
    pushToDataLayer = true
  } = {}
) {
  const payload =
    buildAiSearchAnalyticsPayload({
      ...context,

      pagePath:
        context.pagePath ??
        target?.location?.pathname ??
        '/'
    });

  if (
    pushToDataLayer
  ) {
    try {
      target.dataLayer =
        target.dataLayer ||
        [];

      target.dataLayer.push(
        payload
      );
    } catch {
      /* noop */
    }
  }

  try {
    target.__ajsee =
      target.__ajsee ||
      {};

    target.__ajsee
      .lastAiSearchEvent =
      payload;
  } catch {
    /* noop */
  }

  return payload;
}

const STEP_EVENTS = {
  start: 'ai_event_search_start',
  challenge: 'ai_event_search_challenge',
  fallback: 'ai_event_search_fallback'
};

const FALLBACK_REASONS = new Set([
  'manual', 'verification-timeout', 'verification-error', 'service-timeout', 'service-error'
]);

// Use the same direct GA4 route as the site's other consent-gated diagnostics.
export function trackAiSearchStep(step, { locale, reason } = {}, target = globalThis) {
  if (!Object.hasOwn(STEP_EVENTS, step) || typeof target.gtag !== 'function') return;
  const pagePath = normalizePagePath(target.location?.pathname);
  try {
    target.gtag('event', STEP_EVENTS[step], {
      page_path: pagePath,
      page_location: (target.location?.origin || '') + pagePath,
      locale: normalizeLocale(locale),
      ...(step === 'fallback' && FALLBACK_REASONS.has(reason) ? { fallback_reason: reason } : {}),
      send_to: GA4_MEASUREMENT_ID
    });
  } catch {
    // Analytics must never affect the search.
  }
}
