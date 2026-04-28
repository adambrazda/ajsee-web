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
  // 1) Načti widget, pokud ještě není
  function loadWidget() {
    return new Promise((resolve) => {
      if (window.netlifyIdentity) return resolve(window.netlifyIdentity);

      const s = document.createElement('script');
      s.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
      s.defer = true;
      s.onload = () => resolve(window.netlifyIdentity);
      document.head.appendChild(s);
    });
  }

  // 2) Otevři modal ze „zvu“ odkazu (#invite_token)
  function hasInviteToken() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const qs = new URLSearchParams(location.search);

    return hash.get('invite_token') || qs.get('invite_token');
  }

  loadWidget().then((id) => {
    if (!id) return;

    // Po initu: pokud nejsem přihlášen a mám invite token → otevři „Sign up“
    id.on('init', (user) => {
      if (!user && hasInviteToken()) id.open('signup');

      // Admin kvalita života: jdu-li přímo na /admin a nejsem přihlášen → otevři login
      if (!user && /^\/admin\/?$/.test(location.pathname)) id.open('login');
    });

    // Po loginu/přihlášení přesměruj do /admin
    id.on('login', () => {
      window.location.assign('/admin/');
    });

    id.on('signup', () => {
      // Netlify většinou rovnou vede na set password
    });

    // Spusť widget (vyvolá 'init')
    id.init();
  });
})();