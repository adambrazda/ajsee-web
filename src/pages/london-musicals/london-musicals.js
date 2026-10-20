import '../../identity-init.js';

import { initNav } from '../../nav-core.js';
import { applyTranslations, detectLang } from '../../i18n.js';

const SUPPORTED = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const TODAYTIX_PURCHASE_BASE_URL = 'https://ajsee.tixculture.com/';

const ROUTES = {
  cs: '/londynske-muzikaly/',
  en: '/en/london-musicals/',
  de: '/de/london-musicals/',
  sk: '/sk/londynske-muzikaly/',
  pl: '/pl/londynskie-musicale/',
  hu: '/hu/londoni-musicalek/'
};



function normLang(value) {
  const lang = String(value || '').toLowerCase().slice(0, 2);
  return SUPPORTED.includes(lang) ? lang : 'cs';
}

function getTodayTixPurchaseUrl(lang = 'cs') {
  const url = new URL(TODAYTIX_PURCHASE_BASE_URL);
  url.searchParams.set('utm_source', 'ajsee');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'london_musicals');
  url.searchParams.set('utm_content', normLang(lang));
  return url.toString();
}

function getCurrentPageLang(fallback = 'cs') {
  const path = cleanTrackingText(window.location?.pathname || '');

  if (path.startsWith('/en/')) return 'en';
  if (path.startsWith('/de/')) return 'de';
  if (path.startsWith('/sk/')) return 'sk';
  if (path.startsWith('/pl/')) return 'pl';
  if (path.startsWith('/hu/')) return 'hu';

  const htmlLang = cleanTrackingText(document.documentElement.getAttribute('lang')).slice(0, 2).toLowerCase();

  if (htmlLang) return normLang(htmlLang);

  return normLang(fallback);
}

function syncPurchaseLinks(lang) {
  const currentLang = getCurrentPageLang(lang);
  const href = getTodayTixPurchaseUrl(currentLang);

  document.querySelectorAll('.js-lm-purchase-link').forEach((link) => {
    link.href = href;
    link.dataset.outboundUrl = href;
    link.dataset.partner = 'todaytix';
  });
}

function localizeLanguageButtons(currentLang) {
  document.querySelectorAll('.lang-btn[data-lang]').forEach((button) => {
    const lang = normLang(button.getAttribute('data-lang'));
    const target = ROUTES[lang] || ROUTES.cs;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (lang === currentLang) return;
      window.location.href = target;
    });
  });
}

function syncYear() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}


function cleanTrackingText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = normLang(detectLang());

  initNav({ lang });
  await applyTranslations(lang);
  syncYear();
  localizeLanguageButtons(lang);
  syncPurchaseLinks(lang);


});
