// netlify/functions/tmOutbound.js
// ---------------------------------------------------------
// AJSEE Ticketmaster outbound redirect
//
// Cíl:
// - přijmout čistou Ticketmaster URL přes parametr "to"
// - odstranit staré affiliate / interní parametry
// - podle Ticketmaster domény vybrat správný Impact market wrapper
// - doplnit subId1, subId2, subId3, sharedid a partnerpropertyid
// - redirectovat uživatele přes Impact tracking link
// - pokud trh není namapovaný, bezpečně redirectovat na čistý Ticketmaster link
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

function sanitizeTicketmasterUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);

    if (!isTicketmasterHost(parsed.hostname)) return '';

    [...INTERNAL_PARAMS, ...OLD_AFFILIATE_PARAMS].forEach((key) => {
      parsed.searchParams.delete(key);
    });

    return parsed.toString();
  } catch {
    return '';
  }
}

function extractTicketmasterUrl(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const host = parsed.hostname.toLowerCase();

    // Legacy: pokud přijde už starý Impact link, vytáhneme z něj cílové "u".
    if (isImpactTicketmasterHost(host)) {
      const target = parsed.searchParams.get('u');
      return target ? sanitizeTicketmasterUrl(target) : '';
    }

    // Legacy: pokud Ticketmaster URL obsahuje v parametru "url" nebo "to"
    // starý affiliate link, vytáhneme z něj cílové "u".
    if (isTicketmasterHost(host)) {
      const nested = parsed.searchParams.get('to') || parsed.searchParams.get('url');

      if (nested) {
        try {
          const nestedUrl = new URL(nested);

          if (isImpactTicketmasterHost(nestedUrl.hostname)) {
            const target = nestedUrl.searchParams.get('u');
            if (target) return sanitizeTicketmasterUrl(target);
          }

          if (isTicketmasterHost(nestedUrl.hostname)) {
            return sanitizeTicketmasterUrl(nestedUrl.toString());
          }
        } catch {
          // ignorujeme a použijeme původní Ticketmaster URL
        }
      }

      return sanitizeTicketmasterUrl(parsed.toString());
    }

    return '';
  } catch {
    return '';
  }
}

function getMarketConfig(ticketmasterUrl = '') {
  try {
    const parsed = new URL(ticketmasterUrl);
    const host = normalizeHost(parsed.hostname);
    return MARKET_MAP[host] || null;
  } catch {
    return null;
  }
}

function buildImpactUrl(ticketmasterUrl, options = {}) {
  const market = getMarketConfig(ticketmasterUrl);

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
  impactUrl.searchParams.set('u', ticketmasterUrl);

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

  const cleanTicketmasterUrl = extractTicketmasterUrl(rawUrl);

  if (!cleanTicketmasterUrl) {
    return safeRedirect(DEFAULT_FALLBACK_URL);
  }

  const sourcePage = q.source || q.subId1 || 'events_page';
  const placement = q.placement || q.subId2 || 'event_card';
  const eventId = q.eid || q.eventId || q.subId3 || '';

  const affiliateUrl = buildImpactUrl(cleanTicketmasterUrl, {
    sourcePage,
    placement,
    eventId,
  });

  // Pokud trh není v mapě, raději použijeme čistý Ticketmaster link
  // než špatný affiliate wrapper.
  if (!affiliateUrl) {
    return safeRedirect(cleanTicketmasterUrl);
  }

  return safeRedirect(affiliateUrl);
};