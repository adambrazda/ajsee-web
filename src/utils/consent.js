const CONSENT_KEY = 'ajsee_cookie_consent_v1';

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

function loadGTM() {
  if (gtmLoaded) return;
  if (!isProdHttps()) return;

  const existingScript = document.querySelector(
    'script[src*="googletagmanager.com/gtm.js?id=GTM-T5NZVSSW"]'
  );

  if (existingScript) {
    gtmLoaded = true;
    return;
  }

  gtmLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'gtm.js',
    'gtm.start': Date.now(),
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-T5NZVSSW';
  script.onload = () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'ajsee_consent_analytics_granted',
    });
  };

  document.head.appendChild(script);
}

function applyConsent(consent) {
  if (!consent) return;

  if (consent.analytics) {
    loadGTM();
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
};
