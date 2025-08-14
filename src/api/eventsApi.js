// /src/api/eventsApi.js
// ---------------------------------------------------------
// Aggregate events from adapters, apply consistent client-side filters
// + city canonicalization via shared/city/canonical.js
// + collapse districts (Praha 1..10 / Prague 5 -> Prague)
// + optional Near Me filtering for local/demo sources
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';
import {
  canonForInputCity,         // "Praha"/"Prag"/"Praga"/"Praha 7" -> "Prague" (TM-friendly)
  guessCountryCodeFromCity,  // z libovolného vstupu města -> "CZ"/"AT"/...
  baseCityKey                // "Praha 7" / "Prague 5" / "Wien-Landstraße" -> "prague" / "vienna"
} from '../city/canonical.js';

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

/** Vytáhne kandidáty názvu města z eventu */
function eventCityCandidates(ev) {
  const c = ev?.location?.city || ev?.city || '';
  return [c].filter(Boolean);
}

/** Stabilní city-id pro porovnávání na FE (např. "prague", "vienna"…) */
function cityId(raw = '') {
  if (!raw) return '';
  // baseCityKey už složí „Praha 7“, „Bratislava - Staré Mesto“… na jeden klíč
  const key = baseCityKey(raw);
  return key || normalizeText(raw);
}

/**
 * Fetches and merges events from partners, then applies client-side filters.
 */
export async function getAllEvents({ locale = 'cs', filters = {} } = {}) {
  let all = [];

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
  } = filters;

  // ---- H2: PŘÍMÁ OPRAVA COUNTRYCODE PODLE MĚSTA ----
  // Pokud uživatel zadal město, přemapujeme:
  //  - city -> TM-friendly (Prague/Vienna/Bratislava…)
  //  - countryCode -> podle města (CZ/AT/SK/PL/HU…)
  const upstreamFilters = { ...filters };
  if (city && String(city).trim().length > 0) {
    const tmCity = canonForInputCity(city);            // např. "Prague"
    const ccFromCity = guessCountryCodeFromCity(city); // např. "CZ"
    if (tmCity) upstreamFilters.city = tmCity;
    if (ccFromCity) upstreamFilters.countryCode = ccFromCity;
  }

  // --- Ticketmaster (always) ---
  const tm = await fetchTicketmasterEvents({ locale, filters: upstreamFilters });
  all = all.concat(tm);

  // --- Demo source (dev only) ---
  if (!isProduction) {
    const { fetchEvents: fetchDemoEvents } = await import('../adapters/demo.js');
    const demo = await fetchDemoEvents({ locale, filters: upstreamFilters });
    all = all.concat(demo);
  }

  // ---- Client-side filters (defensive) ----

  // Category
  if (category && category !== 'all') {
    all = all.filter(ev => normalizeStr(ev.category) === normalizeStr(category));
  }

  // City (alias-aware, district-safe; děláme i na FE, protože některé zdroje
  // nemusí být 100% konzistentní v lokalizaci názvů měst)
  if (city) {
    const qId = cityId(city); // např. "prague"
    all = all.filter(ev => {
      const candidates = eventCityCandidates(ev);
      if (!candidates.length) return false;
      return candidates.some(label => {
        const evId = cityId(label);
        if (!evId) return false;
        return evId === qId || evId.includes(qId) || qId.includes(evId);
      });
    });
  }

  // Near Me (client-side pass pro demo/sekundární zdroje; TM řeší na backendu)
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
        ev?.title?.[locale] ?? ev?.title?.cs ?? ev?.title ?? '';
      const desc =
        ev?.description?.[locale] ?? ev?.description?.cs ?? ev?.description ?? '';
      return normalizeStr(title).includes(q) || normalizeStr(desc).includes(q);
    });
  }

  // Date range
  const fromISO = dateFrom ? new Date(dateFrom).toISOString() : '';
  const toISO   = dateTo   ? new Date(dateTo).toISOString()   : '';
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
