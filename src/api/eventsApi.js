// /src/api/eventsApi.js
// ---------------------------------------------------------
// Agreguje události z adapterů a aplikuje jednotné FE filtry.
// - aliasy měst (vícejazyčně – Evropa + velká světová města)
// - sloučení městských částí (Praha 1..10 / Prague 5 -> Prague / Paris 11e -> Paris)
// - volitelný Near Me filtr (funguje pro zdroje s lat/lon)
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';
import { canonForInputCity } from '../city/canonical.js';

// DEV detekce (localhost/Vite)
const isDev =
  (typeof window !== 'undefined' &&
    /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) ||
  (typeof import.meta !== 'undefined' && import.meta?.env?.DEV);

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
    .replace(/[\u0300-\u036f]/g, '') // diakritika
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ');
}
const normalizeStr = normalizeText;

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const toRad = (x) => (Number(x) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ------- Multilingual city aliases (client-side equality only) -------
// NOTE: Cílem je trefit uživatelské dotazy typu "Londýn/Paris/ Нью-Йорк" na EN štítky, které posílá adapter.
const CITY_ALIASES = {
  // CZ / SK / PL (already supported core)
  Praha: ['Praha','Prague','Prag','Praga','Praag','Prága'],
  Brno: ['Brno','Brünn'],
  Ostrava: ['Ostrava'],
  Plzeň: ['Plzeň','Plzen','Pilsen'],
  Olomouc: ['Olomouc','Olmütz'],
  Bratislava: ['Bratislava','Pressburg','Pozsony'],
  Košice: ['Košice','Kosice','Kassa'],
  Žilina: ['Žilina','Zilina'],
  Warszawa: ['Warszawa','Warsaw','Warschau','Varšava','Varsava'],
  Kraków: ['Kraków','Krakow','Cracow','Krakau','Krakov'],
  Wrocław: ['Wrocław','Wroclaw','Breslau'],
  Gdańsk: ['Gdańsk','Gdansk','Danzig'],
  Poznań: ['Poznań','Poznan'],
  Łódź: ['Łódź','Lodz'],
  Katowice: ['Katowice'],
  Budapest: ['Budapest','Budapešť','Budapeszt','Budapesta'],

  // DE / AT / CH
  Berlin: ['Berlin','Berlín'],
  Hamburg: ['Hamburg','Hamburk'],
  München: ['München','Munich','Muenchen','Mnichov'],
  Köln: ['Köln','Cologne','Kolín nad Rýnem','Koln'],
  Frankfurt: ['Frankfurt','Frankfurt am Main'],
  Stuttgart: ['Stuttgart'],
  Düsseldorf: ['Düsseldorf','Dusseldorf'],
  Dresden: ['Dresden','Drážďany'],
  Leipzig: ['Leipzig'],
  Nürnberg: ['Nürnberg','Nuremberg','Norimberk'],
  Bremen: ['Bremen','Brémy'],
  Hannover: ['Hannover','Hanover'],
  Wien: ['Wien','Vienna','Vídeň','Viedeň','Wiedeń'],
  Salzburg: ['Salzburg','Solnohrad'],
  Linz: ['Linz'],
  Graz: ['Graz','Štýrský Hradec'],
  Zürich: ['Zürich','Zurich','Curych'],
  Genf: ['Genf','Geneva','Ženeva'],
  Basel: ['Basel','Basilej'],
  Bern: ['Bern','Berno'],

  // Benelux
  Amsterdam: ['Amsterdam','Amsterodam'],
  Rotterdam: ['Rotterdam'],
  'The Hague': ['The Hague','Den Haag','Haag'],
  Utrecht: ['Utrecht'],
  Brussels: ['Brussels','Bruxelles','Brusel'],
  Antwerp: ['Antwerp','Antwerpen','Antverpy'],
  Ghent: ['Ghent','Gent'],
  Bruges: ['Bruges','Brugge'],

  // France
  Paris: ['Paris','Paříž','Paríž','Pariz','París','Parigi','Paryż'],
  Lyon: ['Lyon'],
  Marseille: ['Marseille','Marseilles','Marsej'],
  Toulouse: ['Toulouse'],
  Bordeaux: ['Bordeaux'],
  Lille: ['Lille'],
  Nice: ['Nice'],
  Nantes: ['Nantes'],
  Strasbourg: ['Strasbourg','Štrasburk'],
  Montpellier: ['Montpellier'],

  // Iberia
  Madrid: ['Madrid','Madryt'],
  Barcelona: ['Barcelona','Barcelóna'],
  Valencia: ['Valencia','Valencie'],
  Seville: ['Seville','Sevilla'],
  Bilbao: ['Bilbao'],
  Malaga: ['Malaga','Málaga'],
  Zaragoza: ['Zaragoza','Zaragoza'],
  Lisbon: ['Lisbon','Lisabon','Lisboa'],
  Porto: ['Porto','Oporto'],

  // Italy
  Rome: ['Rome','Roma','Řím','Rim'],
  Milan: ['Milan','Milano','Milán'],
  Naples: ['Naples','Napoli','Neapol'],
  Turin: ['Turin','Torino','Turín'],
  Florence: ['Florence','Firenze','Florencie'],
  Venice: ['Venice','Venezia','Benátky','Benatky'],
  Bologna: ['Bologna'],
  Genoa: ['Genoa','Genova','Janov'],

  // Nordics & Baltics
  Stockholm: ['Stockholm','Štokholm'],
  Gothenburg: ['Gothenburg','Göteborg','Goteborg'],
  Malmö: ['Malmö','Malmo'],
  Copenhagen: ['Copenhagen','København','Kobenhavn','Kodaň'],
  Oslo: ['Oslo'],
  Bergen: ['Bergen'],
  Helsinki: ['Helsinki','Helsinky'],
  Tampere: ['Tampere'],
  Reykjavik: ['Reykjavik','Reykjavík','Rejkjavik'],
  Tallinn: ['Tallinn','Talin'],
  Riga: ['Riga','Ryga'],
  Vilnius: ['Vilnius','Vilno','Wilno'],
  Kaunas: ['Kaunas','Kovno'],

  // Balkans & SE Europe
  Ljubljana: ['Ljubljana','Lublaň'],
  Zagreb: ['Zagreb','Záhřeb','Zahreb'],
  Split: ['Split'],
  Rijeka: ['Rijeka'],
  Belgrade: ['Belgrade','Beograd','Bělehrad'],
  'Novi Sad': ['Novi Sad'],
  Sarajevo: ['Sarajevo'],
  Skopje: ['Skopje'],
  Sofia: ['Sofia'],
  Bucharest: ['Bucharest','Bukurešť','București'],
  'Cluj-Napoca': ['Cluj-Napoca','Cluj'],
  Timișoara: ['Timișoara','Timisoara'],
  Athens: ['Athens','Athény','Athína'],
  Thessaloniki: ['Thessaloniki','Soluň','Saloniki'],
  Istanbul: ['Istanbul'],
  Ankara: ['Ankara'],
  Izmir: ['Izmir','Smyrna'],

  // Ukraine / Belarus
  Kyiv: ['Kyiv','Kyjev','Kiev'],
  Lviv: ['Lviv','Lvov'],
  Odesa: ['Odesa','Odessa'],
  Kharkiv: ['Kharkiv','Charkov'],
  Minsk: ['Minsk'],

  // UK & Ireland
  London: ['London','Londýn','Londyn','Londres','Londra','Londen'],
  Manchester: ['Manchester'],
  Birmingham: ['Birmingham'],
  Liverpool: ['Liverpool'],
  Leeds: ['Leeds'],
  'Newcastle upon Tyne': ['Newcastle','Newcastle upon Tyne'],
  Glasgow: ['Glasgow'],
  Edinburgh: ['Edinburgh','Edinburk'],
  Bristol: ['Bristol'],
  Cardiff: ['Cardiff'],
  Belfast: ['Belfast'],
  Dublin: ['Dublin'],

  // Middle East
  'Tel Aviv': ['Tel Aviv','Tel-Aviv','TelAviv'],
  Jerusalem: ['Jerusalem','Jeruzalém'],
  Dubai: ['Dubai','Dubaj'],
  'Abu Dhabi': ['Abu Dhabi','Abú Zabí'],
  Doha: ['Doha'],
  Riyadh: ['Riyadh','Rijád'],

  // North America (selection)
  'New York': ['New York','NYC','NewYork','Nový York','Nowy Jork'],
  'Los Angeles': ['Los Angeles','LA'],
  'San Francisco': ['San Francisco','SF'],
  Chicago: ['Chicago','Čikágo'],
  Boston: ['Boston'],
  Miami: ['Miami'],
  Washington: ['Washington','Washington DC','DC'],
  Seattle: ['Seattle'],
  'San Diego': ['San Diego'],
  'Las Vegas': ['Las Vegas','Vegas'],
  Dallas: ['Dallas'],
  Houston: ['Houston'],
  Austin: ['Austin'],
  Atlanta: ['Atlanta'],
  Philadelphia: ['Philadelphia','Philly'],
  Phoenix: ['Phoenix'],
  Denver: ['Denver'],
  Detroit: ['Detroit'],
  Minneapolis: ['Minneapolis'],

  // Canada
  Toronto: ['Toronto'],
  Vancouver: ['Vancouver'],
  Montreal: ['Montreal','Montréal','Montreál'],

  // South America (selection)
  'Mexico City': ['Mexico City','Ciudad de México','Mexiko City'],
  'São Paulo': ['São Paulo','Sao Paulo'],
  'Rio de Janeiro': ['Rio de Janeiro','Rio'],
  'Buenos Aires': ['Buenos Aires'],
  Santiago: ['Santiago','Santiago de Chile'],

  // Asia (selection)
  Tokyo: ['Tokyo','Tokio'],
  Osaka: ['Osaka'],
  Kyoto: ['Kyoto','Kjóto','Kjoto'],
  Yokohama: ['Yokohama'],
  Nagoya: ['Nagoya'],
  Seoul: ['Seoul','Soul'],
  Busan: ['Busan','Pusan'],
  Beijing: ['Beijing','Peking'],
  Shanghai: ['Shanghai','Šanghaj'],
  Shenzhen: ['Shenzhen','Šen-čen','Šenčen','Šen-čen'],
  Guangzhou: ['Guangzhou','Kanton'],
  'Hong Kong': ['Hong Kong','Hongkong'],
  Taipei: ['Taipei','Tchaj-pej'],
  Singapore: ['Singapore','Singapur'],
  Bangkok: ['Bangkok'],
  'Kuala Lumpur': ['Kuala Lumpur'],
  Jakarta: ['Jakarta','Džakarta'],
  Manila: ['Manila'],
  Mumbai: ['Mumbai','Bombaj'],
  Delhi: ['Delhi','Dillí','New Delhi','Nové Dillí'],
  Bengaluru: ['Bengaluru','Bangalore'],
  Colombo: ['Colombo'],

  // Oceania
  Sydney: ['Sydney','Sydnej'],
  Melbourne: ['Melbourne','Melbourn'],
  Brisbane: ['Brisbane'],
  Perth: ['Perth'],
  Adelaide: ['Adelaide','Adelaida'],
  Canberra: ['Canberra'],
  Auckland: ['Auckland','Okland'],
  Wellington: ['Wellington'],
};

// Kanonický label -> stabilní EN id (bez mezer, ASCII)
const LABEL_TO_ID = {};
for (const canonical of Object.keys(CITY_ALIASES)) {
  LABEL_TO_ID[canonical] = canonical
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

// alias -> cityId (EN)
const aliasToId = (() => {
  const m = new Map();
  for (const [canonical, list] of Object.entries(CITY_ALIASES)) {
    const id = LABEL_TO_ID[canonical];
    if (!id) continue;
    for (const alias of list) m.set(normalizeText(alias), id);
    m.set(normalizeText(canonical), id);
  }
  return m;
})();

function collapseDistricts(n = '') {
  let s = n;
  s = s.replace(/^praha\s+([ivxlcdm]+|\d+)\b.*$/, 'praha');
  s = s.replace(/^prague\s+\d+\b.*$/, 'prague');
  s = s.replace(/^paris\s+\d+\b.*$/, 'paris');
  return s;
}

function cityId(raw = '') {
  if (!raw) return '';
  let n = normalizeText(raw);
  n = collapseDistricts(n);
  if (aliasToId.has(n)) return aliasToId.get(n);
  // Fallback: normalize by stripping spaces (for "new york" -> "newyork")
  return n.replace(/\s+/g, '');
}

function eventCityCandidates(ev) {
  const c = ev?.location?.city || ev?.city || '';
  return [c].filter(Boolean);
}

function detectLang() {
  const qs = new URLSearchParams(location.search);
  return (qs.get('lang') || document.documentElement.lang || 'cs').toLowerCase();
}
function mapLangToLocale(lang) {
  const m = { cs: 'cs', sk: 'sk', en: 'en', de: 'de', pl: 'pl', hu: 'hu' };
  return m[lang] || 'en';
}

/**
 * Hlavní vstup pro FE:
 *   fetchEvents({ locale, filters })
 * - přijímá filtry (city, keyword, category, dateFrom/To, sort, latlong, radius, unit, size…)
 * - vrací sjednocené objekty událostí (co vrací adapter)
 */
export async function fetchEvents({ locale, filters = {} } = {}) {
  const lng = (locale || detectLang()).toLowerCase();
  const loc = mapLangToLocale(lng);

  let all = [];

  // --- City hotfix: když kanonizátor vrátí prázdno, ponecháme původní vstup ---
  let upstreamCity = (filters.city || '').trim();
  if (upstreamCity) {
    try {
      const canon = canonForInputCity(upstreamCity);
      upstreamCity = canon || upstreamCity; // fallback na původní text
    } catch {
      // kdyby kanonizátor spadl, pošleme původní vstup
    }
  }

  const upstreamFilters = {
    ...filters,
    city: upstreamCity, // ← nikdy nezmizí, pokud něco uživatel zadal
  };

  if (upstreamFilters.city) {
    // Nepřivazuj k countryCode (jinak je hledání globální a funguje pro exonyma)
    delete upstreamFilters.countryCode;
  }

  console.debug('[eventsApi] upstreamFilters:', upstreamFilters);

  // --- Ticketmaster (vždy) ---
  try {
    const tm = await fetchTicketmasterEvents({ locale: loc, filters: upstreamFilters });
    if (Array.isArray(tm)) all = all.concat(tm);
  } catch (e) {
    console.warn('[eventsApi] Ticketmaster fetch failed:', e);
  }

  // --- Demo zdroj v DEV (best-effort import) ---
  if (isDev) {
    try {
      const mod = await import('../adapters/demo.js');
      const fn =
        (typeof mod.fetchEvents === 'function' && mod.fetchEvents) ||
        (typeof mod.default === 'function' && mod.default) ||
        (typeof mod.default?.fetchEvents === 'function' && mod.default.fetchEvents);
      const demoFn = typeof fn === 'function' ? fn : async () => [];
      const demo = await demoFn({ locale: loc, filters: upstreamFilters });
      if (Array.isArray(demo)) all = all.concat(demo);
    } catch (e) {
      console.warn('[eventsApi] Demo adapter missing or invalid, continuing without demo data.', e);
    }
  }

  // ---- Client-side filtry (obrana, hlavní filtr probíhá v adapteru/API) ----
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

  console.debug('[eventsApi] total before city filter:', all.length, 'city filter =', city || '(none)');

  if (category && category !== 'all') {
    all = all.filter((ev) => normalizeStr(ev.category) === normalizeStr(category));
  }

  if (city) {
    const qId = cityId(city);
    all = all.filter((ev) => {
      const candidates = eventCityCandidates(ev);
      if (!candidates.length) return false;
      return candidates.some((label) => {
        const evId = cityId(label);
        if (!evId) return false;
        // exact or substring (handles "new york" vs "newyork", etc.)
        return evId === qId || evId.includes(qId) || qId.includes(evId);
      });
    });
  }

  // Near Me (fallback – pokud událost nemá lat/lon, filtr ji vyřadí)
  if (nearMeLat != null && nearMeLon != null && Number.isFinite(nearMeRadiusKm)) {
    all = all.filter((ev) => {
      const lat = ev?.location?.lat ?? ev?.location?.latitude ?? ev?.lat;
      const lon = ev?.location?.lon ?? ev?.location?.longitude ?? ev?.lon;
      const d = haversineKm(nearMeLat, nearMeLon, lat, lon);
      return d <= (nearMeRadiusKm || 50);
    });
  }

  if (keyword) {
    const q = normalizeStr(keyword);
    all = all.filter((ev) => {
      const title = ev?.title?.[loc] ?? ev?.title?.cs ?? ev?.title ?? '';
      const desc  = ev?.description?.[loc] ?? ev?.description?.cs ?? ev?.description ?? '';
      return normalizeStr(title).includes(q) || normalizeStr(desc).includes(q);
    });
  }

  const fromISO = dateFrom ? new Date(dateFrom).toISOString() : '';
  const toISO   = dateTo   ? new Date(dateTo).toISOString()   : '';
  if (fromISO || toISO) {
    all = all.filter((ev) => inRangeISO(ev.datetime || ev.date, fromISO, toISO));
  }

  // Třídění podle data
  all.sort((a, b) => {
    const da = new Date(a.datetime || a.date);
    const db = new Date(b.datetime || b.date);
    return sort === 'latest' ? db - da : da - db; // default nearest (ASC)
  });

  console.debug('[eventsApi] total after city filter:', all.length);
  return all;
}

// Backward-compat: starší kód volá getAllEvents
export { fetchEvents as getAllEvents };
