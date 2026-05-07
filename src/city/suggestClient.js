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
// - Pokud uživatel hledá známé město, držíme jeho primární zemi striktně.
//   Tím zabráníme chybným návrhům typu Paříž GB, Madrid GB, Amsterdam GB.
// - Známá města jako Londýn, Paříž, Madrid, Amsterdam nebo Varšava
//   budou v našeptávači dostupná i tehdy, když TM endpoint nic nevrátí.
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
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/[’'`´]/g, '')
    .replace(/[().,;:/\\\-+_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactNorm(s) {
  return norm(s).replace(/\s+/g, '');
}

// Sloučení městských částí
function collapseDistricts(name) {
  if (!name) return name;

  let s = String(name).trim();

  s = s.replace(/\s*[-–]\s*.+$/, '');                       // "Praha - Libuš" → "Praha"
  s = s.split(',')[0].trim();                               // "Praha, CZ" → "Praha"
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim();   // "Praha 7" → "Praha"
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();               // "Praha 4-Libuš" → "Praha"
  s = s.replace(/^paris\s+\d+\w?\b.*$/i, 'Paris');         // "Paris 11e" → "Paris"
  s = s.replace(/^london\s+(borough|zone)\b.*$/i, 'London');

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

  return compactNorm(canonEn || base);
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

function safeCanonForInputCity(value = '') {
  try {
    return canonForInputCity(value) || '';
  } catch {
    return '';
  }
}

function safeLabelForCanon(canon = '', locale = 'cs') {
  try {
    return labelForCanon(canon, locale) || canon || '';
  } catch {
    return canon || '';
  }
}

function safeGuessCountryCodeFromCity(city = '') {
  try {
    return String(guessCountryCodeFromCity(city) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

/**
 * Vrátí pravidlo pro známé město.
 *
 * Pokud poznáme, že uživatel hledá konkrétní známé město,
 * držíme pouze jeho primární zemi.
 *
 * Příklady:
 * - Paříž / Paris  → FR
 * - Madrid         → ES
 * - Amsterdam      → NL
 * - Londýn / London→ GB
 * - Varšava        → PL
 */
function getKnownCityRule(keyword = '', locale = 'cs') {
  const q = String(keyword || '').trim();

  if (q.length < 2) return null;

  const canon = safeCanonForInputCity(q);

  if (!canon) return null;

  const countryCode = safeGuessCountryCodeFromCity(canon) || safeGuessCountryCodeFromCity(q);

  if (!countryCode) return null;

  const localized = safeLabelForCanon(canon, locale);

  const qNorm = compactNorm(q);
  const canonNorm = compactNorm(canon);
  const localizedNorm = compactNorm(localized);

  if (!qNorm || !canonNorm) return null;

  const exact =
    qNorm === canonNorm ||
    qNorm === localizedNorm;

  const strongPrefix =
    qNorm.length >= 4 &&
    (
      canonNorm.startsWith(qNorm) ||
      localizedNorm.startsWith(qNorm) ||
      qNorm.startsWith(canonNorm) ||
      qNorm.startsWith(localizedNorm)
    );

  // Důležité:
  // Pro krátké dotazy typu "pa" nechceme tvrdě zamknout Paříž,
  // protože může jít o Pardubice apod.
  if (!exact && !strongPrefix) return null;

  return {
    canon,
    label: localized || canon,
    countryCode,
    qNorm,
    canonNorm,
    labelNorm: localizedNorm
  };
}

function matchesKnownCityRuleCity(city = '', rule = null) {
  if (!rule || !city) return false;

  const cityCanon = safeCanonForInputCity(city);
  const cityNorm = compactNorm(city);
  const cityCanonNorm = compactNorm(cityCanon || city);
  const collapsedNorm = compactNorm(collapseDistricts(city));

  return (
    cityNorm === rule.canonNorm ||
    cityNorm === rule.labelNorm ||
    cityCanonNorm === rule.canonNorm ||
    cityCanonNorm === rule.labelNorm ||
    collapsedNorm === rule.canonNorm ||
    collapsedNorm === rule.labelNorm
  );
}

function shouldKeepSuggestionForKnownCity(item, rule = null, countryCodes = CITY_SUGGEST_SCOPE) {
  if (!item) return false;

  const city = item.city || item.name || item.label || item.rawCity || '';
  const countryCode = String(item.countryCode || item.country || '').trim().toUpperCase();

  if (!isCountryAllowed(countryCode, countryCodes)) return false;

  // Pokud nemáme tvrdé pravidlo, stačí běžný country scope.
  if (!rule) return true;

  // U známého města držíme jen primární zemi.
  if (countryCode && countryCode !== rule.countryCode) return false;

  // A zároveň nechceme pustit jiné město ze stejné země.
  return matchesKnownCityRuleCity(city, rule);
}

/**
 * Lokální fallback pro známá města.
 *
 * Používá canonical.js jako náš vlastní "source of truth".
 * Je to pojistka pro situace, kdy Ticketmaster city suggest vrátí prázdno,
 * i když město známe a umíme ho později použít pro Discovery API.
 */
function localCityFallback(keyword, locale = 'cs', countryCodes = CITY_SUGGEST_SCOPE, knownRule = null) {
  const q = String(keyword || '').trim();

  if (q.length < 2) return [];

  const rule = knownRule || getKnownCityRule(q, locale);

  if (!rule) return [];

  if (!isCountryAllowed(rule.countryCode, countryCodes)) {
    return [];
  }

  return [{
    city: rule.label,
    countryCode: rule.countryCode,
    lat: undefined,
    lon: undefined,
    score: 10000,
    source: 'local'
  }];
}

function mergeSuggestionLists(primary = [], secondary = [], knownRule = null, countryCodes = CITY_SUGGEST_SCOPE) {
  const out = [];
  const seen = new Set();

  for (const it of [...primary, ...secondary]) {
    const city = (it && (it.city || it.name || it.label))
      ? String(it.city || it.name || it.label)
      : '';

    if (!city) continue;

    const countryCode = String(it.countryCode || it.country || '').trim().toUpperCase();

    if (!shouldKeepSuggestionForKnownCity(
      { ...it, city, countryCode },
      knownRule,
      countryCodes
    )) {
      continue;
    }

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

  const lang = locale || 'cs';

  // Bezpečný limit
  const limit = Math.max(10, Math.min(100, Number(size) || 50));

  const scopeKey = Array.isArray(countryCodes)
    ? countryCodes.join(',')
    : String(countryCodes || '');

  const knownRule = getKnownCityRule(q, lang);

  const cacheKey = [
    (lang || 'cs').toLowerCase(),
    scopeKey || 'GLOBAL',
    q.toLowerCase(),
    limit,
    knownRule ? `${knownRule.canon}|${knownRule.countryCode}` : 'no-rule'
  ].join('|');

  // Per-modul cache
  if (!suggestCities.__cache) suggestCities.__cache = new Map();

  const cache = suggestCities.__cache;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const fallback = localCityFallback(q, lang, countryCodes, knownRule);

  // Sestavení dotazu na Netlify funkci
  const qsParams = new URLSearchParams({
    locale: lang,
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

      if (!shouldKeepSuggestionForKnownCity(
        { ...it, city: it.rawCity, countryCode },
        knownRule,
        countryCodes
      )) {
        continue;
      }

      const key = `${clusterKey(it.rawCity)}|${countryCode}`;

      // Výchozí display label
      let preferred = collapseDistricts(it.rawCity);

      try {
        const canonEn = canonForInputCity(preferred);
        const localized = labelForCanon(canonEn, lang);
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
    const finalList = mergeSuggestionLists(fallback, list, knownRule, countryCodes).slice(0, limit);

    cache.set(cacheKey, finalList);
    return finalList;
  } catch {
    const finalFallback = fallback.slice(0, limit);
    cache.set(cacheKey, finalFallback);
    return finalFallback;
  }
}