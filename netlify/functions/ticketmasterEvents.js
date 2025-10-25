// /netlify/functions/ticketmasterEvents.js
// ---------------------------------------------------------
// Netlify proxy pro Ticketmaster Discovery API (ESM)
// - Priorita geo: latlong > city > countryCode
// - Když je city, countryCode NEPOSÍLÁME (TM to doporučuje pro cílené dotazy)
// - Pojistky: TM_API_KEY/TICKETMASTER_API_KEY, CORS/OPTIONS,
//   timeout (AbortController), clamping size, mapování sortu,
//   datumy "YYYY-MM-DD" i "dd.mm.yyyy" -> ISO8601 (00:00/23:59:59Z),
//   unit=km -> radius v mílích (TM očekává miles)
// - Bezpečnější "locale": propouštíme jen známé, jinak nepřidáváme
//   (některé regiony vrací 5xx, když je locale mimo whitelist).
// ---------------------------------------------------------

/** Parse UI date formats to ISO8601 Z (start/end of day). */
function toIsoDay(dateStr, endOfDay = false) {
  if (!dateStr) return '';
  let y, m, d;

  const reIso = /^(\d{4})-(\d{2})-(\d{2})$/;      // YYYY-MM-DD
  const reCz  = /^(\d{2})\.(\d{2})\.(\d{4})$/;    // dd.mm.yyyy

  if (reIso.test(dateStr)) {
    const m1 = dateStr.match(reIso);
    y = m1[1]; m = m1[2]; d = m1[3];
  } else if (reCz.test(dateStr)) {
    const m2 = dateStr.match(reCz);
    d = m2[1]; m = m2[2]; y = m2[3];
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
  // přijmeme už "date,asc|desc" i naše "nearest/latest"
  if (s === 'nearest') return 'date,asc';
  if (s === 'latest')  return 'date,desc';
  if (s === 'date,asc' || s === 'date,desc') return s;
  return 'date,asc';
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
};

// Bezpečnější whitelist lokálů (když přijde jiný, locale vůbec neposíláme)
const LOCALE_WHITELIST = new Set([
  'en', 'en-us', 'de', 'de-de', 'pl', 'pl-pl', 'cs', 'sk', 'hu'
]);

// Malý helper na fetch — zajistí error, když runtime nemá fetch (Node < 18)
async function safeFetch(input, init) {
  if (typeof fetch === 'function') return fetch(input, init);
  // starší runtime → hezká chyba s návodem
  throw new Error(
    'Fetch is not available in this Node runtime. Set Node >= 18 (netlify.toml [functions] node_bundler / [build] environment) or provide a fetch polyfill.'
  );
}

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: { ...CORS_HEADERS, 'content-length': '0' },
        body: '',
      };
    }

    const q = event?.queryStringParameters || {};

    const API_KEY =
      process.env.TM_API_KEY ||             // preferujeme TM_API_KEY
      process.env.TICKETMASTER_API_KEY;     // fallback TICKETMASTER_API_KEY

    if (!API_KEY) {
      console.error('[ticketmasterEvents] Missing API key');
      return json(500, { error: 'Missing TM_API_KEY/TICKETMASTER_API_KEY' });
    }

    const BASE = (process.env.TM_BASE_URL || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, '');
    const url = new URL(`${BASE}/events.json`);
    url.searchParams.set('apikey', API_KEY);

    // Locale – pouze whitelist; neznámý nepošleme (někdy dělá 5xx)
    const rawLocale = (q.locale || '').toString().trim().toLowerCase();
    if (rawLocale && LOCALE_WHITELIST.has(rawLocale)) {
      url.searchParams.set('locale', rawLocale);
    }

    // Geo prioritizace: latlong > city > countryCode
    const latlong = (q.latlong || '').toString().trim(); // "lat,lon"
    const cityParam = (q.city || '').toString().trim();
    const rawCountry = (q.countryCode || '').toString().trim().toUpperCase();

    if (latlong) {
      url.searchParams.set('latlong', latlong);

      let radius = Number(q.radius);
      if (!Number.isFinite(radius) || radius <= 0) radius = 50; // km default (z UI)
      const unit = (q.unit || 'km').toString().toLowerCase();
      // TM používá miles – převedeme, unit nastavíme na miles
      const miles = unit === 'km'
        ? Math.max(1, Math.round(radius * 0.621371))
        : Math.max(1, Math.round(radius));
      url.searchParams.set('radius', String(miles));
      url.searchParams.set('unit', 'miles');
    } else if (cityParam) {
      url.searchParams.set('city', cityParam);
      // TM doporučuje u city NEPOSÍLAT countryCode
    } else if (rawCountry) {
      url.searchParams.set('countryCode', rawCountry);
    }

    // Řazení
    url.searchParams.set('sort', toTmSort(q.sort));

    // Date range
    const startDateTime = q.startDateTime || toIsoDay(q.dateFrom, false);
    const endDateTime   = q.endDateTime   || toIsoDay(q.dateTo,   true);
    if (startDateTime) url.searchParams.set('startDateTime', startDateTime);
    if (endDateTime)   url.searchParams.set('endDateTime', endDateTime);

    // Segment / classification
    if (q.segmentName)        url.searchParams.set('segmentName', String(q.segmentName));
    if (q.classificationName) url.searchParams.set('classificationName', String(q.classificationName));

    // Passthrough whitelist (+ clamp size)
    const passthrough = ['keyword', 'venueId', 'attractionId', 'dmaId', 'marketId', 'page', 'size'];
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
    console.log('[ticketmasterEvents] →', finalUrl.replace(/apikey=[^&]+/, 'apikey=***'));

    // fetch s timeoutem
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);

    let resp;
    try {
      resp = await safeFetch(finalUrl, {
        headers: { accept: 'application/json', 'user-agent': 'AJSEE/NetlifyFunction' },
        signal: controller.signal
      });
    } finally {
      clearTimeout(t);
    }

    const text = await resp.text(); // předej raw JSON (frontend si s tím poradí)

    // Pokud upstream selže, pošli zpět status + text (ať je vidět proč)
    if (!resp.ok) {
      console.error('[ticketmasterEvents] Upstream error', resp.status, text.slice(0, 400));
    }

    return {
      statusCode: resp.status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
      body: text
    };

  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('[ticketmasterEvents] Error:', err);
    return json(isAbort ? 504 : 500, { error: isAbort ? 'Upstream timeout' : (err?.message || String(err)) });
  }
};

function json(status, data) {
  return {
    statusCode: status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}
