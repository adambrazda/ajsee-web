import { CONSENT_KEY, GA4_MEASUREMENT_ID } from './utils/analytics-config.js';

const trackedActivations = new WeakSet();
const boundDocuments = new WeakSet();
const LANGUAGES = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const text = value => String(value || '').replace(/\s+/g, ' ').trim();

function analyticsAllowed(win) {
  try {
    return JSON.parse(win.localStorage.getItem(CONSENT_KEY))?.analytics === true;
  } catch {
    return false;
  }
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
  if (/(^|\.)colosseumticket\.cz$/.test(host)) return 'colosseumticket';
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
    product_type: resolvedPlacement === 'partner_roster' ? 'partner_info'
      : partner === 'trustedstays' ? 'accommodation' : 'tickets',
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
  if (!win || !analyticsAllowed(win)) return null;
  const activation = options.activation;
  if (activation && (activation.type === 'auxclick' ? activation.button !== 1 : activation.button > 0)) return null;
  if (activation && trackedActivations.has(activation)) return null;
  const payload = buildPartnerOutboundPayload(link, { ...options, win });
  if (!payload) return null;

  try {
    win.dataLayer = win.dataLayer || [];
    if (typeof win.gtag !== 'function') {
      win.gtag = function () { win.dataLayer.push(arguments); };
    }
    // The published GTM trigger listens for legacy partner_click and can also
    // react to gtag event commands. Use a separate name to avoid duplicate hits.
    // event_id and language are reserved Google fields. Keep AJSEE's identity
    // and page locale in explicit custom parameters, without overriding them.
    const { event, event_id, language, ...parameters } = payload;
    win.gtag('event', event, { ...parameters, partner_event_id: event_id, send_to: GA4_MEASUREMENT_ID });
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
  const onActivation = activation => {
    const link = activation.target?.closest?.('a[href]');
    if (link) trackPartnerOutboundLink(link, { activation });
  };
  // Delegation covers dynamically rendered results and translated/replaced CTAs.
  doc.addEventListener('click', onActivation, true);
  doc.addEventListener('auxclick', onActivation, true);
}
