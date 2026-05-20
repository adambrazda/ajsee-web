// /src/api/eventsApi.js
// ---------------------------------------------------------
// Agreguje události z adapterů a aplikuje jednotné FE filtry.
//
// Podporuje:
// - město,
// - zemi zadanou do stejného pole jako město,
//   např. Francie / France / FR / Maďarsko / Hungary / HU,
// - aliasy měst,
// - sloučení městských částí,
// - Near Me,
// - keyword,
// - datumy,
// - kategorie,
// - deduplikaci,
// - bezpečné FE filtrování podle města a země.
//
// DŮLEŽITÉ:
// Pokud uživatel zadá do pole města zemi, např. "Francie",
// nesmí se to později filtrovat jako město.
// Proto tady vstup převádíme na country-only search.
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

// ------- Utils -------

/** Robustní převod na timestamp (ms); vrací NaN, pokud nelze převést. */
function ts(raw) {
  return new Date(raw).getTime();
}

/** "YYYY-MM-DD" -> lokální poledne (vyhne se posunům/DST); jinak nativní parser. */
function tsLocalMidday(raw) {
  if (!raw) return NaN;

  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return ts(raw);

  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];

  return new Date(y, mo, d, 12, 0, 0, 0).getTime();
}

/** Hranice dne z ISO "YYYY-MM-DD" v lokálním čase (start/end). */
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
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/[’'`´]/g, '')
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
    .replace(/['’`]/g, '')
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
  'Česko',
  'Cesko',
  'Česká republika',
  'Ceska republika'
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
  'Magyarorszag'
]);

addCountryAliases('DE', [
  'DE',
  'Germany',
  'Německo',
  'Nemecko',
  'Deutschland',
  'Germania'
]);

addCountryAliases('AT', [
  'AT',
  'Austria',
  'Rakousko',
  'Österreich',
  'Osterreich'
]);

addCountryAliases('CH', [
  'CH',
  'Switzerland',
  'Švýcarsko',
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
  'Španělsko',
  'Spanelsko',
  'España',
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
  'België'
]);

addCountryAliases('IT', [
  'IT',
  'Italy',
  'Itálie',
  'Italie',
  'Italia'
]);

addCountryAliases('DK', [
  'DK',
  'Denmark',
  'Dánsko',
  'Dansko',
  'Danmark'
]);

addCountryAliases('SE', [
  'SE',
  'Sweden',
  'Švédsko',
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
  'Éire',
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
  'Velká Británie',
  'Velka Britanie',
  'Spojené království',
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
  Praha: ['Praha', 'Prague', 'Prag', 'Praga', 'Praag', 'Prága'],
  Brno: ['Brno', 'Brünn'],
  Ostrava: ['Ostrava', 'Ostrau', 'Ostrawa'],
  Plzeň: ['Plzeň', 'Plzen', 'Pilsen', 'Pilzen'],
  Olomouc: ['Olomouc', 'Olmütz'],
  Bratislava: ['Bratislava', 'Pressburg', 'Pozsony'],
  Košice: ['Košice', 'Kosice', 'Kassa'],
  Žilina: ['Žilina', 'Zilina'],
  Warszawa: ['Warszawa', 'Warsaw', 'Warschau', 'Varšava', 'Varsava'],
  Kraków: ['Kraków', 'Krakow', 'Cracow', 'Krakau', 'Krakov'],
  Wrocław: ['Wrocław', 'Wroclaw', 'Breslau'],
  Gdańsk: ['Gdańsk', 'Gdansk', 'Danzig'],
  Poznań: ['Poznań', 'Poznan'],
  Łódź: ['Łódź', 'Lodz'],
  Katowice: ['Katowice'],
  Budapest: ['Budapest', 'Budapešť', 'Budapeszt', 'Budapesta'],

  // DE / AT / CH
  Berlin: ['Berlin', 'Berlín'],
  Hamburg: ['Hamburg', 'Hamburk'],
  München: ['München', 'Munich', 'Muenchen', 'Mnichov'],
  Köln: ['Köln', 'Cologne', 'Kolín nad Rýnem', 'Koln'],
  Frankfurt: ['Frankfurt', 'Frankfurt am Main'],
  Stuttgart: ['Stuttgart'],
  Düsseldorf: ['Düsseldorf', 'Dusseldorf'],
  Dresden: ['Dresden', 'Drážďany'],
  Leipzig: ['Leipzig'],
  Nürnberg: ['Nürnberg', 'Nuremberg', 'Norimberk'],
  Bremen: ['Bremen', 'Brémy'],
  Hannover: ['Hannover', 'Hanover'],
  Wien: ['Wien', 'Vienna', 'Vídeň', 'Viedeň', 'Wiedeń'],
  Salzburg: ['Salzburg', 'Solnohrad'],
  Linz: ['Linz'],
  Graz: ['Graz', 'Štýrský Hradec'],
  Zürich: ['Zürich', 'Zurich', 'Curych'],
  Genf: ['Genf', 'Geneva', 'Ženeva'],
  Basel: ['Basel', 'Basilej'],
  Bern: ['Bern', 'Berno'],

  // Benelux
  Amsterdam: ['Amsterdam', 'Amsterodam'],
  Rotterdam: ['Rotterdam'],
  'The Hague': ['The Hague', 'Den Haag', 'Haag'],
  Utrecht: ['Utrecht'],
  Brussels: ['Brussels', 'Bruxelles', 'Brusel'],
  Antwerp: ['Antwerp', 'Antwerpen', 'Antverpy'],
  Ghent: ['Ghent', 'Gent'],
  Bruges: ['Bruges', 'Brugge'],

  // France
  Paris: ['Paris', 'Paříž', 'Paríž', 'Pariz', 'París', 'Parigi', 'Paryż'],
  Lyon: ['Lyon'],
  Marseille: ['Marseille', 'Marseilles', 'Marsej'],
  Toulouse: ['Toulouse'],
  Bordeaux: ['Bordeaux'],
  Lille: ['Lille'],
  Nice: ['Nice'],
  Nantes: ['Nantes'],
  Strasbourg: ['Strasbourg', 'Štrasburk'],
  Montpellier: ['Montpellier'],

  // Iberia
  Madrid: ['Madrid', 'Madryt'],
  Barcelona: ['Barcelona', 'Barcelóna'],
  Valencia: ['Valencia', 'Valencie'],
  Seville: ['Seville', 'Sevilla'],
  Bilbao: ['Bilbao'],
  Malaga: ['Malaga', 'Málaga'],
  Zaragoza: ['Zaragoza'],
  Lisbon: ['Lisbon', 'Lisabon', 'Lisboa'],
  Porto: ['Porto', 'Oporto'],

  // Italy
  Rome: ['Rome', 'Roma', 'Řím', 'Rim'],
  Milan: ['Milan', 'Milano', 'Milán'],
  Naples: ['Naples', 'Napoli', 'Neapol'],
  Turin: ['Turin', 'Torino', 'Turín'],
  Florence: ['Florence', 'Firenze', 'Florencie'],
  Venice: ['Venice', 'Venezia', 'Benátky', 'Benatky'],
  Bologna: ['Bologna'],
  Genoa: ['Genoa', 'Genova', 'Janov'],

  // Nordics & Baltics
  Stockholm: ['Stockholm', 'Štokholm'],
  Gothenburg: ['Gothenburg', 'Göteborg', 'Goteborg'],
  Malmö: ['Malmö', 'Malmo'],
  Copenhagen: ['Copenhagen', 'København', 'Kobenhavn', 'Kodaň'],
  Oslo: ['Oslo'],
  Bergen: ['Bergen'],
  Helsinki: ['Helsinki', 'Helsinky'],
  Tampere: ['Tampere'],
  Reykjavik: ['Reykjavik', 'Reykjavík', 'Rejkjavik'],
  Tallinn: ['Tallinn', 'Talin'],
  Riga: ['Riga', 'Ryga'],
  Vilnius: ['Vilnius', 'Vilno', 'Wilno'],
  Kaunas: ['Kaunas', 'Kovno'],

  // Balkans & SE Europe
  Ljubljana: ['Ljubljana', 'Lublaň'],
  Zagreb: ['Zagreb', 'Záhřeb', 'Zahreb'],
  Split: ['Split'],
  Rijeka: ['Rijeka'],
  Belgrade: ['Belgrade', 'Beograd', 'Bělehrad'],
  'Novi Sad': ['Novi Sad'],
  Sarajevo: ['Sarajevo'],
  Skopje: ['Skopje'],
  Sofia: ['Sofia'],
  Bucharest: ['Bucharest', 'Bukurešť', 'București'],
  'Cluj-Napoca': ['Cluj-Napoca', 'Cluj'],
  Timișoara: ['Timișoara', 'Timisoara'],
  Athens: ['Athens', 'Athény', 'Athína'],
  Thessaloniki: ['Thessaloniki', 'Soluň', 'Saloniki'],
  Istanbul: ['Istanbul'],
  Ankara: ['Ankara'],
  Izmir: ['Izmir', 'Smyrna'],

  // Ukraine / Belarus
  Kyiv: ['Kyiv', 'Kyjev', 'Kiev'],
  Lviv: ['Lviv', 'Lvov'],
  Odesa: ['Odesa', 'Odessa'],
  Kharkiv: ['Kharkiv'],
  Minsk: ['Minsk'],

  // UK & Ireland
  London: ['London', 'Londýn', 'Londyn', 'Londres', 'Londra', 'Londen'],
  Manchester: ['Manchester'],
  Birmingham: ['Birmingham'],
  Liverpool: ['Liverpool'],
  Leeds: ['Leeds'],
  'Newcastle upon Tyne': ['Newcastle', 'Newcastle upon Tyne'],
  Glasgow: ['Glasgow'],
  Edinburgh: ['Edinburgh', 'Edinburk'],
  Bristol: ['Bristol'],
  Cardiff: ['Cardiff'],
  Belfast: ['Belfast'],
  Dublin: ['Dublin'],

  // Middle East
  'Tel Aviv': ['Tel Aviv', 'Tel-Aviv', 'TelAviv'],
  Jerusalem: ['Jerusalem', 'Jeruzalém'],
  Dubai: ['Dubai', 'Dubaj'],
  'Abu Dhabi': ['Abu Dhabi', 'Abú Zabí'],
  Doha: ['Doha'],
  Riyadh: ['Riyadh', 'Rijád'],

  // North America
  'New York': ['New York', 'NYC', 'NewYork', 'Nový York', 'Nowy Jork'],
  'Los Angeles': ['Los Angeles', 'LA'],
  'San Francisco': ['San Francisco', 'SF'],
  Chicago: ['Chicago', 'Čikágo'],
  Boston: ['Boston'],
  Miami: ['Miami'],
  Washington: ['Washington', 'Washington DC', 'DC'],
  Seattle: ['Seattle'],
  'San Diego': ['San Diego'],
  'Las Vegas': ['Las Vegas', 'Vegas'],
  Dallas: ['Dallas'],
  Houston: ['Houston'],
  Austin: ['Austin'],
  Atlanta: ['Atlanta'],
  Philadelphia: ['Philadelphia', 'Philly'],
  Phoenix: ['Phoenix'],
  Denver: ['Denver'],
  Detroit: ['Detroit'],
  Minneapolis: ['Minneapolis'],

  // Canada / South America / Asia / Oceania
  Toronto: ['Toronto'],
  Vancouver: ['Vancouver'],
  Montreal: ['Montreal', 'Montréal', 'Montreál'],
  'Mexico City': ['Mexico City', 'Ciudad de México', 'Mexiko City'],
  'São Paulo': ['São Paulo', 'Sao Paulo'],
  'Rio de Janeiro': ['Rio de Janeiro', 'Rio'],
  'Buenos Aires': ['Buenos Aires'],
  Santiago: ['Santiago', 'Santiago de Chile'],
  Tokyo: ['Tokyo', 'Tokio'],
  Osaka: ['Osaka'],
  Kyoto: ['Kyoto', 'Kjóto', 'Kjoto'],
  Yokohama: ['Yokohama'],
  Nagoya: ['Nagoya'],
  Seoul: ['Seoul', 'Soul'],
  Busan: ['Busan', 'Pusan'],
  Beijing: ['Beijing', 'Peking'],
  Shanghai: ['Shanghai', 'Šanghaj'],
  Shenzhen: ['Shenzhen', 'Šenčen', 'Šen-čen'],
  Guangzhou: ['Guangzhou', 'Kanton'],
  'Hong Kong': ['Hong Kong', 'Hongkong'],
  Taipei: ['Taipei', 'Tchaj-pej'],
  Singapore: ['Singapore', 'Singapur'],
  Bangkok: ['Bangkok'],
  'Kuala Lumpur': ['Kuala Lumpur'],
  Jakarta: ['Jakarta', 'Džakarta'],
  Manila: ['Manila'],
  Mumbai: ['Mumbai', 'Bombaj'],
  Delhi: ['Delhi', 'Dillí', 'New Delhi', 'Nové Dillí'],
  Bengaluru: ['Bengaluru', 'Bangalore'],
  Colombo: ['Colombo'],
  Sydney: ['Sydney', 'Sydnej'],
  Melbourne: ['Melbourne', 'Melbourn'],
  Brisbane: ['Brisbane'],
  Perth: ['Perth'],
  Adelaide: ['Adelaide', 'Adelaida'],
  Canberra: ['Canberra'],
  Auckland: ['Auckland', 'Okland'],
  Wellington: ['Wellington']
};

// Kanonický label -> stabilní EN id
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
  // Když uživatel výslovně zadal zemi do městského pole,
  // chceme bránit tomu, aby FE pustil event z jiné země.
  if (countryFromCityInput) return true;

  // Near Me nesmí být uměle omezen defaultní zemí.
  if (nearMeLat != null && nearMeLon != null) return false;

  // Pokud je skutečné město, země se řeší ve city filtru.
  if (rawCityInput && normalizedCity) return false;

  return false;
}

/**
 * Hlavní vstup pro FE:
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
  // Jestli uživatel zadal do pole města zemi, např. "Francie",
  // chováme se dál jako country-only search.
  const countryFromCityInput = countryCodeFromInput(rawCityInput);
  const isCountrySearchFromCityField = Boolean(rawCityInput && countryFromCityInput);

  const localCityInput = isCountrySearchFromCityField ? '' : rawCityInput;
  let upstreamCity = localCityInput;

  // City hotfix: když kanonizátor vrátí prázdno, ponecháme původní vstup.
  if (upstreamCity) {
    try {
      const canon = canonForInputCity(upstreamCity);
      upstreamCity = canon || upstreamCity;
    } catch {
      // fallback na původní vstup
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

  // Pokud je to country-only search, rozhodující je země zadaná v city inputu.
  // Pokud není nic zadané, držíme současný default CZ.
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
    // Klíčová změna:
    // pokud uživatel zadal "Francie", neposíláme to dál jako city.
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
// CZ affiliate/API zdroj. Adapter si s?m ?e?? filtrov?n? a str?nkov?n?,
// tak?e nevrac? cel? feed najednou a neni?? prvn? render.
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

// --- SeatPlan ---
// London theatre affiliate source.
// Adapter returns events only for explicit GB/London/theatre intent,
// so default CZ/SK discovery is not polluted.
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
    // Klíčová změna:
    // FE city filtr už nevidí "Francie" jako město.
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
  // Použije se hlavně pro city input typu "Francie", "Maďarsko", "FR", "HU".
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

  if (hasSeatPlanPilotIntent(normalizedClientFilters)) {
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

// Backward-compat: starší kód volá getAllEvents
export { fetchEvents as getAllEvents };
