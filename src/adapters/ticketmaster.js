// /src/adapters/ticketmaster.js
// ---------------------------------------------------------
// Ticketmaster Discovery API adapter (via Netlify function proxy)
//
// Stabilizační verze po rate-limit incidentu:
// - výrazně omezuje počet requestů na Ticketmaster proxy,
// - nepálí paralelně všechny locale / city / keyword / broad fallbacky,
// - zastaví další pokusy při 429,
// - rozpozná i proxy odpověď 200 + _ajseeProxy.upstreamStatus=429,
// - nastaví krátký frontend cooldown po rate limitu,
// - loguje jen v debug režimu,
// - drží city+country striktně, ale pro vybrané metropole povolí metro okolí,
// - u evropských výsledků dovolí i obecný ticketmaster.com jako nižší skóre,
//   protože některé FR/ES/IT/NL Discovery výsledky reálně chodí z .com hostu.
// ---------------------------------------------------------

import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

const AJSEE_TM_PATCH_MARKER = 'AJSEE_TM_RATE_LIMIT_GUARD_20260507C';

const REQUEST_CACHE_TTL_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;
const REQUEST_CACHE = new Map();

const RATE_LIMIT_STORAGE_KEY = 'ajsee.tm.rateLimit.v1';

let RATE_LIMIT_UNTIL = readStoredRateLimitUntil();

exposeRateLimitState('init');

function readStoredRateLimitUntil() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0;

    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    const until = Number(parsed?.until || parsed || 0);

    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
      return 0;
    }

    return until;
  } catch {
    return 0;
  }
}

function writeStoredRateLimit(until, reason = 'ticketmaster_rate_limited') {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify({
      until,
      reason,
      savedAt: Date.now()
    }));
  } catch {
    // noop
  }
}

function clearStoredRateLimitIfExpired(now = Date.now()) {
  if (!RATE_LIMIT_UNTIL || RATE_LIMIT_UNTIL > now) return;

  RATE_LIMIT_UNTIL = 0;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
    }
  } catch {
    // noop
  }

  exposeRateLimitState('expired');
}

function getEffectiveRateLimitUntil(now = Date.now()) {
  const storedUntil = readStoredRateLimitUntil();
  RATE_LIMIT_UNTIL = Math.max(Number(RATE_LIMIT_UNTIL || 0), Number(storedUntil || 0));

  if (RATE_LIMIT_UNTIL && RATE_LIMIT_UNTIL <= now) {
    clearStoredRateLimitIfExpired(now);
  }

  return RATE_LIMIT_UNTIL;
}

function getRateLimitState(reason = 'ticketmaster_rate_limited') {
  const now = Date.now();
  const until = getEffectiveRateLimitUntil(now);
  const retryAfterMs = Math.max(0, Number(until || 0) - now);

  return {
    provider: 'ticketmaster',
    active: retryAfterMs > 0,
    until: retryAfterMs > 0 ? until : 0,
    retryAt: retryAfterMs > 0 ? new Date(until).toISOString() : '',
    retryAfterMs,
    reason,
    marker: AJSEE_TM_PATCH_MARKER
  };
}

function exposeRateLimitState(reason = 'ticketmaster_rate_limited') {
  try {
    if (typeof window === 'undefined') return getRateLimitState(reason);

    window.__ajsee = window.__ajsee || {};
    const state = getRateLimitState(reason);

    window.__ajsee.tmRateLimit = state;
    window.__ajsee.ticketmasterRateLimit = state;

    try {
      window.dispatchEvent(new CustomEvent('AJSEE:tm-rate-limit', { detail: state }));
      window.dispatchEvent(new CustomEvent('ajsee:tm-rate-limit', { detail: state }));
    } catch {
      // noop
    }

    return state;
  } catch {
    return {
      provider: 'ticketmaster',
      active: false,
      until: 0,
      retryAfterMs: 0,
      reason,
      marker: AJSEE_TM_PATCH_MARKER
    };
  }
}

const SUPPORTED_COUNTRY_CODES = new Set([
  'CZ', 'SK', 'PL', 'HU',
  'DE', 'AT', 'CH',
  'GB', 'IE',
  'FR', 'NL', 'BE',
  'IT', 'ES',
  'DK', 'SE', 'FI', 'NO'
]);

const MARKET_LOCALE_BY_COUNTRY = {
  CZ: 'cs-cz',
  SK: 'sk-sk',
  PL: 'pl-pl',
  HU: 'hu-hu',

  DE: 'de-de',
  AT: 'de-at',
  CH: 'de-ch',

  GB: 'en-gb',
  IE: 'en-gb',

  FR: 'fr-fr',
  ES: 'es-es',
  NL: 'nl-nl',
  BE: 'fr-fr',
  IT: 'it-it',

  DK: 'da-dk',
  SE: 'sv-se',
  FI: 'fi-fi',
  NO: 'en'
};

const COUNTRY_MARKET_HOST = {
  CZ: 'ticketmaster.cz',
  GB: 'ticketmaster.co.uk',
  DE: 'ticketmaster.de',
  PL: 'ticketmaster.pl',
  AT: 'ticketmaster.at',
  IE: 'ticketmaster.ie',
  FR: 'ticketmaster.fr',
  NL: 'ticketmaster.nl',
  BE: 'ticketmaster.be',
  IT: 'ticketmaster.it',
  ES: 'ticketmaster.es',
  DK: 'ticketmaster.dk',
  CH: 'ticketmaster.ch',
  NO: 'ticketmaster.no',
  SE: 'ticketmaster.se',
  FI: 'ticketmaster.fi'
};

const IMPACT_COUNTRY_BY_IDS = {
  '2038768|23901': 'CZ',
  '2038758|24023': 'GB',
  '2038753|23890': 'DE',
  '2038764|23896': 'PL',
  '2038762|23895': 'AT',
  '2038752|23889': 'IE',
  '2038754|23891': 'FR',
  '2038751|23888': 'NL',
  '2038757|23894': 'BE',
  '2038766|23899': 'IT',
  '2038750|23886': 'ES',
  '2038756|23893': 'DK',
  '2038765|23898': 'CH',
  '2038767|23900': 'NO',
  '2038747|23885': 'SE',
  '2038755|23892': 'FI'
};

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

const COUNTRY_ALIASES = Object.create(null);

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();
  if (!SUPPORTED_COUNTRY_CODES.has(cc)) return;

  for (const alias of aliases) {
    const key = foldText(alias);
    if (key) COUNTRY_ALIASES[key] = cc;
  }
}

addCountryAliases('CZ', ['CZ', 'Czechia', 'Czech Republic', 'Česko', 'Cesko', 'Česká republika', 'Ceska republika']);
addCountryAliases('SK', ['SK', 'Slovakia', 'Slovensko', 'Slovenská republika', 'Slovenska republika']);
addCountryAliases('PL', ['PL', 'Poland', 'Polsko', 'Polska']);
addCountryAliases('HU', ['HU', 'Hungary', 'Maďarsko', 'Madarsko', 'Magyarország', 'Magyarorszag']);
addCountryAliases('DE', ['DE', 'Germany', 'Německo', 'Nemecko', 'Deutschland', 'Germania']);
addCountryAliases('AT', ['AT', 'Austria', 'Rakousko', 'Österreich', 'Osterreich']);
addCountryAliases('CH', ['CH', 'Switzerland', 'Švýcarsko', 'Svycarsko', 'Schweiz', 'Suisse', 'Svizzera']);
addCountryAliases('FR', ['FR', 'France', 'Francie', 'Francia', 'Frankreich']);
addCountryAliases('ES', ['ES', 'Spain', 'Španělsko', 'Spanelsko', 'España', 'Espana']);
addCountryAliases('NL', ['NL', 'Netherlands', 'The Netherlands', 'Nizozemsko', 'Holandsko', 'Nederland', 'Holland']);
addCountryAliases('BE', ['BE', 'Belgium', 'Belgie', 'Belgique', 'België']);
addCountryAliases('IT', ['IT', 'Italy', 'Itálie', 'Italie', 'Italia']);
addCountryAliases('DK', ['DK', 'Denmark', 'Dánsko', 'Dansko', 'Danmark']);
addCountryAliases('SE', ['SE', 'Sweden', 'Švédsko', 'Svedsko', 'Sverige']);
addCountryAliases('FI', ['FI', 'Finland', 'Finsko', 'Suomi']);
addCountryAliases('NO', ['NO', 'Norway', 'Norsko', 'Norge']);
addCountryAliases('IE', ['IE', 'Ireland', 'Irsko', 'Éire', 'Eire']);
addCountryAliases('GB', ['GB', 'UK', 'United Kingdom', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Velká Británie', 'Velka Britanie', 'Spojené království', 'Spojene kralovstvi', 'Anglie']);

function countryCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const normalizedCode = upper === 'UK' ? 'GB' : upper;

  if (/^[A-Z]{2}$/.test(normalizedCode) && SUPPORTED_COUNTRY_CODES.has(normalizedCode)) {
    return normalizedCode;
  }

  return COUNTRY_ALIASES[foldText(raw)] || '';
}

function firstCountryCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const cc = countryCodeFromInput(part);
    if (cc) return cc;
  }

  return '';
}

function toTmSort(sortUi) {
  if (sortUi === 'latest') return 'date,desc';
  return 'date,asc';
}

function toTmCity(raw = '') {
  try {
    const c = canonForInputCity?.(raw);
    return (c && String(c)) || String(raw || '').trim();
  } catch {
    return String(raw || '').trim();
  }
}

function normCity(s = '') {
  return String(s || '')
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

function compactCity(s = '') {
  return normCity(s).replace(/[^a-z0-9]/g, '');
}

function cityKey(s = '') {
  const raw = String(s || '').trim();
  if (!raw) return '';

  try {
    const c = canonForInputCity?.(raw);
    return normCity(c || raw);
  } catch {
    return normCity(raw);
  }
}

function isSameCity(a = '', b = '') {
  const aa = cityKey(a);
  const bb = cityKey(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

const METRO_CITY_ALIASES = {
  'FR|paris': [
    'paris', 'saint denis', 'saint-denis', 'st denis', 'st-denis',
    'saint ouen', 'saint-ouen', 'nanterre', 'puteaux', 'courbevoie',
    'la defense', 'la défense', 'paris la defense', 'paris la défense',
    'boulogne billancourt', 'boulogne-billancourt', 'levallois perret',
    'levallois-perret', 'neuilly sur seine', 'neuilly-sur-seine',
    'issy les moulineaux', 'issy-les-moulineaux', 'aubervilliers', 'pantin',
    'montreuil', 'vincennes', 'ivry sur seine', 'ivry-sur-seine',
    'villepinte', 'versailles'
  ]
};

const MARKET_CITY_QUERY_ALIASES = {
  // Ticketmaster market locale někdy očekává lokální název města,
  // zatímco AJSEE interně drží kanonický EN název pro stabilní filtrování.
  // Tyto aliasy jsou pouze dodatečné query pokusy do TM proxy.
  'AT|vienna': ['Wien'],

  'DE|munich': ['München'],
  'DE|cologne': ['Köln'],
  'DE|dusseldorf': ['Düsseldorf'],
  'DE|nuremberg': ['Nürnberg'],

  'CH|zurich': ['Zürich'],
  'CH|geneva': ['Genève'],

  'IT|rome': ['Roma'],
  'IT|milan': ['Milano'],
  'IT|florence': ['Firenze'],
  'IT|venice': ['Venezia'],

  'ES|seville': ['Sevilla']
};

const METRO_CITY_QUERY_ALIASES = {
  'FR|paris': [
    'Nanterre',
    'Saint-Denis',
    'Saint Denis',
    'Boulogne-Billancourt',
    'Puteaux',
    'Courbevoie'
  ]
};

function getMetroCityQueryAttempts(countryCode = '', selectedCity = '') {
  const cc = String(countryCode || '').trim().toUpperCase();
  const selectedKey = compactCity(cityKey(selectedCity));
  const selectedRawKey = compactCity(selectedCity);

  const aliasGroups = [
    MARKET_CITY_QUERY_ALIASES[`${cc}|${selectedKey}`] || [],
    METRO_CITY_QUERY_ALIASES[`${cc}|${selectedKey}`] || []
  ];

  const out = [];
  const seenRaw = new Set([selectedRawKey].filter(Boolean));

  for (const aliases of aliasGroups) {
    for (const alias of aliases) {
      const city = String(alias || '').trim();
      const rawKey = compactCity(city);

      if (!city || !rawKey || seenRaw.has(rawKey)) continue;

      seenRaw.add(rawKey);
      out.push(city);
    }
  }

  return out;
}

function isSameCityOrMetro(evCity = '', selectedCity = '', countryCode = '') {
  if (isSameCity(evCity, selectedCity)) return true;

  const cc = String(countryCode || '').trim().toUpperCase();
  const selectedKey = compactCity(cityKey(selectedCity));
  const metroKey = `${cc}|${selectedKey}`;
  const aliases = METRO_CITY_ALIASES[metroKey];

  if (!aliases || !aliases.length) return false;

  const evCompact = compactCity(evCity);
  return aliases.some((alias) => compactCity(alias) === evCompact);
}

function normalizeHost(hostname = '') {
  return String(hostname || '').trim().toLowerCase().replace(/^www\./, '');
}

function hostMatches(hostname = '', expectedHost = '') {
  const host = normalizeHost(hostname);
  const expected = normalizeHost(expectedHost);
  if (!host || !expected) return false;
  return host === expected || host.endsWith(`.${expected}`);
}

function isGenericTicketmasterComHost(hostname = '') {
  const host = normalizeHost(hostname);
  return host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com');
}

function getImpactCountry(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    if (normalizeHost(parsed.hostname) !== 'ticketmaster.evyy.net') return '';

    const match = parsed.pathname.match(/\/c\/([^/]+)\/([^/]+)\/([^/?#]+)/);
    if (!match) return '';

    const assetId = match[2];
    const programId = match[3];
    return IMPACT_COUNTRY_BY_IDS[`${assetId}|${programId}`] || '';
  } catch {
    return '';
  }
}

function getNestedTargetUrl(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    return parsed.searchParams.get('u') || parsed.searchParams.get('url') || parsed.searchParams.get('to') || '';
  } catch {
    return '';
  }
}

function getUrlMarketScore(rawUrl = '', countryCode = '', depth = 0) {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc) return { allowed: true, score: 0 };

  const expectedHost = COUNTRY_MARKET_HOST[cc];
  if (!expectedHost) return { allowed: true, score: 0 };

  const sourceUrl = String(rawUrl || '').trim();
  if (!sourceUrl) return { allowed: false, score: -100 };
  if (depth > 3) return { allowed: true, score: 0 };

  try {
    const parsed = new URL(sourceUrl);
    const host = normalizeHost(parsed.hostname);

    if (host === 'ticketmaster.evyy.net') {
      const impactCountry = getImpactCountry(sourceUrl);

      if (impactCountry && impactCountry !== cc) return { allowed: false, score: -100 };

      const nested = getNestedTargetUrl(sourceUrl);
      if (nested) {
        const nestedScore = getUrlMarketScore(nested, cc, depth + 1);
        if (!nestedScore.allowed) return nestedScore;
        return { allowed: true, score: Math.max(impactCountry === cc ? 4 : 0, nestedScore.score) };
      }

      return { allowed: impactCountry ? impactCountry === cc : true, score: impactCountry === cc ? 4 : 0 };
    }

    if (hostMatches(host, expectedHost)) return { allowed: true, score: 5 };

    if (host === 'universe.com' || host.endsWith('.universe.com')) return { allowed: true, score: 2 };

    if (cc === 'GB' && (host === 'ticketweb.uk' || host.endsWith('.ticketweb.uk'))) {
      return { allowed: true, score: 2 };
    }

    // Některé evropské Discovery výsledky legitimně přichází z ticketmaster.com.
    // Nezahazujeme je, jen jim dáme nižší prioritu než přesnému market hostu.
    if (isGenericTicketmasterComHost(host)) {
      return { allowed: true, score: 1 };
    }

    if (host.includes('ticketmaster.')) return { allowed: false, score: -100 };

    const nested = getNestedTargetUrl(sourceUrl);
    if (nested) return getUrlMarketScore(nested, cc, depth + 1);

    return { allowed: false, score: -100 };
  } catch {
    return { allowed: false, score: -100 };
  }
}

function filterObviouslyWrongMarketUrls(events = [], countryCode = '') {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc || !events.length) return events;

  return events.filter((ev) => getUrlMarketScore(ev?.url || '', cc).allowed);
}

function normClassification(s = '') {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapSegmentToCategory(ev) {
  const cls = ev?.classifications?.[0] || {};
  const hay = normClassification([
    cls?.segment?.name || '',
    cls?.genre?.name || '',
    cls?.subGenre?.name || '',
    cls?.type?.name || '',
    cls?.subType?.name || '',
    ev?.name || ''
  ].filter(Boolean).join(' '));

  if (hay.includes('festival') || hay.includes('fest')) return 'festival';

  if (
    hay.includes('music') || hay.includes('musique') || hay.includes('musica') ||
    hay.includes('musik') || hay.includes('muziek') || hay.includes('concert')
  ) return 'concert';

  if (hay.includes('sport') || hay.includes('sports')) return 'sport';

  if (
    hay.includes('arts and theatre') || hay.includes('arts theatre') ||
    hay.includes('theatre') || hay.includes('theater') || hay.includes('teatro') ||
    hay.includes('opera') || hay.includes('comedy') || hay.includes('dance') ||
    hay.includes('ballet') || hay.includes('circus')
  ) return 'theatre';

  return 'other';
}

function pickDate(ev) {
  const dt = ev?.dates?.start || {};
  if (dt.dateTime) return dt.dateTime;
  if (dt.localDate && dt.localTime) return `${dt.localDate}T${dt.localTime}`;
  if (dt.localDate) return dt.localDate;
  return '';
}

function pickImage(ev) {
  const images = Array.isArray(ev?.images) ? ev.images : [];

  if (!images.length) return '';

  const normalized = images
    .map((image) => ({
      url: String(image?.url || '').trim(),
      width: Number(image?.width || 0),
      height: Number(image?.height || 0),
      ratio: String(image?.ratio || '').trim()
    }))
    .filter((image) => image.url);

  if (!normalized.length) return '';

  // Ticketmaster často vrací obří *_SOURCE soubory.
  // Ty jsou nevhodné pro event card a extrémně zvedají LCP / total payload.
  const nonSource = normalized.filter((image) => !/_SOURCE(?:[?#]|$)/i.test(image.url));

  // Pro karty chceme cca 480–640 px, ideálně 16:9.
  const pool = nonSource.length ? nonSource : normalized;

  const scored = pool
    .map((image) => {
      const width = image.width || 0;
      const height = image.height || 0;

      let score = 0;

      // Ideál pro mobilní i desktop kartu.
      score += width ? Math.abs(width - 480) : 900;

      // Příliš malé obrázky budou rozmazané.
      if (width && width < 280) score += 2500;

      // Příliš velké obrázky zbytečně nafukují payload.
      if (width > 800) score += 5000;
      if (width > 1200) score += 10000;

      // Preferuj 16:9, protože event card je vizuálně horizontální.
      if (image.ratio === '16_9') score -= 250;
      if (image.ratio && image.ratio !== '16_9') score += 250;

      // Když width chybí, ale height je extrémní, penalizuj.
      if (!width && height > 600) score += 3000;

      return { image, score };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.image?.url || '';
}

function extractPreferredTicketmasterUrl(rawUrl = '') {
  const sourceUrl = String(rawUrl || '').trim();
  if (!sourceUrl) return '';

  try {
    const parsed = new URL(sourceUrl);

    if (normalizeHost(parsed.hostname) === 'ticketmaster.evyy.net') return parsed.toString();

    const nestedUrl = parsed.searchParams.get('url') || parsed.searchParams.get('to') || parsed.searchParams.get('u');
    if (nestedUrl) {
      try {
        const nested = new URL(nestedUrl);
        if (normalizeHost(nested.hostname) === 'ticketmaster.evyy.net') return nested.toString();
      } catch {
        // noop
      }
    }

    return parsed.toString();
  } catch {
    return sourceUrl;
  }
}

function buildTicketmasterOutboundUrl(rawUrl = '', eventId = '', countryCode = '') {
  const preferredUrl = extractPreferredTicketmasterUrl(rawUrl);
  if (!preferredUrl) return '';

  if (preferredUrl.includes('/.netlify/functions/tmOutbound')) return preferredUrl;

  const qs = new URLSearchParams();
  qs.set('to', preferredUrl);
  if (eventId) qs.set('eid', String(eventId));
  if (countryCode) qs.set('cc', String(countryCode).toUpperCase());

  return `/.netlify/functions/tmOutbound?${qs.toString()}`;
}

function mapTicketmasterEvent(ev, locale, context = {}) {
  const cat = mapSegmentToCategory(ev);
  const dt = pickDate(ev);
  const img = pickImage(ev);

  const venue = ev?._embedded?.venues?.[0] || {};
  const actualCity = venue?.city?.name || '';
  const country = venue?.country?.countryCode || '';

  const selectedCity = String(context.selectedCity || '').trim();
  const selectedCountry = String(context.selectedCountry || '').trim().toUpperCase();

  const displayCity =
    selectedCity &&
    selectedCountry &&
    country &&
    String(country).toUpperCase() === selectedCountry &&
    actualCity &&
    isSameCityOrMetro(actualCity, selectedCity, selectedCountry)
      ? selectedCity
      : actualCity;

  const latRaw = venue?.location?.latitude ?? venue?.location?.lat ?? '';
  const lonRaw = venue?.location?.longitude ?? venue?.location?.lon ?? '';
  const lat = Number.isFinite(+latRaw) ? +latRaw : undefined;
  const lon = Number.isFinite(+lonRaw) ? +lonRaw : undefined;

  const desc = [ev?.info, ev?.pleaseNote].filter(Boolean).join(' — ');

  const price = Array.isArray(ev?.priceRanges) && ev.priceRanges.length
    ? (ev.priceRanges[0]?.min ?? null)
    : null;

  const tmRawUrl = ev.url || '';
  const outboundUrl = buildTicketmasterOutboundUrl(tmRawUrl, ev.id || '', country);

  return {
    id: `ticketmaster-${ev.id}`,
    title: { [locale]: ev.name },
    description: desc ? { [locale]: desc } : {},
    category: cat,
    datetime: dt,
    location: {
      city: displayCity,
      actualCity,
      country,
      lat,
      lon
    },
    venue: {
      city: actualCity,
      name: venue?.name || ''
    },
    image: img,
    partner: 'ticketmaster',
    sourceName: 'Ticketmaster',
    url: outboundUrl,
    tickets: outboundUrl,
    priceFrom: price,
    promo: null
  };
}

function filterRawEventsByStrictCityCountry(events = [], { strictCity = '', strictCountry = '' } = {}) {
  const cc = String(strictCountry || '').trim().toUpperCase();
  const city = String(strictCity || '').trim();

  return events.filter((ev) => {
    const venue = ev?._embedded?.venues?.[0] || {};
    const evCountry = String(venue?.country?.countryCode || '').trim().toUpperCase();
    const evCity = String(venue?.city?.name || '').trim();

    if (cc && evCountry && evCountry !== cc) return false;
    if (city && evCity && !isSameCityOrMetro(evCity, city, cc)) return false;

    return true;
  });
}

function rawEventKey(ev) {
  const id = String(ev?.id || '').trim();
  if (id) return id;

  const venue = ev?._embedded?.venues?.[0] || {};
  const city = venue?.city?.name || '';
  const country = venue?.country?.countryCode || '';
  const date = pickDate(ev);
  const name = ev?.name || '';

  return `${name}|${date}|${city}|${country}`.toLowerCase();
}

function dedupeRawEvents(events = []) {
  const out = [];
  const seen = new Set();

  for (const ev of events) {
    const key = rawEventKey(ev);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }

  return out;
}

function rawEventTime(ev) {
  const d = pickDate(ev);
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function sortRawEvents(events = [], sort = 'date,asc', countryCode = '') {
  const direction = sort === 'date,desc' ? -1 : 1;
  const cc = String(countryCode || '').trim().toUpperCase();

  return [...events].sort((a, b) => {
    const da = rawEventTime(a);
    const db = rawEventTime(b);
    if (da !== db) return direction * (da - db);

    const sa = getUrlMarketScore(a?.url || '', cc).score;
    const sb = getUrlMarketScore(b?.url || '', cc).score;
    if (sa !== sb) return sb - sa;

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function getCategoryQueryVariants(category = 'all') {
  const cat = String(category || 'all').trim().toLowerCase();

  switch (cat) {
    case 'concert':
      return [{ segmentName: 'Music' }];
    case 'sport':
      return [{ segmentName: 'Sports' }];
    case 'theatre':
      return [
        { segmentName: 'Arts & Theatre' },
        { classificationName: 'Theatre' }
      ];
    case 'festival':
      return [
        { classificationName: 'Festival' },
        { segmentName: 'Music' }
      ];
    case 'all':
    default:
      return [{}];
  }
}

function categoryVariantKey(v = {}) {
  return [v.segmentName || '', v.classificationName || ''].join('|');
}

function shouldDebugTicketmaster(filters = {}) {
  if (filters.debug || filters.ajseeDebug || filters.debugTm) return true;

  try {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      return qs.get('debug') === '1' || qs.get('ajseeDebug') === '1' || qs.get('ajseeTmDebug') === '1';
    }
  } catch {
    // noop
  }

  return false;
}

const CITY_LOCALE_FALLBACK_BY_COUNTRY = {
  // Ověřeno na Discovery API:
  // city=Vienna + locale=de-at může vracet 0,
  // zatímco city=Vienna + locale=en-us vrací relevantní AT výsledky.
  AT: ['en-us']
};

function makeLocaleList({
  marketLocale = '',
  locale = '',
  debug = false,
  countryCode = '',
  hasCity = false
} = {}) {
  const cc = String(countryCode || '').trim().toUpperCase();
  const primary = marketLocale || locale || 'en-gb';
  const out = [primary];

  if (hasCity && cc && CITY_LOCALE_FALLBACK_BY_COUNTRY[cc]) {
    out.push(...CITY_LOCALE_FALLBACK_BY_COUNTRY[cc]);
  }

  // Debug režim dovolí jeden obecný fallback pro diagnostiku,
  // ale držíme ho až za cílenými market fallbacky.
  if (debug) {
    const fallback = primary === 'en' ? 'en-gb' : 'en';
    out.push(fallback);
  }

  return out.filter((v, i, arr) => !!v && arr.indexOf(v) === i);
}

function createRateLimitError(message = 'Ticketmaster rate limited') {
  const state = exposeRateLimitState('rate_limited');

  const err = new Error(message);
  err.status = 429;
  err.rateLimited = true;
  err.retryAt = state.retryAt || '';
  err.retryAfterMs = state.retryAfterMs || 0;
  err.provider = 'ticketmaster';

  return err;
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseRetryAfterHeader(value, now = Date.now()) {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }

  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate) && asDate > now) {
    return asDate - now;
  }

  return 0;
}

function getRateLimitUntilFromResponse(res, data) {
  const now = Date.now();
  const headers = res?.headers;

  const getHeader = (name) => {
    try {
      return headers?.get?.(name) || '';
    } catch {
      return '';
    }
  };

  const candidates = [];

  const headerUntil = parsePositiveNumber(getHeader('x-ajsee-rate-limit-until'));
  if (headerUntil > now) candidates.push(headerUntil);

  const tmReset = parsePositiveNumber(getHeader('x-ajsee-tm-rate-limit-reset'));
  if (tmReset > now) candidates.push(tmReset + 5000);

  const headerRetryMs = parsePositiveNumber(getHeader('x-ajsee-retry-after-ms'));
  if (headerRetryMs > 0) candidates.push(now + headerRetryMs);

  const retryAfterMs = parseRetryAfterHeader(getHeader('retry-after'), now);
  if (retryAfterMs > 0) candidates.push(now + retryAfterMs);

  const proxy = data?._ajseeProxy || {};

  const payloadUntil = parsePositiveNumber(
    proxy.rateLimitUntil ||
    proxy.until ||
    proxy.resetAt
  );
  if (payloadUntil > now) candidates.push(payloadUntil);

  const payloadRetryMs = parsePositiveNumber(proxy.retryAfterMs);
  if (payloadRetryMs > 0) candidates.push(now + payloadRetryMs);

  if (candidates.length) {
    return Math.max(...candidates);
  }

  return now + RATE_LIMIT_COOLDOWN_MS;
}

function isRateLimitPayload(data) {
  const upstreamStatus = Number(data?._ajseeProxy?.upstreamStatus || 0);
  const reason = String(data?._ajseeProxy?.reason || '').toLowerCase();

  return upstreamStatus === 429 || reason.includes('rate_limited') || reason.includes('rate limit');
}

function isServerRateLimitResponse(res) {
  try {
    const cacheState = String(res?.headers?.get?.('x-ajsee-cache') || '').toLowerCase();
    const active = String(res?.headers?.get?.('x-ajsee-rate-limit-active') || '') === '1';

    return active || cacheState.includes('rate-limited');
  } catch {
    return false;
  }
}

function setRateLimitCooldown(reason = 'ticketmaster_rate_limited', untilOverride = 0) {
  const now = Date.now();
  const nextUntil = Number.isFinite(+untilOverride) && +untilOverride > now
    ? +untilOverride
    : now + RATE_LIMIT_COOLDOWN_MS;

  RATE_LIMIT_UNTIL = Math.max(Number(RATE_LIMIT_UNTIL || 0), nextUntil);

  writeStoredRateLimit(RATE_LIMIT_UNTIL, reason);
  exposeRateLimitState(reason);

  return RATE_LIMIT_UNTIL;
}

async function fetchJsonCached(url) {
  const now = Date.now();

  const cooldownUntil = getEffectiveRateLimitUntil(now);

  if (cooldownUntil && now < cooldownUntil) {
    exposeRateLimitState('cooldown_active');
    throw createRateLimitError('Ticketmaster rate limit cooldown active');
  }

  const cached = REQUEST_CACHE.get(url);

  if (cached && cached.exp > now) {
    return cached.promise;
  }

  const promise = fetch(url, { cache: 'default' }).then(async (res) => {
    const status = res.status;
    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (status === 429 || isRateLimitPayload(data) || isServerRateLimitResponse(res)) {
      const reason =
        String(data?._ajseeProxy?.reason || '').trim() ||
        'ticketmaster_rate_limited';

      const until = getRateLimitUntilFromResponse(res, data);

      setRateLimitCooldown(reason, until);

      throw createRateLimitError(`Ticketmaster proxy ${status || 429}`);
    }

    if (!res.ok) {
      const err = new Error(`Ticketmaster proxy ${status}`);
      err.status = status;
      err.body = text;
      throw err;
    }

    if (!data) {
      const err = new Error('Ticketmaster proxy returned invalid JSON');
      err.status = status;
      throw err;
    }

    return data;
  });

  REQUEST_CACHE.set(url, {
    exp: now + REQUEST_CACHE_TTL_MS,
    promise
  });

  promise.catch((err) => {
    // 429 se řeší globálním cooldownem. Běžné chyby z cache mažeme,
    // aby se po krátkém výpadku mohl další request zkusit znovu.
    if (!err?.rateLimited) {
      REQUEST_CACHE.delete(url);
    }
  });

  return promise;
}

function shouldContinueAfterCollected(collectedRaw, requestedSize) {
  return collectedRaw.length < Math.max(1, Number(requestedSize) || 12);
}

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  const rawCity = String(filters.city || '').trim();

  const cityInputCountry = countryCodeFromInput(rawCity);
  const isCountrySearchFromCityField = Boolean(rawCity && cityInputCountry);

  const effectiveRawCity = isCountrySearchFromCityField ? '' : rawCity;
  const tmCity = effectiveRawCity ? toTmCity(effectiveRawCity) : '';

  const explicitCountry = firstCountryCodeFromInput(
    filters.cityCountryCode ||
    filters.countryCode ||
    filters.country ||
    ''
  );

  const guessedCC = effectiveRawCity
    ? String(
        guessCountryCodeFromCity?.(effectiveRawCity) ||
        guessCountryCodeFromCity?.(tmCity) ||
        ''
      ).toUpperCase()
    : '';

  const selectedCityCountry = effectiveRawCity
    ? String(filters.cityCountryCode || guessedCC || explicitCountry || '').toUpperCase()
    : '';

  const countrySearchCode =
    cityInputCountry ||
    (!effectiveRawCity ? explicitCountry : '') ||
    '';

  const targetCountryForLocale = selectedCityCountry || countrySearchCode || explicitCountry || '';
  const targetCountryForMarketFilter = selectedCityCountry || countrySearchCode || explicitCountry || '';
  const marketLocale = targetCountryForLocale ? MARKET_LOCALE_BY_COUNTRY[targetCountryForLocale] : '';

  const sort = toTmSort(filters.sort);
  const page = Number.isFinite(+filters.page) ? String(+filters.page) : '0';
  const size = Number.isFinite(+filters.size) ? String(+filters.size) : '12';

  const category = filters.category || filters.segment || 'all';
  const categoryVariants = getCategoryQueryVariants(category);
  const debugTm = shouldDebugTicketmaster(filters);
  const locales = makeLocaleList({
    marketLocale,
    locale,
    debug: debugTm,
    countryCode: targetCountryForLocale,
    hasCity: Boolean(tmCity)
  });

  const putCommonParams = (qs, categoryVariant = {}) => {
    if (filters.keyword) qs.set('keyword', String(filters.keyword));
    if (categoryVariant.segmentName) qs.set('segmentName', String(categoryVariant.segmentName));
    if (categoryVariant.classificationName) qs.set('classificationName', String(categoryVariant.classificationName));
    if (filters.classificationName) qs.set('classificationName', String(filters.classificationName));
    if (filters.dateFrom) qs.set('dateFrom', String(filters.dateFrom));
    if (filters.dateTo) qs.set('dateTo', String(filters.dateTo));

    let latlong = filters.latlong;

    if (!latlong && filters.nearMeLat != null && filters.nearMeLon != null) {
      latlong = `${Number(filters.nearMeLat)},${Number(filters.nearMeLon)}`;
    }

    if (latlong) {
      qs.set('latlong', String(latlong));
      const radius = filters.radius || filters.nearMeRadiusKm || 50;
      if (radius) qs.set('radius', String(radius));
      qs.set('unit', String(filters.unit || 'km'));
    }

    if (filters.venueId) qs.set('venueId', String(filters.venueId));
    if (filters.attractionId) qs.set('attractionId', String(filters.attractionId));
    if (filters.dmaId) qs.set('dmaId', String(filters.dmaId));
    if (filters.marketId) qs.set('marketId', String(filters.marketId));
    if (debugTm) qs.set('debug', '1');

    qs.set('sort', sort);
    qs.set('page', page);
    qs.set('size', size);
  };

  const attempts = [];

  if (tmCity) {
    if (selectedCityCountry) {
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
        countryStrategy: 'both'
      });

      attempts.push({
        mode: 'broad',
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
        countryStrategy: ''
      });

      for (const metroCity of getMetroCityQueryAttempts(selectedCityCountry, tmCity)) {
        attempts.push({
          mode: 'city',
          city: metroCity,
          countryCode: selectedCityCountry,
          strictCity: tmCity,
          strictCountry: selectedCityCountry,
          countryStrategy: 'both',
          force: true,
          reason: 'metro'
        });
      }
    } else {
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: '',
        strictCity: tmCity,
        strictCountry: '',
        countryStrategy: ''
      });
    }
  } else {
    const broadCountry = countrySearchCode || explicitCountry || 'CZ';
    attempts.push({
      mode: 'broad',
      countryCode: broadCountry,
      strictCity: '',
      strictCountry: broadCountry,
      countryStrategy: ''
    });
  }

  const keyOf = (a) => [
    a.mode,
    a.city || a.keyword || '',
    a.countryCode || '',
    a.strictCity || '',
    a.strictCountry || '',
    a.countryStrategy || ''
  ].join('|');

  const seenAttempts = new Set();
  const uniqAttempts = attempts.filter((a) => {
    const key = keyOf(a);
    if (seenAttempts.has(key)) return false;
    seenAttempts.add(key);
    return true;
  });

  const hasForcedAttempts = uniqAttempts.some((a) => !!a.force);
  const hasGeo = Boolean(filters.latlong || (filters.nearMeLat != null && filters.nearMeLon != null));
  const collectedRaw = [];
  let rateLimited = false;

  outer:
  for (const locTry of locales) {
    for (const categoryVariant of categoryVariants) {
      for (const attempt of uniqAttempts) {
        const enoughCollected = !shouldContinueAfterCollected(collectedRaw, size);

        if (enoughCollected && !attempt.force) {
          if (hasForcedAttempts) continue;
          break outer;
        }

        const qs = new URLSearchParams();
        putCommonParams(qs, categoryVariant);
        qs.set('locale', locTry);

        if (!hasGeo && attempt.countryCode) qs.set('countryCode', attempt.countryCode);
        if (attempt.countryStrategy) qs.set('countryStrategy', attempt.countryStrategy);
        else if (filters.countryStrategy) qs.set('countryStrategy', String(filters.countryStrategy));

        if (attempt.mode === 'city') {
          qs.set('city', attempt.city);
        } else if (attempt.mode === 'keyword' && attempt.keyword && !filters.keyword) {
          qs.set('keyword', attempt.keyword);
        }

        const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;

        if (debugTm) {
          console.info(
            '[TM adapter] GET',
            url,
            '| raw city =', rawCity || '(none)',
            '| effective city =', tmCity || '(none)',
            '| city input country =', cityInputCountry || '(none)',
            '| selected country =', selectedCityCountry || countrySearchCode || explicitCountry || '(none)',
            '| using =', attempt.mode,
            '| category variant =', categoryVariantKey(categoryVariant) || '(none)',
            '| patch =', AJSEE_TM_PATCH_MARKER
          );
        }

        try {
          const data = await fetchJsonCached(url);
          const list = data?._embedded?.events || [];

          if (!Array.isArray(list) || !list.length) continue;

          const strictRawList = (attempt.strictCity || attempt.strictCountry)
            ? filterRawEventsByStrictCityCountry(list, {
                strictCity: attempt.strictCity,
                strictCountry: attempt.strictCountry
              })
            : list;

          if (!strictRawList.length) continue;
          collectedRaw.push(...strictRawList);
        } catch (err) {
          if (err?.status === 429 || err?.rateLimited) {
            rateLimited = true;
            break outer;
          }

          if (debugTm) {
            console.error('[Ticketmaster adapter] fetch error:', locTry, attempt, err);
          }
        }
      }
    }
  }

  if (rateLimited) {
    if (typeof exposeRateLimitState === 'function') {
      exposeRateLimitState('rate_limited');
    }

    if (debugTm) {
      console.warn('[Ticketmaster adapter] rate limited; stopped additional fallback requests.');
    }

    // Klíčová změna:
    // Pokud API spadlo na rate limit a nemáme žádná data,
    // nesmíme vrátit [] jako běžný prázdný výsledek.
    // Chybu pošleme výš do eventsApi.js a UI pak ukáže správnou hlášku.
    if (!collectedRaw.length) {
      const err = createRateLimitError('Ticketmaster API is temporarily rate limited');
      err.code = 'TICKETMASTER_RATE_LIMITED';
      err.partner = 'ticketmaster';
      err.retryAfterMs = RATE_LIMIT_UNTIL
        ? Math.max(0, RATE_LIMIT_UNTIL - Date.now())
        : RATE_LIMIT_COOLDOWN_MS;

      throw err;
    }
  }

  let dedupedRaw = dedupeRawEvents(collectedRaw);
  if (!dedupedRaw.length) return [];

  dedupedRaw = filterObviouslyWrongMarketUrls(dedupedRaw, targetCountryForMarketFilter);
  dedupedRaw = sortRawEvents(dedupedRaw, sort, targetCountryForMarketFilter);

  return dedupedRaw.map((ev) => mapTicketmasterEvent(ev, locale, {
    selectedCity: tmCity,
    selectedCountry: selectedCityCountry
  }));
}

export default { fetchEvents };


