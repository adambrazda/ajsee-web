const CONSENT_KEY = 'ajsee_cookie_consent_v1';

const GA4_MEASUREMENT_ID = 'G-KOZS0D9JLK';
const GTM_ID = 'GTM-T5NZVSSW';

const ANALYTICS_READY_EVENT = 'ajsee_analytics_ready';

const defaultConsent = {
  necessary: true,
  analytics: false,
  updatedAt: null,
};

let ga4ScriptLoaded = false;
let ga4ScriptLoadingPromise = null;
let ga4Configured = false;
let ga4PageViewSentFor = '';
let gtmLoaded = false;

function isProdHttps() {
  return (
    location.protocol === 'https:' &&
    !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(location.hostname)
  );
}

function writeDebug(payload = {}) {
  const debugPayload = {
    ...(window.__AJSEE_ANALYTICS_DEBUG__ || {}),
    ...(window.__AJSEE_CONSENT_DEBUG__ || {}),
    ...payload,
    checkedAt: new Date().toISOString(),
    page: document.body?.dataset?.page || null,
    hostname: location.hostname,
    href: location.href,
    protocol: location.protocol,
    measurementId: GA4_MEASUREMENT_ID,
  };

  try {
    window.__AJSEE_ANALYTICS_DEBUG__ = debugPayload;
    window.__AJSEE_CONSENT_DEBUG__ = debugPayload;
  } catch {
    // noop
  }
}

function readConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      ...defaultConsent,
      ...parsed,
      necessary: true,
    };
  } catch {
    return null;
  }
}

function writeConsent(consent) {
  const payload = {
    ...defaultConsent,
    ...consent,
    necessary: true,
    analytics: !!consent?.analytics,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  } catch {
    // noop
  }

  return payload;
}

function hasConsentDecision() {
  return !!readConsent();
}

function hasAnalyticsConsent() {
  const consent = readConsent();
  return !!consent?.analytics;
}

function ensureDataLayerAndGtag() {
  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  return window.gtag;
}

function setGoogleConsentGranted() {
  const gtag = ensureDataLayerAndGtag();

  // Reklamní režimy necháváme vypnuté. Řešíme pouze analytiku.
  const consentSettings = {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  };

  // Default + update kvůli jistotě při dynamickém načtení po souhlasu.
  gtag('consent', 'default', consentSettings);
  gtag('consent', 'update', consentSettings);

  writeDebug({
    googleConsentUpdated: true,
    analyticsStorage: 'granted',
    adStorage: 'denied',
  });
}

function getExistingScriptByContains(partialSrc) {
  return Array.from(document.scripts || []).find((script) =>
    String(script.src || '').includes(partialSrc)
  );
}

function loadScript(src, id, containsCheck) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Missing script src'));
      return;
    }

    const existingById = id ? document.getElementById(id) : null;
    if (existingById) {
      resolve(existingById);
      return;
    }

    const existingByContains = containsCheck ? getExistingScriptByContains(containsCheck) : null;
    if (existingByContains) {
      resolve(existingByContains);
      return;
    }

    const script = document.createElement('script');
    if (id) script.id = id;
    script.async = true;
    script.src = src;

    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.head.appendChild(script);
  });
}

function sendGA4PageView() {
  const gtag = ensureDataLayerAndGtag();

  const pageKey = `${location.pathname}${location.search}`;
  if (ga4PageViewSentFor === pageKey) return;

  ga4PageViewSentFor = pageKey;

  gtag('event', 'page_view', {
    page_title: document.title,
    page_location: location.href,
    page_path: location.pathname + location.search,
    send_to: GA4_MEASUREMENT_ID,
  });

  writeDebug({
    pageViewSent: true,
    pageViewSentFor: pageKey,
  });
}

function sendGA4ReadyEvent() {
  const gtag = ensureDataLayerAndGtag();

  gtag('event', ANALYTICS_READY_EVENT, {
    source: 'consent_js_direct_ga4',
    page_title: document.title,
    page_location: location.href,
    page_path: location.pathname + location.search,
    debug_mode: true,
    send_to: GA4_MEASUREMENT_ID,
  });

  writeDebug({
    readyEventSent: true,
    readyEventName: ANALYTICS_READY_EVENT,
  });
}

function configureGA4() {
  const gtag = ensureDataLayerAndGtag();

  if (!ga4Configured) {
    gtag('js', new Date());

    // Page view posíláme ručně níže, aby bylo jasné, kdy a co odchází.
    gtag('config', GA4_MEASUREMENT_ID, {
      send_page_view: false,
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname + location.search,
    });

    ga4Configured = true;
  }

  sendGA4PageView();
  sendGA4ReadyEvent();

  try {
    window.dispatchEvent(new CustomEvent('ajsee:analytics-ready', {
      detail: {
        measurementId: GA4_MEASUREMENT_ID,
        eventName: ANALYTICS_READY_EVENT,
      },
    }));
  } catch {
    // noop
  }
}

function loadGA4Direct() {
  if (!isProdHttps()) {
    writeDebug({
      analyticsRequested: true,
      analyticsSkipped: true,
      reason: 'not-production-https',
      source: 'direct-ga4',
    });

    return Promise.resolve(false);
  }

  setGoogleConsentGranted();

  if (ga4ScriptLoaded) {
    configureGA4();

    writeDebug({
      analyticsRequested: true,
      analyticsLoaded: true,
      analyticsAlreadyLoaded: true,
      source: 'direct-ga4',
    });

    return Promise.resolve(true);
  }

  if (ga4ScriptLoadingPromise) return ga4ScriptLoadingPromise;

  const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;

  writeDebug({
    analyticsRequested: true,
    analyticsLoading: true,
    source: 'direct-ga4',
    scriptSrc: src,
  });

  ga4ScriptLoadingPromise = loadScript(
    src,
    `ajsee-ga4-${GA4_MEASUREMENT_ID}`,
    `googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`
  )
    .then(() => {
      ga4ScriptLoaded = true;

      configureGA4();

      writeDebug({
        analyticsRequested: true,
        analyticsLoaded: true,
        analyticsLoading: false,
        source: 'direct-ga4',
      });

      return true;
    })
    .catch((error) => {
      ga4ScriptLoaded = false;
      ga4ScriptLoadingPromise = null;

      writeDebug({
        analyticsRequested: true,
        analyticsLoaded: false,
        analyticsLoading: false,
        source: 'direct-ga4',
        error: String(error?.message || error),
      });

      return false;
    });

  return ga4ScriptLoadingPromise;
}

/**
 * GTM loader necháváme kvůli kompatibilitě a budoucím marketingovým tagům.
 * Základní GA4 měření teď ale řešíme přímo přes loadGA4Direct().
 */
function loadGTM() {
  if (gtmLoaded) return Promise.resolve(true);

  if (!isProdHttps()) {
    writeDebug({
      gtmRequested: true,
      gtmSkipped: true,
      reason: 'not-production-https',
      source: 'gtm',
    });

    return Promise.resolve(false);
  }

  const existingScript = getExistingScriptByContains(`googletagmanager.com/gtm.js?id=${GTM_ID}`);

  if (existingScript) {
    gtmLoaded = true;

    writeDebug({
      gtmRequested: true,
      gtmLoaded: true,
      source: 'gtm-existing-script',
      gtmId: GTM_ID,
    });

    return Promise.resolve(true);
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'gtm.js',
    'gtm.start': Date.now(),
  });

  const src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;

  writeDebug({
    gtmRequested: true,
    gtmLoading: true,
    source: 'gtm',
    gtmId: GTM_ID,
  });

  return loadScript(src, `ajsee-gtm-${GTM_ID}`, `googletagmanager.com/gtm.js?id=${GTM_ID}`)
    .then(() => {
      gtmLoaded = true;

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'ajsee_consent_analytics_granted',
      });

      writeDebug({
        gtmRequested: true,
        gtmLoaded: true,
        gtmLoading: false,
        source: 'gtm',
        gtmId: GTM_ID,
      });

      return true;
    })
    .catch((error) => {
      gtmLoaded = false;

      writeDebug({
        gtmRequested: true,
        gtmLoaded: false,
        gtmLoading: false,
        source: 'gtm',
        gtmId: GTM_ID,
        error: String(error?.message || error),
      });

      return false;
    });
}

function applyConsent(consent) {
  if (!consent) {
    writeDebug({
      analyticsConsent: false,
      reason: 'missing-consent',
    });

    return;
  }

  writeDebug({
    consent,
    analyticsConsent: !!consent.analytics,
  });

  if (consent.analytics) {
    loadGA4Direct();
  }
}

// Ruční diagnostika z konzole, kdyby bylo potřeba.
try {
  window.ajseeLoadGA4Direct = loadGA4Direct;
  window.ajseeReadConsent = readConsent;
} catch {
  // noop
}

export {
  CONSENT_KEY,
  defaultConsent,
  readConsent,
  writeConsent,
  hasConsentDecision,
  hasAnalyticsConsent,
  applyConsent,
  loadGTM,
  loadGA4Direct,
};