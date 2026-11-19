import { CONSENT_KEY, GA4_MEASUREMENT_ID, GTM_ENABLED } from './utils/analytics-config.js';
import { AMAZING_PLACES_VOUCHER_URL } from '../shared/amazing-places.js';

const trackedActivations = new WeakSet();
const boundDocuments = new WeakSet();
const recordedHomeTipMetrics = new WeakMap();
const HOME_TIP_VARIANT_KEY = 'ajsee.home-tip-variant.v1';
const HOME_TIP_CARD = 'body[data-page="home"] #eventsList > .event-card[data-home-tip-pilot]';
const LANGUAGES = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const AMAZING_PLACES_VOUCHER_PATH = new URL(AMAZING_PLACES_VOUCHER_URL).pathname;
const text = value => String(value || '').replace(/\s+/g, ' ').trim();

function trackingConsent(win) {
  try {
    const consent = JSON.parse(win.localStorage.getItem(CONSENT_KEY));
    return {
      analytics: consent?.analytics === true,
      marketing: consent?.marketing === true,
    };
  } catch {
    return { analytics: false, marketing: false };
  }
}

// Serialized by the homepage build so a visitor's variant is known before the cards can paint.
function assignHomeTipVariant(win, consentKey, variantKey) {
  let saved;
  try {
    if (JSON.parse(win.localStorage.getItem(consentKey))?.analytics === true) {
      saved = win.sessionStorage.getItem(variantKey);
    }
  } catch {
    // The variant can still be assigned for this page.
  }
  win.document.documentElement.dataset.homeTipVariant = saved === 'control' || saved === 'reason'
    ? saved
    : (win.Math.random() < .5 ? 'control' : 'reason');
}

export function homeTipVariantScript() {
  return `(${assignHomeTipVariant.toString()})(window, ${JSON.stringify(CONSENT_KEY)}, ${JSON.stringify(HOME_TIP_VARIANT_KEY)});`;
}

function sendGa4Event(win, name, parameters) {
  if (typeof win.gtag !== 'function') {
    win.dataLayer = win.dataLayer || [];
    win.gtag = function () { win.dataLayer.push(arguments); };
  }
  win.gtag('event', name, { ...parameters, send_to: GA4_MEASUREMENT_ID });
}

function recordHomeTipMetric(card, action) {
  if (!card?.matches(HOME_TIP_CARD)) return;
  const doc = card.ownerDocument;
  const win = doc.defaultView;
  if (!win || win.location.origin !== 'https://ajsee.cz' || !trackingConsent(win).analytics) return;
  const variant = doc.documentElement.dataset.homeTipVariant;
  const eventId = card.dataset.eventId;
  if ((variant !== 'control' && variant !== 'reason') || !eventId) return;

  let recorded = recordedHomeTipMetrics.get(doc);
  if (!recorded) recordedHomeTipMetrics.set(doc, recorded = new Set());
  const key = `${action}:${eventId}`;
  if (recorded.has(key)) return;

  try {
    // The event names also allow comparison in GA4's standard Events report.
    sendGa4Event(win, `ajsee_home_tip_${action}_${variant}`, {
      partner_event_id: eventId,
      page_language: doc.documentElement.lang,
      result_position: Number(card.dataset.resultPosition) || 0,
    });
    recorded.add(key);
  } catch {
    return;
  }
  try {
    win.sessionStorage.setItem(HOME_TIP_VARIANT_KEY, variant);
  } catch {
    // The measurement does not depend on browser storage.
  }
}

function observeHomeTipImpressions(doc) {
  const win = doc.defaultView;
  const list = doc.getElementById('eventsList');
  if (win?.location.origin !== 'https://ajsee.cz' || !list || doc.body?.dataset.page !== 'home' ||
      !doc.documentElement.dataset.homeTipVariant || !win.IntersectionObserver) return;

  const observer = new win.IntersectionObserver(entries => {
    if (doc.visibilityState === 'hidden') return;
    for (const { target, isIntersecting, intersectionRatio } of entries) {
      if (list.contains(target) && isIntersecting && intersectionRatio >= .5 &&
          win.getComputedStyle(target).visibility === 'visible') {
        recordHomeTipMetric(target, 'view');
      }
    }
  }, { threshold: .5 });

  const observe = () => {
    observer.disconnect();
    list.querySelectorAll(HOME_TIP_CARD).forEach(card => observer.observe(card));
  };

  observe();
  new win.MutationObserver(observe).observe(list, { childList: true });
  win.addEventListener('ajsee:analytics-ready', observe);
  doc.addEventListener('visibilitychange', observe);
}

function parseUrl(value, origin) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, origin);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function providerForUrl(url) {
  const host = url?.hostname.toLowerCase() || '';
  if (host === 'ajsee.tixculture.com') return 'todaytix';
  if (/(^|\.)trustedstays\.co\.uk$/.test(host)) return 'trustedstays';
  if (host === 'www.amazingplaces.cz' || host === 'amazingplaces.cz') return 'amazingplaces';
  if (/(^|\.)colosseumticket\.(cz|sk)$/.test(host)) return 'colosseumticket';
  if (/(^|\.)smsticket\.cz$/.test(host)) return 'smsticket';
  if (/(^|\.)(ticketmaster\.[a-z.]+|ticketweb\.[a-z.]+|universe\.com)$/.test(host)) return 'ticketmaster';
  return '';
}

function partnerName(value) {
  const key = text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.includes('ticketmaster')) return 'ticketmaster';
  if (key.includes('colosseum')) return 'colosseumticket';
  if (key.includes('smsticket')) return 'smsticket';
  if (key.includes('todaytix') || key === 'encore') return 'todaytix';
  if (key.includes('trustedstays')) return 'trustedstays';
  return '';
}

// Analytics needs the product path, never free-text search, coordinates,
// fragments or arbitrary query parameters. The real anchor is never changed.
const analyticsUrl = url => url ? url.origin + url.pathname : '';

export function buildPartnerOutboundPayload(link, {
  win = link?.ownerDocument?.defaultView || globalThis.window,
  doc = link?.ownerDocument || globalThis.document,
  placement = ''
} = {}) {
  if (!win || !doc || !link || link.getAttribute('aria-disabled') === 'true' || link.hasAttribute('download')) return null;

  const rawHref = link.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return null;
  const clicked = parseUrl(link.href || rawHref, win.location.origin);
  if (!clicked) return null;

  const isTicketmasterRedirect = clicked.origin === win.location.origin &&
    /^\/(?:\.netlify\/functions\/tmOutbound|api\/tmOutbound)\/?$/.test(clicked.pathname);
  const isColosseumRedirect = clicked.origin === win.location.origin &&
    /^\/(?:\.netlify\/functions\/colosseumOutbound|api\/colosseumOutbound)\/?$/.test(clicked.pathname);
  if (clicked.origin === win.location.origin && !isTicketmasterRedirect && !isColosseumRedirect) return null;

  const destination = isTicketmasterRedirect || isColosseumRedirect
    ? parseUrl(clicked.searchParams.get('to'), win.location.origin)
    : clicked;
  if (!destination) return null;
  if (isColosseumRedirect && providerForUrl(destination) !== 'colosseumticket') return null;
  const partner = isTicketmasterRedirect ? 'ticketmaster' : isColosseumRedirect ? 'colosseumticket'
    : providerForUrl(destination) || partnerName(link.dataset.partner);
  if (!partner) return null;

  const article = link.closest('[data-review-slug]');
  const eventCard = link.closest('.event-card');
  const pageType = text(doc.body?.dataset.page) || 'page';
  const resolvedPlacement = text(link.dataset.placement || placement || link.dataset.trackSource) ||
    (article && link.closest('.review-cta') ? 'review_cta'
      : article ? 'review_body'
        : eventCard ? 'event_card'
          : pageType === 'partners' ? 'partner_roster'
            : pageType === 'accommodation' ? 'accommodation_page'
              : 'partner_link');
  const eventTitle = text(link.dataset.eventTitle || article?.querySelector('h1')?.textContent ||
    (partner === 'todaytix' && pageType === 'london-musicals' ? 'London musicals' : ''));
  const city = text(link.dataset.eventCity || (partner === 'todaytix' ? 'London' : ''));
  const path = win.location.pathname;
  const pathLang = path.match(/^\/(cs|en|de|sk|pl|hu)(?:\/|$)/)?.[1];
  const htmlLang = text(doc.documentElement?.lang).slice(0, 2).toLowerCase();
  const pageLanguage = pathLang || (LANGUAGES.includes(htmlLang) ? htmlLang : 'cs');
  const isStayPartner = partner === 'trustedstays' || partner === 'amazingplaces';
  let productType = isStayPartner ? 'accommodation' : 'tickets';
  if (resolvedPlacement === 'partner_roster') {
    productType = 'partner_info';
  } else if (partner === 'amazingplaces' && destination.pathname.replace(/\/$/, '') === AMAZING_PLACES_VOUCHER_PATH) {
    productType = 'voucher';
  }

  return {
    event: 'ajsee_partner_click',
    partner,
    event_id: text(link.dataset.eventId || eventCard?.dataset.eventId),
    event_title: eventTitle,
    event_city: city,
    event_provider: partner,
    // Preserve the names already used in AJSEE's GA4 reports.
    partner_event_name: eventTitle,
    partner_city: city,
    source_page_path: path,
    page_path: path,
    page_location: win.location.origin + path,
    page_type: pageType,
    language: pageLanguage,
    page_language: pageLanguage,
    placement: resolvedPlacement,
    product_type: productType,
    content_slug: text(article?.dataset.reviewSlug),
    outbound_url: analyticsUrl(destination),
    destination_host: destination?.hostname || '',
    clicked_href: analyticsUrl(clicked),
    link_text: text(link.textContent),
    ticket_option_index: text(link.dataset.ticketOptionIndex),
    ticket_price_from: text(link.dataset.ticketPriceFrom),
    ticket_currency: text(link.dataset.ticketCurrency)
  };
}

export function trackPartnerOutboundLink(link, options = {}) {
  const win = options.win || link?.ownerDocument?.defaultView || globalThis.window;
  if (!win) return null;
  const consent = trackingConsent(win);
  const trackWithGTM = GTM_ENABLED && consent.marketing;
  if (!consent.analytics && !trackWithGTM) return null;
  const activation = options.activation;
  if (activation && (activation.type === 'auxclick' ? activation.button !== 1 : activation.button > 0)) return null;
  if (activation && trackedActivations.has(activation)) return null;
  const payload = buildPartnerOutboundPayload(link, { ...options, win });
  if (!payload) return null;

  try {
    win.dataLayer = win.dataLayer || [];
    if (consent.analytics) {
      // Direct GA4 remains the single owner of the analytics event.
      const { event, event_id, language, ...parameters } = payload;
      sendGa4Event(win, event, { ...parameters, partner_event_id: event_id });
      if (link.matches('.js-partner-click')) {
        const card = link.closest('.event-card');
        // A ticket activation also proves the card was reached.
        recordHomeTipMetric(card, 'view');
        recordHomeTipMetric(card, 'ticket');
      }
    }
    if (trackWithGTM) {
      // A distinct event avoids duplicating the direct GA4 hit and gives GTM a
      // deterministic trigger for future consent-gated Google Ads conversions.
      const { event, ...parameters } = payload;
      win.dataLayer.push({
        ...parameters,
        event: 'ajsee_partner_click_gtm',
        analytics_event_name: event,
      });
    }
    if (activation) trackedActivations.add(activation);
    win.__ajsee = win.__ajsee || {};
    win.__ajsee.lastPartnerClick = payload;
    return payload;
  } catch {
    // Measurement must never block opening the original affiliate link.
    return null;
  }
}

export function initPartnerOutboundTracking(doc = globalThis.document) {
  if (!doc || boundDocuments.has(doc)) return;
  boundDocuments.add(doc);
  observeHomeTipImpressions(doc);
  const onActivation = activation => {
    const link = activation.target?.closest?.('a[href]');
    if (link) trackPartnerOutboundLink(link, { activation });
  };
  // Delegation covers dynamically rendered results and translated/replaced CTAs.
  doc.addEventListener('click', onActivation, true);
  doc.addEventListener('auxclick', onActivation, true);
}
