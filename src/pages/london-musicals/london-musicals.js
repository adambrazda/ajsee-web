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


/* AJSEE_LONDON_MUSICALS_TRACKING_V1
   Track TodayTix partner purchase clicks and key London musicals funnel actions. */
function cleanTrackingText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getTrackingLang() {
  return cleanTrackingText(document.documentElement.getAttribute('lang'))
    .slice(0, 2)
    .toLowerCase() || normLang(detectLang());
}

function getUrlHost(value) {
  try {
    return new URL(value, window.location.origin).hostname;
  } catch {
    return '';
  }
}

function pushAnalyticsEvent(payload) {
  const eventPayload = {
    ...payload,
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    language: getTrackingLang(),
    ts: new Date().toISOString()
  };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventPayload);
  } catch {
    /* noop */
  }

  try {
    window.__ajsee = window.__ajsee || {};
    window.__ajsee.lastLondonMusicalsEvent = eventPayload;
  } catch {
    /* noop */
  }

  try {
    sessionStorage.setItem('ajsee:lastLondonMusicalsEvent', JSON.stringify(eventPayload));
  } catch {
    /* noop */
  }

  try {
    console.info('[AJSEE London musicals tracking]', eventPayload);
  } catch {
    /* noop */
  }
}

function trackLondonMusicalsPartnerClick(link) {
  if (!link) return;

  const partner = cleanTrackingText(link.dataset.partner || 'todaytix');
  const eventTitle = cleanTrackingText(link.dataset.eventTitle || link.closest('.lm-card')?.querySelector('h3')?.textContent);
  const eventCity = cleanTrackingText(link.dataset.eventCity || 'London');
  const clickedHref = cleanTrackingText(link.href || link.getAttribute('href'));
  const outboundUrl = cleanTrackingText(link.dataset.outboundUrl) || clickedHref;
  const placement = cleanTrackingText(link.dataset.placement || 'london_musicals_card');

  if (!partner && !outboundUrl) return;

  pushAnalyticsEvent({
    event: 'partner_click',

    partner,
    event_name: eventTitle,
    city: eventCity,
    outbound_url: outboundUrl,
    placement,

    event_title: eventTitle,
    event_city: eventCity,
    event_provider: partner,
    destination_url: outboundUrl,
    destination_host: getUrlHost(outboundUrl),
    clicked_href: clickedHref,
    clicked_host: getUrlHost(clickedHref),
    route_city: 'London',
    route_country_code: 'GB',
    link_text: cleanTrackingText(link.textContent)
  });
}

function initLondonMusicalsTracking() {
  if (window.__ajseeLondonMusicalsTrackingInit) return;
  window.__ajseeLondonMusicalsTrackingInit = true;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const partnerLink = target.closest('.js-lm-partner-click');
    if (partnerLink) {
      trackLondonMusicalsPartnerClick(partnerLink);
      return;
    }

  }, true);
}

function trackTrustedStaysClicks() {
  document.querySelectorAll('a[href*="trustedstays.co.uk/book-a-home"]').forEach((link) => {
    link.addEventListener('click', () => {
      try {
        window.gtag?.('event', 'trustedstays_london_musicals_banner_click', {
          href: link.href
        });
      } catch {
        // noop
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = normLang(detectLang());

  initNav({ lang });
  await applyTranslations(lang);
  syncYear();
  localizeLanguageButtons(lang);
  syncPurchaseLinks(lang);
  initLondonMusicalsTracking();
  trackTrustedStaysClicks();


});
