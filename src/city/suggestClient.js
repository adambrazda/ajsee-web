/* src/city/suggestClient.js
// ---------------------------------------------------------
// City/Country suggest (frontend client)
// ---------------------------------------------------------
//
// Volá Netlify funkci pro Ticketmaster city suggest a bezpečně slučuje
// výsledky s lokálním fallbackem přes canonical.js.
//
// Nově podporuje jedno pole „město nebo země“:
// - Paris / Paříž      → city suggestion, countryCode FR
// - Budapest / Budapešť→ city suggestion, countryCode HU
// - Francie / France   → country suggestion, countryCode FR
// - Maďarsko / Hungary → country suggestion, countryCode HU
// - FR / HU / DE       → country suggestion podle ISO kódu
//
// Důležité:
// - Netlify funkce je primární zdroj městských návrhů.
// - Země generujeme lokálně, protože Ticketmaster city suggest vrací města,
//   ne country-only položky.
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

const SUPPORTED_COUNTRY_CODES = new Set(CITY_SUGGEST_SCOPE);

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
const COUNTRY_ALIAS_ENTRIES = [];

// Diacritics-less normalize.
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

function foldCountryText(value) {
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

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();

  if (!SUPPORTED_COUNTRY_CODES.has(cc)) return;

  for (const alias of aliases) {
    const label = String(alias || '').trim();
    const key = foldCountryText(label);

    if (!key) continue;

    COUNTRY_ALIASES[key] = cc;
    COUNTRY_ALIAS_ENTRIES.push({ code: cc, alias: label, key });
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

function countryCodeFromInput(value = '') {
  const raw = String(value || '').trim();

  if (!raw) return '';

  const upper = raw.toUpperCase();
  const normalizedCode = upper === 'UK' ? 'GB' : upper;

  if (/^[A-Z]{2}$/.test(normalizedCode) && SUPPORTED_COUNTRY_CODES.has(normalizedCode)) {
    return normalizedCode;
  }

  return COUNTRY_ALIASES[foldCountryText(raw)] || '';
}

function countryLabelForCode(code = '', locale = 'cs') {
  const cc = String(code || '').trim().toUpperCase();
  const lang = String(locale || 'cs').trim().toLowerCase().slice(0, 2);
  const labels = COUNTRY_LABELS[cc];

  return labels?.[lang] || labels?.cs || labels?.en || cc;
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

function buildCountrySuggestion(code = '', locale = 'cs', score = 0, source = 'local-country') {
  const cc = String(code || '').trim().toUpperCase();
  const label = countryLabelForCode(cc, locale);

  if (!cc || !label) return null;

  return {
    type: 'country',
    kind: 'country',
    isCountry: true,
    city: label,
    label,
    name: label,
    state: '',
    countryCode: cc,
    lat: undefined,
    lon: undefined,
    score,
    source
  };
}

function localCountryFallback(keyword = '', locale = 'cs', countryCodes = CITY_SUGGEST_SCOPE) {
  const q = String(keyword || '').trim();

  if (q.length < 2) return [];

  const qFold = foldCountryText(q);
  const qCode = q.toUpperCase() === 'UK' ? 'GB' : q.toUpperCase();
  const matches = new Map();

  const addMatch = (cc, score) => {
    const code = String(cc || '').trim().toUpperCase();

    if (!code || !SUPPORTED_COUNTRY_CODES.has(code)) return;
    if (!isCountryAllowed(code, countryCodes)) return;

    const prev = matches.get(code) || 0;
    matches.set(code, Math.max(prev, score));
  };

  if (/^[A-Z]{2}$/.test(qCode) && SUPPORTED_COUNTRY_CODES.has(qCode)) {
    addMatch(qCode, 20000);
  }

  const exactAliasCode = COUNTRY_ALIASES[qFold];
  if (exactAliasCode) {
    addMatch(exactAliasCode, 19000);
  }

  for (const entry of COUNTRY_ALIAS_ENTRIES) {
    const aliasKey = entry.key;

    if (!aliasKey) continue;

    if (aliasKey === qFold) {
      addMatch(entry.code, 19000);
    } else if (qFold.length >= 2 && aliasKey.startsWith(qFold)) {
      addMatch(entry.code, 12000 - Math.max(0, aliasKey.length - qFold.length));
    } else if (qFold.length >= 4 && aliasKey.includes(qFold)) {
      addMatch(entry.code, 8000 - Math.max(0, aliasKey.length - qFold.length));
    }
  }

  return Array.from(matches.entries())
    .map(([code, score]) => buildCountrySuggestion(code, locale, score))
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      return String(a.city || '').localeCompare(String(b.city || ''));
    });
}

// Sloučení městských částí.
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

// Vytvoří klíč pro seskupení (Prague/Vienna/… pokud známe; jinak base city).
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

  // Pokud dotaz vypadá jako země, nepokoušíme se z něj udělat město.
  if (countryCodeFromInput(q)) return null;

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

function isCountrySuggestion(item = {}) {
  const type = String(item?.type || item?.kind || '').toLowerCase();

  return type === 'country' || type === 'country-only' || item?.isCountry === true;
}

function shouldKeepSuggestionForKnownCity(item, rule = null, countryCodes = CITY_SUGGEST_SCOPE) {
  if (!item) return false;

  const countryCode = String(item.countryCode || item.country || '').trim().toUpperCase();

  if (!isCountryAllowed(countryCode, countryCodes)) return false;

  // Country suggestion je samostatný režim. Known city rule na něj neaplikujeme.
  if (isCountrySuggestion(item)) return true;

  const city = item.city || item.name || item.label || item.rawCity || '';

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
 * Používá canonical.js jako náš vlastní source of truth.
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
    type: 'city',
    kind: 'city',
    isCountry: false,
    city: rule.label,
    label: rule.label,
    name: rule.label,
    countryCode: rule.countryCode,
    lat: undefined,
    lon: undefined,
    score: 10000,
    source: 'local-city'
  }];
}

function normalizeSuggestionItem(it = {}) {
  const country = String(it.countryCode || it.country || '').trim().toUpperCase() || undefined;
  const countryItem = isCountrySuggestion(it);

  const label = (it && (it.city || it.name || it.label))
    ? String(it.city || it.name || it.label)
    : '';

  if (!label) return null;

  return {
    type: countryItem ? 'country' : 'city',
    kind: countryItem ? 'country' : 'city',
    isCountry: countryItem,
    city: label,
    label,
    name: label,
    state: countryItem ? '' : (it.state || it.region || ''),
    countryCode: country,
    lat: typeof it.lat === 'number'
      ? it.lat
      : (typeof it.latitude === 'number' ? it.latitude : undefined),
    lon: typeof it.lon === 'number'
      ? it.lon
      : (typeof it.longitude === 'number' ? it.longitude : undefined),
    score: typeof it.score === 'number' ? it.score : undefined,
    source: it.source || undefined
  };
}

function mergeSuggestionLists(primary = [], secondary = [], knownRule = null, countryCodes = CITY_SUGGEST_SCOPE) {
  const out = [];
  const seen = new Set();

  for (const rawItem of [...primary, ...secondary]) {
    const normalized = normalizeSuggestionItem(rawItem);

    if (!normalized) continue;

    if (!shouldKeepSuggestionForKnownCity(normalized, knownRule, countryCodes)) {
      continue;
    }

    const typeKey = normalized.isCountry ? 'country' : 'city';
    const labelKey = normalized.isCountry
      ? String(normalized.countryCode || '').trim().toUpperCase()
      : clusterKey(normalized.city);

    const key = `${typeKey}|${labelKey}|${normalized.countryCode || ''}`;

    if (seen.has(key)) continue;
    seen.add(key);

    out.push(normalized);
  }

  return out;
}

/**
 * Vyžádá návrhy měst z Netlify funkce a vrátí sloučený/odduplikovaný list.
 *
 * @param {Object} opts
 * @param {string} opts.locale - jazyk UI (ovlivňuje popisek města/země)
 * @param {string} opts.keyword - hledaný výraz
 * @param {number} [opts.size=50] - max počet návrhů (clamp 10..100)
 * @param {string[]|string} [opts.countryCodes=CITY_SUGGEST_SCOPE] - CSV nebo pole country codes
 * @returns {Promise<Array<{type?:string,city:string,countryCode:string,lat?:number,lon?:number,score?:number}>>}
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

  // Bezpečný limit.
  const limit = Math.max(10, Math.min(100, Number(size) || 50));

  const scopeKey = Array.isArray(countryCodes)
    ? countryCodes.join(',')
    : String(countryCodes || '');

  const countryFallback = localCountryFallback(q, lang, countryCodes);
  const knownRule = countryFallback.length ? null : getKnownCityRule(q, lang);
  const cityFallback = localCityFallback(q, lang, countryCodes, knownRule);

  const cacheKey = [
    (lang || 'cs').toLowerCase(),
    scopeKey || 'GLOBAL',
    q.toLowerCase(),
    limit,
    countryFallback.map(item => item.countryCode).join(',') || 'no-country',
    knownRule ? `${knownRule.canon}|${knownRule.countryCode}` : 'no-rule'
  ].join('|');

  // Per-modul cache.
  if (!suggestCities.__cache) suggestCities.__cache = new Map();

  const cache = suggestCities.__cache;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const localFallback = mergeSuggestionLists(
    countryFallback,
    cityFallback,
    knownRule,
    countryCodes
  ).slice(0, limit);

  // Pokud je dotaz jednoznačně země, nemusíme vůbec volat TM city suggest.
  // Šetříme request a zabráníme tomu, aby se k FR/HU přimíchala náhodná města.
  const exactCountryCode = countryCodeFromInput(q);
  if (exactCountryCode && localFallback.length) {
    cache.set(cacheKey, localFallback);
    return localFallback;
  }

  // Sestavení dotazu na Netlify funkci.
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
      cache.set(cacheKey, localFallback);
      return localFallback;
    }

    const data = await r.json();

    // BE vrací { items }, ne { cities }.
    const raw = Array.isArray(data?.items) ? data.items : [];

    // 1) Základní transformace.
    const tmp = raw.map((c) => ({
      type: c.type || c.kind || 'city',
      rawCity: c.label || c.name || c.value || c.city || '',
      countryCode: c.countryCode || c.country || '',
      state: c.state || c.region || '',
      lat: c.lat !== undefined ? Number(c.lat) : undefined,
      lon: c.lon !== undefined ? Number(c.lon) : undefined,
      score: typeof c.score === 'number' ? c.score : undefined,
      source: c.source || 'ticketmaster'
    }));

    // 2) Slučování synonym & městských částí.
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

      // Výchozí display label.
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
          type: 'city',
          kind: 'city',
          isCountry: false,
          city: preferred,
          label: preferred,
          name: preferred,
          state: it.state || '',
          countryCode,
          lat: Number.isFinite(it.lat) ? it.lat : undefined,
          lon: Number.isFinite(it.lon) ? it.lon : undefined,
          score: it.score || 0,
          source: it.source || 'ticketmaster'
        });
      } else {
        cur.score = Math.max(cur.score || 0, it.score || 0);

        if (!cur.lat && Number.isFinite(it.lat)) cur.lat = it.lat;
        if (!cur.lon && Number.isFinite(it.lon)) cur.lon = it.lon;
        if (!cur.state && it.state) cur.state = it.state;
      }
    }

    // 3) Seřazení + limit.
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
    // Country fallback je úplně první, protože země není city suggestion z TM.
    const finalList = mergeSuggestionLists(
      [...countryFallback, ...cityFallback],
      list,
      knownRule,
      countryCodes
    ).slice(0, limit);

    cache.set(cacheKey, finalList);
    return finalList;
  } catch {
    cache.set(cacheKey, localFallback);
    return localFallback;
  }
}
