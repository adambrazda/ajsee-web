/* src/city/suggestClient.js
// ---------------------------------------------------------
// City suggest (frontend client) – volá Netlify funkci a
// provádí bezpečné sloučení aliasů a městských částí.
// Bez globálů; vše přes parametry.
//
// Důležité:
// - Netlify funkce je primární zdroj návrhů.
// - Pokud TM city suggest vrátí prázdno nebo nedostupnou odpověď,
//   použijeme lokální fallback přes canonical.js.
// - Tím zajistíme, že známá města jako Londýn, Paříž, Madrid,
//   Amsterdam nebo Varšava budou v našeptávači dostupná i tehdy,
//   když TM endpoint nic nevrátí.
//
// Závislosti:
//   - src/city/canonical.js
//     canonForInputCity, labelForCanon, guessCountryCodeFromCity
// --------------------------------------------------------- */

import {
  canonForInputCity,
  labelForCanon,
  guessCountryCodeFromCity
} from './canonical.js';

export const CITY_SUGGEST_SCOPE = [
  'CZ', 'SK', 'PL', 'HU',
  'DE', 'AT', 'GB', 'IE',
  'FR', 'NL', 'BE',
  'IT', 'ES',
  'DK', 'CH', 'NO', 'SE', 'FI'
];

// Diacritics-less normalize
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Sloučení městských částí (shodná heuristika s BE)
function collapseDistricts(name) {
  if (!name) return name;

  let s = String(name).trim();

  s = s.replace(/\s*[-–]\s*.+$/, '');                       // "Praha - Libuš" → "Praha"
  s = s.split(',')[0].trim();                               // "Praha, CZ" → "Praha"
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim();   // "Praha 7" → "Praha"
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();               // "Praha 4-Libuš" → "Praha"

  return s;
}

// Vytvoří klíč pro seskupení (Prague/Vienna/… pokud známe; jinak base city)
function clusterKey(rawLabel) {
  const base = collapseDistricts(rawLabel);

  let canonEn = '';
  try {
    canonEn = canonForInputCity(base) || '';
  } catch {
    canonEn = '';
  }

  return norm(canonEn || base);
}

function parseAllowedCountryCodes(countryCodes = CITY_SUGGEST_SCOPE) {
  const raw = Array.isArray(countryCodes)
    ? countryCodes.join(',')
    : String(countryCodes || '');

  return new Set(
    raw
      .split(',')
      .map((cc) => cc.trim().toUpperCase())
      .filter(Boolean)
  );
}

function isCountryAllowed(countryCode = '', countryCodes = CITY_SUGGEST_SCOPE) {
  const allowed = parseAllowedCountryCodes(countryCodes);
  const cc = String(countryCode || '').trim().toUpperCase();

  if (!allowed.size) return true;
  if (!cc) return true;

  return allowed.has(cc);
}

/**
 * Lokální fallback pro známá města.
 *
 * Používá canonical.js jako náš vlastní "source of truth".
 * Je to pojistka pro situace, kdy Ticketmaster city suggest vrátí prázdno,
 * i když město známe a umíme ho později použít pro Discovery API.
 */
function localCityFallback(keyword, locale = 'cs', countryCodes = CITY_SUGGEST_SCOPE) {
  const q = String(keyword || '').trim();

  if (q.length < 2) return [];

  let canon = '';

  try {
    canon = canonForInputCity(q) || '';
  } catch {
    canon = '';
  }

  if (!canon) return [];

  const countryCode = guessCountryCodeFromCity(canon) || '';

  if (!isCountryAllowed(countryCode, countryCodes)) {
    return [];
  }

  const label = labelForCanon(canon, locale) || canon;

  const qNorm = norm(q);
  const labelNorm = norm(label);
  const canonNorm = norm(canon);

  const looksRelevant =
    labelNorm.includes(qNorm) ||
    qNorm.includes(labelNorm) ||
    canonNorm.includes(qNorm) ||
    qNorm.includes(canonNorm) ||
    canon !== q;

  if (!looksRelevant) return [];

  return [{
    city: label,
    countryCode,
    lat: undefined,
    lon: undefined,
    score: 10000,
    source: 'local'
  }];
}

function mergeSuggestionLists(primary = [], secondary = []) {
  const out = [];
  const seen = new Set();

  for (const it of [...primary, ...secondary]) {
    const city = (it && (it.city || it.name || it.label))
      ? String(it.city || it.name || it.label)
      : '';

    if (!city) continue;

    const countryCode = String(it.countryCode || it.country || '').trim().toUpperCase();
    const key = `${clusterKey(city)}|${countryCode}`;

    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      city,
      state: it.state || it.region || '',
      countryCode: countryCode || undefined,
      lat: typeof it.lat === 'number'
        ? it.lat
        : (typeof it.latitude === 'number' ? it.latitude : undefined),
      lon: typeof it.lon === 'number'
        ? it.lon
        : (typeof it.longitude === 'number' ? it.longitude : undefined),
      score: typeof it.score === 'number' ? it.score : undefined,
      source: it.source || undefined
    });
  }

  return out;
}

/**
 * Vyžádá návrhy měst z Netlify funkce a vrátí sloučený/odduplikovaný list.
 *
 * @param {Object} opts
 * @param {string} opts.locale - jazyk UI (ovlivňuje popisek města)
 * @param {string} opts.keyword - hledaný výraz
 * @param {number} [opts.size=50] - max počet návrhů (clamp 10..100)
 * @param {string[]|string} [opts.countryCodes=CITY_SUGGEST_SCOPE] - CSV nebo pole country codes
 * @returns {Promise<Array<{city:string,countryCode:string,lat?:number,lon?:number,score?:number}>>}
 */
export async function suggestCities({
  locale,
  keyword,
  size = 50,
  countryCodes = CITY_SUGGEST_SCOPE
} = {}) {
  const q = (keyword || '').trim();

  if (q.length < 2) return [];

  // Bezpečný limit
  const limit = Math.max(10, Math.min(100, Number(size) || 50));

  const scopeKey = Array.isArray(countryCodes)
    ? countryCodes.join(',')
    : String(countryCodes || '');

  const cacheKey = `${(locale || 'cs').toLowerCase()}|${scopeKey || 'GLOBAL'}|${q.toLowerCase()}|${limit}`;

  // Per-modul cache
  if (!suggestCities.__cache) suggestCities.__cache = new Map();

  const cache = suggestCities.__cache;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const fallback = localCityFallback(q, locale, countryCodes);

  // Sestavení dotazu na Netlify funkci
  const qsParams = new URLSearchParams({
    locale: locale || 'cs',
    keyword: q,
    size: String(limit)
  });

  if (scopeKey) {
    qsParams.set('countryCode', scopeKey);
  }

  let list = [];

  try {
    const r = await fetch(`/.netlify/functions/ticketmasterCitySuggest?${qsParams.toString()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!r.ok) {
      const finalFallback = fallback.slice(0, limit);
      cache.set(cacheKey, finalFallback);
      return finalFallback;
    }

    const data = await r.json();

    // BE vrací { items }, ne { cities }
    const raw = Array.isArray(data?.items) ? data.items : [];

    // 1) Základní transformace
    const tmp = raw.map((c) => ({
      rawCity: c.label || c.name || c.value || c.city || '',
      countryCode: c.countryCode || c.country || '',
      state: c.state || c.region || '',
      lat: c.lat !== undefined ? Number(c.lat) : undefined,
      lon: c.lon !== undefined ? Number(c.lon) : undefined,
      score: typeof c.score === 'number' ? c.score : undefined
    }));

    // 2) Slučování synonym & městských částí
    const merged = new Map();

    for (const it of tmp) {
      if (!it.rawCity) continue;

      const countryCode = String(it.countryCode || '').trim().toUpperCase();

      if (!isCountryAllowed(countryCode, countryCodes)) {
        continue;
      }

      const key = `${clusterKey(it.rawCity)}|${countryCode}`;

      // Výchozí display label
      let preferred = collapseDistricts(it.rawCity);

      try {
        const canonEn = canonForInputCity(preferred);
        const localized = labelForCanon(canonEn, locale);
        preferred = localized || preferred;
      } catch {
        // noop
      }

      const cur = merged.get(key);

      if (!cur) {
        merged.set(key, {
          city: preferred,
          state: it.state || '',
          countryCode,
          lat: it.lat,
          lon: it.lon,
          score: it.score || 0,
          source: 'ticketmaster'
        });
      } else {
        cur.score = Math.max(cur.score || 0, it.score || 0);

        if (!cur.lat && it.lat) cur.lat = it.lat;
        if (!cur.lon && it.lon) cur.lon = it.lon;
        if (!cur.state && it.state) cur.state = it.state;
      }
    }

    // 3) Seřazení + limit
    list = Array.from(merged.values())
      .sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        return String(a.city || '').localeCompare(String(b.city || ''));
      })
      .slice(0, limit);

    // Lokální fallback dáváme před TM výsledky.
    // Důvod: u známých měst chceme preferovat správný trh,
    // např. Amsterdam → NL, Paříž → FR, Londýn → GB.
    const finalList = mergeSuggestionLists(fallback, list).slice(0, limit);

    cache.set(cacheKey, finalList);
    return finalList;
  } catch {
    const finalFallback = fallback.slice(0, limit);
    cache.set(cacheKey, finalFallback);
    return finalFallback;
  }
}