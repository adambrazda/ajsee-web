// /src/api/eventsApi.js
// ---------------------------------------------------------
// Aggregate events from adapters, apply consistent client-side filters
// + multilingual city alias matching (Praha/Prague/Prag/Praga…)
// + collapse districts (Praha 1..10 / Prague 5 -> Prague)
// + optional Near Me filtering for local/demo sources
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';
import { canonForInputCity } from '../city/canonical.js';

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

// ------- Multilingual city aliases (for client-side matching only) -------
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

// Map kanonických labelů na stabilní ID (EN)
const LABEL_TO_ID = {
  // CZ
  'Praha': 'prague',
  'Brno': 'brno',
  'Ostrava': 'ostrava',
  'Plzeň': 'plzen',
  'Olomouc': 'olomouc',
  // SK
  'Bratislava': 'bratislava',
  'Košice': 'kosice',
  'Žilina': 'zilina',
  // PL
  'Warszawa': 'warsaw',
  'Kraków': 'krakow',
  'Wrocław': 'wroclaw',
  'Gdańsk': 'gdansk',
  'Poznań': 'poznan',
  'Łódź': 'lodz',
  'Katowice': 'katowice',
  // HU
  'Budapest': 'budapest',
  'Debrecen': 'debrecen',
  // DE
  'Berlin': 'berlin',
  'München': 'munich',
  'Dresden': 'dresden',
  'Leipzig': 'leipzig',
  'Nürnberg': 'nuremberg',
  // AT
  'Wien': 'vienna',
  'Salzburg': 'salzburg',
  'Linz': 'linz',
  'Graz': 'graz',
};

// alias -> cityId (EN) (pro klientské porovnávání)
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

/** Srazí „Praha 1..10“ / „Prague 5“ na základní klíč */
function collapseDistricts(n = '') {
  let s = n;
  s = s.replace(/^praha\s+([ivxlcdm]+|\d+)\b.*$/, 'praha');
  s = s.replace(/^prague\s+\d+\b.*$/, 'prague');
  return s;
}

/** Vrátí stabilní cityId (EN), např. "prague", "vienna", ... */
function cityId(raw = '') {
  if (!raw) return '';
  let n = normalizeText(raw);
  n = collapseDistricts(n);
  // známý alias -> id
  if (aliasToId.has(n)) return aliasToId.get(n);
  // fallback: použij „holé“ n (už bez diakritiky) – pokryje exotické varianty
  return n;
}

/** Vytáhne kandidáty názvu města z eventu */
function eventCityCandidates(ev) {
  const c = ev?.location?.city || ev?.city || '';
  return [c].filter(Boolean);
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
    nearMeRadiusKm = 50,
  } = filters;

  // 🔧 KLÍČOVÁ OPRAVA:
  // Do upstreamu posíláme *anglické endonymum* (Prague/Vienna/…),
  // protože Ticketmaster má s EN tvary nejlepší „hit rate“ napříč jazyky.
  // (main.js už canonForInputCity používá – zde to jen pojistíme)
  const upstreamFilters = {
    ...filters,
    city: city ? canonForInputCity(city) : ''
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

  // ---- Client-side filters (defensive; backend už filtruje Ticketmaster) ----

  // Category
  if (category && category !== 'all') {
    all = all.filter(ev => normalizeStr(ev.category) === normalizeStr(category));
  }

  // City (alias-aware, district-safe)
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

  // Near Me (client-side pass pro demo zdroje)
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
