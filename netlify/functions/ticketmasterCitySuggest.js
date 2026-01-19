// netlify/functions/ticketmasterCitySuggest.js
// ---------------------------------------------------------
// City suggest (Ticketmaster) with exonym→canon mapping, minimal API calls,
// strict relevance, local CC filtering, stable { items: [...] } shape,
// accepts countryCode *or* countryCodes (CSV or array), locale mapped for TM,
// CORS/OPTIONS handling, tiny 30s in-memory cache.
// ---------------------------------------------------------

const CACHE = globalThis.__tm_city_cache || (globalThis.__tm_city_cache = new Map());
const cacheGet = (k) => {
  const e = CACHE.get(k);
  return e && e.exp > Date.now() ? e.data : null;
};
const cacheSet = (k, data, ttlMs = 30_000) => {
  CACHE.set(k, { exp: Date.now() + ttlMs, data });
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function json(status, data, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(data)
  };
}

// Map UI lang → Ticketmaster locale (defenzivně)
function mapLangToTm(l) {
  const k = String(l || 'en').toLowerCase();
  const m = {
    cs: 'cs-cz',
    sk: 'sk-sk',
    pl: 'pl-pl',
    de: 'de-de',
    hu: 'hu-hu',
    en: 'en-gb'
  };
  // pokud už přijde plný BCP47 (např. "de-de"), necháme
  if (/^[a-z]{2}-[a-z]{2}$/i.test(k)) return k.toLowerCase();
  return m[k.slice(0, 2)] || 'en-gb';
}

const stripDiacritics = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const EXONYM_TO_CANON = {
  // London
  'londyn': 'london', 'londýn': 'london', 'londra': 'london', 'londen': 'london', 'londres': 'london',
  // Vienna
  'vídeň': 'vienna', 'viden': 'vienna', 'vieden': 'vienna', 'viedeň': 'vienna', 'wien': 'vienna',
  // Paris
  'paříž': 'paris', 'pariz': 'paris', 'paríž': 'paris', 'parigi': 'paris', 'paryż': 'paris',
  // Rome
  'řím': 'rome', 'rim': 'rome', 'roma': 'rome',
  // Munich
  'mnichov': 'munich', 'munchen': 'munich', 'münchen': 'munich',
  // Prague
  'praha': 'prague', 'prag': 'prague', 'prága': 'prague', 'praga': 'prague',
  // Warsaw / Krakow
  'varšava': 'warsaw', 'varsava': 'warsaw', 'warschau': 'warsaw',
  'krakov': 'krakow', 'kraków': 'krakow'
};

const SYNS = {
  prague:     ['praha','prague','prag','praga','prága'],
  vienna:     ['wien','vienna','vídeň','vieden','wiedeń','viedeň','bécs'],
  bratislava: ['bratislava','pressburg','pozsony'],
  budapest:   ['budapest','budapešť','budapeszt','budapesta'],
  munich:     ['münchen','munchen','munich','mnichov'],
  krakow:     ['krakow','kraków','krakov','krakau'],
  warsaw:     ['warsaw','warszawa','warschau','varšava','varsava'],
  ostrava:    ['ostrava','ostrawa','ostrau','osztrava'],
  pilsen:     ['plzeň','plzen','pilsen'],
  london:     ['london','londyn','londýn','londra','londen','londres'],
  paris:      ['paris','paříž','pariz','paríž','parigi','paryż'],
  rome:       ['rome','řím','rim','roma']
};
const synToKey = new Map(
  Object.entries(SYNS).flatMap(([key, arr]) => arr.map(v => [stripDiacritics(v), key]))
);

const collapseToBaseCity = (name) => {
  if (!name) return name;
  let s = String(name).trim();
  s = s.replace(/\s*[-–]\s*.+$/, '');                     // "Praha - Libuš" → "Praha"
  s = s.split(',')[0].trim();                             // "Praha, CZ" → "Praha"
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim(); // "Praha 7" / "Praha IV" → "Praha"
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();             // "Praha 4-Libuš" → "Praha"
  return s;
};
const normCityKey = (name) => {
  const base = collapseToBaseCity(name);
  const n = stripDiacritics(base);
  return synToKey.get(n) || n;
};

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event?.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: { ...CORS, 'content-length': '0' },
        body: ''
      };
    }

    const API_KEY =
      process.env.TICKETMASTER_API_KEY ||
      process.env.TM_API_KEY;

    const BASE =
      (process.env.TM_BASE_URL || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, '');

    // ---- safe URL parse (funguje i lokálně bez rawUrl) ----
    const url = new URL(
      event?.rawUrl ||
      `http://local/?${new URLSearchParams(event?.queryStringParameters || {}).toString()}`
    );

    const uiLocaleRaw = (url.searchParams.get('locale') || 'en').trim();
    const uiLocale = uiLocaleRaw.toLowerCase();
    const tmLocale = mapLangToTm(uiLocale);

    const qRaw = (url.searchParams.get('keyword') || '').trim();
    const qn = stripDiacritics(qRaw);
    if (qn.length < 2) return json(200, { items: [] });

    // countryCode + countryCodes (CSV or array-like)
    const ccParamRaw = (url.searchParams.get('countryCode') || url.searchParams.get('countryCodes') || '').trim();
    const ALLOWED_CC = new Set(
      ccParamRaw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    );
    const isAllowedCC = (cc) => {
      if (!ALLOWED_CC.size) return true;
      if (!cc) return false;
      return ALLOWED_CC.has(String(cc).toUpperCase().slice(0, 2));
    };

    const canonFromExonym = EXONYM_TO_CANON[qn] || null;
    const candidateVariants = Array.from(new Set([qRaw, qn, canonFromExonym].filter(Boolean)));
    const isRelevantName = (name) => {
      const ln = stripDiacritics(collapseToBaseCity(name));
      return candidateVariants.some((c) => {
        const cn = stripDiacritics(c);
        return ln.startsWith(cn) || ln.includes(cn);
      });
    };

    // bez API klíče nefailuj (pomáhá lokálně)
    if (!API_KEY) {
      console.warn('[ticketmasterCitySuggest] Missing Ticketmaster API key');
      return json(200, { items: [] });
    }

    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    // ---- cache key ----
    const cacheKey = JSON.stringify({
      l: tmLocale,
      q: qn,
      cc: Array.from(ALLOWED_CC.values()).join(','),
      s: size
    });
    const cached = cacheGet(cacheKey);
    if (cached) return json(200, cached);

    // ---- TM fetch helper ----
    const tm = async (path, params, { locale } = {}) => {
      try {
        const u = new URL(`${BASE}${path}`);
        u.searchParams.set('apikey', API_KEY);
        if (locale) u.searchParams.set('locale', locale);
        for (const [k, v] of Object.entries(params || {})) {
          if (v !== undefined && v !== null && `${v}` !== '') u.searchParams.set(k, v);
        }
        const r = await fetch(u.toString(), { headers: { accept: 'application/json' } });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[citySuggest] ${path} ${r.status} ${u.toString()}`, t.slice(0, 140));
          return null;
        }
        return await r.json();
      } catch (e) {
        console.warn('[citySuggest] fetch failed', e);
        return null;
      }
    };

    // preferuj TM locale odvozené z UI, fallback en-gb
    const LOCALES = Array.from(new Set([tmLocale, 'en-gb'].filter(Boolean)));

    const bucket = new Map();
    const add = (name, countryCode, lat, lon, w = 1) => {
      if (!name || !isRelevantName(name)) return;
      if (!isAllowedCC(countryCode)) return;

      const base = collapseToBaseCity(name);
      const key = `${normCityKey(base)}|${(countryCode || '').toUpperCase().slice(0, 2)}`;
      const cur = bucket.get(key) || {
        namePref: base,
        countryCode: (countryCode || '').toUpperCase().slice(0, 2),
        lat: undefined,
        lon: undefined,
        score: 0
      };
      cur.score += w;
      if (lat && !cur.lat) cur.lat = Number(lat);
      if (lon && !cur.lon) cur.lon = Number(lon);

      const bestNow = stripDiacritics(cur.namePref);
      const candN = stripDiacritics(base);
      const better =
        (candN.startsWith(qn) && !bestNow.startsWith(qn)) ||
        (base.length < cur.namePref.length && (candN.startsWith(qn) === bestNow.startsWith(qn)));
      if (better) cur.namePref = base;

      bucket.set(key, cur);
    };

    const wantMore = () => bucket.size < size;
    const CITY_CANDIDATES = Array.from(new Set([canonFromExonym || qRaw, qRaw].filter(Boolean)));
    const KEYWORD_CANDIDATES = CITY_CANDIDATES;

    for (const loc of LOCALES) {
      // 1) venues by city
      for (const val of CITY_CANDIDATES) {
        if (!wantMore()) break;
        const vCity = await tm('/venues.json', { city: val, size: Math.min(size * 2, 100) }, { locale: loc });
        for (const v of vCity?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude, v?.location?.longitude, 3);
        }
      }
      if (!wantMore()) break;

      // 2) venues by keyword
      for (const val of KEYWORD_CANDIDATES) {
        if (!wantMore()) break;
        const vKey = await tm('/venues.json', { keyword: val, size: Math.min(size * 3, 200) }, { locale: loc });
        for (const v of vKey?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude, v?.location?.longitude, 1);
        }
      }
      if (!wantMore()) break;

      // 3) events by keyword (fallback)
      for (const val of KEYWORD_CANDIDATES) {
        if (!wantMore()) break;
        const evs = await tm('/events.json', { keyword: val, size: Math.min(size * 2, 100) }, { locale: loc });
        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
                v?.location?.latitude, v?.location?.longitude, 1);
          }
        }
      }
    }

    // ---- scoring & output ----
    const itemsRaw = Array.from(bucket.values()).map(x => {
      const ln = stripDiacritics(x.namePref);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 10 : 0) + (contains ? 5 : 0);
      return { ...x, score: (x.score || 0) + boost };
    });

    const list = itemsRaw
      .sort((a, b) => b.score - a.score || a.namePref.localeCompare(b.namePref))
      .slice(0, size)
      .map(x => ({
        label: x.namePref,            // for UI
        value: x.namePref,            // for UI
        name: x.namePref,             // compatibility
        city: x.namePref,             // compatibility
        countryCode: x.countryCode,   // e.g. "GB"
        lat: x.lat,
        lon: x.lon,
        score: x.score
      }));

    const payload = { items: list };
    cacheSet(cacheKey, payload);
    return json(200, payload);
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    return json(200, { items: [] });
  }
};
