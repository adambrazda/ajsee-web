// netlify/functions/ticketmasterCitySuggest.js
// ---------------------------------------------------------
// City / country suggest for AJSEE.
// - Primary source for city suggestions: Ticketmaster Discovery API.
// - Local fallback for known cities.
// - Local country suggestions for one shared input: city OR country.
// - Stable response shape: { items: [...] }.
// - Accepts countryCode or countryCodes as CSV.
// - CORS/OPTIONS handling.
// - Tiny 30s in-memory cache.
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
  'access-control-allow-headers': 'content-type,authorization'
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

  if (/^[a-z]{2}-[a-z]{2}$/i.test(k)) return k.toLowerCase();

  return m[k.slice(0, 2)] || 'en-gb';
}

const stripDiacritics = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function foldText(value = '') {
  return stripDiacritics(value)
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/[’'`´]/g, '')
    .replace(/[().,;:/\\\-+_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value = '') {
  return foldText(value).replace(/[^a-z0-9]/g, '');
}

const CITY_SUGGEST_SCOPE = [
  'CZ', 'SK', 'PL', 'HU',
  'DE', 'AT', 'GB', 'IE',
  'FR', 'NL', 'BE',
  'IT', 'ES',
  'DK', 'CH', 'NO', 'SE', 'FI'
];

const COUNTRY_LABELS = {
  CZ: { cs: 'Česko', en: 'Czechia', de: 'Tschechien', sk: 'Česko', pl: 'Czechy', hu: 'Csehország' },
  SK: { cs: 'Slovensko', en: 'Slovakia', de: 'Slowakei', sk: 'Slovensko', pl: 'Słowacja', hu: 'Szlovákia' },
  PL: { cs: 'Polsko', en: 'Poland', de: 'Polen', sk: 'Poľsko', pl: 'Polska', hu: 'Lengyelország' },
  HU: { cs: 'Maďarsko', en: 'Hungary', de: 'Ungarn', sk: 'Maďarsko', pl: 'Węgry', hu: 'Magyarország' },

  DE: { cs: 'Německo', en: 'Germany', de: 'Deutschland', sk: 'Nemecko', pl: 'Niemcy', hu: 'Németország' },
  AT: { cs: 'Rakousko', en: 'Austria', de: 'Österreich', sk: 'Rakúsko', pl: 'Austria', hu: 'Ausztria' },
  CH: { cs: 'Švýcarsko', en: 'Switzerland', de: 'Schweiz', sk: 'Švajčiarsko', pl: 'Szwajcaria', hu: 'Svájc' },

  GB: { cs: 'Velká Británie', en: 'United Kingdom', de: 'Vereinigtes Königreich', sk: 'Veľká Británia', pl: 'Wielka Brytania', hu: 'Egyesült Királyság' },
  IE: { cs: 'Irsko', en: 'Ireland', de: 'Irland', sk: 'Írsko', pl: 'Irlandia', hu: 'Írország' },

  FR: { cs: 'Francie', en: 'France', de: 'Frankreich', sk: 'Francúzsko', pl: 'Francja', hu: 'Franciaország' },
  NL: { cs: 'Nizozemsko', en: 'Netherlands', de: 'Niederlande', sk: 'Holandsko', pl: 'Holandia', hu: 'Hollandia' },
  BE: { cs: 'Belgie', en: 'Belgium', de: 'Belgien', sk: 'Belgicko', pl: 'Belgia', hu: 'Belgium' },

  IT: { cs: 'Itálie', en: 'Italy', de: 'Italien', sk: 'Taliansko', pl: 'Włochy', hu: 'Olaszország' },
  ES: { cs: 'Španělsko', en: 'Spain', de: 'Spanien', sk: 'Španielsko', pl: 'Hiszpania', hu: 'Spanyolország' },

  DK: { cs: 'Dánsko', en: 'Denmark', de: 'Dänemark', sk: 'Dánsko', pl: 'Dania', hu: 'Dánia' },
  SE: { cs: 'Švédsko', en: 'Sweden', de: 'Schweden', sk: 'Švédsko', pl: 'Szwecja', hu: 'Svédország' },
  FI: { cs: 'Finsko', en: 'Finland', de: 'Finnland', sk: 'Fínsko', pl: 'Finlandia', hu: 'Finnország' },
  NO: { cs: 'Norsko', en: 'Norway', de: 'Norwegen', sk: 'Nórsko', pl: 'Norwegia', hu: 'Norvégia' }
};

const COUNTRY_ALIASES = Object.create(null);

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();

  if (!COUNTRY_LABELS[cc]) return;

  for (const alias of aliases) {
    const key = compact(alias);

    if (key) {
      COUNTRY_ALIASES[key] = cc;
    }
  }
}

addCountryAliases('CZ', [
  'CZ',
  'Czechia',
  'Czech Republic',
  'Česko',
  'Cesko',
  'Česká republika',
  'Ceska republika',
  'Czechy',
  'Tschechien'
]);

addCountryAliases('SK', [
  'SK',
  'Slovakia',
  'Slovensko',
  'Slovenská republika',
  'Slovenska republika'
]);

addCountryAliases('PL', [
  'PL',
  'Poland',
  'Polsko',
  'Polska'
]);

addCountryAliases('HU', [
  'HU',
  'Hungary',
  'Maďarsko',
  'Madarsko',
  'Magyarország',
  'Magyarorszag',
  'Węgry',
  'Wegry',
  'Ungarn'
]);

addCountryAliases('DE', [
  'DE',
  'Germany',
  'Německo',
  'Nemecko',
  'Deutschland',
  'Niemcy',
  'Germania'
]);

addCountryAliases('AT', [
  'AT',
  'Austria',
  'Rakousko',
  'Rakúsko',
  'Rakouska',
  'Österreich',
  'Osterreich'
]);

addCountryAliases('CH', [
  'CH',
  'Switzerland',
  'Švýcarsko',
  'Svycarsko',
  'Švajčiarsko',
  'Szwajcaria',
  'Schweiz',
  'Suisse',
  'Svizzera'
]);

addCountryAliases('GB', [
  'GB',
  'UK',
  'United Kingdom',
  'Great Britain',
  'Britain',
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'Velká Británie',
  'Velka Britanie',
  'Spojené království',
  'Spojene kralovstvi',
  'Anglie',
  'Wielka Brytania',
  'Egyesült Királyság'
]);

addCountryAliases('IE', [
  'IE',
  'Ireland',
  'Irsko',
  'Írsko',
  'Irlandia',
  'Éire',
  'Eire'
]);

addCountryAliases('FR', [
  'FR',
  'France',
  'Francie',
  'Francúzsko',
  'Francuzsko',
  'Francja',
  'Franciaország',
  'Franciaorszag',
  'Francia',
  'Frankreich'
]);

addCountryAliases('NL', [
  'NL',
  'Netherlands',
  'The Netherlands',
  'Nizozemsko',
  'Holandsko',
  'Holandia',
  'Nederland',
  'Holland',
  'Niederlande'
]);

addCountryAliases('BE', [
  'BE',
  'Belgium',
  'Belgie',
  'Belgicko',
  'Belgia',
  'Belgique',
  'België',
  'Belgien'
]);

addCountryAliases('IT', [
  'IT',
  'Italy',
  'Itálie',
  'Italie',
  'Taliansko',
  'Włochy',
  'Wlochy',
  'Italia',
  'Italien'
]);

addCountryAliases('ES', [
  'ES',
  'Spain',
  'Španělsko',
  'Spanelsko',
  'Španielsko',
  'Spanielsko',
  'Hiszpania',
  'España',
  'Espana',
  'Spanien'
]);

addCountryAliases('DK', [
  'DK',
  'Denmark',
  'Dánsko',
  'Dansko',
  'Dania',
  'Danmark',
  'Dänemark'
]);

addCountryAliases('SE', [
  'SE',
  'Sweden',
  'Švédsko',
  'Svedsko',
  'Szwecja',
  'Sverige',
  'Schweden'
]);

addCountryAliases('FI', [
  'FI',
  'Finland',
  'Finsko',
  'Fínsko',
  'Finlandia',
  'Suomi',
  'Finnland'
]);

addCountryAliases('NO', [
  'NO',
  'Norway',
  'Norsko',
  'Nórsko',
  'Norwegia',
  'Norge',
  'Norwegen'
]);

function parseAllowedCountryCodes(raw = '') {
  const source = String(raw || '').trim();

  if (!source) {
    return new Set();
  }

  return new Set(
    source
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

function makeCcChecker(allowedSet) {
  return (cc) => {
    const normalized = String(cc || '').trim().toUpperCase().slice(0, 2);

    if (!allowedSet || !allowedSet.size) return true;
    if (!normalized) return false;

    return allowedSet.has(normalized);
  };
}

function countryLabelForCode(code, lang = 'cs') {
  const cc = String(code || '').trim().toUpperCase();
  const l = String(lang || 'cs').slice(0, 2).toLowerCase();
  const labels = COUNTRY_LABELS[cc];

  return labels?.[l] || labels?.cs || labels?.en || cc;
}

function countrySuggestionsForKeyword(keyword = '', locale = 'cs', isAllowedCC = () => true, limit = 10) {
  const q = compact(keyword);

  if (q.length < 2) return [];

  const out = [];
  const seen = new Set();

  for (const [aliasKey, cc] of Object.entries(COUNTRY_ALIASES)) {
    if (!isAllowedCC(cc)) continue;

    const directCode = q === compact(cc);
    const prefix = aliasKey.startsWith(q);
    const reversePrefix = q.length >= 4 && q.startsWith(aliasKey);
    const contains = q.length >= 4 && aliasKey.includes(q);

    if (!directCode && !prefix && !reversePrefix && !contains) {
      continue;
    }

    if (seen.has(cc)) continue;
    seen.add(cc);

    const label = countryLabelForCode(cc, locale);

    out.push({
      type: 'country',
      kind: 'country',
      isCountry: true,
      label,
      value: label,
      name: label,
      city: '',
      countryCode: cc,
      score:
        (directCode ? 10000 : 0) +
        (prefix ? 8000 : 0) +
        (contains ? 1000 : 0) +
        Math.max(0, 80 - label.length),
      source: 'local-country'
    });
  }

  return out
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

const EXONYM_TO_CANON = {
  // London
  londyn: 'london',
  londýn: 'london',
  londra: 'london',
  londen: 'london',
  londres: 'london',

  // Vienna
  vídeň: 'vienna',
  viden: 'vienna',
  vieden: 'vienna',
  viedeň: 'vienna',
  wien: 'vienna',

  // Paris
  paříž: 'paris',
  pariz: 'paris',
  paríž: 'paris',
  parigi: 'paris',
  paryż: 'paris',

  // Budapest
  budapest: 'budapest',
  budapešt: 'budapest',
  budapest: 'budapest',
  budapeszt: 'budapest',
  budapesta: 'budapest',

  // Amsterdam / Madrid
  amsterodam: 'amsterdam',
  madryt: 'madrid',

  // Rome
  řím: 'rome',
  rim: 'rome',
  roma: 'rome',

  // Munich
  mnichov: 'munich',
  munchen: 'munich',
  münchen: 'munich',

  // Prague
  praha: 'prague',
  prag: 'prague',
  prága: 'prague',
  praga: 'prague',

  // Warsaw / Krakow
  varšava: 'warsaw',
  varsava: 'warsaw',
  warschau: 'warsaw',
  warszawa: 'warsaw',
  krakov: 'krakow',
  kraków: 'krakow'
};

const SYNS = {
  prague: ['praha', 'prague', 'prag', 'praga', 'prága'],
  brno: ['brno', 'brünn'],
  vienna: ['wien', 'vienna', 'vídeň', 'viden', 'viedeň', 'wiedeń', 'bécs'],
  bratislava: ['bratislava', 'pressburg', 'pozsony'],

  budapest: ['budapest', 'budapešť', 'budapest', 'budapeszt', 'budapesta'],
  munich: ['münchen', 'munchen', 'munich', 'mnichov'],
  krakow: ['krakow', 'kraków', 'krakov', 'krakau'],
  warsaw: ['warsaw', 'warszawa', 'warschau', 'varšava', 'varsava'],
  ostrava: ['ostrava', 'ostrawa', 'ostrau', 'osztrava'],
  pilsen: ['plzeň', 'plzen', 'pilsen'],

  london: ['london', 'londyn', 'londýn', 'londra', 'londen', 'londres'],
  paris: ['paris', 'paříž', 'pariz', 'paríž', 'parigi', 'paryż'],
  amsterdam: ['amsterdam', 'amsterodam'],
  madrid: ['madrid', 'madryt'],

  rome: ['rome', 'řím', 'rim', 'roma']
};

const LOCAL_CITY_FALLBACKS = {
  prague: { name: 'Prague', countryCode: 'CZ', lat: 50.0755, lon: 14.4378 },
  brno: { name: 'Brno', countryCode: 'CZ', lat: 49.1951, lon: 16.6068 },
  ostrava: { name: 'Ostrava', countryCode: 'CZ', lat: 49.8209, lon: 18.2625 },

  vienna: { name: 'Vienna', countryCode: 'AT', lat: 48.2082, lon: 16.3738 },
  berlin: { name: 'Berlin', countryCode: 'DE', lat: 52.52, lon: 13.405 },
  munich: { name: 'Munich', countryCode: 'DE', lat: 48.1351, lon: 11.582 },

  warsaw: { name: 'Warsaw', countryCode: 'PL', lat: 52.2297, lon: 21.0122 },
  krakow: { name: 'Kraków', countryCode: 'PL', lat: 50.0647, lon: 19.945 },

  budapest: { name: 'Budapest', countryCode: 'HU', lat: 47.4979, lon: 19.0402 },

  london: { name: 'London', countryCode: 'GB', lat: 51.5072, lon: -0.1276 },
  paris: { name: 'Paris', countryCode: 'FR', lat: 48.8566, lon: 2.3522 },
  amsterdam: { name: 'Amsterdam', countryCode: 'NL', lat: 52.3676, lon: 4.9041 },
  dublin: { name: 'Dublin', countryCode: 'IE', lat: 53.3498, lon: -6.2603 },

  madrid: { name: 'Madrid', countryCode: 'ES', lat: 40.4168, lon: -3.7038 },
  barcelona: { name: 'Barcelona', countryCode: 'ES', lat: 41.3874, lon: 2.1686 },

  milan: { name: 'Milan', countryCode: 'IT', lat: 45.4642, lon: 9.19 },
  rome: { name: 'Rome', countryCode: 'IT', lat: 41.9028, lon: 12.4964 }
};

const synToKey = new Map(
  Object.entries(SYNS).flatMap(([key, arr]) => arr.map((v) => [stripDiacritics(v), key]))
);

const collapseToBaseCity = (name) => {
  if (!name) return name;

  let s = String(name).trim();

  s = s.replace(/\s*[-–]\s*.+$/, '');
  s = s.split(',')[0].trim();
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim();
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();
  s = s.replace(/^paris\s+\d+\w?\b.*$/i, 'Paris');
  s = s.replace(/^london\s+(borough|zone)\b.*$/i, 'London');

  return s;
};

const normCityKey = (name) => {
  const base = collapseToBaseCity(name);
  const n = stripDiacritics(base);

  return synToKey.get(n) || n;
};

function buildQueryContext(qRaw) {
  const qn = stripDiacritics(qRaw);
  const canonFromExonym = EXONYM_TO_CANON[qn] || null;

  const queryKey =
    synToKey.get(qn) ||
    (canonFromExonym ? synToKey.get(stripDiacritics(canonFromExonym)) : '') ||
    '';

  const querySynonyms = queryKey && SYNS[queryKey]
    ? SYNS[queryKey]
    : [];

  const candidateVariants = Array.from(
    new Set([qRaw, qn, canonFromExonym, ...querySynonyms].filter(Boolean))
  );

  const isRelevantName = (name) => {
    const nameKey = normCityKey(name);

    if (queryKey && nameKey === queryKey) return true;

    const ln = stripDiacritics(collapseToBaseCity(name));

    return candidateVariants.some((c) => {
      const cn = stripDiacritics(c);
      return ln.startsWith(cn) || ln.includes(cn);
    });
  };

  return {
    qn,
    canonFromExonym,
    queryKey,
    querySynonyms,
    candidateVariants,
    isRelevantName
  };
}

function makeCityListFromBucket(bucket, { qn, queryKey, size }) {
  const itemsRaw = Array.from(bucket.values()).map((x) => {
    const ln = stripDiacritics(x.namePref);
    const starts = ln.startsWith(qn);
    const contains = !starts && ln.includes(qn);
    const sameSynonymGroup = queryKey && normCityKey(x.namePref) === queryKey;

    const boost =
      (sameSynonymGroup ? 12 : 0) +
      (starts ? 10 : 0) +
      (contains ? 5 : 0);

    return { ...x, score: (x.score || 0) + boost };
  });

  return itemsRaw
    .sort((a, b) => b.score - a.score || a.namePref.localeCompare(b.namePref))
    .slice(0, size)
    .map((x) => ({
      type: 'city',
      kind: 'city',
      label: x.namePref,
      value: x.namePref,
      name: x.namePref,
      city: x.namePref,
      countryCode: x.countryCode,
      lat: x.lat,
      lon: x.lon,
      score: x.score,
      source: x.source || 'ticketmaster'
    }));
}

function mergeItems(countryItems = [], cityItems = [], size = 10) {
  const out = [];
  const seen = new Set();

  for (const item of [...countryItems, ...cityItems]) {
    if (!item) continue;

    const type = item.type || item.kind || (item.city ? 'city' : 'country');
    const label = item.label || item.name || item.city || item.value || '';
    const cc = String(item.countryCode || '').toUpperCase();

    if (!label && type !== 'country') continue;

    const key = type === 'country'
      ? `country|${cc}`
      : `city|${compact(label)}|${cc}`;

    if (seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out.slice(0, size);
}

export const handler = async (event) => {
  try {
    if (event?.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: { ...CORS, 'content-length': '0' },
        body: ''
      };
    }

    if (event?.httpMethod && event.httpMethod !== 'GET') {
      return json(405, { items: [], error: 'Method not allowed' });
    }

    const API_KEY =
      process.env.TICKETMASTER_API_KEY ||
      process.env.TM_API_KEY;

    const BASE =
      (process.env.TM_BASE_URL || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, '');

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

    const ccParamRaw = (url.searchParams.get('countryCode') || url.searchParams.get('countryCodes') || '').trim();
    const allowedSet = parseAllowedCountryCodes(ccParamRaw);
    const isAllowedCC = makeCcChecker(allowedSet);

    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    const ctx = buildQueryContext(qRaw);

    const countryItems = countrySuggestionsForKeyword(qRaw, uiLocale, isAllowedCC, size);

    const cacheKey = JSON.stringify({
      l: tmLocale,
      ui: uiLocale,
      q: qn,
      cc: Array.from(allowedSet.values()).join(','),
      s: size
    });

    const cached = cacheGet(cacheKey);
    if (cached) return json(200, cached);

    const bucket = new Map();

    const add = (name, countryCode, lat, lon, w = 1, source = 'ticketmaster') => {
      if (!name || !ctx.isRelevantName(name)) return;
      if (!isAllowedCC(countryCode)) return;

      const base = collapseToBaseCity(name);
      const cc = String(countryCode || '').toUpperCase().slice(0, 2);
      const key = `${normCityKey(base)}|${cc}`;

      const cur = bucket.get(key) || {
        namePref: base,
        countryCode: cc,
        lat: undefined,
        lon: undefined,
        score: 0,
        source
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

    const addLocalFallbacks = () => {
      const keys = new Set();

      if (ctx.queryKey) keys.add(ctx.queryKey);

      const directKey = synToKey.get(qn);
      if (directKey) keys.add(directKey);

      if (ctx.canonFromExonym) {
        const canonKey = synToKey.get(stripDiacritics(ctx.canonFromExonym));
        if (canonKey) keys.add(canonKey);
      }

      for (const key of keys) {
        const fallback = LOCAL_CITY_FALLBACKS[key];
        if (!fallback) continue;

        add(
          fallback.name,
          fallback.countryCode,
          fallback.lat,
          fallback.lon,
          80,
          'local-city'
        );
      }
    };

    addLocalFallbacks();

    if (!API_KEY) {
      console.warn('[ticketmasterCitySuggest] Missing Ticketmaster API key');

      const cityItems = makeCityListFromBucket(bucket, {
        qn,
        queryKey: ctx.queryKey,
        size
      });

      const payload = { items: mergeItems(countryItems, cityItems, size) };
      cacheSet(cacheKey, payload);
      return json(200, payload);
    }

    const tm = async (path, params, { locale } = {}) => {
      try {
        const u = new URL(`${BASE}${path}`);

        u.searchParams.set('apikey', API_KEY);

        if (locale) u.searchParams.set('locale', locale);

        for (const [k, v] of Object.entries(params || {})) {
          if (v !== undefined && v !== null && `${v}` !== '') {
            u.searchParams.set(k, v);
          }
        }

        const r = await fetch(u.toString(), {
          headers: { accept: 'application/json' }
        });

        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[citySuggest] ${path} ${r.status} ${u.toString().replace(/apikey=[^&]+/, 'apikey=***')}`, t.slice(0, 140));
          return null;
        }

        return await r.json();
      } catch (e) {
        console.warn('[citySuggest] fetch failed', e);
        return null;
      }
    };

    const LOCALES = Array.from(new Set([tmLocale, 'en-gb', 'en'].filter(Boolean)));

    const wantMore = () => bucket.size < size;

    const CITY_CANDIDATES = Array.from(
      new Set([ctx.canonFromExonym, ...ctx.querySynonyms, qRaw, qn].filter(Boolean))
    );

    const KEYWORD_CANDIDATES = CITY_CANDIDATES;

    for (const loc of LOCALES) {
      for (const val of CITY_CANDIDATES) {
        if (!wantMore()) break;

        const vCity = await tm(
          '/venues.json',
          { city: val, size: Math.min(size * 2, 100) },
          { locale: loc }
        );

        for (const v of vCity?._embedded?.venues ?? []) {
          add(
            v?.city?.name,
            v?.country?.countryCode || v?.country?.name,
            v?.location?.latitude,
            v?.location?.longitude,
            3
          );
        }
      }

      if (!wantMore()) break;

      for (const val of KEYWORD_CANDIDATES) {
        if (!wantMore()) break;

        const vKey = await tm(
          '/venues.json',
          { keyword: val, size: Math.min(size * 3, 200) },
          { locale: loc }
        );

        for (const v of vKey?._embedded?.venues ?? []) {
          add(
            v?.city?.name,
            v?.country?.countryCode || v?.country?.name,
            v?.location?.latitude,
            v?.location?.longitude,
            1
          );
        }
      }

      if (!wantMore()) break;

      for (const val of KEYWORD_CANDIDATES) {
        if (!wantMore()) break;

        const evs = await tm(
          '/events.json',
          { keyword: val, size: Math.min(size * 2, 100) },
          { locale: loc }
        );

        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(
              v?.city?.name,
              v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude,
              v?.location?.longitude,
              1
            );
          }
        }
      }
    }

    const cityItems = makeCityListFromBucket(bucket, {
      qn,
      queryKey: ctx.queryKey,
      size
    });

    const payload = {
      items: mergeItems(countryItems, cityItems, size)
    };

    cacheSet(cacheKey, payload);
    return json(200, payload);
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    return json(200, { items: [] });
  }
};
