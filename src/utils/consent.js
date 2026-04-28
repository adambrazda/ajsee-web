const CONSENT_KEY = 'ajsee_cookie_consent_v1';

const GA4_MEASUREMENT_ID = 'G-KOZS0D9JLK';
const GTM_ID = 'GTM-T5NZVSSW';

const defaultConsent = {
  necessary: true,
  analytics: false,
  updatedAt: null,
};

function isProdHttps() {
  return (
    location.protocol === 'https:' &&
    !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(location.hostname)
  );
}

function writeDebug(payload = {}) {
  try {
    window.__AJSEE_CONSENT_DEBUG__ = {
      ...(window.__AJSEE_CONSENT_DEBUG__ || {}),
      ...payload,
      checkedAt: new Date().toISOString(),
      page: document.body?.dataset?.page || null,
      hostname: location.hostname,
      protocol: location.protocol,
    };
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

function loadScript(src, id) {
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

    const existingBySrc = document.querySelector(`script[src="${src}"]`);
    if (existingBySrc) {
      resolve(existingBySrc);
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

/**
 * Přímé GA4 měření.
 *
 * Proč:
 * - GTM je na pracovním notebooku blokovaný přes certifikát.
 * - GA4 zatím nepřijímá žádná data.
 * - Tímto odstraníme mezivrstvu GTM a ověříme čistě GA4.
 *
 * Poznámka:
 * GTM funkci níže necháváme v souboru kvůli kompatibilitě/exportu,
 * ale applyConsent() teď používá primárně přímé GA4.
 */
let ga4DirectLoaded = false;
let ga4DirectLoadingPromise = null;

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  return window.gtag;
}

function loadGA4Direct() {
  if (ga4DirectLoaded) return Promise.resolve(true);
  if (ga4DirectLoadingPromise) return ga4DirectLoadingPromise;

  if (!isProdHttps()) {
    writeDebug({
      analyticsRequested: true,
      analyticsSkipped: true,
      reason: 'not-production-https',
      source: 'direct-ga4',
    });
    return Promise.resolve(false);
  }

  const gtag = ensureGtag();

  // GA4 načítáme až po souhlasu, takže analytics_storage nastavujeme jako granted.
  // Reklamní consent necháváme denied, protože teď řešíme jen analytiku.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;

  writeDebug({
    analyticsRequested: true,
    analyticsLoading: true,
    source: 'direct-ga4',
    measurementId: GA4_MEASUREMENT_ID,
  });

  ga4DirectLoadingPromise = loadScript(src, `ajsee-ga4-${GA4_MEASUREMENT_ID}`)
    .then(() => {
      ga4DirectLoaded = true;

      gtag('js', new Date());

      // Tohle odešle standardní page_view.
      gtag('config', GA4_MEASUREMENT_ID, {
        send_page_view: true,
        page_location: location.href,
        page_path: location.pathname + location.search,
        page_title: document.title,
      });

      // Dočasný diagnostický event, ať máme v Realtime jasně viditelný signál.
      gtag('event', 'ajsee_direct_ga4_loaded', {
        source: 'consent_js',
        page_path: location.pathname,
      });

      writeDebug({
        analyticsRequested: true,
        analyticsLoaded: true,
        analyticsLoading: false,
        source: 'direct-ga4',
        measurementId: GA4_MEASUREMENT_ID,
      });

      return true;
    })
    .catch((error) => {
      ga4DirectLoaded = false;

      writeDebug({
        analyticsRequested: true,
        analyticsLoaded: false,
        analyticsLoading: false,
        source: 'direct-ga4',
        measurementId: GA4_MEASUREMENT_ID,
        error: String(error?.message || error),
      });

      return false;
    });

  return ga4DirectLoadingPromise;
}

/**
 * GTM loader necháváme kvůli kompatibilitě, ale applyConsent()
 * jej nyní nespouští automaticky. Až GA4 ověříme, můžeme se rozhodnout,
 * jestli GTM znovu zapnout pro další marketingové tagy.
 */
let gtmLoaded = false;

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

  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtm.js?id=${GTM_ID}"]`
  );

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

  return loadScript(src, `ajsee-gtm-${GTM_ID}`)
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
  if (!consent) return;

  writeDebug({
    consent,
    analyticsConsent: !!consent.analytics,
  });

  if (consent.analytics) {
    loadGA4Direct();
  }
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