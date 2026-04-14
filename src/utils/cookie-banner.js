import {
  readConsent,
  writeConsent,
  applyConsent,
} from './consent.js';

const COOKIE_BANNER_FALLBACKS = {
  cs: {
    title: 'Používáme cookies',
    desc: 'Používáme nezbytné cookies pro fungování webu a se souhlasem také analytické cookies, které nám pomáhají měřit návštěvnost a zlepšovat AJSEE.cz.',
    privacy: 'Zásady ochrany osobních údajů',
    cookies: 'Zásady používání cookies',
    reject: 'Odmítnout',
    settings: 'Nastavení',
    acceptAll: 'Přijmout vše',
    modalTitle: 'Nastavení cookies',
    necessaryTitle: 'Nezbytné cookies',
    necessaryText: 'Tyto cookies jsou nutné pro základní fungování webu.',
    alwaysActive: 'Vždy aktivní',
    analyticsTitle: 'Analytické cookies',
    analyticsText: 'Pomáhají nám měřit návštěvnost a zlepšovat web pomocí Google Analytics.',
    allowAnalytics: 'Povolit analytiku',
    save: 'Uložit nastavení',
  },
  en: {
    title: 'We use cookies',
    desc: 'We use necessary cookies for the website to function and, with your consent, also analytics cookies that help us measure traffic and improve AJSEE.cz.',
    privacy: 'Privacy Policy',
    cookies: 'Cookies Policy',
    reject: 'Reject',
    settings: 'Settings',
    acceptAll: 'Accept all',
    modalTitle: 'Cookie settings',
    necessaryTitle: 'Necessary cookies',
    necessaryText: 'These cookies are required for the basic functioning of the website.',
    alwaysActive: 'Always active',
    analyticsTitle: 'Analytics cookies',
    analyticsText: 'They help us measure traffic and improve the website using Google Analytics.',
    allowAnalytics: 'Allow analytics',
    save: 'Save settings',
  },
  de: {
    title: 'Wir verwenden Cookies',
    desc: 'Wir verwenden notwendige Cookies für den Betrieb der Website und mit Ihrer Einwilligung auch analytische Cookies, die uns helfen, den Traffic zu messen und AJSEE.cz zu verbessern.',
    privacy: 'Datenschutzerklärung',
    cookies: 'Cookie-Richtlinie',
    reject: 'Ablehnen',
    settings: 'Einstellungen',
    acceptAll: 'Alle akzeptieren',
    modalTitle: 'Cookie-Einstellungen',
    necessaryTitle: 'Notwendige Cookies',
    necessaryText: 'Diese Cookies sind für die grundlegende Funktion der Website erforderlich.',
    alwaysActive: 'Immer aktiv',
    analyticsTitle: 'Analytische Cookies',
    analyticsText: 'Sie helfen uns, den Traffic zu messen und die Website mit Google Analytics zu verbessern.',
    allowAnalytics: 'Analyse erlauben',
    save: 'Einstellungen speichern',
  },
  sk: {
    title: 'Používame cookies',
    desc: 'Používame nevyhnutné cookies pre fungovanie webu a so súhlasom aj analytické cookies, ktoré nám pomáhajú merať návštevnosť a zlepšovať AJSEE.cz.',
    privacy: 'Zásady ochrany osobných údajov',
    cookies: 'Zásady používania cookies',
    reject: 'Odmietnuť',
    settings: 'Nastavenia',
    acceptAll: 'Prijať všetko',
    modalTitle: 'Nastavenia cookies',
    necessaryTitle: 'Nevyhnutné cookies',
    necessaryText: 'Tieto cookies sú potrebné pre základné fungovanie webu.',
    alwaysActive: 'Vždy aktívne',
    analyticsTitle: 'Analytické cookies',
    analyticsText: 'Pomáhajú nám merať návštevnosť a zlepšovať web pomocou Google Analytics.',
    allowAnalytics: 'Povoliť analytiku',
    save: 'Uložiť nastavenia',
  },
  pl: {
    title: 'Używamy plików cookies',
    desc: 'Używamy niezbędnych plików cookies do działania strony oraz, za Twoją zgodą, także analitycznych cookies, które pomagają nam mierzyć ruch i ulepszać AJSEE.cz.',
    privacy: 'Polityka prywatności',
    cookies: 'Polityka cookies',
    reject: 'Odrzuć',
    settings: 'Ustawienia',
    acceptAll: 'Akceptuj wszystko',
    modalTitle: 'Ustawienia cookies',
    necessaryTitle: 'Niezbędne cookies',
    necessaryText: 'Te pliki cookies są wymagane do podstawowego działania strony.',
    alwaysActive: 'Zawsze aktywne',
    analyticsTitle: 'Analityczne cookies',
    analyticsText: 'Pomagają nam mierzyć ruch i ulepszać stronę za pomocą Google Analytics.',
    allowAnalytics: 'Włącz analitykę',
    save: 'Zapisz ustawienia',
  },
  hu: {
    title: 'Sütiket használunk',
    desc: 'A weboldal működéséhez szükséges sütiket használunk, és hozzájárulásoddal analitikai sütiket is, amelyek segítenek mérni a forgalmat és fejleszteni az AJSEE.cz oldalt.',
    privacy: 'Adatvédelmi tájékoztató',
    cookies: 'Cookie-szabályzat',
    reject: 'Elutasítás',
    settings: 'Beállítások',
    acceptAll: 'Összes elfogadása',
    modalTitle: 'Süti-beállítások',
    necessaryTitle: 'Szükséges sütik',
    necessaryText: 'Ezek a sütik a weboldal alapvető működéséhez szükségesek.',
    alwaysActive: 'Mindig aktív',
    analyticsTitle: 'Analitikai sütik',
    analyticsText: 'Segítenek mérni a forgalmat és fejleszteni a weboldalt a Google Analytics segítségével.',
    allowAnalytics: 'Analitika engedélyezése',
    save: 'Beállítások mentése',
  },
};

let listenersBound = false;
let initialized = false;

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase();
  return COOKIE_BANNER_FALLBACKS[lang] ? lang : 'cs';
}

function getActiveLang(preferredLang = null) {
  const explicit = normalizeLang(preferredLang);
  if (explicit) return explicit;

  const htmlLang = normalizeLang(document.documentElement.getAttribute('lang'));
  if (htmlLang) return htmlLang;

  try {
    const url = new URL(window.location.href);
    const fromUrl = normalizeLang(url.searchParams.get('lang'));
    if (fromUrl) return fromUrl;
  } catch {}

  return 'cs';
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function getText(key, lang) {
  const currentLang = getActiveLang(lang);
  const translations = window.translations || {};
  const fullKey = `cookie-banner.${key}`;

  const translated =
    getByPath(translations, fullKey) ??
    translations[fullKey];

  if (typeof translated === 'string' && translated.trim()) {
    return translated;
  }

  return COOKIE_BANNER_FALLBACKS[currentLang]?.[key] ?? COOKIE_BANNER_FALLBACKS.cs[key] ?? '';
}

function buildLangHref(path, lang) {
  const currentLang = getActiveLang(lang);
  const url = new URL(path, window.location.origin);

  if (currentLang === 'cs') {
    url.searchParams.delete('lang');
  } else {
    url.searchParams.set('lang', currentLang);
  }

  return url.pathname + url.search + url.hash;
}

function createBanner(lang) {
  const wrapper = document.createElement('div');
  wrapper.id = 'cookie-banner';
  wrapper.className = 'cookie-banner';
  wrapper.innerHTML = `
    <div class="cookie-banner__card" role="dialog" aria-labelledby="cookie-banner-title" aria-describedby="cookie-banner-desc" aria-modal="false">
      <h2 id="cookie-banner-title">${getText('title', lang)}</h2>
      <p id="cookie-banner-desc">${getText('desc', lang)}</p>
      <div class="cookie-banner__links">
        <a href="${buildLangHref('/privacy-policy.html', lang)}" data-lang-link>${getText('privacy', lang)}</a>
        <a href="${buildLangHref('/cookies-policy.html', lang)}" data-lang-link>${getText('cookies', lang)}</a>
      </div>
      <div class="cookie-banner__actions">
        <button type="button" class="btn btn-secondary" data-action="reject">${getText('reject', lang)}</button>
        <button type="button" class="btn btn-secondary" data-action="settings">${getText('settings', lang)}</button>
        <button type="button" class="btn btn-primary" data-action="accept-all">${getText('acceptAll', lang)}</button>
      </div>
    </div>
  `;
  return wrapper;
}

function createModal(lang) {
  const modal = document.createElement('div');
  modal.id = 'cookie-preferences';
  modal.className = 'cookie-modal is-hidden';
  modal.innerHTML = `
    <div class="cookie-modal__backdrop" data-close="true"></div>
    <div class="cookie-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-modal-title">
      <h2 id="cookie-modal-title">${getText('modalTitle', lang)}</h2>

      <div class="cookie-modal__section">
        <div>
          <strong>${getText('necessaryTitle', lang)}</strong>
          <p>${getText('necessaryText', lang)}</p>
        </div>
        <label class="switch">
          <input type="checkbox" checked disabled />
          <span class="switch__ui" aria-hidden="true"></span>
          <span class="switch__label">${getText('alwaysActive', lang)}</span>
        </label>
      </div>

      <div class="cookie-modal__section">
        <div>
          <strong>${getText('analyticsTitle', lang)}</strong>
          <p>${getText('analyticsText', lang)}</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="cookie-analytics-toggle" />
          <span class="switch__ui" aria-hidden="true"></span>
          <span class="switch__label">${getText('allowAnalytics', lang)}</span>
        </label>
      </div>

      <div class="cookie-modal__actions">
        <button type="button" class="btn btn-secondary" data-action="reject">${getText('reject', lang)}</button>
        <button type="button" class="btn btn-primary" data-action="save">${getText('save', lang)}</button>
        <button type="button" class="btn btn-primary" data-action="accept-all">${getText('acceptAll', lang)}</button>
      </div>
    </div>
  `;
  return modal;
}

function removeBannerUi() {
  document.getElementById('cookie-banner')?.remove();
  document.getElementById('cookie-preferences')?.remove();
}

function mountUi(lang, { force = false, openPreferences = false, keepState = false, hideBanner = false } = {}) {
  if (!force && readConsent()) return;

  const resolvedLang = getActiveLang(lang);
  const existingModal = document.getElementById('cookie-preferences');
  const modalWasOpen = keepState ? !!(existingModal && !existingModal.classList.contains('is-hidden')) : false;
  const previousAnalyticsValue =
    document.getElementById('cookie-analytics-toggle')?.checked ??
    !!readConsent()?.analytics;

  removeBannerUi();

  const banner = createBanner(resolvedLang);
  const modal = createModal(resolvedLang);

  if (hideBanner || modalWasOpen || openPreferences) {
    banner.hidden = true;
  }

  document.body.appendChild(banner);
  document.body.appendChild(modal);

  const analyticsToggle = document.getElementById('cookie-analytics-toggle');
  if (analyticsToggle) {
    analyticsToggle.checked = !!previousAnalyticsValue;
  }

  if (modalWasOpen || openPreferences) {
    modal.classList.remove('is-hidden');
  }
}

function openModal() {
  const modal = document.getElementById('cookie-preferences');
  const banner = document.getElementById('cookie-banner');
  const consent = readConsent();
  const analyticsToggle = document.getElementById('cookie-analytics-toggle');

  if (analyticsToggle) {
    analyticsToggle.checked = !!consent?.analytics;
  }

  if (banner) {
    banner.hidden = true;
  }

  modal?.classList.remove('is-hidden');
}

function closeModal() {
  const modal = document.getElementById('cookie-preferences');
  const banner = document.getElementById('cookie-banner');

  if (readConsent()) {
    removeBannerUi();
    return;
  }

  modal?.classList.add('is-hidden');

  if (banner) {
    banner.hidden = false;
  }
}

function saveConsent(consent) {
  const finalConsent = writeConsent(consent);
  applyConsent(finalConsent);
  removeBannerUi();
}

function openCookieSettings(lang = null) {
  const resolvedLang = getActiveLang(lang);

  if (!listenersBound) {
    bindGlobalListeners();
  }

  initialized = true;
  mountUi(resolvedLang, {
    force: true,
    openPreferences: true,
    hideBanner: true,
  });
}

function syncCookieBannerLanguage(lang = null) {
  if (!initialized) return;

  const hasUi =
    document.getElementById('cookie-banner') ||
    document.getElementById('cookie-preferences');

  if (!hasUi) return;

  mountUi(getActiveLang(lang), {
    force: true,
    keepState: true,
  });
}

function bindGlobalListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-open-cookie-settings]')) {
      e.preventDefault();
      openCookieSettings();
      return;
    }

    if (target.closest('#cookie-banner [data-action="accept-all"]')) {
      saveConsent({ analytics: true });
      return;
    }

    if (target.closest('#cookie-banner [data-action="reject"]')) {
      saveConsent({ analytics: false });
      return;
    }

    if (target.closest('#cookie-banner [data-action="settings"]')) {
      openModal();
      return;
    }

    if (target.matches('#cookie-preferences [data-close="true"]')) {
      closeModal();
      return;
    }

    if (target.closest('#cookie-preferences [data-action="accept-all"]')) {
      saveConsent({ analytics: true });
      return;
    }

    if (target.closest('#cookie-preferences [data-action="reject"]')) {
      saveConsent({ analytics: false });
      return;
    }

    if (target.closest('#cookie-preferences [data-action="save"]')) {
      const analytics = document.getElementById('cookie-analytics-toggle')?.checked;
      saveConsent({ analytics: !!analytics });
    }
  });
}

function initCookieBanner({ lang = 'cs' } = {}) {
  bindGlobalListeners();
  initialized = true;

  const existingConsent = readConsent();
  if (existingConsent) {
    applyConsent(existingConsent);
    return;
  }

  mountUi(lang);
}

export { initCookieBanner, syncCookieBannerLanguage, openCookieSettings, openModal };