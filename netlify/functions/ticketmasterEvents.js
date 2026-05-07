// /netlify/functions/ticketmasterEvents.js
// ---------------------------------------------------------
// Netlify proxy pro Ticketmaster Discovery API (ESM, single handler)
//
// Stabilizační verze po rate-limit incidentu:
// - server-side in-memory cache pro úspěšné odpovědi,
// - stale cache fallback při 429 / upstream chybě,
// - při 429 bez cache vrací bezpečný prázdný TM-like payload se status 200,
// - zachovává CORS, country/city interpretaci, debug režim a lokální country filtr.
// ---------------------------------------------------------

const RESPONSE_CACHE = globalThis.__ajsee_tm_events_response_cache ||
  (globalThis.__ajsee_tm_events_response_cache = new Map());

const FRESH_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 45 * 60 * 1000;

function cacheGet(key, { allowStale = false } = {}) {
  const hit = RESPONSE_CACHE.get(key);
  if (!hit) return null;

  const age = Date.now() - hit.ts;
  if (age <= FRESH_TTL_MS) return { ...hit, cacheState: 'fresh' };
  if (allowStale && age <= STALE_TTL_MS) return { ...hit, cacheState: 'stale' };

  RESPONSE_CACHE.delete(key);
  return null;
}

function cacheSet(key, body, statusCode = 200) {
  if (!key || !body || statusCode !== 200) return;

  RESPONSE_CACHE.set(key, {
    ts: Date.now(),
    body,
    statusCode
  });
}

function toIsoDay(dateStr, endOfDay = false) {
  if (!dateStr) return '';

  let y, m, d;
  const reIso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const reCz = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  if (reIso.test(dateStr)) {
    const m1 = dateStr.match(reIso);
    y = m1[1];
    m = m1[2];
    d = m1[3];
  } else if (reCz.test(dateStr)) {
    const m2 = dateStr.match(reCz);
    d = m2[1];
    m = m2[2];
    y = m2[3];
  } else {
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return '';

    const res = new Date(Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0
    ));

    return res.toISOString();
  }

  const hh = endOfDay ? '23' : '00';
  const mm = endOfDay ? '59' : '00';
  const ss = endOfDay ? '59' : '00';

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
}

function toTmSort(s) {
  if (s === 'nearest') return 'date,asc';
  if (s === 'latest') return 'date,desc';
  if (s === 'date,asc' || s === 'date,desc') return s;
  return 'date,asc';
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
};

const LOCALE_WHITELIST = new Set([
  'en', 'en-us', 'en-gb',
  'cs', 'cs-cz',
  'sk', 'sk-sk',
  'pl', 'pl-pl',
  'hu', 'hu-hu',
  'de', 'de-de', 'de-at', 'de-ch',
  'fr', 'fr-fr', 'fr-be',
  'nl', 'nl-nl', 'nl-be',
  'es', 'es-es',
  'it', 'it-it',
  'da', 'da-dk',
  'sv', 'sv-se',
  'fi', 'fi-fi',
  'nb', 'nb-no',
  'no', 'no-no'
]);

function foldText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COUNTRY_ALIASES = Object.create(null);

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();
  if (!cc) return;

  for (const alias of aliases) {
    const key = foldText(alias);
    if (key) COUNTRY_ALIASES[key] = cc;
  }
}

addCountryAliases('CZ', ['CZ', 'Czechia', 'Czech Republic', 'Česko', 'Cesko', 'Česká republika', 'Ceska republika']);
addCountryAliases('SK', ['SK', 'Slovakia', 'Slovensko', 'Slovenská republika', 'Slovenska republika']);
addCountryAliases('PL', ['PL', 'Poland', 'Polsko', 'Polska']);
addCountryAliases('HU', ['HU', 'Hungary', 'Maďarsko', 'Madarsko', 'Magyarország', 'Magyarorszag']);
addCountryAliases('DE', ['DE', 'Germany', 'Německo', 'Nemecko', 'Deutschland', 'Germania']);
addCountryAliases('AT', ['AT', 'Austria', 'Rakousko', 'Österreich', 'Osterreich']);
addCountryAliases('CH', ['CH', 'Switzerland', 'Švýcarsko', 'Svycarsko', 'Schweiz', 'Suisse', 'Svizzera']);
addCountryAliases('FR', ['FR', 'France', 'Francie', 'Francia', 'Frankreich']);
addCountryAliases('ES', ['ES', 'Spain', 'Španělsko', 'Spanelsko', 'España', 'Espana']);
addCountryAliases('NL', ['NL', 'Netherlands', 'The Netherlands', 'Nizozemsko', 'Holandsko', 'Nederland', 'Holland']);
addCountryAliases('BE', ['BE', 'Belgium', 'Belgie', 'Belgique', 'België']);
addCountryAliases('IT', ['IT', 'Italy', 'Itálie', 'Italie', 'Italia']);
addCountryAliases('DK', ['DK', 'Denmark', 'Dánsko', 'Dansko', 'Danmark']);
addCountryAliases('SE', ['SE', 'Sweden', 'Švédsko', 'Svedsko', 'Sverige']);
addCountryAliases('FI', ['FI', 'Finland', 'Finsko', 'Suomi']);
addCountryAliases('NO', ['NO', 'Norway', 'Norsko', 'Norge']);
addCountryAliases('IE', ['IE', 'Ireland', 'Irsko', 'Éire', 'Eire']);
addCountryAliases('GB', ['GB', 'UK', 'United Kingdom', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Velká Británie', 'Velka Britanie', 'Spojené království', 'Spojene kralovstvi', 'Anglie']);

function countryCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) {
    if (upper === 'UK') return 'GB';
    return upper;
  }

  return COUNTRY_ALIASES[foldText(raw)] || '';
}

async function safeFetch(input, init) {
  if (typeof fetch === 'function') return fetch(input, init);
  throw new Error('Fetch is not available in this Node runtime. Use Node >= 18 or provide a fetch polyfill.');
}

function headers(extra = {}) {
  return {
    ...CORS_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra
  };
}

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: headers(extraHeaders),
    body: JSON.stringify(data)
  };
}

function responseFromBody(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: headers(extraHeaders),
    body
  };
}

function emptyTicketmasterPayload(q = {}, meta = {}) {
  const page = Math.max(0, parseInt(q.page || '0', 10) || 0);
  const size = Math.max(1, Math.min(200, parseInt(q.size || '12', 10) || 12));

  return {
    _embedded: {
      events: []
    },
    page: {
      size,
      totalElements: 0,
      totalPages: 0,
      number: page
    },
    _ajseeProxy: meta
  };
}

function getCountryFromVenue(ev) {
  const venue = ev?._embedded?.venues?.[0] || {};
  const countryCode = String(venue?.country?.countryCode || '').trim().toUpperCase();
  if (countryCode) return countryCode;

  const countryName = String(venue?.country?.name || '').trim().toUpperCase();
  const byName = {
    CZECHIA: 'CZ',
    'CZECH REPUBLIC': 'CZ',
    SLOVAKIA: 'SK',
    POLAND: 'PL',
    HUNGARY: 'HU',
    GERMANY: 'DE',
    AUSTRIA: 'AT',
    SWITZERLAND: 'CH',
    FRANCE: 'FR',
    SPAIN: 'ES',
    NETHERLANDS: 'NL',
    HOLLAND: 'NL',
    BELGIUM: 'BE',
    ITALY: 'IT',
    DENMARK: 'DK',
    SWEDEN: 'SE',
    FINLAND: 'FI',
    NORWAY: 'NO',
    IRELAND: 'IE',
    'UNITED KINGDOM': 'GB',
    UK: 'GB',
    'GREAT BRITAIN': 'GB',
    ENGLAND: 'GB',
    SCOTLAND: 'GB',
    WALES: 'GB',
    'NORTHERN IRELAND': 'GB'
  };

  return byName[countryName] || '';
}

function getHostFromUrl(rawUrl) {
  try {
    return rawUrl ? new URL(rawUrl).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

function buildDebugPayload({
  parsed,
  countryStrategy,
  finalUrl,
  rawLocale,
  originalCityParam,
  effectiveCityParam,
  cityInputCountryCode,
  countryParam,
  countryParamCountryCode,
  countryCode,
  latlong,
  q
}) {
  const rawEvents = parsed?._embedded?.events;
  const events = Array.isArray(rawEvents) ? rawEvents : [];

  return {
    countryStrategy,
    interpretedInput: {
      originalCity: originalCityParam || '',
      effectiveCity: effectiveCityParam || '',
      cityWasInterpretedAsCountry: Boolean(originalCityParam && cityInputCountryCode),
      cityInputCountryCode: cityInputCountryCode || '',
      countryParam: countryParam || '',
      countryParamCountryCode: countryParamCountryCode || '',
      finalCountryCode: countryCode || ''
    },
    requested: {
      city: effectiveCityParam || '',
      originalCity: originalCityParam || '',
      countryCode: countryCode || '',
      locale: rawLocale || '',
      segmentName: q.segmentName || '',
      classificationName: q.classificationName || '',
      keyword: q.keyword || '',
      dateFrom: q.dateFrom || '',
      dateTo: q.dateTo || '',
      startDateTime: q.startDateTime || '',
      endDateTime: q.endDateTime || '',
      latlong: latlong || ''
    },
    upstreamUrl: finalUrl.replace(/apikey=[^&]+/, 'apikey=***'),
    rawCountOnPage: events.length,
    rawPage: parsed?.page || null,
    samples: events.slice(0, 12).map((ev) => {
      const venue = ev?._embedded?.venues?.[0] || {};
      return {
        name: ev?.name || '',
        eventId: ev?.id || '',
        city: venue?.city?.name || '',
        countryCode: getCountryFromVenue(ev),
        host: getHostFromUrl(ev?.url || ''),
        url: ev?.url || ''
      };
    })
  };
}

function makeCacheKey(finalUrl) {
  return String(finalUrl || '').replace(/apikey=[^&]+/, 'apikey=***');
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          ...CORS_HEADERS,
          'content-length': '0'
        },
        body: ''
      };
    }

    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const q = event?.queryStringParameters || {};

    const API_KEY = process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY;
    if (!API_KEY) {
      console.error('[ticketmasterEvents] Missing API key');
      return json(500, { error: 'Missing TM_API_KEY/TICKETMASTER_API_KEY' });
    }

    const BASE = (process.env.TM_BASE_URL || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, '');
    const url = new URL(`${BASE}/events.json`);
    url.searchParams.set('apikey', API_KEY);

    const rawLocale = String(q.locale || '').trim().toLowerCase();
    if (rawLocale && LOCALE_WHITELIST.has(rawLocale)) url.searchParams.set('locale', rawLocale);

    const rawCountryStrategy = String(q.countryStrategy || '').trim().toLowerCase();
    const countryStrategy = ['local', 'upstream', 'both', 'none'].includes(rawCountryStrategy)
      ? rawCountryStrategy
      : 'local';

    const debugMode = q.debug === '1' || q.ajseeDebug === '1';

    const latlong = String(q.latlong || '').trim();
    const originalCityParam = String(q.city || '').trim();
    const countryParam = String(q.country || '').trim();

    const ccRaw = String(q.countryCode || q.countryCodes || '').trim();
    const ccList = ccRaw
      ? ccRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const cityInputCountryCode = countryCodeFromInput(originalCityParam);
    const countryParamCountryCode = countryCodeFromInput(countryParam);
    const effectiveCityParam = cityInputCountryCode ? '' : originalCityParam;

    const countryCode = ccList[0] || countryParamCountryCode || cityInputCountryCode || '';

    if (latlong) {
      url.searchParams.set('latlong', latlong);

      let radius = Number(q.radius);
      if (!Number.isFinite(radius) || radius <= 0) radius = 50;

      const unitIn = String(q.unit || 'km').toLowerCase();
      const miles = unitIn === 'km'
        ? Math.max(1, Math.round(radius * 0.621371))
        : Math.max(1, Math.round(radius));

      url.searchParams.set('radius', String(miles));
      url.searchParams.set('unit', 'miles');
    } else if (effectiveCityParam) {
      url.searchParams.set('city', effectiveCityParam);

      if (countryCode && (countryStrategy === 'upstream' || countryStrategy === 'both')) {
        url.searchParams.set('countryCode', countryCode);
      }
    } else if (countryCode) {
      url.searchParams.set('countryCode', countryCode);
    }

    url.searchParams.set('sort', toTmSort(q.sort));

    const startDateTime = q.startDateTime || toIsoDay(q.dateFrom, false);
    const endDateTime = q.endDateTime || toIsoDay(q.dateTo, true);
    if (startDateTime) url.searchParams.set('startDateTime', startDateTime);
    if (endDateTime) url.searchParams.set('endDateTime', endDateTime);

    if (q.segmentName) url.searchParams.set('segmentName', String(q.segmentName));
    if (q.classificationName) url.searchParams.set('classificationName', String(q.classificationName));

    const passthrough = [
      'keyword',
      'venueId',
      'attractionId',
      'dmaId',
      'marketId',
      'page',
      'size'
    ];

    for (const key of passthrough) {
      const val = q[key];
      if (val === undefined || val === null || val === '') continue;

      if (key === 'size') {
        const n = Math.max(1, Math.min(200, parseInt(val, 10) || 50));
        url.searchParams.set('size', String(n));
      } else {
        url.searchParams.set(key, String(val));
      }
    }

    if (!url.searchParams.has('size')) url.searchParams.set('size', '50');

    const finalUrl = url.toString();
    const cacheKey = makeCacheKey(finalUrl);

    if (!debugMode) {
      const fresh = cacheGet(cacheKey);
      if (fresh) {
        return responseFromBody(fresh.statusCode || 200, fresh.body, { 'x-ajsee-cache': 'fresh' });
      }
    }

    if (debugMode) {
      console.log('[ticketmasterEvents] →', finalUrl.replace(/apikey=[^&]+/, 'apikey=***'));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let resp;
    try {
      resp = await safeFetch(finalUrl, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AJSEE/NetlifyFunction'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    let text = await resp.text();

    if (!resp.ok) {
      console.error('[ticketmasterEvents] Upstream error', resp.status, text.slice(0, 500));

      const stale = !debugMode ? cacheGet(cacheKey, { allowStale: true }) : null;
      if (stale) {
        return responseFromBody(200, stale.body, {
          'x-ajsee-cache': 'stale-if-error',
          'x-ajsee-upstream-status': String(resp.status)
        });
      }

      if (resp.status === 429) {
        return json(200, emptyTicketmasterPayload(q, {
          upstreamStatus: 429,
          reason: 'ticketmaster_rate_limited'
        }), {
          'x-ajsee-cache': 'empty-rate-limited',
          'x-ajsee-upstream-status': '429'
        });
      }

      return responseFromBody(resp.status, text, { 'x-ajsee-upstream-status': String(resp.status) });
    }

    let ajseeDebug = null;

    if (text && debugMode) {
      try {
        const parsedForDebug = JSON.parse(text);
        ajseeDebug = buildDebugPayload({
          parsed: parsedForDebug,
          countryStrategy,
          finalUrl,
          rawLocale,
          originalCityParam,
          effectiveCityParam,
          cityInputCountryCode,
          countryParam,
          countryParamCountryCode,
          countryCode,
          latlong,
          q
        });
      } catch (e) {
        ajseeDebug = {
          countryStrategy,
          debugParseError: e?.message || String(e),
          upstreamUrl: finalUrl.replace(/apikey=[^&]+/, 'apikey=***'),
          interpretedInput: {
            originalCity: originalCityParam || '',
            effectiveCity: effectiveCityParam || '',
            cityWasInterpretedAsCountry: Boolean(originalCityParam && cityInputCountryCode),
            cityInputCountryCode: cityInputCountryCode || '',
            countryParam: countryParam || '',
            countryParamCountryCode: countryParamCountryCode || '',
            finalCountryCode: countryCode || ''
          }
        };
      }
    }

    const shouldApplyLocalCountryFilter =
      effectiveCityParam &&
      countryCode &&
      (countryStrategy === 'local' || countryStrategy === 'both');

    if (shouldApplyLocalCountryFilter && text) {
      try {
        const parsed = JSON.parse(text);
        const events = parsed?._embedded?.events;

        if (Array.isArray(events)) {
          const filtered = events.filter((ev) => getCountryFromVenue(ev) === countryCode);

          if (ajseeDebug) ajseeDebug.afterLocalCountryFilterCount = filtered.length;

          if (filtered.length !== events.length) {
            parsed._embedded = parsed._embedded || {};
            parsed._embedded.events = filtered;

            if (parsed.page && typeof parsed.page === 'object') {
              parsed.page.totalElements = filtered.length;
              parsed.page.totalPages = filtered.length ? 1 : 0;
              parsed.page.number = 0;
              parsed.page.size = filtered.length;
            }
          }

          if (debugMode && ajseeDebug) {
            parsed._ajseeDebug = {
              ...ajseeDebug,
              afterLocalCountryFilterCount: filtered.length
            };
          }

          text = JSON.stringify(parsed);
        }
      } catch (e) {
        console.warn('[ticketmasterEvents] country filter parse fail:', e?.message || e);
      }
    }

    if (debugMode && ajseeDebug && text) {
      try {
        const parsed = JSON.parse(text);

        if (!parsed._ajseeDebug) {
          parsed._ajseeDebug = ajseeDebug;
          text = JSON.stringify(parsed);
        }
      } catch (e) {
        console.warn('[ticketmasterEvents] debug attach fail:', e?.message || e);
      }
    }

    if (!debugMode) cacheSet(cacheKey, text, 200);

    return responseFromBody(200, text, { 'x-ajsee-cache': 'miss' });
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('[ticketmasterEvents] Error:', err);

    return json(
      isAbort ? 504 : 500,
      { error: isAbort ? 'Upstream timeout' : (err?.message || String(err)) }
    );
  }
};
