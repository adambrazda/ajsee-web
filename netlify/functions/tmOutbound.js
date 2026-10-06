// netlify/functions/tmOutbound.js
// ---------------------------------------------------------
// AJSEE Ticketmaster outbound redirect
//
// Cíl:
// - přijmout Ticketmaster / Impact / Universe / TicketWeb URL přes parametr "to"
// - bezpečně vytáhnout čistý cílový odkaz
// - správně poznat Ticketmaster market i ze subdomén
//   např. attractions.ticketmaster.co.uk -> ticketmaster.co.uk
// - správně poznat TicketWeb UK jako UK Ticketmaster market
// - odstranit staré affiliate / interní / jazykové parametry,
//   které umí rozbít redirect chain
// - doplnit subId1, subId2, subId3, sharedid a partnerpropertyid
// - redirectovat uživatele přes správný Impact tracking link
//
// Důležitá bezpečnostní oprava:
// - pokud přijde cc=FR/HU/ES/NL/... a cílová URL je generic ticketmaster.com,
//   nepustíme ji dál, protože pro evropské markety bývá v praxi slepá/neplatná.
// - pokud přijde cc=FR a URL vede např. na ticketmaster.co.uk,
//   nepustíme ji dál, protože market neodpovídá vybrané zemi.
// - Universe necháváme jako direct destination, protože je součástí TM ekosystému,
//   ale typicky nemá Impact market wrapper.
// ---------------------------------------------------------

const AJSEE_IMPACT_ID = '7218577';
const AJSEE_SHARED_ID = 'ajsee_web_events';
const AJSEE_PARTNER_PROPERTY_ID = '8292139';

// Tracking modes:
// - server (default): Netlify resolves the Impact redirect chain server-side
//   and sends the browser straight to the final Ticketmaster URL carrying the
//   affiliate click parameters. This prevents local DNSBL/ad-blocking from
//   breaking the purchase journey while preserving attribution.
// - affiliate: emergency override that exposes the raw Impact chain.
// - direct: emergency bypass of Impact.
//
// Legacy "adaptive" is mapped to server mode. TM_IMPACT_TRACKING_ENABLED is
// kept only as a backwards-compatible override.
function resolveImpactTrackingMode() {
  const explicitMode = String(
    process.env.TM_IMPACT_TRACKING_MODE || ''
  )
    .trim()
    .toLowerCase();

  if (explicitMode === 'adaptive') {
    return 'server';
  }

  if (
    ['server', 'affiliate', 'direct'].includes(
      explicitMode
    )
  ) {
    return explicitMode;
  }

  const legacy = String(
    process.env.TM_IMPACT_TRACKING_ENABLED || ''
  )
    .trim()
    .toLowerCase();

  if (
    ['1', 'true', 'yes', 'on'].includes(legacy)
  ) {
    return 'server';
  }

  if (
    ['0', 'false', 'no', 'off'].includes(legacy)
  ) {
    return 'direct';
  }

  return 'server';
}

const IMPACT_TRACKING_MODE =
  resolveImpactTrackingMode();

const DEFAULT_FALLBACK_URL = 'https://www.ticketmaster.cz/';

const MARKET_MAP = {
  'ticketmaster.cz':    { assetId: '1958979', programId: '23901', countryCode: 'CZ' },
  'ticketmaster.co.uk': { assetId: '2038758', programId: '24023', countryCode: 'GB' },
  'ticketweb.uk':       { assetId: '2038758', programId: '24023', countryCode: 'GB' },
  'ticketmaster.de':    { assetId: '2038753', programId: '23890', countryCode: 'DE' },
  'ticketmaster.pl':    { assetId: '2038764', programId: '23896', countryCode: 'PL' },
  'ticketmaster.at':    { assetId: '2038762', programId: '23895', countryCode: 'AT' },
  'ticketmaster.ie':    { assetId: '2038752', programId: '23889', countryCode: 'IE' },
  'ticketmaster.fr':    { assetId: '2038754', programId: '23891', countryCode: 'FR' },
  'ticketmaster.nl':    { assetId: '2038751', programId: '23888', countryCode: 'NL' },
  'ticketmaster.be':    { assetId: '2038757', programId: '23894', countryCode: 'BE' },
  'ticketmaster.it':    { assetId: '2038766', programId: '23899', countryCode: 'IT' },
  'ticketmaster.es':    { assetId: '2038750', programId: '23886', countryCode: 'ES' },
  'ticketmaster.dk':    { assetId: '2038756', programId: '23893', countryCode: 'DK' },
  'ticketmaster.ch':    { assetId: '2038765', programId: '23898', countryCode: 'CH' },
  'ticketmaster.no':    { assetId: '2038767', programId: '23900', countryCode: 'NO' },
  'ticketmaster.se':    { assetId: '2038747', programId: '23885', countryCode: 'SE' },
  'ticketmaster.fi':    { assetId: '2038755', programId: '23892', countryCode: 'FI' },
};

const MARKET_BY_IDS = Object.fromEntries(
  Object.values(MARKET_MAP).map((cfg) => [`${cfg.assetId}|${cfg.programId}`, cfg])
);

const MARKET_HOSTS = Object.keys(MARKET_MAP);

const PRIMARY_MARKET_HOST_BY_CC = {
  CZ: 'ticketmaster.cz',
  GB: 'ticketmaster.co.uk',
  DE: 'ticketmaster.de',
  PL: 'ticketmaster.pl',
  AT: 'ticketmaster.at',
  IE: 'ticketmaster.ie',
  FR: 'ticketmaster.fr',
  NL: 'ticketmaster.nl',
  BE: 'ticketmaster.be',
  IT: 'ticketmaster.it',
  ES: 'ticketmaster.es',
  DK: 'ticketmaster.dk',
  CH: 'ticketmaster.ch',
  NO: 'ticketmaster.no',
  SE: 'ticketmaster.se',
  FI: 'ticketmaster.fi',
};

const SUPPORTED_MARKET_COUNTRIES = new Set(Object.keys(PRIMARY_MARKET_HOST_BY_CC));

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
  'cc',
  'country',
  'countryCode',
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

// CRITICAL AFFILIATE SAFETY INVARIANT:
// In normal production mode the customer's browser must never be sent through
// Impact sync/tracking hosts (ticketmaster.evyy.net / ojrq.net). Netlify resolves
// that chain server-side and returns only the final seller URL. Raw Impact
// browser navigation is available solely via the explicit emergency
// TM_IMPACT_TRACKING_MODE=affiliate override.
//
// Do not reintroduce a browser-side reachability/adaptive fallback here.
function normalizeHost(hostname = '') {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function normalizeCountryCode(value = '') {
  const cc = String(value || '').trim().toUpperCase();

  if (cc === 'UK') return 'GB';
  if (/^[A-Z]{2}$/.test(cc)) return cc;

  return '';
}

function isImpactTicketmasterHost(hostname = '') {
  return normalizeHost(hostname) === 'ticketmaster.evyy.net';
}

/**
 * Vrátí základní Ticketmaster / TicketWeb market host.
 *
 * Ticketmaster často používá subdomény, např.:
 * - attractions.ticketmaster.co.uk
 * - shop.ticketmaster.co.uk
 *
 * Ty musí spadnout pod ticketmaster.co.uk, jinak by se chybně vyhodnotily
 * jako nenamapovaný market.
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

function isGenericTicketmasterComHost(hostname = '') {
  const host = normalizeHost(hostname);
  return host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com');
}

function isTicketmasterDestinationHost(hostname = '') {
  const host = normalizeHost(hostname);

  if (!host || isImpactTicketmasterHost(host)) return false;

  // Primárně povolujeme země, pro které máme Impact mapu.
  if (getTicketmasterMarketHost(host)) return true;

  // Generic .com technicky povolíme jako typ destination hostu.
  // Jestli ho pustíme dál, rozhoduje validateDestinationForExpectedCountry().
  if (isGenericTicketmasterComHost(host)) {
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

function fallbackUrlForCountry(countryCode = '') {
  const cc = normalizeCountryCode(countryCode);
  const host = PRIMARY_MARKET_HOST_BY_CC[cc];

  if (!host) {
    return DEFAULT_FALLBACK_URL;
  }

  return `https://www.${host}/`;
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
 * 3) přímý TicketWeb UK link
 * 4) přímý Universe link
 * 5) Impact link s parametrem u=...
 * 6) Ticketmaster link s vnořeným parametrem to/url obsahujícím Impact link
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

        // B2) Vnořený přímý Ticketmaster / TicketWeb / Universe link.
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

/**
 * Country-aware validace.
 *
 * Bez expectedCountry necháváme původní kompatibilní chování:
 * - mapped TM market => affiliate wrapper
 * - Universe => direct
 * - generic ticketmaster.com => direct
 *
 * S expectedCountry:
 * - mapped market musí sedět s cc
 * - generic ticketmaster.com pro podporované evropské markety blokujeme
 * - Universe necháváme projít jako direct, protože nemá marketovou TM doménu
 */
function validateDestinationForExpectedCountry(destinationUrl = '', expectedCountry = '', extractedMarket = null) {
  const expectedCc = normalizeCountryCode(expectedCountry);

  if (!expectedCc) {
    return { ok: true, reason: 'no_expected_country' };
  }

  // Pokud expected country není v podporovaných TM marketech, nebudeme ji tvrdě blokovat.
  if (!SUPPORTED_MARKET_COUNTRIES.has(expectedCc)) {
    return { ok: true, reason: 'unsupported_expected_country' };
  }

  try {
    const parsed = new URL(destinationUrl);
    const host = normalizeHost(parsed.hostname);

    if (isUniverseHost(host)) {
      return { ok: true, reason: 'universe_direct' };
    }

    if (isGenericTicketmasterComHost(host)) {
      return {
        ok: false,
        reason: `generic_ticketmaster_com_blocked_for_${expectedCc}`
      };
    }

    const destinationMarket = extractedMarket || getMarketConfig(destinationUrl);

    if (destinationMarket?.countryCode && destinationMarket.countryCode !== expectedCc) {
      return {
        ok: false,
        reason: `market_mismatch_${destinationMarket.countryCode}_for_${expectedCc}`
      };
    }

    const marketHost = getTicketmasterMarketHost(host);

    if (marketHost) {
      const marketCfg = MARKET_MAP[marketHost];

      if (marketCfg?.countryCode && marketCfg.countryCode !== expectedCc) {
        return {
          ok: false,
          reason: `host_mismatch_${marketCfg.countryCode}_for_${expectedCc}`
        };
      }
    }

    return { ok: true, reason: 'market_matches_expected_country' };
  } catch {
    return { ok: false, reason: 'invalid_destination_url' };
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

const SERVER_RESOLVE_MAX_HOPS = 8;
const SERVER_RESOLVE_TIMEOUT_MS = 3500;
const SERVER_RESOLVE_TOTAL_MS = 9000;

function isImpactSyncHost(hostname = '') {
  return normalizeHost(hostname) === 'ojrq.net';
}

function isAllowedImpactResolverHost(hostname = '') {
  return (
    isImpactTicketmasterHost(hostname) ||
    isImpactSyncHost(hostname) ||
    isAllowedDestinationHost(hostname)
  );
}

function getSetCookieHeaders(headers) {
  try {
    if (typeof headers?.getSetCookie === 'function') {
      return headers.getSetCookie();
    }
  } catch {
    // noop
  }

  const raw = headers?.get?.('set-cookie');
  return raw ? [raw] : [];
}

function cookiePairsFromSetCookie(setCookieHeaders = []) {
  return setCookieHeaders
    .map((raw) => String(raw || '').split(';', 1)[0].trim())
    .filter((pair) => /^[^=;\s]+=[^;]*$/.test(pair));
}

function mergeCookiePairs(existing = [], incoming = []) {
  const byName = new Map();

  for (const pair of [...existing, ...incoming]) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    byName.set(pair.slice(0, eq), pair);
  }

  return [...byName.values()];
}

function hasAffiliateEvidence(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    const p = parsed.searchParams;

    return Boolean(
      p.get('clickId') ||
      p.get('irclickid') ||
      p.get('irgwc') === '1' ||
      p.get('afsrc') === '1' ||
      p.get('ircid') ||
      p.get('camefrom') ||
      p.get('utm_campaign') === AJSEE_IMPACT_ID ||
      String(p.get('utm_source') || '').includes(AJSEE_IMPACT_ID)
    );
  } catch {
    return false;
  }
}

async function resolveAffiliateServerSide(
  affiliateUrl = '',
  {
    userAgent = '',
    acceptLanguage = '',
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
  } = {}
) {
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      reason: 'fetch_unavailable',
      url: '',
      hops: 0,
    };
  }

  let current = String(affiliateUrl || '').trim();
  if (!current) {
    return {
      ok: false,
      reason: 'missing_affiliate_url',
      url: '',
      hops: 0,
    };
  }

  const startedAt = now();
  const cookieJar = new Map();

  for (
    let hop = 0;
    hop < SERVER_RESOLVE_MAX_HOPS;
    hop += 1
  ) {
    if (now() - startedAt > SERVER_RESOLVE_TOTAL_MS) {
      return {
        ok: false,
        reason: 'total_timeout',
        url: '',
        hops: hop,
      };
    }

    let parsed;

    try {
      parsed = new URL(current);
    } catch {
      return {
        ok: false,
        reason: 'invalid_redirect_url',
        url: '',
        hops: hop,
      };
    }

    if (!/^https:$/i.test(parsed.protocol)) {
      return {
        ok: false,
        reason: 'non_https_redirect',
        url: '',
        hops: hop,
      };
    }

    if (!isAllowedImpactResolverHost(parsed.hostname)) {
      return {
        ok: false,
        reason: `blocked_redirect_host:${normalizeHost(parsed.hostname)}`,
        url: '',
        hops: hop,
      };
    }

    if (isAllowedDestinationHost(parsed.hostname)) {
      return {
        ok: true,
        reason: hasAffiliateEvidence(parsed.toString())
          ? 'ticketmaster_with_affiliate_evidence'
          : 'ticketmaster_destination',
        url: parsed.toString(),
        hops: hop,
        affiliateEvidence:
          hasAffiliateEvidence(parsed.toString()),
      };
    }

    const hostKey = normalizeHost(parsed.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SERVER_RESOLVE_TIMEOUT_MS
    );

    const requestHeaders = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    };

    if (userAgent) {
      requestHeaders['User-Agent'] =
        String(userAgent).slice(0, 500);
    }

    if (acceptLanguage) {
      requestHeaders['Accept-Language'] =
        String(acceptLanguage).slice(0, 300);
    }

    const hostCookies =
      cookieJar.get(hostKey) || [];

    if (hostCookies.length) {
      requestHeaders.Cookie =
        hostCookies.join('; ');
    }

    try {
      const response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: requestHeaders,
        signal: controller.signal,
      });

      const incomingCookies =
        cookiePairsFromSetCookie(
          getSetCookieHeaders(response.headers)
        );

      if (incomingCookies.length) {
        cookieJar.set(
          hostKey,
          mergeCookiePairs(
            hostCookies,
            incomingCookies
          )
        );
      }

      const location =
        response.headers?.get?.('location');

      if (location) {
        const next =
          new URL(location, current);

        if (
          !/^https:$/i.test(next.protocol) ||
          !isAllowedImpactResolverHost(next.hostname)
        ) {
          return {
            ok: false,
            reason: `blocked_location:${normalizeHost(next.hostname)}`,
            url: '',
            hops: hop + 1,
          };
        }

        current = next.toString();
        continue;
      }

      /*
       * Impact's sync endpoint normally answers with a 3xx Location.
       * If a variant answers without one, its signed "return" parameter
       * still identifies the next official Impact URL. We only use it when
       * it resolves back to ticketmaster.evyy.net.
       */
      if (isImpactSyncHost(parsed.hostname)) {
        const returnUrl =
          parsed.searchParams.get('return');

        const next =
          parseUrlMaybe(returnUrl);

        if (
          next &&
          isImpactTicketmasterHost(next.hostname) &&
          /^https:$/i.test(next.protocol)
        ) {
          current = next.toString();
          continue;
        }
      }

      return {
        ok: false,
        reason: `no_redirect:${response.status || 0}`,
        url: '',
        hops: hop + 1,
      };
    } catch (error) {
      return {
        ok: false,
        reason:
          error?.name === 'AbortError'
            ? 'hop_timeout'
            : (error?.message || String(error)),
        url: '',
        hops: hop + 1,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    reason: 'max_hops',
    url: '',
    hops: SERVER_RESOLVE_MAX_HOPS,
  };
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

  const expectedCountry =
    normalizeCountryCode(q.cc) ||
    normalizeCountryCode(q.countryCode) ||
    normalizeCountryCode(q.country) ||
    '';

  const extracted = extractDestination(rawUrl);
  const cleanDestinationUrl = extracted.url;

  if (!cleanDestinationUrl) {
    return safeRedirect(fallbackUrlForCountry(expectedCountry));
  }

  const validation = validateDestinationForExpectedCountry(
    cleanDestinationUrl,
    expectedCountry,
    extracted.market
  );

  if (!validation.ok) {
    console.warn('[tmOutbound] blocked destination:', {
      reason: validation.reason,
      expectedCountry,
      destinationHost: (() => {
        try {
          return new URL(cleanDestinationUrl).hostname;
        } catch {
          return '';
        }
      })()
    });

    return safeRedirect(fallbackUrlForCountry(expectedCountry));
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

  if (IMPACT_TRACKING_MODE === 'direct') {
    return safeRedirect(cleanDestinationUrl);
  }

  if (IMPACT_TRACKING_MODE === 'affiliate') {
    return safeRedirect(affiliateUrl);
  }

  const resolved =
    await resolveAffiliateServerSide(
      affiliateUrl,
      {
        userAgent:
          event?.headers?.['user-agent'] ||
          event?.headers?.['User-Agent'] ||
          '',
        acceptLanguage:
          event?.headers?.['accept-language'] ||
          event?.headers?.['Accept-Language'] ||
          '',
      }
    );

  if (resolved.ok && resolved.url) {
    console.info(
      '[tmOutbound] Impact resolved server-side:',
      {
        eventId,
        expectedCountry,
        hops: resolved.hops,
        affiliateEvidence:
          resolved.affiliateEvidence === true,
      }
    );

    return safeRedirect(resolved.url);
  }

  console.warn(
    '[tmOutbound] Server-side Impact resolution failed; using direct seller fallback:',
    {
      eventId,
      expectedCountry,
      reason: resolved.reason,
      hops: resolved.hops,
    }
  );

  // CRITICAL: never expose the raw Impact/ojrq chain to the customer's browser
  // from the default server mode. A direct seller fallback can lose affiliate
  // attribution for this click, but it preserves a working purchase journey.
  return safeRedirect(cleanDestinationUrl);
};
