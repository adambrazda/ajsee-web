// netlify/functions/tmOutbound.js
// ---------------------------------------------------------
// AJSEE Ticketmaster outbound redirect
//
// Cíl:
// - přijmout Ticketmaster / Impact / Universe URL přes parametr "to"
// - bezpečně vytáhnout čistý cílový odkaz
// - správně poznat Ticketmaster market i ze subdomén
//   např. attractions.ticketmaster.co.uk -> ticketmaster.co.uk
// - odstranit staré affiliate / interní / jazykové parametry,
//   které umí rozbít redirect chain
// - doplnit subId1, subId2, subId3, sharedid a partnerpropertyid
// - redirectovat uživatele přes správný Impact tracking link
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

const MARKET_HOSTS = Object.keys(MARKET_MAP);

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

const LANGUAGE_PARAMS = [
  'language',
  'locale',
  'lang',
  'hl',
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
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function isImpactTicketmasterHost(hostname = '') {
  return normalizeHost(hostname) === 'ticketmaster.evyy.net';
}

/**
 * Vrátí základní Ticketmaster market host.
 *
 * Důležité:
 * Ticketmaster často používá subdomény, např.:
 * - attractions.ticketmaster.co.uk
 * - shop.ticketmaster.co.uk
 *
 * Ty musí spadnout pod ticketmaster.co.uk, jinak redirect skončí na CZ fallbacku.
 */
function getTicketmasterMarketHost(hostname = '') {
  const host = normalizeHost(hostname);

  for (const marketHost of MARKET_HOSTS) {
    if (host === marketHost || host.endsWith(`.${marketHost}`)) {
      return marketHost;
    }
  }

  return '';
}

function isTicketmasterDestinationHost(hostname = '') {
  const host = normalizeHost(hostname);

  if (!host || isImpactTicketmasterHost(host)) return false;

  // Primárně povolujeme jen země, pro které máme mapu.
  if (getTicketmasterMarketHost(host)) return true;

  // Bez affiliate mapování, ale stále legitimní Ticketmaster doména.
  // Při takovém odkazu použijeme čistý direct fallback, ne Impact wrapper.
  if (host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com')) {
    return true;
  }

  return false;
}

function isUniverseHost(hostname = '') {
  const host = normalizeHost(hostname);
  return host === 'universe.com' || host.endsWith('.universe.com');
}

function isAllowedDestinationHost(hostname = '') {
  return isTicketmasterDestinationHost(hostname) || isUniverseHost(hostname);
}

function getMarketConfig(destinationUrl = '') {
  try {
    const parsed = new URL(destinationUrl);
    const marketHost = getTicketmasterMarketHost(parsed.hostname);

    return marketHost ? (MARKET_MAP[marketHost] || null) : null;
  } catch {
    return null;
  }
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

function safeDecodeMaybe(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseUrlMaybe(rawUrl = '') {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(safeDecodeMaybe(raw));
    } catch {
      return null;
    }
  }
}

function removeParams(parsed, keys = []) {
  for (const key of keys) {
    parsed.searchParams.delete(key);
  }
}

function sanitizeDestinationUrl(rawUrl = '') {
  const parsed = parseUrlMaybe(rawUrl);

  if (!parsed) return '';
  if (!/^https?:$/i.test(parsed.protocol)) return '';
  if (!isAllowedDestinationHost(parsed.hostname)) return '';

  removeParams(parsed, INTERNAL_PARAMS);
  removeParams(parsed, OLD_AFFILIATE_PARAMS);

  // Tyto parametry na cílovém URL nechceme držet.
  // U přeshraničních linků umí špatná language/locale kombinace způsobit
  // přesměrování na nesprávný Ticketmaster market.
  removeParams(parsed, LANGUAGE_PARAMS);

  return parsed.toString();
}

function getMarketFromImpactUrl(parsed) {
  try {
    if (!parsed || !isImpactTicketmasterHost(parsed.hostname)) return null;

    const match = parsed.pathname.match(/\/c\/([^/]+)\/([^/]+)\/([^/?#]+)/);
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

function getImpactTarget(parsed) {
  if (!parsed) return '';

  return (
    parsed.searchParams.get('u') ||
    parsed.searchParams.get('url') ||
    parsed.searchParams.get('to') ||
    ''
  );
}

/**
 * Vrátí čistou cílovou URL + market config.
 *
 * Umí tyto scénáře:
 * 1) přímý Ticketmaster link
 * 2) přímý Ticketmaster subdomain link
 *    např. attractions.ticketmaster.co.uk
 * 3) přímý Universe link
 * 4) Impact link s parametrem u=...
 * 5) Ticketmaster link s vnořeným parametrem to/url obsahujícím Impact link
 */
function extractDestination(rawUrl = '') {
  const parsed = parseUrlMaybe(rawUrl);

  if (!parsed) {
    return { url: '', market: null };
  }

  // A) Přímý Impact link.
  // Například:
  // https://ticketmaster.evyy.net/c/7218577/2038758/24023?u=https%3A%2F%2Fattractions.ticketmaster.co.uk%2F...
  if (isImpactTicketmasterHost(parsed.hostname)) {
    const market = getMarketFromImpactUrl(parsed);
    const target = getImpactTarget(parsed);
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
      const nestedUrl = parseUrlMaybe(nested);

      if (nestedUrl) {
        // B1) Vnořený Impact link.
        if (isImpactTicketmasterHost(nestedUrl.hostname)) {
          const market = getMarketFromImpactUrl(nestedUrl);
          const target = getImpactTarget(nestedUrl);
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
      }
    }

    const cleanUrl = sanitizeDestinationUrl(parsed.toString());

    return {
      url: cleanUrl,
      market: getMarketConfig(cleanUrl),
    };
  }

  return { url: '', market: null };
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
