// netlify/functions/ticketmasterCitySuggest.js
// City suggest pro CEE region s podporou exonym (Praha/Prague/Prag/Praga ...)
// API: GET /.netlify/functions/ticketmasterCitySuggest?keyword=Pra&locale=pl&countryCode=CZ,SK,PL,HU,DE,AT&size=80

const DEFAULT_SCOPE = ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'];
const MAX_SIZE = 100;

// --- Malá CEE databáze s exonymy (fallback i pro případ chybějícího TM klíče) ---
function C(label, countryCode, lat, lon, aliases = [], state = '') {
  return { label, countryCode, lat, lon, aliases, state };
}
const CITY_DB = [
  // CZ
  C('Praha', 'CZ', 50.0755, 14.4378, ['Praha', 'Prague', 'Prag', 'Praga', 'Praag', 'Prága']),
  C('Brno', 'CZ', 49.1951, 16.6068, ['Brno', 'Brünn', 'Brno']),
  C('Ostrava', 'CZ', 49.8209, 18.2625, ['Ostrava']),
  C('Plzeň', 'CZ', 49.7384, 13.3736, ['Plzeň', 'Plzen', 'Pilsen']),
  C('Olomouc', 'CZ', 49.5938, 17.2509, ['Olomouc', 'Olmütz']),
  // SK
  C('Bratislava', 'SK', 48.1486, 17.1077, ['Bratislava', 'Pressburg', 'Pozsony']),
  C('Košice', 'SK', 48.7164, 21.2611, ['Košice', 'Kosice', 'Kassa']),
  C('Žilina', 'SK', 49.2231, 18.7394, ['Žilina', 'Zilina']),
  // PL
  C('Warszawa', 'PL', 52.2297, 21.0122, ['Warszawa', 'Warsaw', 'Warschau']),
  C('Kraków', 'PL', 50.0647, 19.945, ['Kraków', 'Krakow', 'Cracow', 'Krakau']),
  C('Wrocław', 'PL', 51.1079, 17.0385, ['Wrocław', 'Wroclaw', 'Breslau']),
  C('Gdańsk', 'PL', 54.352, 18.6466, ['Gdańsk', 'Gdansk', 'Danzig']),
  C('Poznań', 'PL', 52.4064, 16.9252, ['Poznań', 'Poznan']),
  C('Łódź', 'PL', 51.7592, 19.4559, ['Łódź', 'Lodz']),
  C('Katowice', 'PL', 50.2649, 19.0238, ['Katowice']),
  // HU
  C('Budapest', 'HU', 47.4979, 19.0402, ['Budapest', 'Budapešť', 'Budapeszt', 'Budapesta']),
  C('Debrecen', 'HU', 47.5316, 21.6273, ['Debrecen']),
  // DE
  C('Berlin', 'DE', 52.52, 13.405, ['Berlin', 'Berlín'], 'BE'),
  C('München', 'DE', 48.1351, 11.582, ['München', 'Munich', 'Muenchen', 'Mnichov'], 'BY'),
  C('Hamburg', 'DE', 53.5511, 9.9937, ['Hamburg'], 'HH'),
  C('Dresden', 'DE', 51.0504, 13.7373, ['Dresden', 'Drážďany'], 'SN'),
  C('Leipzig', 'DE', 51.3397, 12.3731, ['Leipzig'], 'SN'),
  C('Nürnberg', 'DE', 49.4521, 11.0767, ['Nürnberg', 'Nuremberg', 'Norimberk'], 'BY'),
  // AT
  C('Wien', 'AT', 48.2082, 16.3738, ['Wien', 'Vienna', 'Vídeň', 'Viedeň', 'Wiedeń']),
  C('Salzburg', 'AT', 47.8095, 13.055, ['Salzburg', 'Solnohrad']),
  C('Linz', 'AT', 48.3069, 14.2858, ['Linz']),
  C('Graz', 'AT', 47.0707, 15.4395, ['Graz', 'Štýrský Hradec'])
];

// --- Utils ---
function normalize(str = '') {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diakritika
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 \-]/g, '');
}
function scoreMatch(queryNorm, nameNorm) {
  if (!queryNorm || !nameNorm) return 0;
  if (nameNorm.startsWith(queryNorm)) return 100;
  if (nameNorm.includes(queryNorm)) return 70;
  if (queryNorm.includes(nameNorm)) return 50;
  return 0;
}
function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- Jednotné JSON odpovědi ---
function json(status, data) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  };
}

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  try {
    const API_KEY =
      process.env.TICKETMASTER_API_KEY ||
      process.env.TM_API_KEY;

    const BASE =
      process.env.TM_BASE_URL ||
      'https://app.ticketmaster.com/discovery/v2';

    // Bezpečné parsování query
    const url = new URL(
      event.rawUrl ||
        `http://local/?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
    );

    const q = (url.searchParams.get('keyword') || '').trim();
    const locale = (url.searchParams.get('locale') || 'en').slice(0, 2).toLowerCase();
    const size = Math.min(MAX_SIZE, Math.max(1, parseInt(url.searchParams.get('size') || '50', 10)));

    // countryCode může být comma-separated (CZ,SK,PL) – jinak fallback na DEFAULT_SCOPE
    let scopeStr = (url.searchParams.get('countryCode') || '').trim();
    let scope = scopeStr
      ? scopeStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [...DEFAULT_SCOPE];

    // dotaz musí mít aspoň 2 znaky
    if (q.length < 2) {
      return json(200, { cities: [] });
    }

    const qn = normalize(q);

    // --- Košík výsledků (dedupe + skóre) ---
    const bucket = new Map();
    const add = (city, cc, lat, lon, weight = 1, state = '') => {
      if (!city) return;
      const key = `${city}|${cc || ''}`;
      const cur = bucket.get(key) || {
        city,
        label: city,     // pro FE kompat (nemusí použít)
        name: city,      // pro starší FE
        countryCode: cc || '',
        state: state || '',
        lat: toNumberOrNull(lat),
        lon: toNumberOrNull(lon),
        score: 0
      };
      cur.score += weight;
      if (cur.lat == null && lat != null) cur.lat = toNumberOrNull(lat);
      if (cur.lon == null && lon != null) cur.lon = toNumberOrNull(lon);
      if (!cur.state && state) cur.state = state;
      bucket.set(key, cur);
    };

    // --- Fallback/boost: lokální exonym DB (nezávisle na TM klíči) ---
    for (const c of CITY_DB) {
      if (scope.length && !scope.includes(c.countryCode)) continue;
      let best = 0;
      for (const nm of [c.label, ...(c.aliases || [])]) {
        const sc = scoreMatch(qn, normalize(nm));
        if (sc > best) best = sc;
      }
      if (best > 0) add(c.label, c.countryCode, c.lat, c.lon, 2 + Math.floor(best / 10), c.state);
    }

    // --- Ticketmaster fetch (pokud je k dispozici API key) ---
    if (API_KEY) {
      const tm = async (path, params) => {
        try {
          const u = new URL(`${BASE}${path}`);
          u.searchParams.set('apikey', API_KEY);
          u.searchParams.set('locale', locale);
          for (const [k, v] of Object.entries(params || {})) {
            if (v !== undefined && v !== null && `${v}` !== '') u.searchParams.set(k, v);
          }
          const r = await fetch(u.toString(), { headers: { accept: 'application/json' } });
          if (!r.ok) {
            const t = await r.text().catch(() => '');
            console.warn(`[citySuggest] ${path} ${r.status}`, t.slice(0, 200));
            return null;
          }
          return r.json();
        } catch (e) {
          console.warn('[citySuggest] fetch failed', e);
          return null;
        }
      };

      // Pro více zemí iterujeme – venues (city + keyword) + events (fallback)
      const perCountry = async (cc) => {
        // 1) venues podle "city" – silný signál
        const vCity = await tm('/venues.json', {
          countryCode: cc,
          city: q,
          size: Math.min(size * 2, 100)
        });
        for (const v of vCity?._embedded?.venues ?? []) {
          add(
            v?.city?.name,
            v?.country?.countryCode || v?.country?.name,
            v?.location?.latitude,
            v?.location?.longitude,
            6,
            v?.state?.stateCode || v?.state?.name || ''
          );
        }

        // 2) venues podle "keyword" – slabší signál
        const vKey = await tm('/venues.json', {
          countryCode: cc,
          keyword: q,
          size: Math.min(size * 3, 150)
        });
        for (const v of vKey?._embedded?.venues ?? []) {
          add(
            v?.city?.name,
            v?.country?.countryCode || v?.country?.name,
            v?.location?.latitude,
            v?.location?.longitude,
            2,
            v?.state?.stateCode || v?.state?.name || ''
          );
        }

        // 3) events → vyparsovat města z embedded venues
        const evs = await tm('/events.json', {
          countryCode: cc,
          keyword: q,
          size: Math.min(size * 2, 100)
        });
        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(
              v?.city?.name,
              v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude,
              v?.location?.longitude,
              1,
              v?.state?.stateCode || v?.state?.name || ''
            );
          }
        }
      };

      // 1. vlna: požadovaný scope
      await Promise.all(scope.map(perCountry));

      // 2. vlna (fallback): pokud výsledků málo a scope je příliš úzký, rozšiř na DEFAULT_SCOPE
      if (bucket.size < size && scope.length < DEFAULT_SCOPE.length) {
        const missing = DEFAULT_SCOPE.filter(cc => !scope.includes(cc));
        await Promise.all(missing.map(perCountry));
      }
    }

    // --- Postprocess: relevance boost (prefix > substring) ---
    let items = Array.from(bucket.values()).filter(x => x.city);
    items = items.map(x => {
      const ln = normalize(x.city);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 20 : 0) + (contains ? 8 : 0);
      return { ...x, score: (x.score || 0) + boost, _starts: starts, _contains: contains };
    });

    // pokud existují relevantní (starts/contains), zbytek odfiltruj
    const relevant = items.filter(it => it._starts || it._contains);
    const pool = relevant.length ? relevant : items;

    // řazení a limit
    const list = pool
      .sort((a, b) => (b.score - a.score) || a.city.localeCompare(b.city, locale, { sensitivity: 'base' }))
      .slice(0, size)
      .map(x => ({
        // finální sjednocený tvar pro FE (main.js čte city/countryCode/lat/lon/score + volitelně state)
        city: x.city,
        countryCode: x.countryCode,
        state: x.state || '',
        lat: x.lat,
        lon: x.lon,
        score: x.score,
        // zpětná kompatibilita s dřívějším FE
        label: x.city,
        value: x.city,
        name: x.city
      }));

    return json(200, { cities: dedupeByKey(list, it => `${it.city}|${it.countryCode}`).slice(0, size) });
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    return json(200, { cities: [] });
  }
};
