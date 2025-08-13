// /src/api/eventsApi.js
// ---------------------------------------------------------
// Aggregate events from adapters, apply consistent client-side filters
// + multilingual city alias matching (Praha/Prague/Prag/Praga…)
// + optional Near Me filtering for local/demo sources
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';

// Consider anything that's not localhost/127.* as production (adjust if needed)
const isProduction =
  typeof window !== 'undefined' &&
  !/^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname) &&
  window.location.hostname.includes('ajsee');

// ------- Utils -------
function inRangeISO(dateStr, fromISO, toISO) {
  if (!dateStr) return false;
  const d = new Date(dateStr).toISOString();
  if (fromISO && d < new Date(fromISO).toISOString()) return false;
  if (toISO && d > new Date(toISO).toISOString()) return false;
  return true;
}

function normalizeText(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ');
}

function normalizeStr(s) {
  return normalizeText(s);
}

function containsAny(hay, terms) {
  if (!hay) return false;
  const h = normalizeText(hay);
  for (const t of terms) {
    if (!t) continue;
    const tn = normalizeText(t);
    if (tn && h.includes(tn)) return true;
  }
  return false;
}

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null || lon1 == null ||
    lat2 == null || lon2 == null
  ) return Infinity;

  const toRad = (x) => (Number(x) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ------- Multilingual city aliases (shared logic with FE/Function) -------
/**
 * Minimal CEE alias set so that "Prague"/"Prag"/"Praga" === "Praha" etc.
 * Keys are canonical labels, values include the canonical label itself.
 */
const CITY_ALIASES = {
  // CZ
  'Praha': ['Praha', 'Prague', 'Prag', 'Praga', 'Praag', 'Prága'],
  'Brno': ['Brno', 'Brünn'],
  'Ostrava': ['Ostrava'],
  'Plzeň': ['Plzeň', 'Plzen', 'Pilsen'],
  'Olomouc': ['Olomouc', 'Olmütz'],
  // SK
  'Bratislava': ['Bratislava', 'Pressburg', 'Pozsony'],
  'Košice': ['Košice', 'Kosice', 'Kassa'],
  'Žilina': ['Žilina', 'Zilina'],
  // PL
  'Warszawa': ['Warszawa', 'Warsaw', 'Warschau'],
  'Kraków': ['Kraków', 'Krakow', 'Cracow', 'Krakau'],
  'Wrocław': ['Wrocław', 'Wroclaw', 'Breslau'],
  'Gdańsk': ['Gdańsk', 'Gdansk', 'Danzig'],
  'Poznań': ['Poznań', 'Poznan'],
  'Łódź': ['Łódź', 'Lodz'],
  'Katowice': ['Katowice'],
  // HU
  'Budapest': ['Budapest', 'Budapešť', 'Budapeszt', 'Budapesta'],
  'Debrecen': ['Debrecen'],
  // DE
  'Berlin': ['Berlin', 'Berlín'],
  'München': ['München', 'Munich', 'Muenchen', 'Mnichov'],
  'Dresden': ['Dresden', 'Drážďany'],
  'Leipzig': ['Leipzig'],
  'Nürnberg': ['Nürnberg', 'Nuremberg', 'Norimberk'],
  // AT
  'Wien': ['Wien', 'Vienna', 'Vídeň', 'Viedeň', 'Wiedeń'],
  'Salzburg': ['Salzburg', 'Solnohrad'],
  'Linz': ['Linz'],
  'Graz': ['Graz', 'Štýrský Hradec'],
};

const aliasIndex = (() => {
  const m = new Map();
  for (const [canonical, list] of Object.entries(CITY_ALIASES)) {
    for (const alias of list) {
      m.set(normalizeText(alias), canonical);
    }
  }
  // also map canonical -> canonical
  for (const canonical of Object.keys(CITY_ALIASES)) {
    m.set(normalizeText(canonical), canonical);
  }
  return m;
})();

function resolveCityCanonical(input) {
  const norm = normalizeText(input);
  if (!norm) return null;
  // exact alias hit
  if (aliasIndex.has(norm)) {
    const canonical = aliasIndex.get(norm);
    const synonyms = CITY_ALIASES[canonical] || [canonical];
    return { canonical, synonyms };
  }
  // substring hit: pick first canonical that contains the token
  for (const [kNorm, canonical] of aliasIndex.entries()) {
    if (kNorm.includes(norm)) {
      const synonyms = CITY_ALIASES[canonical] || [canonical];
      return { canonical, synonyms };
    }
  }
  return null;
}

function eventCityCandidates(ev) {
  const c = ev?.location?.city || ev?.city || '';
  const extras = [];
  // sometimes providers stuff state/country into city-like fields
  if (ev?.location?.state) extras.push(ev.location.state);
  if (ev?.location?.country) extras.push(ev.location.country);
  return [c, ...extras].filter(Boolean);
}

/**
 * Fetches and merges events from partners, then applies client-side filters
 * (useful especially for demo/secondary sources).
 */
export async function getAllEvents({ locale = 'cs', filters = {} } = {}) {
  let all = [];

  // ----- Preprocess filters (city canonicalization) -----
  const {
    category = 'all',
    city = '',
    keyword = '',
    dateFrom = '',
    dateTo = '',
    sort = 'nearest',
    nearMeLat = null,
    nearMeLon = null,
    nearMeRadiusKm = 50,
    countryCode = ''
  } = filters;

  const cityInfo = city ? resolveCityCanonical(city) : null;
  const canonicalCity = cityInfo?.canonical || city || '';

  // Build filters for upstream adapters (e.g., Ticketmaster)
  const upstreamFilters = {
    ...filters,
    city: canonicalCity, // use canonical for provider query
  };

  // --- Ticketmaster (always) ---
  const tm = await fetchTicketmasterEvents({ locale, filters: upstreamFilters });
  all = all.concat(tm);

  // --- Demo source (dev only) ---
  if (!isProduction) {
    const { fetchEvents: fetchDemoEvents } = await import('../adapters/demo.js');
    const demo = await fetchDemoEvents({ locale, filters: upstreamFilters });
    all = all.concat(demo);
  }

  // ---- Client-side filters (defensive; backend already filters for TM) ----

  // Category
  if (category && category !== 'all') {
    all = all.filter(ev => normalizeStr(ev.category) === normalizeStr(category));
  }

  // City (multilingual alias match OR substring match)
  if (city) {
    const normInput = normalizeText(city);
    const synonyms = cityInfo?.synonyms || [city];
    all = all.filter(ev => {
      const candidates = eventCityCandidates(ev);
      if (!candidates.length) return false;

      // direct substring on raw city field
      if (containsAny(candidates.join(' | '), [city])) return true;

      // alias equality or substring match
      for (const cand of candidates) {
        const cn = normalizeText(cand);
        if (cn === normalizeText(canonicalCity)) return true;
        if (synonyms.some(a => cn === normalizeText(a) || cn.includes(normalizeText(a)))) return true;
        // also cover input token as substring (typed "Pra" etc.)
        if (cn.includes(normInput)) return true;
      }
      return false;
    });
  }

  // Near Me (client-side pass for demo sources; TM already handles via backend)
  if (nearMeLat != null && nearMeLon != null && Number.isFinite(nearMeRadiusKm)) {
    all = all.filter(ev => {
      const lat = ev?.location?.lat ?? ev?.location?.latitude ?? ev?.lat;
      const lon = ev?.location?.lon ?? ev?.location?.longitude ?? ev?.lon;
      const d = haversineKm(nearMeLat, nearMeLon, lat, lon);
      return d <= (nearMeRadiusKm || 50);
    });
  }

  // Keyword (title/description contains)
  if (keyword) {
    const q = normalizeStr(keyword);
    all = all.filter(ev => {
      const title =
        ev?.title?.[locale] ??
        ev?.title?.cs ??
        ev?.title ??
        '';
      const desc =
        ev?.description?.[locale] ??
        ev?.description?.cs ??
        ev?.description ??
        '';
      return normalizeStr(title).includes(q) || normalizeStr(desc).includes(q);
    });
  }

  // Date range
  const fromISO = dateFrom ? new Date(dateFrom).toISOString() : '';
  const toISO = dateTo ? new Date(dateTo).toISOString() : '';
  if (fromISO || toISO) {
    all = all.filter(ev => inRangeISO(ev.datetime || ev.date, fromISO, toISO));
  }

  // Sort by date
  all.sort((a, b) => {
    const da = new Date(a.datetime || a.date);
    const db = new Date(b.datetime || b.date);
    return sort === 'latest' ? db - da : da - db; // default nearest
  });

  return all;
}
