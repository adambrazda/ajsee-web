// netlify/functions/tmOutbound.js
// ---------------------------------------------------------
// AJSEE Ticketmaster outbound redirect
//
// Cíl:
// - přijmout Ticketmaster / Impact / Universe URL přes parametr "to"
// - odstranit staré affiliate / interní parametry
// - podle Ticketmaster domény nebo původního Impact wrapperu vybrat správný market
// - doplnit subId1, subId2, subId3, sharedid a partnerpropertyid
// - redirectovat uživatele přes Impact tracking link
// - pokud trh není namapovaný, bezpečně redirectovat na čistý cílový link
// ---------------------------------------------------------

const AJSEE_IMPACT_ID = '7218577';
const AJSEE_SHARED_ID = 'ajsee_web_events';
const AJSEE_PARTNER_PROPERTY_ID = '8292139';

const DEFAULT_FALLBACK_URL = 'https://www.ticketmaster.cz/';

const MARKET_MAP = {
  'ticketmaster.cz':    { assetId: '2038768', programId: '23901' },
  'ticketmaster.co.uk': { assetId: '2038758', programId: '24023' },
  'ticketmaster.de':    { assetId: '2038753', programId: '23890' },
  'ticketmaster.pl':    { assetId: '2038764', programId: '23896' },
  'ticketmaster.at':    { assetId: '2038762', programId: '23895' },
  'ticketmaster.ie':    { assetId: '2038752', programId: '23889' },
  'ticketmaster.fr':    { assetId: '2038754', programId: '23891' },
  'ticketmaster.nl':    { assetId: '2038751', programId: '23888' },
  'ticketmaster.be':    { assetId: '2038757', programId: '23894' },
  'ticketmaster.it':    { assetId: '2038766', programId: '23899' },
  'ticketmaster.es':    { assetId: '2038750', programId: '23886' },
  'ticketmaster.dk':    { assetId: '2038756', programId: '23893' },
  'ticketmaster.ch':    { assetId: '2038765', programId: '23898' },
  'ticketmaster.no':    { assetId: '2038767', programId: '23900' },
  'ticketmaster.se':    { assetId: '2038747', programId: '23885' },
  'ticketmaster.fi':    { assetId: '2038755', programId: '23892' },
};

const MARKET_BY_IDS = Object.fromEntries(
  Object.values(MARKET_MAP).map((cfg) => [`${cfg.assetId}|${cfg.programId}`, cfg])
);

const INTERNAL_PARAMS = [
  'url',
  'to',
  'eventId',
  'eid',
  'affiliateUrl',
  'directUrl',
  'fallbackUrl',
  'sourceUrl',
  'source',
  'placement',
];

const OLD_AFFILIATE_PARAMS = [
  'clickId',
  'irgwc',
  'afsrc',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'ircid',
  'camefrom',
  'irclickid',
  'sharedid',
  'partnerpropertyid',
  'subId1',
  'subId2',
  'subId3',
  'subId4',
  'subId5',
];

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function safeRedirect(location, statusCode = 302) {
  return {
    statusCode,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    body: '',
  };
}

function normalizeHost(hostname = '') {
  return String(hostname || '')
    .toLowerCase()
    .replace(/^www\./, '');
}

function isTicketmasterHost(hostname = '') {
  const h = normalizeHost(hostname);

  return (
    h === 'ticketmaster.com' ||
    /^ticketmaster\.[a-z]{2,}(\.[a-z]{2,})?$/.test(h)
  );
}

function isUniverseHost(hostname = '') {
  const h = normalizeHost(hostname);
  return h === 'universe.com';
}

function isAllowedDestinationHost(hostname = '') {
  return isTicketmasterHost(hostname) || isUniverseHost(hostname);
}

function isImpactTicketmasterHost(hostname = '') {
  return String(hostname || '').toLowerCase() === 'ticketmaster.evyy.net';
}

function cleanTrackingValue(value = '', fallback = '') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return cleaned || fallback;
}

function cleanEventId(value = '') {
  return String(value || '')
    .trim()
    .replace(/^ticketmaster-/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 80);
}

function sanitizeDestinationUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);

    if (!isAllowedDestinationHost(parsed.hostname)) return '';

    [...INTERNAL_PARAMS, ...OLD_AFFILIATE_PARAMS].forEach((key) => {
      parsed.searchParams.delete(key);
    });

    return parsed.toString();
  } catch {
    return '';
  }
}

function getMarketFromImpactUrl(parsed) {
  try {
    if (!parsed || !isImpactTicketmasterHost(parsed.hostname)) return null;

    const match = parsed.pathname.match(
      /\/c\/([^/]+)\/([^/]+)\/([^/?#]+)/
    );

    if (!match) return null;

    const impactId = match[1];
    const assetId = match[2];
    const programId = match[3];

    if (impactId !== AJSEE_IMPACT_ID) return null;

    return MARKET_BY_IDS[`${assetId}|${programId}`] || null;
  } catch {
    return null;
  }
}

function getMarketConfig(destinationUrl = '') {
  try {
    const parsed = new URL(destinationUrl);
    const host = normalizeHost(parsed.hostname);

    return MARKET_MAP[host] || null;
  } catch {
    return null;
  }
}

/**
 * Vrátí čistou cílovou URL + market config.
 *
 * Umí tyto scénáře:
 * 1) přímý Ticketmaster link
 * 2) přímý Universe link
 * 3) Impact link s parametrem u=...
 * 4) Ticketmaster link s vnořeným parametrem to/url obsahujícím Impact link
 */
function extractDestination(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());

    // A) Přímý Impact link.
    // Například:
    // https://ticketmaster.evyy.net/c/7218577/2038753/23890?u=https%3A%2F%2Fwww.universe.com%2F...
    if (isImpactTicketmasterHost(parsed.hostname)) {
      const market = getMarketFromImpactUrl(parsed);
      const target = parsed.searchParams.get('u') || '';
      const cleanUrl = sanitizeDestinationUrl(target);

      return {
        url: cleanUrl,
        market,
      };
    }

    // B) Přímý povolený destination link.
    // Ticketmaster URL někdy může obsahovat vnořený "to" nebo "url" s Impact linkem.
    if (isAllowedDestinationHost(parsed.hostname)) {
      const nested = parsed.searchParams.get('to') || parsed.searchParams.get('url');

      if (nested) {
        try {
          const nestedUrl = new URL(nested);

          // B1) Vnořený Impact link.
          if (isImpactTicketmasterHost(nestedUrl.hostname)) {
            const market = getMarketFromImpactUrl(nestedUrl);
            const target = nestedUrl.searchParams.get('u') || '';
            const cleanUrl = sanitizeDestinationUrl(target);

            if (cleanUrl) {
              return {
                url: cleanUrl,
                market,
              };
            }
          }

          // B2) Vnořený přímý Ticketmaster / Universe link.
          if (isAllowedDestinationHost(nestedUrl.hostname)) {
            const cleanUrl = sanitizeDestinationUrl(nestedUrl.toString());

            if (cleanUrl) {
              return {
                url: cleanUrl,
                market: getMarketConfig(cleanUrl),
              };
            }
          }
        } catch {
          // ignorujeme a použijeme původní destination URL
        }
      }

      const cleanUrl = sanitizeDestinationUrl(parsed.toString());

      return {
        url: cleanUrl,
        market: getMarketConfig(cleanUrl),
      };
    }

    return { url: '', market: null };
  } catch {
    return { url: '', market: null };
  }
}

function buildImpactUrl(destinationUrl, options = {}) {
  const market = options.marketConfig || getMarketConfig(destinationUrl);

  if (!market) return '';

  const sourcePage = cleanTrackingValue(options.sourcePage, 'events_page');
  const placement = cleanTrackingValue(options.placement, 'event_card');
  const eventId = cleanEventId(options.eventId);

  const impactUrl = new URL(
    `https://ticketmaster.evyy.net/c/${AJSEE_IMPACT_ID}/${market.assetId}/${market.programId}`
  );

  impactUrl.searchParams.set('subId1', sourcePage);
  impactUrl.searchParams.set('subId2', placement);

  if (eventId) {
    impactUrl.searchParams.set('subId3', eventId);
  }

  impactUrl.searchParams.set('sharedid', AJSEE_SHARED_ID);
  impactUrl.searchParams.set('partnerpropertyid', AJSEE_PARTNER_PROPERTY_ID);
  impactUrl.searchParams.set('u', destinationUrl);

  return impactUrl.toString();
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};

  // "to" je nový parametr, "url" necháváme jen kvůli zpětné kompatibilitě.
  const rawUrl = q.to || q.url || '';

  if (!rawUrl) {
    return safeRedirect(DEFAULT_FALLBACK_URL);
  }

  const extracted = extractDestination(rawUrl);
  const cleanDestinationUrl = extracted.url;

  if (!cleanDestinationUrl) {
    return safeRedirect(DEFAULT_FALLBACK_URL);
  }

  const sourcePage = q.source || q.subId1 || 'events_page';
  const placement = q.placement || q.subId2 || 'event_card';
  const eventId = q.eid || q.eventId || q.subId3 || '';

  const affiliateUrl = buildImpactUrl(cleanDestinationUrl, {
    sourcePage,
    placement,
    eventId,
    marketConfig: extracted.market,
  });

  // Pokud trh neumíme určit, raději použijeme čistý cílový link
  // než špatný affiliate wrapper.
  if (!affiliateUrl) {
    return safeRedirect(cleanDestinationUrl);
  }

  return safeRedirect(affiliateUrl);
};