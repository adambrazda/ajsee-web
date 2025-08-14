// src/city/suggestClient.js
// ---------------------------------------------------------
// City suggest (frontend client) – volá Netlify funkci a
// provádí bezpečné sloučení aliasů a městských částí.
// Bez globálů; vše přes parametry.
//
// Závislosti:
//   - src/city/canonical.js  (canonForInputCity, labelForCanon)
// ---------------------------------------------------------

import { canonForInputCity, labelForCanon } from './canonical.js';

// Jednotný scope pro střední Evropu (necháváme jako CSV – BE při prázdné
// nebo neplatné kombinaci spadne na globální vyhledávání, což je v pořádku)
export const CITY_SUGGEST_SCOPE = ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'];

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
  s = s.replace(/\s*[-–]\s*.+$/, '');                 // "Praha - Libuš" → "Praha"
  s = s.split(',')[0].trim();                         // "Praha, CZ" → "Praha"
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim(); // "Praha 7" → "Praha"
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();         // "Praha 4-Libuš" → "Praha"
  return s;
}

// Vytvoří klíč pro seskupení (Prague/Vienna/… pokud známe; jinak base city)
function clusterKey(rawLabel) {
  const base = collapseDistricts(rawLabel);
  const canonEn = canonForInputCity(base); // např. "Prague", "Vienna", ...
  return norm(canonEn || base);            // fallback na base, pokud neznáme
}

/**
 * Vyžádá návrhy měst z Netlify funkce a vrátí sloučený/odduplikovaný list.
 *
 * @param {Object} opts
 * @param {string} opts.locale - jazyk UI (ovlivňuje popisek města)
 * @param {string} opts.keyword - hledaný výraz
 * @param {number} [opts.size=50] - max počet návrhů
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

  const scopeKey = Array.isArray(countryCodes) ? countryCodes.join(',') : String(countryCodes || '');
  const cacheKey = `${locale || 'cs'}|${scopeKey || 'GLOBAL'}|${q.toLowerCase()}|${size}`;

  // Jednoduchá per-modul cache (neexportujeme)
  if (!suggestCities.__cache) suggestCities.__cache = new Map();
  const cache = suggestCities.__cache;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  // Sestavení dotazu na Netlify funkci
  const qsParams = new URLSearchParams({
    locale: locale || 'cs',
    keyword: q,
    size: String(size)
  });
  if (scopeKey) qsParams.set('countryCode', scopeKey);

  let list = [];
  try {
    const r = await fetch(`/.netlify/functions/ticketmasterCitySuggest?${qsParams.toString()}`);
    if (!r.ok) {
      cache.set(cacheKey, []);
      return [];
    }
    const data = await r.json();
    const raw = Array.isArray(data.cities) ? data.cities : [];

    // 1) Základní transformace
    const tmp = raw.map((c) => ({
      rawCity: c.label || c.name || c.value || '',
      countryCode: c.countryCode || c.country || '',
      lat: c.lat !== undefined ? Number(c.lat) : undefined,
      lon: c.lon !== undefined ? Number(c.lon) : undefined,
      score: typeof c.score === 'number' ? c.score : undefined
    }));

    // 2) Slučování synonym & městských částí
    const merged = new Map();
    for (const it of tmp) {
      const key = `${clusterKey(it.rawCity)}|${it.countryCode || ''}`;

      // Výchozí display label:
      // - pokus o jazykový endonym/exonym přes labelForCanon
      // - jinak base city bez obvodu
      const canonEn = canonForInputCity(collapseDistricts(it.rawCity)); // "Prague", "Vienna", ...
      const preferred = labelForCanon(canonEn, locale) || collapseDistricts(it.rawCity);

      const cur = merged.get(key);
      if (!cur) {
        merged.set(key, {
          city: preferred,
          countryCode: it.countryCode || '',
          lat: it.lat,
          lon: it.lon,
          score: it.score
        });
      } else {
        cur.score = Math.max(cur.score || 0, it.score || 0);
        if (!cur.lat && it.lat) cur.lat = it.lat;
        if (!cur.lon && it.lon) cur.lon = it.lon;
      }
    }

    // 3) Seřazení + limit
    list = Array.from(merged.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0) || a.city.localeCompare(b.city))
      .slice(0, size);

    cache.set(cacheKey, list);
    return list;
  } catch {
    cache.set(cacheKey, []);
    return [];
  }
}
