// src/adapters/ticketmasterCities.js
// ---------------------------------------------------------
// Ticketmaster City Suggest adapter (Netlify proxy: ticketmasterCitySuggest)
// - akceptuje countryCode i countryCodes (pole/string) → posílá jako "countryCode=AA,BB"
// - robustní parsování odpovědi: [], {cities:[]}, {items:[]}
// - sjednocený tvar výstupu: { city, state, countryCode, lat?, lon?, score? }
// - jednoduchý in-memory cache s TTL
// - fetch s timeoutem, no-store cache
// ---------------------------------------------------------

const memoryCache = new Map(); // key -> { ts:number, data:Array }
const TTL_MS = 5 * 60 * 1000;  // 5 minut

function normCCParam(ccAny) {
  const str = Array.isArray(ccAny) ? ccAny.join(',') : String(ccAny || '');
  return str
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .join(',');
}

function makeCacheKey({ locale, ccKey, q, size }) {
  return `${String(locale || 'cs').toLowerCase()}|${ccKey}|${String(q).toLowerCase()}|${Number(size) || 50}`;
}

function fromAnyArray(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.cities)) return json.cities; // starší FE/BEs
  if (json && Array.isArray(json.items))  return json.items;  // aktuální BE kontrakt
  return [];
}

function toNumOrUndef(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function unifyItemShape(it = {}) {
  const city = String(it.city ?? it.name ?? it.label ?? '').trim();
  if (!city) return null;

  const state = it.state ?? it.region ?? '';

  const countryCode = typeof it.countryCode === 'string'
    ? it.countryCode.toUpperCase()
    : (typeof it.country === 'string' ? it.country.toUpperCase() : undefined);

  // přijmi i stringové lat/lon (BE obvykle posílá čísla, ale buďme defenzivní)
  const lat = toNumOrUndef(it.lat ?? it.latitude);
  const lon = toNumOrUndef(it.lon ?? it.longitude);

  const score = (typeof it.score === 'number') ? it.score : undefined;

  return { city, state, countryCode, lat, lon, score };
}

async function fetchWithTimeout(url, { timeout = 10000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {{ locale?:string, countryCode?:string, countryCodes?:string|string[], keyword?:string, size?:number }} params
 * @returns {Promise<Array<{city:string,state?:string,countryCode?:string,lat?:number,lon?:number,score?:number}>>}
 */
export async function suggestCities({
  locale = 'cs',
  countryCode = 'CZ',
  countryCodes,            // volitelně: pole/string; přednostně použijeme před countryCode
  keyword = '',
  size = 50
} = {}) {
  const q = String(keyword || '').trim();
  if (q.length < 2) return [];

  const ccParam = normCCParam(countryCodes ?? countryCode ?? 'CZ');
  const cacheKey = makeCacheKey({ locale, ccKey: ccParam, q, size });

  // cache hit (s TTL)
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < TTL_MS) {
    return cached.data;
  }

  const qs = new URLSearchParams({
    locale: String(locale || 'cs'),
    countryCode: ccParam,            // serverová funkce akceptuje "AA,BB"
    keyword: q,
    size: String(Math.max(1, Math.min(+size || 50, 200)))
  });

  const url = `/.netlify/functions/ticketmasterCitySuggest?${qs.toString()}`;

  try {
    const r = await fetchWithTimeout(url, { timeout: 12000 });
    if (!r.ok) return [];

    const data = await r.json().catch(() => null);
    const raw = fromAnyArray(data);

    // sjednocení + odfiltrování prázdných/duplicit (na úrovni (city,state,countryCode))
    const seen = new Set();
    const out = [];
    for (const it of raw) {
      const uni = unifyItemShape(it);
      if (!uni) continue;
      const key = `${(uni.city || '').toLowerCase()}|${(uni.state || '').toLowerCase()}|${(uni.countryCode || '').toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(uni);
    }

    memoryCache.set(cacheKey, { ts: Date.now(), data: out });
    return out;
  } catch {
    return [];
  }
}

export default { suggestCities };
