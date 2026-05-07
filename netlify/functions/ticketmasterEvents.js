// /netlify/functions/ticketmasterEvents.js
// ---------------------------------------------------------
// Netlify proxy pro Ticketmaster Discovery API (ESM, single handler)
//
// - Priorita geo: latlong > city > countryCode
// - City + countryCode:
//   countryCode s city neposíláme přímo do Ticketmasteru,
//   ale použijeme ho lokálně po fetchi k odfiltrování správné země.
// - CORS + OPTIONS preflight
// - Timeout přes AbortController
// - Clamping size
// - Datumy: "YYYY-MM-DD" / "dd.mm.yyyy" → ISO8601 Z
// - unit=km → radius konvertujeme na míle
// - Rozšířený whitelist locale včetně FR/ES/NL/IT/DK/SE/FI/NO
// - Přijímá countryCode i countryCodes jako CSV
// ---------------------------------------------------------

/** Parse UI date formats to ISO8601 Z (start/end of day). */
function toIsoDay(dateStr, endOfDay = false) {
  if (!dateStr) return '';

  let y, m, d;

  const reIso = /^(\d{4})-(\d{2})-(\d{2})$/;      // YYYY-MM-DD
  const reCz = /^(\d{2})\.(\d{2})\.(\d{4})$/;     // dd.mm.yyyy

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

    const res = new Date(
      Date.UTC(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate(),
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0
      )
    );

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
  'access-control-allow-headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
};

// DŮLEŽITÉ:
// Ticketmaster markety jako FR/ES/NL potřebují vlastní locale.
// Bez toho Paříž / Madrid / Amsterdam mohou vracet prázdno nebo špatné .com výsledky.
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

async function safeFetch(input, init) {
  if (typeof fetch === 'function') {
    return fetch(input, init);
  }

  throw new Error('Fetch is not available in this Node runtime. Use Node >= 18 or provide a fetch polyfill.');
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}

function getCountryFromVenue(ev) {
  const venue = ev?._embedded?.venues?.[0] || {};
  const countryCode = String(venue?.country?.countryCode || '').trim().toUpperCase();

  if (countryCode) return countryCode;

  const countryName = String(venue?.country?.name || '').trim().toUpperCase();

  // Defenzivní fallback, kdyby TM někdy neposlal countryCode.
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
    BELGIUM: 'BE',
    ITALY: 'IT',
    DENMARK: 'DK',
    SWEDEN: 'SE',
    FINLAND: 'FI',
    NORWAY: 'NO',
    IRELAND: 'IE',
    'UNITED KINGDOM': 'GB',
    UK: 'GB',
    'GREAT BRITAIN': 'GB'
  };

  return byName[countryName] || '';
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

    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    const q = event?.queryStringParameters || {};

    const API_KEY =
      process.env.TM_API_KEY ||
      process.env.TICKETMASTER_API_KEY;

    if (!API_KEY) {
      console.error('[ticketmasterEvents] Missing API key');
      return json(500, { error: 'Missing TM_API_KEY/TICKETMASTER_API_KEY' });
    }

    const BASE = (process.env.TM_BASE_URL || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, '');
    const url = new URL(`${BASE}/events.json`);

    url.searchParams.set('apikey', API_KEY);

    // Locale
    const rawLocale = String(q.locale || '').trim().toLowerCase();

    if (rawLocale && LOCALE_WHITELIST.has(rawLocale)) {
      url.searchParams.set('locale', rawLocale);
    }

    // Geo priorita: latlong > city > countryCode
    const latlong = String(q.latlong || '').trim();
    const cityParam = String(q.city || '').trim();

    const ccRaw = String(q.countryCode || q.countryCodes || '').trim();
    const ccList = ccRaw
      ? ccRaw
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : [];

    const countryCode = ccList[0] || '';

    if (latlong) {
      url.searchParams.set('latlong', latlong);

      let radius = Number(q.radius);

      if (!Number.isFinite(radius) || radius <= 0) {
        radius = 50;
      }

      const unitIn = String(q.unit || 'km').toLowerCase();

      const miles = unitIn === 'km'
        ? Math.max(1, Math.round(radius * 0.621371))
        : Math.max(1, Math.round(radius));

      url.searchParams.set('radius', String(miles));
      url.searchParams.set('unit', 'miles');
    } else if (cityParam) {
      url.searchParams.set('city', cityParam);

      // Záměrně neposíláme countryCode k city přímo do TM.
      // Některé markety se s city+countryCode chovají nekonzistentně.
      // Country filtr aplikujeme až lokálně po odpovědi.
    } else if (countryCode) {
      url.searchParams.set('countryCode', countryCode);
    }

    // Řazení
    url.searchParams.set('sort', toTmSort(q.sort));

    // Date range
    const startDateTime = q.startDateTime || toIsoDay(q.dateFrom, false);
    const endDateTime = q.endDateTime || toIsoDay(q.dateTo, true);

    if (startDateTime) {
      url.searchParams.set('startDateTime', startDateTime);
    }

    if (endDateTime) {
      url.searchParams.set('endDateTime', endDateTime);
    }

    // Segment / classification
    if (q.segmentName) {
      url.searchParams.set('segmentName', String(q.segmentName));
    }

    if (q.classificationName) {
      url.searchParams.set('classificationName', String(q.classificationName));
    }

    // Passthrough whitelist
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

    if (!url.searchParams.has('size')) {
      url.searchParams.set('size', '50');
    }

    const finalUrl = url.toString();

    console.log(
      '[ticketmasterEvents] →',
      finalUrl.replace(/apikey=[^&]+/, 'apikey=***')
    );

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

    // Lokální disambiguace:
    // Pokud přišlo city + countryCode, necháme pouze eventy ve správné zemi.
    if (resp.ok && cityParam && countryCode && text) {
      try {
        const parsed = JSON.parse(text);
        const events = parsed?._embedded?.events;

        if (Array.isArray(events)) {
          const filtered = events.filter((ev) => {
            const evCountry = getCountryFromVenue(ev);
            return evCountry === countryCode;
          });

          if (filtered.length !== events.length) {
            parsed._embedded = parsed._embedded || {};
            parsed._embedded.events = filtered;

            if (parsed.page && typeof parsed.page === 'object') {
              parsed.page.totalElements = filtered.length;
              parsed.page.totalPages = filtered.length ? 1 : 0;
              parsed.page.number = 0;
              parsed.page.size = filtered.length;
            }

            text = JSON.stringify(parsed);
          }
        }
      } catch (e) {
        console.warn('[ticketmasterEvents] country filter parse fail:', e?.message || e);
      }
    }

    if (!resp.ok) {
      console.error('[ticketmasterEvents] Upstream error', resp.status, text.slice(0, 500));
    }

    return {
      statusCode: resp.status,
      headers: {
        ...CORS_HEADERS,
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      },
      body: text
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';

    console.error('[ticketmasterEvents] Error:', err);

    return json(
      isAbort ? 504 : 500,
      {
        error: isAbort ? 'Upstream timeout' : (err?.message || String(err))
      }
    );
  }
};