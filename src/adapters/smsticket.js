// /src/adapters/smsticket.js
// ---------------------------------------------------------
// AJSEE – smsticket adapter
// Načítá předgenerovaný JSON z /public/data/smsticket-events.json.
// Výkon:
// - nevrací celý feed najednou,
// - filtruje city/category/date/keyword/near-me už před eventsApi,
// - stránkuje podle filters.page + filters.size.
// ---------------------------------------------------------

import { canonForInputCity } from '../city/canonical.js';
import { matchesKeywordPrefix } from '../search/keyword-match.js';

import {
  buildSmsticketTaxonomy,
  deriveLegacyCategory
} from '../taxonomy/event-taxonomy.js';

import {
  matchesEventDiscoveryFilters
} from '../taxonomy/event-filtering.js';

const DEFAULT_DATA_URL = '/data/smsticket-events.json';

// AJSEE_SMSTICKET_CITY_SUBSET_FEEDS_v1
// Prefer a small city-specific static feed when the user explicitly searches
// a supported CZ/SK city. If the subset is missing or fails to load, fall back
// to the original full feed.
const CITY_DATA_URLS = [
  { url: '/data/smsticket-events-praha.json', aliases: ['praha', 'prague'] },
  { url: '/data/smsticket-events-brno.json', aliases: ['brno'] },
  { url: '/data/smsticket-events-ostrava.json', aliases: ['ostrava'] },
  { url: '/data/smsticket-events-bratislava.json', aliases: ['bratislava'] },
  { url: '/data/smsticket-events-kosice.json', aliases: ['kosice', 'košice'] }
];

const dataCache = new Map();
const dataPromiseCache = new Map();

function getFilterCityText(filters = {}) {
  return String([
    filters.city,
    filters.cityLabel,
    filters.location
  ].filter(Boolean).join(' ')).trim();
}

function getCanonicalCityText(cityText = '') {
  try {
    const canonical = canonForInputCity(cityText);

    if (!canonical) return '';

    if (typeof canonical === 'string') return canonical;

    return String(
      canonical.city ||
      canonical.name ||
      canonical.label ||
      canonical.value ||
      ''
    );
  } catch {
    return '';
  }
}

function resolveSmsticketDataUrl(filters = {}) {
  const cityText = getFilterCityText(filters);

  if (!cityText) return DEFAULT_DATA_URL;

  const folded = fold([
    cityText,
    getCanonicalCityText(cityText)
  ].filter(Boolean).join(' '));

  const match = CITY_DATA_URLS.find((definition) =>
    definition.aliases.some((alias) => {
      const foldedAlias = fold(alias);

      return (
        folded === foldedAlias ||
        folded.startsWith(foldedAlias + ' ') ||
        folded.endsWith(' ' + foldedAlias) ||
        folded.includes(' ' + foldedAlias + ' ')
      );
    })
  );

  return match?.url || DEFAULT_DATA_URL;
}

async function loadSmsticketDataUrl(dataUrl = DEFAULT_DATA_URL) {
  if (dataCache.has(dataUrl)) return dataCache.get(dataUrl);
  if (dataPromiseCache.has(dataUrl)) return dataPromiseCache.get(dataUrl);

  const promise = (async () => {
    try {
      const response = await fetch(dataUrl, { cache: 'default' });

      if (!response.ok) {
        dataCache.set(dataUrl, null);
        return null;
      }

      const payload = await response.json();
      const events = Array.isArray(payload?.events) ? payload.events : [];

      dataCache.set(dataUrl, events);
      return events;
    } catch (error) {
      console.warn('[smsticket adapter] failed to load data from ' + dataUrl + ':', error);
      dataCache.set(dataUrl, null);
      return null;
    } finally {
      dataPromiseCache.delete(dataUrl);
    }
  })();

  dataPromiseCache.set(dataUrl, promise);
  return promise;
}

async function loadSmsticketData(filters = {}) {
  const primaryUrl = resolveSmsticketDataUrl(filters);
  const primaryEvents = await loadSmsticketDataUrl(primaryUrl);

  if (Array.isArray(primaryEvents)) return primaryEvents;

  if (primaryUrl !== DEFAULT_DATA_URL) {
    const fallbackEvents = await loadSmsticketDataUrl(DEFAULT_DATA_URL);

    if (Array.isArray(fallbackEvents)) return fallbackEvents;
  }

  return [];
}

function fold(value = '') {
  return String(value || '')
    .trim()
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

function asText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.cs || value.en || Object.values(value)[0] || '';
  return String(value);
}

function getCity(ev = {}) {
  return String(
    ev?.location?.city ||
    ev?.venue?.city ||
    ev?.place?.city ||
    ''
  ).trim();
}

function getTitle(ev = {}) {
  return asText(ev?.title);
}

function getDescription(ev = {}) {
  return asText(ev?.description);
}

function getDateMs(raw) {
  const value = String(raw || '').trim();
  if (!value) return NaN;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(+match[1], +match[2] - 1, +match[3], 12, 0, 0, 0).getTime();
  }

  return new Date(value).getTime();
}

function boundaryMs(raw, isEnd = false) {
  const value = String(raw || '').trim();
  if (!value) return NaN;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return isEnd
      ? new Date(+match[1], +match[2] - 1, +match[3], 23, 59, 59, 999).getTime()
      : new Date(+match[1], +match[2] - 1, +match[3], 0, 0, 0, 0).getTime();
  }

  return new Date(value).getTime();
}

function inDateRange(ev, dateFrom = '', dateTo = '') {
  if (!dateFrom && !dateTo) return true;

  const t = getDateMs(ev?.datetime || ev?.date);
  if (!Number.isFinite(t)) return false;

  const from = boundaryMs(dateFrom, false);
  const to = boundaryMs(dateTo, true);

  if (Number.isFinite(from) && t < from) return false;
  if (Number.isFinite(to) && t > to) return false;

  return true;
}

export function isSmsticketEventAvailable(ev = {}, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();

  if (!Number.isFinite(nowMs)) return false;

  const eventDateSource = String(
    ev?.datetime || ev?.date || ''
  ).trim();

  const dateMatch = eventDateSource.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  const eventDayEndMs = eventDateSource
    ? boundaryMs(
        dateMatch?.[1] || eventDateSource,
        true
      )
    : Number.NaN;

  const bookingEndMs = boundaryMs(
    ev?.bookingEndsAt,
    true
  );

  const eventIsCurrent =
    Number.isFinite(eventDayEndMs) &&
    eventDayEndMs >= nowMs;

  const bookingIsCurrent =
    Number.isFinite(bookingEndMs) &&
    bookingEndMs >= nowMs;

  return eventIsCurrent || bookingIsCurrent;
}

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
  const dLat = toRad(+lat2 - +lat1);
  const dLon = toRad(+lon2 - +lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(+lat1)) * Math.cos(toRad(+lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasNearMe(filters = {}) {
  return filters.nearMeLat != null && filters.nearMeLon != null;
}

function shouldSkipForCountry(filters = {}) {
  const countryCode = String(filters.countryCode || '').trim().toUpperCase();
  const hasCity = Boolean(String(filters.city || '').trim());

  // smsticket feed je CZ zdroj.
  return countryCode && countryCode !== 'CZ' && !hasCity && !hasNearMe(filters);
}


const CITY_ALIAS_GROUPS = [
  // UI / Ticketmaster canonical value vs. Czech smsticket feed value
  ['prague', 'praha', 'prag', 'praga', 'prága', 'hlavni mesto praha', 'hl. m. praha', 'hl m praha']
];

// AJSEE_SMSTICKET_FOLDED_CITY_ALIAS_GROUPS_v1
// Avoid rebuilding folded alias groups for every event in large static feeds.
const FOLDED_CITY_ALIAS_GROUPS = CITY_ALIAS_GROUPS.map((group) => group.map(fold));

function cityAliasTokens(value = '') {
  const base = fold(value)
    .replace(/\bcz\b/g, '')
    .replace(/\bcesko\b/g, '')
    .replace(/\bczech republic\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return [];

  const tokens = new Set([base]);

  // AJSEE_SMSTICKET_CANONICAL_CITY_ALIAS_TOKENS_v1
  // Generic bridge for UI/local labels and provider canonical labels:
  // Plzeň/Pilsen, Praha/Prague, Vídeň/Vienna, Mnichov/Munich, etc.
  try {
    const canon = canonForInputCity?.(value);
    const canonBase = fold(canon)
      .replace(/\bcz\b/g, '')
      .replace(/\bcesko\b/g, '')
      .replace(/\bczech republic\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (canonBase) tokens.add(canonBase);
  } catch {
    // keep base-only matching
  }

  for (const foldedGroup of FOLDED_CITY_ALIAS_GROUPS) {
    if (foldedGroup.some((alias) => base === alias || base.includes(alias) || alias.includes(base))) {
      foldedGroup.forEach((alias) => tokens.add(alias));
    }
  }

  return [...tokens].filter(Boolean);
}

function cityTokenMatches(a = '', b = '') {
  if (!a || !b) return false;

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
}

function matchesCity(ev, city = '') {
  const selectedTokens = cityAliasTokens(city);

  if (!selectedTokens.length) return true;

  const eventTokens = cityAliasTokens(getCity(ev));

  if (!eventTokens.length) return false;

  return selectedTokens.some((selected) => {
    return eventTokens.some((eventCity) => cityTokenMatches(eventCity, selected));
  });
}




// AJSEE_SMSTICKET_CITY_TOKEN_CACHE_v1
// Fast path for fetchEvents(): selected city tokens are computed once,
// event city tokens are cached by raw city label.
function cachedCityAliasTokens(value = '', cacheMap = new Map()) {
  const key = String(value || '').trim().toLowerCase();

  if (!key) return [];

  if (cacheMap.has(key)) {
    return cacheMap.get(key);
  }

  const tokens = cityAliasTokens(value);
  cacheMap.set(key, tokens);

  return tokens;
}

function cityTokenListsMatch(eventTokens = [], selectedTokens = []) {
  if (!eventTokens.length || !selectedTokens.length) return false;

  return selectedTokens.some((selected) => {
    return eventTokens.some((eventCity) => cityTokenMatches(eventCity, selected));
  });
}

function matchesCityWithPreparedTokens(ev, selectedTokens = [], cacheMap = new Map()) {
  if (!selectedTokens.length) return true;

  const eventTokens = cachedCityAliasTokens(getCity(ev), cacheMap);

  return cityTokenListsMatch(eventTokens, selectedTokens);
}


export function normalizeSmsticketCategory(category = '') {
  const normalized = fold(category);

  switch (normalized) {
    case 'music':
    case 'concert':
      return 'concert';

    case 'arts':
    case 'theatre':
      return 'theatre';

    case 'sports':
    case 'sport':
      return 'sport';

    case 'festival':
      return 'festival';

    case 'all':
      return 'all';

    default:
      return normalized || 'other';
  }
}

function hasFestivalHint(ev = {}) {
  const values = [
    asText(ev?.title),
    ...(Array.isArray(ev?.categories) ? ev.categories : []),
    ...(Array.isArray(ev?.genres) ? ev.genres : []),
    ...(Array.isArray(ev?.types) ? ev.types : []),
  ];

  const tokens = fold(values.join(' '))
    .split(' ')
    .filter(Boolean);

  return tokens.some((token) => {
    return token === 'fest' || token.startsWith('festival');
  });
}

export function normalizeSmsticketEventCategory(ev = {}) {
  if (hasFestivalHint(ev)) return 'festival';

  return normalizeSmsticketCategory(ev?.category);
}

export function withSmsticketTaxonomy(ev = {}) {
  const taxonomy =
    buildSmsticketTaxonomy(ev);

  return {
    ...ev,

    category:
      deriveLegacyCategory(
        taxonomy
      ),

    taxonomy
  };
}

function matchesDiscoveryFilters(
  ev,
  filters = {}
) {
  return matchesEventDiscoveryFilters(
    ev,
    {
      category:
        filters.category ??
        filters.segment ??
        'all',

      audience:
        filters.audience ??
        ''
    }
  );
}

function matchesKeyword(ev, keyword = '') {
  const query = fold(keyword);
  if (!query) return true;

  const haystack = fold([
    getTitle(ev),
    getDescription(ev),
    getCity(ev),
    ev?.venue?.name,
    ev?.place?.company,
    ...(Array.isArray(ev?.categories) ? ev.categories : []),
    ...(Array.isArray(ev?.genres) ? ev.genres : []),
    ...(Array.isArray(ev?.types) ? ev.types : [])
  ].filter(Boolean).join(' '));

  return matchesKeywordPrefix(haystack, query);
}

function matchesNearMe(ev, filters = {}) {
  if (!hasNearMe(filters)) return true;

  const radius = Number.isFinite(+filters.nearMeRadiusKm)
    ? +filters.nearMeRadiusKm
    : 50;

  const lat =
    ev?.location?.lat ??
    ev?.location?.latitude ??
    ev?.venue?.location?.lat ??
    ev?.venue?.location?.latitude;

  const lon =
    ev?.location?.lon ??
    ev?.location?.longitude ??
    ev?.venue?.location?.lon ??
    ev?.venue?.location?.longitude;

  return haversineKm(+filters.nearMeLat, +filters.nearMeLon, +lat, +lon) <= radius;
}


// AJSEE_SMSTICKET_TICKET_OPTIONS_v1
function smsticketDedupeText(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return String(
      value.cs ||
      value.sk ||
      value.en ||
      Object.values(value)[0] ||
      ''
    );
  }

  return String(value);
}

function normalizeSmsticketOccurrencePart(value) {
  return smsticketDedupeText(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function smsticketOccurrenceTitle(event) {
  return normalizeSmsticketOccurrencePart(
    event?.title
  );
}

function smsticketOccurrenceLocation(event) {
  const place = event?.place || {};
  const venue = event?.venue || {};
  const location = event?.location || {};

  const placeId = String(
    place?.id || ''
  ).trim();

  const venueName =
    venue?.name ||
    place?.company ||
    event?.venueName ||
    '';

  const city =
    venue?.city ||
    location?.city ||
    place?.city ||
    '';

  const street =
    venue?.address?.street ||
    place?.street ||
    event?.address ||
    '';

  const latitude =
    location?.lat ??
    location?.latitude ??
    venue?.location?.lat ??
    venue?.location?.latitude ??
    '';

  const longitude =
    location?.lon ??
    location?.longitude ??
    venue?.location?.lon ??
    venue?.location?.longitude ??
    '';

  const hasLocation =
    placeId ||
    venueName ||
    city ||
    street ||
    latitude !== '' ||
    longitude !== '';

  if (!hasLocation) return '';

  return [
    placeId ? 'place-' + placeId : '',
    venueName,
    city,
    street,
    latitude !== '' ? String(latitude) : '',
    longitude !== '' ? String(longitude) : '',
  ]
    .map(normalizeSmsticketOccurrencePart)
    .filter(Boolean)
    .join('|');
}

function smsticketExactOccurrenceKey(event) {
  const title = smsticketOccurrenceTitle(event);

  const datetime = String(
    event?.datetime ||
    event?.date ||
    ''
  ).trim();

  const location =
    smsticketOccurrenceLocation(event);

  if (!title || !datetime || !location) {
    return '';
  }

  return [
    title,
    datetime,
    location,
  ].join('||');
}

function smsticketTicketCurrency(event) {
  const price = String(
    event?.priceFrom || ''
  ).trim();

  if (price.includes('\u004b\u010d') || /CZK/i.test(price)) {
    return 'CZK';
  }

  if (price.includes('\u20ac') || /EUR/i.test(price)) {
    return 'EUR';
  }

  if (price.includes('\u00a3') || /GBP/i.test(price)) {
    return 'GBP';
  }

  if (price.includes('$') || /USD/i.test(price)) {
    return 'USD';
  }

  return '';
}
function smsticketTicketOption(event) {
  const url = String(
    event?.tickets ||
    event?.url ||
    ''
  ).trim();

  if (!url) return null;

  return {
    url,
    priceFrom: String(
      event?.priceFrom || ''
    ).trim(),
    currency:
      smsticketTicketCurrency(event),
    provider: 'smsticket',
  };
}

function smsticketBookingEndMs(event) {
  const parsed = new Date(
    event?.bookingEndsAt || ''
  );

  return Number.isFinite(parsed.getTime())
    ? parsed.getTime()
    : Number.NEGATIVE_INFINITY;
}

function smsticketCurrencyRank(event) {
  const currency =
    smsticketTicketCurrency(event);

  if (currency === 'CZK') return 0;
  if (currency === 'EUR') return 1;
  if (currency === 'GBP') return 2;
  if (currency === 'USD') return 3;

  return 4;
}

function compareSmsticketPrimaryEvents(
  left,
  right
) {
  const currencyDifference =
    smsticketCurrencyRank(left) -
    smsticketCurrencyRank(right);

  if (currencyDifference !== 0) {
    return currencyDifference;
  }

  const bookingDifference =
    smsticketBookingEndMs(right) -
    smsticketBookingEndMs(left);

  if (bookingDifference !== 0) {
    return bookingDifference;
  }

  const leftId = Number(
    left?.sourceId ||
    String(left?.id || '').replace(/\D+/g, '')
  );

  const rightId = Number(
    right?.sourceId ||
    String(right?.id || '').replace(/\D+/g, '')
  );

  if (
    Number.isFinite(leftId) &&
    Number.isFinite(rightId)
  ) {
    return rightId - leftId;
  }

  return String(left?.id || '').localeCompare(
    String(right?.id || '')
  );
}

export function mergeExactSmsticketOccurrences(
  events = []
) {
  if (!Array.isArray(events) || events.length < 2) {
    return Array.isArray(events)
      ? [...events]
      : [];
  }

  const groups = new Map();
  const orderedGroups = [];

  for (const event of events) {
    const key =
      smsticketExactOccurrenceKey(event);

    if (!key) {
      orderedGroups.push({
        key: '',
        events: [event],
      });

      continue;
    }

    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        events: [],
      };

      groups.set(key, group);
      orderedGroups.push(group);
    }

    group.events.push(event);
  }

  return orderedGroups.map((group) => {
    if (group.events.length === 1) {
      return group.events[0];
    }

    const sortedEvents = [
      ...group.events,
    ].sort(compareSmsticketPrimaryEvents);

    const primary = sortedEvents[0];
    const ticketOptions = [];
    const seenUrls = new Set();

    for (const event of sortedEvents) {
      const option =
        smsticketTicketOption(event);

      if (!option || seenUrls.has(option.url)) {
        continue;
      }

      seenUrls.add(option.url);
      ticketOptions.push(option);
    }

    if (ticketOptions.length < 2) {
      return primary;
    }

    return {
      ...primary,
      ticketOptions,
    };
  });
}

export function withSmsticketImagePresentation(
  event = {}
) {
  const existingPresentation =
    event?.imagePresentation;

  if (
    existingPresentation &&
    typeof existingPresentation === 'object'
  ) {
    return event;
  }

  const image =
    String(
      event?.image ||
      ''
    ).trim();

  if (!image) {
    return event;
  }

  return {
    ...event,

    imagePresentation: {
      fit: 'auto',
      x: 50,
      y: 50,
      surface: 'adaptive-matte',
      source: 'rules',
      version: 2
    }
  };
}

function sortEvents(events, sort = 'nearest') {
  return [...events].sort((a, b) => {
    const da = getDateMs(a?.datetime || a?.date);
    const db = getDateMs(b?.datetime || b?.date);

    if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
    if (!Number.isFinite(da)) return 1;
    if (!Number.isFinite(db)) return -1;

    return sort === 'latest' ? db - da : da - db;
  });
}

function pageSlice(events, filters = {}) {
  const pageRaw = Number(filters.page ?? 0);
  const sizeRaw = Number(filters.size ?? 50);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 0;
  const size = Number.isFinite(sizeRaw) && sizeRaw > 0
    ? Math.min(Math.max(Math.floor(sizeRaw), 1), 100)
    : 50;

  const start = page * size;
  return events.slice(start, start + size);
}

export async function fetchEvents({ filters = {} } = {}) {
  if (filters.includeSmsticket === false) return [];
  if (shouldSkipForCountry(filters)) return [];

  const events = await loadSmsticketData(filters);

  // AJSEE_SMSTICKET_SINGLE_PASS_FILTER_v1
  // Keep the adapter result equivalent, but avoid several full-array passes
  // over the large static feed. City is checked first because explicit city
  // searches usually reduce the candidate set the most.
  const city = filters.city || '';
  const category = filters.category ?? filters.segment ?? 'all';
  const audience = filters.audience ?? '';
  const keyword = filters.keyword || '';
  const dateFrom = filters.dateFrom ?? filters.from ?? '';
  const dateTo = filters.dateTo ?? filters.to ?? '';

  const selectedCityTokens = city ? cityAliasTokens(city) : [];
  const eventCityTokenCache = new Map();

  const candidates = [];

  for (const ev of events) {
    if (!isSmsticketEventAvailable(ev)) continue;

    if (
      selectedCityTokens.length &&
      !matchesCityWithPreparedTokens(
        ev,
        selectedCityTokens,
        eventCityTokenCache
      )
    ) {
      continue;
    }

    const normalizedEvent =
      withSmsticketImagePresentation(
        withSmsticketTaxonomy(
          ev
        )
      );

    if (
      !matchesDiscoveryFilters(
        normalizedEvent,
        {
          category,
          audience
        }
      )
    ) {
      continue;
    }

    if (
      keyword &&
      !matchesKeyword(
        normalizedEvent,
        keyword
      )
    ) {
      continue;
    }

    if (
      (dateFrom || dateTo) &&
      !inDateRange(
        normalizedEvent,
        dateFrom,
        dateTo
      )
    ) {
      continue;
    }

    if (
      !matchesNearMe(
        normalizedEvent,
        filters
      )
    ) {
      continue;
    }

    candidates.push(
      normalizedEvent
    );
  }

  const deduplicated =
    mergeExactSmsticketOccurrences(candidates);

  const filtered = sortEvents(
    deduplicated,
    filters.sort || 'nearest'
  );

  return pageSlice(filtered, filters);
}

export default fetchEvents;
