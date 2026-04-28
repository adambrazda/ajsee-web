const CONSENT_KEY = 'ajsee_cookie_consent_v1';
const GTM_ID = 'GTM-T5NZVSSW';

const defaultConsent = {
  necessary: true,
  analytics: false,
  updatedAt: null,
};

function isProdHttps() {
  const hostname = location.hostname || '';

  return (
    location.protocol === 'https:' &&
    !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(hostname)
  );
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

let gtmLoaded = false;

function hasExistingGTMScript() {
  return !!document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${GTM_ID}"]`);
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

function loadGTM() {
  if (gtmLoaded || hasExistingGTMScript()) {
    gtmLoaded = true;
    return true;
  }

  if (!isProdHttps()) {
    window.__AJSEE_GTM_DEBUG__ = {
      loaded: false,
      reason: 'not-prod-https',
      protocol: location.protocol,
      hostname: location.hostname,
      consent: readConsent(),
    };
    return false;
  }

  gtmLoaded = true;

  const dataLayer = ensureDataLayer();

  dataLayer.push({
    event: 'gtm.js',
    'gtm.start': Date.now(),
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;

  script.onload = () => {
    ensureDataLayer().push({
      event: 'ajsee_consent_analytics_granted',
    });

    window.__AJSEE_GTM_DEBUG__ = {
      loaded: true,
      reason: 'loaded',
      protocol: location.protocol,
      hostname: location.hostname,
      consent: readConsent(),
      gtmId: GTM_ID,
    };
  };

  script.onerror = () => {
    gtmLoaded = false;

    window.__AJSEE_GTM_DEBUG__ = {
      loaded: false,
      reason: 'script-error',
      protocol: location.protocol,
      hostname: location.hostname,
      consent: readConsent(),
      gtmId: GTM_ID,
    };
  };

  document.head.appendChild(script);

  window.__AJSEE_GTM_DEBUG__ = {
    loaded: true,
    reason: 'script-injected',
    protocol: location.protocol,
    hostname: location.hostname,
    consent: readConsent(),
    gtmId: GTM_ID,
  };

  return true;
}

function applyConsent(consent) {
  if (!consent) return;

  if (consent.analytics) {
    loadGTM();
  }
}

// Safety bootstrap:
// Když uživatel souhlas udělil dříve, GTM se načte i v případě,
// že se cookie banner z nějakého důvodu neinicializuje včas.
function bootstrapConsentOnLoad() {
  const consent = readConsent();

  if (consent?.analytics) {
    applyConsent(consent);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapConsentOnLoad, { once: true });
} else {
  bootstrapConsentOnLoad();
}

// Debug helper pro ověření v Console
window.__AJSEE_CONSENT_DEBUG__ = {
  CONSENT_KEY,
  GTM_ID,
  isProdHttps,
  readConsent,
  hasConsentDecision,
  hasAnalyticsConsent,
  loadGTM,
  applyConsent,
};

export {
  CONSENT_KEY,
  defaultConsent,
  readConsent,
  writeConsent,
  hasConsentDecision,
  hasAnalyticsConsent,
  applyConsent,
  loadGTM,
};