// /src/api/eventsApi.js
// ---------------------------------------------------------
// Agreguje udĂˇlosti z adapterĹŻ a aplikuje jednotnĂ© FE filtry.
//
// Podporuje:
// - mÄ›sto,
// - zemi zadanou do stejnĂ©ho pole jako mÄ›sto,
//   napĹ™. Francie / France / FR / MaÄŹarsko / Hungary / HU,
// - aliasy mÄ›st,
// - slouÄŤenĂ­ mÄ›stskĂ˝ch ÄŤĂˇstĂ­,
// - Near Me,
// - keyword,
// - datumy,
// - kategorie,
// - deduplikaci,
// - bezpeÄŤnĂ© FE filtrovĂˇnĂ­ podle mÄ›sta a zemÄ›.
//
// DĹ®LEĹ˝ITĂ‰:
// Pokud uĹľivatel zadĂˇ do pole mÄ›sta zemi, napĹ™. "Francie",
// nesmĂ­ se to pozdÄ›ji filtrovat jako mÄ›sto.
// Proto tady vstup pĹ™evĂˇdĂ­me na country-only search.
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';
import { fetchEvents as fetchSmsticketEvents } from '../adapters/smsticket.js';
import { fetchEvents as fetchSeatPlanEvents } from '../adapters/seatplan.js';
import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

// DEV detekce (localhost/Vite)
const isDev =
  (typeof window !== 'undefined' &&
    /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) ||
  (typeof import.meta !== 'undefined' && import.meta?.env?.DEV);

// AJSEE_SEATPLAN_DISABLED_TODAYTIX_EXCLUSIVE_v1
// London theatre/musical ticket sales are now handled exclusively
// through the AJSEE partner purchase page powered by TodayTix/Encore.
// Keep the legacy adapter file in the repo, but do not load SeatPlan data,
// do not render SeatPlan cards, and do not run SeatPlan-specific boosting.
const ENABLE_SEATPLAN = false;

// ------- Utils -------

/** RobustnĂ­ pĹ™evod na timestamp (ms); vracĂ­ NaN, pokud nelze pĹ™evĂ©st. */
function ts(raw) {
  return new Date(raw).getTime();
}

/** "YYYY-MM-DD" -> lokĂˇlnĂ­ poledne (vyhne se posunĹŻm/DST); jinak nativnĂ­ parser. */
function tsLocalMidday(raw) {
  if (!raw) return NaN;

  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return ts(raw);

  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];

  return new Date(y, mo, d, 12, 0, 0, 0).getTime();
}

/** Hranice dne z ISO "YYYY-MM-DD" v lokĂˇlnĂ­m ÄŤase (start/end). */
function boundaryMs(iso, isEnd = false) {
  if (!iso) return NaN;

  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    const y = +m[1];
    const mo = +m[2] - 1;
    const d = +m[3];

    return isEnd
      ? new Date(y, mo, d, 23, 59, 59, 999).getTime()
      : new Date(y, mo, d, 0, 0, 0, 0).getTime();
  }

  return ts(iso);
}

function inRange(dateStr, fromStr, toStr) {
  const t = tsLocalMidday(dateStr);

  if (!Number.isFinite(t)) return false;

  const f = boundaryMs(fromStr, false);
  const to = boundaryMs(toStr, true);

  if (Number.isFinite(f) && t < f) return false;
  if (Number.isFinite(to) && t > to) return false;

  return true;
}

function normalizeText(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ăź/g, 'ss')
    .replace(/Ĺ‚/g, 'l')
    .replace(/[â€™'`Â´]/g, '')
    .replace(/[().,;:/\\\-+_]/g, ' ')
    .replace(/\s+/g, ' ');
}

function isRateLimitError(err) {
  return Boolean(
    err?.rateLimited ||
    err?.status === 429 ||
    err?.code === 'TICKETMASTER_RATE_LIMITED' ||
    Number(err?._ajseeProxy?.upstreamStatus || 0) === 429 ||
    String(err?.message || '').toLowerCase().includes('rate limit')
  );
}

const normalizeStr = normalizeText;

function foldText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['â€™`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null || lon1 == null ||
    lat2 == null || lon2 == null ||
    !Number.isFinite(+lat1) || !Number.isFinite(+lon1) ||
    !Number.isFinite(+lat2) || !Number.isFinite(+lon2)
  ) {
    return Infinity;
  }

  const toRad = (x) => (+x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ------- Country aliases -------

const SUPPORTED_COUNTRY_CODES = new Set([
  'CZ', 'SK', 'PL', 'HU',
  'DE', 'AT', 'CH',
  'GB', 'IE',
  'FR', 'NL', 'BE',
  'IT', 'ES',
  'DK', 'SE', 'FI', 'NO'
]);

const COUNTRY_ALIASES = Object.create(null);

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();

  if (!SUPPORTED_COUNTRY_CODES.has(cc)) return;

  for (const alias of aliases) {
    const key = foldText(alias);

    if (key) {
      COUNTRY_ALIASES[key] = cc;
    }
  }
}

addCountryAliases('CZ', [
  'CZ',
  'Czechia',
  'Czech Republic',
  'ÄŚesko',
  'Cesko',
  'ÄŚeskĂˇ republika',
  'Ceska republika'
]);

addCountryAliases('SK', [
  'SK',
  'Slovakia',
  'Slovensko',
  'SlovenskĂˇ republika',
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
  'MaÄŹarsko',
  'Madarsko',
  'MagyarorszĂˇg',
  'Magyarorszag'
]);

addCountryAliases('DE', [
  'DE',
  'Germany',
  'NÄ›mecko',
  'Nemecko',
  'Deutschland',
  'Germania'
]);

addCountryAliases('AT', [
  'AT',
  'Austria',
  'Rakousko',
  'Ă–sterreich',
  'Osterreich'
]);

addCountryAliases('CH', [
  'CH',
  'Switzerland',
  'Ĺ vĂ˝carsko',
  'Svycarsko',
  'Schweiz',
  'Suisse',
  'Svizzera'
]);

addCountryAliases('FR', [
  'FR',
  'France',
  'Francie',
  'Francia',
  'Frankreich'
]);

addCountryAliases('ES', [
  'ES',
  'Spain',
  'Ĺ panÄ›lsko',
  'Spanelsko',
  'EspaĂ±a',
  'Espana'
]);

addCountryAliases('NL', [
  'NL',
  'Netherlands',
  'The Netherlands',
  'Nizozemsko',
  'Holandsko',
  'Nederland',
  'Holland'
]);

addCountryAliases('BE', [
  'BE',
  'Belgium',
  'Belgie',
  'Belgique',
  'BelgiĂ«'
]);

addCountryAliases('IT', [
  'IT',
  'Italy',
  'ItĂˇlie',
  'Italie',
  'Italia'
]);

addCountryAliases('DK', [
  'DK',
  'Denmark',
  'DĂˇnsko',
  'Dansko',
  'Danmark'
]);

addCountryAliases('SE', [
  'SE',
  'Sweden',
  'Ĺ vĂ©dsko',
  'Svedsko',
  'Sverige'
]);

addCountryAliases('FI', [
  'FI',
  'Finland',
  'Finsko',
  'Suomi'
]);

addCountryAliases('NO', [
  'NO',
  'Norway',
  'Norsko',
  'Norge'
]);

addCountryAliases('IE', [
  'IE',
  'Ireland',
  'Irsko',
  'Ă‰ire',
  'Eire'
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
  'VelkĂˇ BritĂˇnie',
  'Velka Britanie',
  'SpojenĂ© krĂˇlovstvĂ­',
  'Spojene kralovstvi',
  'Anglie'
]);

function countryCodeFromInput(value) {
  const raw = String(value || '').trim();

  if (!raw) return '';

  const upper = raw.toUpperCase();
  const normalizedCode = upper === 'UK' ? 'GB' : upper;

  if (/^[A-Z]{2}$/.test(normalizedCode) && SUPPORTED_COUNTRY_CODES.has(normalizedCode)) {
    return normalizedCode;
  }

  const key = foldText(raw);

  return COUNTRY_ALIASES[key] || '';
}

function firstCountryCodeFromInput(value) {
  const raw = String(value || '').trim();

  if (!raw) return '';

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const cc = countryCodeFromInput(part);

    if (cc) return cc;
  }

  return '';
}

// ------- Multilingual city aliases -------

const CITY_ALIASES = {
  // CZ / SK / PL / HU
  Praha: ['Praha', 'Prague', 'Prag', 'Praga', 'Praag'],
  Brno: ['Brno', 'Bruenn', 'Brunn'],
  Ostrava: ['Ostrava', 'Ostrau', 'Ostrawa'],
  'Plze\u0148': ['Plze\u0148', 'Plzen', 'Pilsen', 'Pilzen'],
  Olomouc: ['Olomouc', 'Olmuetz', 'Olmutz'],
  Bratislava: ['Bratislava', 'Pressburg', 'Pozsony'],
  'Ko\u0161ice': ['Ko\u0161ice', 'Kosice', 'Kassa'],
  '\u017Dilina': ['\u017Dilina', 'Zilina'],
  Warszawa: ['Warszawa', 'Warsaw', 'Warschau', 'Varsava'],
  Krakow: ['Krakow', 'Krak\u00F3w', 'Cracow', 'Krakau'],
  Budapest: ['Budapest', 'Budape\u0161\u0165', 'Budapeszt'],

  // UK / Western Europe
  London: ['London', 'Londyn', 'Lond\u00FDn', 'Lond\u00FDn', 'Londres'],
  Manchester: ['Manchester'],
  Birmingham: ['Birmingham'],
  Liverpool: ['Liverpool'],
  Edinburgh: ['Edinburgh'],
  Glasgow: ['Glasgow'],
  Paris: ['Paris', 'Pa\u0159\u00ED\u017E', 'Pary\u017C', 'Par\u00ED\u017E'],
  Berlin: ['Berlin', 'Berl\u00EDn'],
  Vienna: ['Vienna', 'Wien', 'V\u00EDde\u0148', 'Viede\u0148'],
  Munich: ['Munich', 'M\u00FCnchen', 'Mnichov'],
  Hamburg: ['Hamburg'],
  Cologne: ['Cologne', 'K\u00F6ln', 'Kol\u00EDn nad R\u00FDnem'],
  Amsterdam: ['Amsterdam'],
  Brussels: ['Brussels', 'Bruxelles', 'Brusel'],
  Madrid: ['Madrid'],
  Barcelona: ['Barcelona'],
  Milan: ['Milan', 'Milano', 'Mil\u00E1n'],
  Rome: ['Rome', 'Roma', '\u0158\u00EDm']
};

// KanonickĂ˝ label -> stabilnĂ­ EN id
const LABEL_TO_ID = {};

for (const canonical of Object.keys(CITY_ALIASES)) {
  LABEL_TO_ID[canonical] = canonical
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

// alias -> cityId
const aliasToId = (() => {
  const m = new Map();

  for (const [canonical, list] of Object.entries(CITY_ALIASES)) {
    const id = LABEL_TO_ID[canonical];

    if (!id) continue;

    for (const alias of list) {
      m.set(normalizeText(alias), id);
    }

    m.set(normalizeText(canonical), id);
  }

  return m;
})();

function collapseDistricts(n = '') {
  let s = n;

  s = s.replace(/^praha\s+([ivxlcdm]+|\d+)\b.*$/, 'praha');
  s = s.replace(/^prague\s+\d+\b.*$/, 'prague');
  s = s.replace(/^paris\s+\d+\w?\b.*$/, 'paris');
  s = s.replace(/^london\s+(borough|zone)\b.*$/, 'london');

  return s;
}

function cityId(raw = '') {
  if (!raw) return '';

  let n = normalizeText(raw);

  n = collapseDistricts(n);

  if (aliasToId.has(n)) {
    return aliasToId.get(n);
  }

  try {
    const canon = canonForInputCity?.(raw);
    const c = normalizeText(canon || '');

    if (c && aliasToId.has(c)) {
      return aliasToId.get(c);
    }
  } catch {
    // noop
  }

  return n.replace(/\s+/g, '');
}

function compactCityId(raw = '') {
  return cityId(raw).replace(/[^a-z0-9]/g, '');
}

const METRO_CITY_IDS = {
  paris: new Set([
    'paris',
    'saintdenis',
    'stdenis',
    'saintouen',
    'stouen',
    'nanterre',
    'puteaux',
    'courbevoie',
    'ladefense',
    'laseinedefense',
    'parisladefense',
    'boulognebillancourt',
    'levalloisperret',
    'neuillysurseine',
    'issylesmoulineaux',
    'montreuil',
    'pantin',
    'aubervilliers',
    'ivrysurseine',
    'vincennes',
    'villepinte',
    'versailles'
  ])
};

function matchesSelectedCity(eventCity = '', selectedCity = '') {
  const evId = cityId(eventCity);
  const qId = cityId(selectedCity);

  if (!evId || !qId) return false;

  if (evId === qId || evId.includes(qId) || qId.includes(evId)) {
    return true;
  }

  const compactEvent = compactCityId(eventCity);
  const compactSelected = compactCityId(selectedCity);

  const allowedMetroCities = METRO_CITY_IDS[compactSelected];

  return !!allowedMetroCities && allowedMetroCities.has(compactEvent);
}

function eventCityCandidates(ev) {
  const c1 = ev?.location?.city || ev?.city || '';
  const c2 = ev?.venue?.city || ev?.place?.city || ev?.venue?.address?.city || '';

  return [c1, c2].filter(Boolean);
}

function detectLang() {
  try {
    const qs = new URLSearchParams(location.search);

    return (qs.get('lang') || document.documentElement.lang || 'cs').toLowerCase();
  } catch {
    return 'cs';
  }
}

function mapLangToLocale(lang) {
  const m = {
    cs: 'cs',
    sk: 'sk',
    en: 'en',
    de: 'de',
    pl: 'pl',
    hu: 'hu'
  };

  return m[lang] || 'en';
}

function getEventCountry(ev) {
  return String(
    ev?.location?.country ||
    ev?.venue?.country ||
    ev?.country ||
    ''
  ).trim().toUpperCase();
}

function shouldUseCountryOnlyClientFilter({
  countryFromCityInput = '',
  rawCityInput = '',
  normalizedCity = '',
  nearMeLat = null,
  nearMeLon = null
} = {}) {
  // KdyĹľ uĹľivatel vĂ˝slovnÄ› zadal zemi do mÄ›stskĂ©ho pole,
  // chceme brĂˇnit tomu, aby FE pustil event z jinĂ© zemÄ›.
  if (countryFromCityInput) return true;

  // Near Me nesmĂ­ bĂ˝t umÄ›le omezen defaultnĂ­ zemĂ­.
  if (nearMeLat != null && nearMeLon != null) return false;

  // Pokud je skuteÄŤnĂ© mÄ›sto, zemÄ› se Ĺ™eĹˇĂ­ ve city filtru.
  if (rawCityInput && normalizedCity) return false;

  return false;
}

/**
 * HlavnĂ­ vstup pro FE:
 *   fetchEvents({ locale, filters })
 */

/* AJSEE_SEATPLAN_PILOT_BOOST_v1
   ---------------------------------------------------------
   SeatPlan is a London theatre affiliate source.
   We only boost it for explicit GB/London/theatre/search intent,
   so CZ/SK discovery stays unchanged.
   --------------------------------------------------------- */
function isSeatPlanEvent(ev = {}) {
  const raw = String(
    ev?.partner ||
    ev?.source ||
    ev?.bookingProvider ||
    ev?.affiliate?.provider ||
    ''
  ).trim().toLowerCase();

  return raw.includes('seatplan');
}

function hasSeatPlanPilotIntent(filters = {}) {
  const cc = String(
    filters.cityCountryCode ||
    filters.cityCc ||
    filters.countryCode ||
    filters.country ||
    ''
  ).trim().toUpperCase();

  const city = normalizeStr(filters.city || filters.cityLabel || filters.location || '');
  const category = normalizeStr(filters.category || filters.segment || '');
  const keyword = normalizeStr(filters.keyword || filters.q || filters.search || '');

  if (cc === 'GB') return true;
  if (city === 'london' || city === 'londyn') return true;

  return (
    category === 'theatre' ||
    category === 'divadlo' ||
    category === 'musical' ||
    category === 'musicals' ||
    keyword.includes('london') ||
    keyword.includes('londyn') ||
    keyword.includes('theatre') ||
    keyword.includes('theater') ||
    keyword.includes('musical') ||
    keyword.includes('west end') ||
    keyword.length >= 3
  );
}

function eventSearchText(ev = {}, loc = 'en') {
  const title =
    ev?.title?.[loc] ??
    ev?.title?.cs ??
    ev?.title?.en ??
    ev?.title ??
    ev?.name ??
    '';

  const desc =
    ev?.description?.[loc] ??
    ev?.description?.cs ??
    ev?.description?.en ??
    ev?.description ??
    ev?.descriptionText ??
    '';

  return normalizeStr([
    title,
    ev?.titleI18n?.en,
    ev?.titleI18n?.cs,
    ev?.name,
    desc,
    ev?.location?.city,
    ev?.venue?.name,
    ev?.venueName,
    ev?.rawUrl,
    ev?.category,
    ...(Array.isArray(ev?.categories) ? ev.categories : []),
    ...(Array.isArray(ev?.types) ? ev.types : [])
  ].filter(Boolean).join(' '));
}

function seatPlanBoostScore(ev = {}, filters = {}, loc = 'en') {
  if (!isSeatPlanEvent(ev)) return 10;

  const q = normalizeStr(filters.keyword || filters.q || filters.search || '');

  if (q && eventSearchText(ev, loc).includes(q)) return 0;

  return 1;
}

export async function fetchEvents({ locale, filters = {} } = {}) {
  const lng = (locale || detectLang()).toLowerCase();
  const loc = mapLangToLocale(lng);

  let all = [];

  const rawCityInput = String(filters.city || '').trim();

  // Novinka:
  // Jestli uĹľivatel zadal do pole mÄ›sta zemi, napĹ™. "Francie",
  // chovĂˇme se dĂˇl jako country-only search.
  const countryFromCityInput = countryCodeFromInput(rawCityInput);
  const isCountrySearchFromCityField = Boolean(rawCityInput && countryFromCityInput);

  const localCityInput = isCountrySearchFromCityField ? '' : rawCityInput;
  let upstreamCity = localCityInput;

  // City hotfix: kdyĹľ kanonizĂˇtor vrĂˇtĂ­ prĂˇzdno, ponechĂˇme pĹŻvodnĂ­ vstup.
  if (upstreamCity) {
    try {
      const canon = canonForInputCity(upstreamCity);
      upstreamCity = canon || upstreamCity;
    } catch {
      // fallback na pĹŻvodnĂ­ vstup
    }
  }

  const explicitCountry = firstCountryCodeFromInput(
    filters.countryCode ||
    filters.country ||
    ''
  );

  const explicitCityCountry = firstCountryCodeFromInput(
    filters.cityCountryCode ||
    ''
  );

  const guessedCityCc = upstreamCity
    ? String(
        guessCountryCodeFromCity?.(upstreamCity) ||
        guessCountryCodeFromCity?.(rawCityInput) ||
        ''
      ).trim().toUpperCase()
    : '';

  const selectedCityCc = upstreamCity
    ? String(explicitCityCountry || guessedCityCc || explicitCountry || '').trim().toUpperCase()
    : '';

  // Pokud je to country-only search, rozhodujĂ­cĂ­ je zemÄ› zadanĂˇ v city inputu.
  // Pokud nenĂ­ nic zadanĂ©, drĹľĂ­me souÄŤasnĂ˝ default CZ.
  const countryOnlyCc =
    countryFromCityInput ||
    (!upstreamCity ? explicitCountry : '') ||
    '';

  const requestCountryCode = upstreamCity
    ? selectedCityCc
    : countryOnlyCc || explicitCountry || 'CZ';

  const upstreamFilters = {
    ...filters,
    dateFrom: filters.dateFrom ?? filters.from ?? '',
    dateTo: filters.dateTo ?? filters.to ?? '',
    category: filters.category ?? filters.segment ?? 'all',
    keyword: filters.keyword ?? filters.q ?? filters.search ?? '',
    // KlĂ­ÄŤovĂˇ zmÄ›na:
    // pokud uĹľivatel zadal "Francie", neposĂ­lĂˇme to dĂˇl jako city.
    city: upstreamCity,

    cityCountryCode: selectedCityCc,
    countryCode: requestCountryCode
  };

  const localProviderFilters = {
    ...upstreamFilters,
    city: localCityInput || upstreamCity
  };

// --- Ticketmaster ---
try {
  const tm = await fetchTicketmasterEvents({ locale: loc, filters: upstreamFilters });

  if (Array.isArray(tm)) {
    all = all.concat(tm);
  }
} catch (e) {
  if (isRateLimitError(e)) {
    e.code = e.code || 'TICKETMASTER_RATE_LIMITED';
    e.partner = e.partner || 'ticketmaster';
    throw e;
  }

  console.warn('[eventsApi] Ticketmaster fetch failed:', e);
}


// --- smsticket ---
// AJSEE_SKIP_SMSTICKET_NON_CZSK_INLINE_v3
// SMS Ticket is a CZ/SK local affiliate source.
// Skip its large static feed for explicit non-CZ/SK contexts such as London/GB.
var ajseeSmsTicketCityText = String([
  filters && filters.city,
  filters && filters.cityLabel,
  filters && filters.location
].filter(Boolean).join(' '))
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

var ajseeSmsTicketCc = String(
  (filters && (
    filters.cityCountryCode ||
    filters.cityCc ||
    filters.countryCode ||
    filters.country
  )) ||
  ''
).trim().toUpperCase();

var ajseeSkipSmsTicket =
  ajseeSmsTicketCityText.includes('london') ||
  ajseeSmsTicketCityText.includes('west end') ||
  (ajseeSmsTicketCc && ajseeSmsTicketCc !== 'CZ' && ajseeSmsTicketCc !== 'SK');

if (!ajseeSkipSmsTicket) {
  try {
    const smsticket = await fetchSmsticketEvents({
      locale: loc,
      filters: localProviderFilters
    });

    if (Array.isArray(smsticket)) {
      all = all.concat(smsticket);
    }
  } catch (e) {
    console.warn('[eventsApi] smsticket fetch failed:', e);
  }
}

// --- SeatPlan ---
// Disabled: London theatre/musical ticket sales are now handled through
// the AJSEE partner purchase page powered by TodayTix/Encore.
if (ENABLE_SEATPLAN) {
  try {
    const seatplan = await fetchSeatPlanEvents({
      locale: loc,
      filters: localProviderFilters
    });

    if (Array.isArray(seatplan)) {
      all = all.concat(seatplan);
    }
  } catch (e) {
    console.warn('[eventsApi] SeatPlan fetch failed:', e);
  }
}

  // --- Demo zdroj v DEV ---
  if (isDev) {
    try {
      const mod = await import('../adapters/demo.js');

      const fn =
        (typeof mod.fetchEvents === 'function' && mod.fetchEvents) ||
        (typeof mod.default === 'function' && mod.default) ||
        (typeof mod.default?.fetchEvents === 'function' && mod.default.fetchEvents);

      const demoFn = typeof fn === 'function' ? fn : async () => [];
      const demo = await demoFn({ locale: loc, filters: upstreamFilters });

      if (Array.isArray(demo)) {
        all = all.concat(demo);
      }
    } catch (e) {
      console.warn('[eventsApi] Demo adapter missing or invalid, continuing without demo data.', e);
    }
  }

  // ---- Client-side filtry ----
  const normalizedClientFilters = {
    ...filters,
    dateFrom: filters.dateFrom ?? filters.from ?? '',
    dateTo: filters.dateTo ?? filters.to ?? '',
    category: filters.category ?? filters.segment ?? 'all',
    keyword: filters.keyword ?? filters.q ?? filters.search ?? '',
    // KlĂ­ÄŤovĂˇ zmÄ›na:
    // FE city filtr uĹľ nevidĂ­ "Francie" jako mÄ›sto.
    city: localCityInput || upstreamCity,

    cityCountryCode: selectedCityCc,
    countryCode: requestCountryCode
  };

  const {
    category = 'all',
    city = '',
    keyword = '',
    dateFrom = '',
    dateTo = '',
    sort = 'nearest',
    nearMeLat = null,
    nearMeLon = null,
    nearMeRadiusKm = 50
  } = normalizedClientFilters;

  // Dedup podle id nebo fallback hashe.
  const seen = new Set();

  all = all.filter((ev, idx) => {
    const titleAny = ev.title?.[loc] ?? ev.title?.cs ?? ev.title?.en ?? ev.title ?? '';
    const titleStr = typeof titleAny === 'string' ? titleAny : (titleAny?.toString?.() ?? '');
    const cityHint = ev?.location?.city || ev?.venue?.city || '';
    const timeKey = tsLocalMidday(ev.datetime || ev.date) || idx;

    const id =
      ev.id ||
      `${ev.partner || 'x'}-${timeKey}-${(cityHint || '').toLowerCase()}-${titleStr.slice(0, 50)}`;

    if (seen.has(id)) return false;

    seen.add(id);

    return true;
  });

  if (category && category !== 'all') {
    const want = normalizeStr(category);

    all = all.filter((ev) => normalizeStr(ev.category) === want);
  }

  // Country-only ochrana:
  // PouĹľije se hlavnÄ› pro city input typu "Francie", "MaÄŹarsko", "FR", "HU".
  const shouldCountryFilter = shouldUseCountryOnlyClientFilter({
    countryFromCityInput,
    rawCityInput,
    normalizedCity: city,
    nearMeLat,
    nearMeLon
  });

  if (shouldCountryFilter) {
    const cc = String(countryFromCityInput || requestCountryCode || '').trim().toUpperCase();

    if (cc) {
      all = all.filter((ev) => {
        const evCountry = getEventCountry(ev);

        return !evCountry || evCountry === cc;
      });
    }
  }

  if (city) {
    const selectedFilterCc = String(
      normalizedClientFilters.cityCountryCode ||
      selectedCityCc ||
      guessCountryCodeFromCity?.(city) ||
      ''
    ).trim().toUpperCase();

    all = all.filter((ev) => {
      const evCountry = getEventCountry(ev);

      if (selectedFilterCc && evCountry && evCountry !== selectedFilterCc) {
        return false;
      }

      const candidates = eventCityCandidates(ev);

      if (!candidates.length) return false;

      return candidates.some((label) => matchesSelectedCity(label, city));
    });
  }

  // Near Me
  if (nearMeLat != null && nearMeLon != null) {
    const radius = Number.isFinite(+nearMeRadiusKm) ? +nearMeRadiusKm : 50;

    all = all.filter((ev) => {
      const lat =
        ev?.location?.lat ??
        ev?.location?.latitude ??
        ev?.venue?.location?.lat ??
        ev?.venue?.location?.latitude ??
        ev?.lat;

      const lon =
        ev?.location?.lon ??
        ev?.location?.longitude ??
        ev?.venue?.location?.lon ??
        ev?.venue?.location?.longitude ??
        ev?.lon;

      const d = haversineKm(+nearMeLat, +nearMeLon, +lat, +lon);

      return d <= radius;
    });
  }

  if (keyword) {
    const q = normalizeStr(keyword);

    all = all.filter((ev) => eventSearchText(ev, loc).includes(q));
  }

  if (dateFrom || dateTo) {
    all = all.filter((ev) => inRange(ev.datetime || ev.date, dateFrom, dateTo));
  }

  all.sort((a, b) => {
    const da = tsLocalMidday(a.datetime || a.date);
    const db = tsLocalMidday(b.datetime || b.date);

    if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
    if (!Number.isFinite(da)) return 1;
    if (!Number.isFinite(db)) return -1;

    return sort === 'latest' ? db - da : da - db;
  });

  if (ENABLE_SEATPLAN && hasSeatPlanPilotIntent(normalizedClientFilters)) {
    all.sort((a, b) => {
      const seatPlanDiff =
        seatPlanBoostScore(a, normalizedClientFilters, loc) -
        seatPlanBoostScore(b, normalizedClientFilters, loc);

      if (seatPlanDiff !== 0) return seatPlanDiff;

      const da = tsLocalMidday(a.datetime || a.date);
      const db = tsLocalMidday(b.datetime || b.date);

      if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
      if (!Number.isFinite(da)) return 1;
      if (!Number.isFinite(db)) return -1;

      return sort === 'latest' ? db - da : da - db;
    });
  }

  return all;
}

// Backward-compat: starĹˇĂ­ kĂłd volĂˇ getAllEvents
export { fetchEvents as getAllEvents };

