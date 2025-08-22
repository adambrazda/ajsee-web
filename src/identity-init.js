// src/identity-init.js
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
    const qs   = new URLSearchParams(location.search);
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
    id.on('login', () => { window.location.assign('/admin/'); });
    id.on('signup', () => { /* Netlify většinou rovnou vede na set password */ });

    // Spusť widget (vyvolá 'init')
    id.init();
  });
})();
