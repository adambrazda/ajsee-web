// src/identity-init.js
import {
  readConsent,
  applyConsent,
} from './utils/consent.js';

/* ---------------------------------------------------------
   AJSEE – Global consent / analytics bootstrap
   ---------------------------------------------------------
   Důvod:
   Některé stránky běží přes vlastní Vite bundle, ne přes /src/main.js.
   Pokud uživatel už analytiku povolil, musíme consent aplikovat globálně,
   jinak se GTM na těchto stránkách vůbec nenačte.
--------------------------------------------------------- */

(function initGlobalConsent() {
  try {
    const consent = readConsent();

    window.__AJSEE_CONSENT_DEBUG__ = {
      ran: true,
      source: 'identity-init.js',
      page: document.body?.dataset?.page || null,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      consent,
      analyticsAllowed: !!consent?.analytics,
      checkedAt: new Date().toISOString(),
    };

    if (consent) {
      applyConsent(consent);
    }

    window.setTimeout(() => {
      window.__AJSEE_GTM_DEBUG__ = {
        source: 'identity-init.js',
        checkedAt: new Date().toISOString(),
        gtmScripts: document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]').length,
        analyticsResources: performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) =>
            url.includes('googletagmanager') ||
            url.includes('google-analytics') ||
            url.includes('/collect') ||
            url.includes('/g/collect')
          ),
      };
    }, 1200);
  } catch (error) {
    window.__AJSEE_CONSENT_DEBUG__ = {
      ran: false,
      source: 'identity-init.js',
      error: String(error),
      checkedAt: new Date().toISOString(),
    };
  }
})();

/* ---------------------------------------------------------
   Netlify Identity
--------------------------------------------------------- */

(function initIdentity() {
  const IDENTITY_WIDGET_SRC = 'https://identity.netlify.com/v1/netlify-identity-widget.js';

  const IDENTITY_TOKEN_KEYS = [
    'invite_token',
    'confirmation_token',
    'recovery_token',
    'email_change_token',
    'access_token',
  ];

  function getHashParams() {
    try {
      const rawHash = String(window.location.hash || '').replace(/^#\/?/, '');
      return new URLSearchParams(rawHash);
    } catch {
      return new URLSearchParams();
    }
  }

  function getSearchParams() {
    try {
      return new URLSearchParams(window.location.search || '');
    } catch {
      return new URLSearchParams();
    }
  }

  function hasIdentityToken() {
    const hash = getHashParams();
    const qs = getSearchParams();

    return IDENTITY_TOKEN_KEYS.some((key) => hash.has(key) || qs.has(key));
  }

  function isAdminPath() {
    return /^\/admin(?:\/|$)/.test(window.location.pathname || '');
  }

  function shouldLoadIdentityWidget() {
    if (window.netlifyIdentity) return true;
    if (isAdminPath()) return true;
    if (hasIdentityToken()) return true;

    return false;
  }

  function loadWidget() {
    return new Promise((resolve) => {
      if (window.netlifyIdentity) {
        resolve(window.netlifyIdentity);
        return;
      }

      const existing = document.querySelector(`script[src="${IDENTITY_WIDGET_SRC}"]`);

      if (existing) {
        existing.addEventListener('load', () => resolve(window.netlifyIdentity), { once: true });
        existing.addEventListener('error', () => resolve(null), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = IDENTITY_WIDGET_SRC;
      script.defer = true;
      script.async = true;
      script.onload = () => resolve(window.netlifyIdentity || null);
      script.onerror = () => resolve(null);

      document.head.appendChild(script);
    });
  }

  function openInitialIdentityFlow(identity, user) {
    if (!identity || user) return;

    if (hasIdentityToken()) {
      identity.open('signup');
      return;
    }

    if (isAdminPath()) {
      identity.open('login');
    }
  }

  function bootIdentity() {
    loadWidget().then((identity) => {
      if (!identity) return;

      identity.on('init', (user) => {
        openInitialIdentityFlow(identity, user);
      });

      identity.on('login', () => {
        window.location.assign('/admin/');
      });

      identity.on('signup', () => {
        // Netlify většinou rovnou vede na set password / confirmation flow.
      });

      identity.init();
    });
  }

  // Veřejné stránky nesmí tahat 240KB Netlify Identity widget zbytečně.
  // Widget načítáme pouze pro admin/token flow nebo při explicitním vyžádání.
  if (shouldLoadIdentityWidget()) {
    bootIdentity();
  }

  // Bezpečný veřejný hook pro případný budoucí login button.
  window.AJSEE_LOAD_IDENTITY = bootIdentity;
})();