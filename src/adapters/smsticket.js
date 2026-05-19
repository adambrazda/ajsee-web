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

const DATA_URL = '/data/smsticket-events.json';

let cache = null;
let cachePromise = null;

async function loadSmsticketData() {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    try {
      const response = await fetch(DATA_URL, { cache: 'default' });

      if (!response.ok) {
        cache = [];
        return cache;
      }

      const payload = await response.json();
      const events = Array.isArray(payload?.events) ? payload.events : [];

      cache = events;
      return cache;
    } catch (error) {
      console.warn('[smsticket adapter] failed to load data:', error);
      cache = [];
      return cache;
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
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

  for (const group of CITY_ALIAS_GROUPS) {
    const foldedGroup = group.map(fold);

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



function matchesCategory(ev, category = 'all') {
  const wanted = fold(category);
  if (!wanted || wanted === 'all') return true;

  return fold(ev?.category) === wanted;
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

  return haystack.includes(query);
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

  const events = await loadSmsticketData();

  const filtered = sortEvents(
    events
      .filter((ev) => matchesCategory(ev, filters.category ?? filters.segment ?? 'all'))
      .filter((ev) => matchesCity(ev, filters.city || ''))
      .filter((ev) => matchesKeyword(ev, filters.keyword || ''))
      .filter((ev) => inDateRange(ev, filters.dateFrom ?? filters.from ?? '', filters.dateTo ?? filters.to ?? ''))
      .filter((ev) => matchesNearMe(ev, filters)),
    filters.sort || 'nearest'
  );

  return pageSlice(filtered, filters);
}

export default fetchEvents;
