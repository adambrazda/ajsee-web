// /shared/city/canonical.js
// ---------------------------------------------------------
// Jediný "zdroj pravdy" pro práci s názvy měst napříč FE i Netlify funkcemi.
//
// - robustní normalizace (bez diakritiky, lower, trim)
// - baseCityKey(): sloučí "Praha 1/2/7…" → prague, "Bratislava - Staré Mesto" → bratislava
// - canonForInputCity(): aliasy -> kanonické endonym/exonym pro TM (EN varianty) + fuzzy
// - labelForCanon(): preferovaný popisek dle UI jazyka
// - guessCountryCodeFromCity(): odvodí správný countryCode z města
// - findBestCityMatchInfo(): detail fuzzy shody (kanonické EN + skóre)
// - countryCodeFromInput(): rozpozná zadanou zemi / ISO kód, aby se země nemíchaly do city logiky
//
// DŮLEŽITÁ OPRAVA 2026-05-07:
// - Budapest / Budapešť / Budapeszt doplněno do CITY_ALIASES i CITY_TO_CC.
// - Země typu Francie / France / FR / Maďarsko / Hungary / HU se už nebudou
//   fuzzy-mapovat jako města.
// ---------------------------------------------------------

/** Základní normalizace textu: lower + odstranění diakritiky + trim */
export function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .trim();
}

/** Lehce přísnější normalizace pro fuzzy porovnání (čistí i interpunkci, zkratky apod.) */
function normalizeForMatch(s = '') {
  return normalize(s)
    .replace(/[’'`´]/g, '')
    .replace(/[().,;:/\\\-+_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(st|st\.|saint|sankt)\b/g, 'saint')
    .replace(/\b(n\s*y\s*c)\b/g, 'nyc')
    .trim();
}

function compactKey(s = '') {
  return normalizeForMatch(s).replace(/\s+/g, '');
}

function collapseDistricts(s = '') {
  // Praha/Prague 1.. → prague
  s = s.replace(/\b(praha|prague)\s+([ivxlcdm]+|\d+)\b.*$/, '$1');
  // Paris 11e/12 → paris
  s = s.replace(/\bparis\s+\d+\w?\b.*$/, 'paris');
  // London borough/zone → london
  s = s.replace(/\blondon\s+(borough|zone)\b.*$/, 'london');
  // Bratislava - Staré Mesto → bratislava
  s = s.replace(/^bratislava\s*[-–].+$/, 'bratislava');
  // Budapest - district / Budapest 7 → budapest
  s = s.replace(/^budapest\s*[-–].+$/, 'budapest');
  s = s.replace(/^budapest\s+([ivxlcdm]+|\d+)\b.*$/, 'budapest');
  return s;
}

/**
 * Vrátí "základní" klíč města (slučuje městské části a pomlčky/čárky).
 */
export function baseCityKey(input) {
  let n = normalize(input);
  n = collapseDistricts(n);

  // Praha – čísla, římské číslice, textové části
  if (/^praha(?:\s*[-–]?\s*(?:\d+|[ivxlcdm]+|[a-z]+))?$/i.test(n)) return 'prague';

  // Bratislava – libovolná městská část
  if (/^bratislava(?:\s*[-–]?\s*.+)?$/.test(n)) return 'bratislava';

  // Budapešť / Budapest – libovolná městská část
  if (/^budapest(?:\s*[-–]?\s*.+)?$/.test(n)) return 'budapest';
  if (['budapest', 'budapesth', 'budapestt', 'budapestz', 'budapesta'].includes(n)) return 'budapest';

  // Vídeň / Wien / Vienna / Wiedeń / Viedeň / Bécs
  if (['vienna', 'wien', 'viden', 'vieden', 'wieden', 'becs'].includes(n)) return 'vienna';

  // Jednoduchý fallback: text do čárky/pomlčky
  return n.split(/[,-]/)[0].trim();
}

/* ---------------------------------------------------------
   Country aliases – aby se země nikdy nemíchaly do city fuzzy logiky.
--------------------------------------------------------- */
export const SUPPORTED_COUNTRY_CODES = new Set([
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

  for (const alias of aliases || []) {
    const key = normalizeForMatch(alias);
    if (key) COUNTRY_ALIASES[key] = cc;

    const compact = compactKey(alias);
    if (compact) COUNTRY_ALIASES[compact] = cc;
  }
}

addCountryAliases('CZ', ['CZ', 'Czechia', 'Czech Republic', 'Česko', 'Cesko', 'Česká republika', 'Ceska republika', 'Czechy', 'Tschechien']);
addCountryAliases('SK', ['SK', 'Slovakia', 'Slovensko', 'Slovenská republika', 'Slovenska republika']);
addCountryAliases('PL', ['PL', 'Poland', 'Polsko', 'Polska']);
addCountryAliases('HU', ['HU', 'Hungary', 'Maďarsko', 'Madarsko', 'Magyarország', 'Magyarorszag', 'Węgry', 'Wegry', 'Ungarn']);
addCountryAliases('DE', ['DE', 'Germany', 'Německo', 'Nemecko', 'Deutschland', 'Niemcy', 'Germania']);
addCountryAliases('AT', ['AT', 'Austria', 'Rakousko', 'Rakúsko', 'Österreich', 'Osterreich']);
addCountryAliases('CH', ['CH', 'Switzerland', 'Švýcarsko', 'Svycarsko', 'Švajčiarsko', 'Schweiz', 'Suisse', 'Svizzera']);
addCountryAliases('GB', ['GB', 'UK', 'United Kingdom', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Velká Británie', 'Velka Britanie', 'Spojené království', 'Spojene kralovstvi', 'Anglie']);
addCountryAliases('IE', ['IE', 'Ireland', 'Irsko', 'Írsko', 'Éire', 'Eire']);
addCountryAliases('FR', ['FR', 'France', 'Francie', 'Francúzsko', 'Francuzsko', 'Francja', 'Franciaország', 'Franciaorszag', 'Francia', 'Frankreich']);
addCountryAliases('NL', ['NL', 'Netherlands', 'The Netherlands', 'Nizozemsko', 'Holandsko', 'Nederland', 'Holland', 'Niederlande']);
addCountryAliases('BE', ['BE', 'Belgium', 'Belgie', 'Belgicko', 'Belgique', 'België', 'Belgien']);
addCountryAliases('IT', ['IT', 'Italy', 'Itálie', 'Italie', 'Taliansko', 'Italia', 'Italien']);
addCountryAliases('ES', ['ES', 'Spain', 'Španělsko', 'Spanelsko', 'Španielsko', 'España', 'Espana', 'Spanien']);
addCountryAliases('DK', ['DK', 'Denmark', 'Dánsko', 'Dansko', 'Danmark', 'Dänemark']);
addCountryAliases('SE', ['SE', 'Sweden', 'Švédsko', 'Svedsko', 'Sverige', 'Schweden']);
addCountryAliases('FI', ['FI', 'Finland', 'Finsko', 'Fínsko', 'Suomi', 'Finnland']);
addCountryAliases('NO', ['NO', 'Norway', 'Norsko', 'Nórsko', 'Norge', 'Norwegen']);

export function countryCodeFromInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const code = upper === 'UK' ? 'GB' : upper;

  if (/^[A-Z]{2}$/.test(code) && SUPPORTED_COUNTRY_CODES.has(code)) {
    return code;
  }

  const normal = normalizeForMatch(raw);
  const compact = compactKey(raw);

  return COUNTRY_ALIASES[normal] || COUNTRY_ALIASES[compact] || '';
}

/* ---------------------------------------------------------
   Databáze aliasů (EU + významná světová města)
--------------------------------------------------------- */
const CITY_ALIASES = {
  // CZ / SK / PL / HU (výběr)
  'Prague': ['Praha', 'Prag', 'Praga', 'Prága', 'Prague'],
  'Brno': ['Brno', 'Brünn'],
  'Ostrava': ['Ostrava', 'Ostrau', 'Ostrawa', 'Osztrava'],
  'Pilsen': ['Plzeň', 'Plzen', 'Pilsen', 'Pilzen'],
  'Olomouc': ['Olomouc', 'Olmütz'],

  'Bratislava': ['Bratislava', 'Pressburg', 'Pozsony'],
  'Vienna': ['Wien', 'Vídeň', 'Viedeň', 'Wiedeń', 'Bécs', 'Vienna'],

  'Warsaw': ['Warszawa', 'Warschau', 'Varšava', 'Varsava', 'Warsaw'],
  'Kraków': ['Krakow', 'Kraków', 'Krakau', 'Krakov'],
  'Wroclaw': ['Wrocław', 'Wroclaw', 'Breslau'],
  'Gdansk': ['Gdańsk', 'Gdansk', 'Danzig'],
  'Poznan': ['Poznań', 'Poznan'],
  'Lodz': ['Łódź', 'Lodz'],

  'Budapest': ['Budapest', 'Budapešť', 'Budapesth', 'Budapeszt', 'Budapesta'],
  'Debrecen': ['Debrecen', 'Debrecín', 'Debrecin', 'Debreczyn'],
  'Szeged': ['Szeged'],
  'Miskolc': ['Miskolc', 'Miškovec', 'Miskovec', 'Miszkolc'],
  'Pécs': ['Pécs', 'Pecs', 'Péč', 'Pec', 'Pecz'],
  'Győr': ['Győr', 'Gyor', 'Ráb', 'Rab', 'Raab'],

  // DE / AT / CH / BeNeLux
  'Berlin': ['Berlin', 'Berlín'],
  'Hamburg': ['Hamburg', 'Hamburk'],
  'Cologne': ['Cologne', 'Köln', 'Kolín nad Rýnem', 'Koeln'],
  'Frankfurt': ['Frankfurt am Main', 'Frankfurt'],
  'Munich': ['München', 'Munich', 'Muenchen', 'Mnichov'],
  'Stuttgart': ['Stuttgart'],
  'Dusseldorf': ['Düsseldorf', 'Dusseldorf'],
  'Dresden': ['Dresden', 'Drážďany', 'Drazdany'],
  'Leipzig': ['Leipzig', 'Lipsko'],
  'Zurich': ['Zürich', 'Zurich', 'Curych'],
  'Geneva': ['Genève', 'Geneva', 'Ženeva'],

  'Amsterdam': ['Amsterdam', 'Amsterodam'],
  'Rotterdam': ['Rotterdam'],
  'The Hague': ['Den Haag', 'Haag', 'The Hague'],

  'Brussels': ['Bruxelles', 'Brussel', 'Brusel', 'Brussels'],
  'Antwerp': ['Antwerpen', 'Antverpy', 'Antwerp'],

  // FR / ES / PT / IT
  'Paris': ['Paříž', 'Paríž', 'Pariz', 'París', 'Parigi', 'Paryż', 'Paris'],
  'Lyon': ['Lyon'],
  'Marseille': ['Marseille', 'Marsej'],

  'Madrid': ['Madrid', 'Madryt'],
  'Barcelona': ['Barcelona', 'Barcelóna'],
  'Valencia': ['Valencia', 'Valencie'],

  'Lisbon': ['Lisabon', 'Lisboa', 'Lisbon'],
  'Porto': ['Porto', 'Oporto'],

  'Rome': ['Řím', 'Rim', 'Roma', 'Rome'],
  'Milan': ['Milán', 'Milan', 'Milano'],
  'Naples': ['Neapol', 'Napoli', 'Naples'],
  'Turin': ['Turín', 'Torino', 'Turin'],
  'Florence': ['Florencie', 'Firenze', 'Florence'],
  'Venice': ['Benátky', 'Benatky', 'Venezia', 'Venice'],

  // Nordics + Baltics
  'Stockholm': ['Stockholm', 'Štokholm'],
  'Gothenburg': ['Göteborg', 'Goteborg', 'Gothenburg'],
  'Copenhagen': ['København', 'Kobenhavn', 'Kodaň', 'Kodan', 'Copenhagen'],
  'Oslo': ['Oslo'],
  'Helsinki': ['Helsinki', 'Helsinky'],
  'Reykjavik': ['Reykjavik', 'Reykjavík', 'Rejkjavik'],

  'Tallinn': ['Tallinn', 'Talin'],
  'Riga': ['Riga', 'Ryga'],
  'Vilnius': ['Vilnius', 'Wilno', 'Vilno'],

  // Balkán / SEE
  'Ljubljana': ['Ljubljana', 'Lublaň', 'Lublan'],
  'Zagreb': ['Zagreb', 'Záhřeb', 'Zahreb'],
  'Belgrade': ['Belgrade', 'Beograd', 'Bělehrad', 'Belehrad'],
  'Sofia': ['Sofia'],
  'Bucharest': ['Bucharest', 'București', 'Bucuresti', 'Bukurešť', 'Bukurest'],
  'Athens': ['Athens', 'Athína', 'Athina', 'Athény', 'Atheny'],
  'Thessaloniki': ['Thessaloniki', 'Soluň', 'Solun'],
  'Istanbul': ['Istanbul'],

  // UK / IE
  'London': ['London', 'Londýn', 'Londyn', 'Londres', 'Londra', 'Londen'],
  'Manchester': ['Manchester'],
  'Birmingham': ['Birmingham'],
  'Liverpool': ['Liverpool'],
  'Leeds': ['Leeds'],
  'Newcastle upon Tyne': ['Newcastle', 'Newcastle upon Tyne'],
  'Glasgow': ['Glasgow'],
  'Edinburgh': ['Edinburgh', 'Edinburk'],
  'Bristol': ['Bristol'],
  'Cardiff': ['Cardiff'],
  'Belfast': ['Belfast'],
  'Dublin': ['Dublin'],

  // UA / BY (výběr)
  'Kyiv': ['Kyiv', 'Kiev', 'Kyjev'],
  'Lviv': ['Lviv', 'Lvov'],
  'Odesa': ['Odesa', 'Odessa'],
  'Minsk': ['Minsk'],

  // Middle East
  'Tel Aviv': ['Tel Aviv', 'Tel-Aviv', 'TelAviv'],
  'Jerusalem': ['Jerusalem', 'Jeruzalém', 'Jeruzalem'],
  'Dubai': ['Dubai', 'Dubaj'],
  'Abu Dhabi': ['Abu Dhabi', 'Abú Zabí', 'Abu Zabi'],
  'Doha': ['Doha'],
  'Riyadh': ['Riyadh', 'Rijád', 'Rijad'],

  // North America (výběr)
  'New York': ['New York', 'NewYork', 'NYC', 'Nový York', 'Novy York', 'Nowy Jork'],
  'Los Angeles': ['Los Angeles', 'LA'],
  'San Francisco': ['San Francisco', 'SF'],
  'Chicago': ['Chicago', 'Čikágo', 'Cikago'],
  'Boston': ['Boston'],
  'Miami': ['Miami'],
  'Washington': ['Washington', 'Washington DC', 'DC'],
  'Seattle': ['Seattle'],
  'San Diego': ['San Diego'],
  'Las Vegas': ['Las Vegas', 'Vegas'],
  'Dallas': ['Dallas'],
  'Houston': ['Houston'],
  'Austin': ['Austin'],
  'Atlanta': ['Atlanta'],
  'Philadelphia': ['Philadelphia', 'Philly'],
  'Phoenix': ['Phoenix'],
  'Denver': ['Denver'],
  'Toronto': ['Toronto'],
  'Vancouver': ['Vancouver'],
  'Montreal': ['Montreal', 'Montréal', 'Montreál'],

  // LatAm (výběr)
  'Mexico City': ['Mexico City', 'Ciudad de México', 'Mexiko City'],
  'São Paulo': ['São Paulo', 'Sao Paulo'],
  'Rio de Janeiro': ['Rio de Janeiro', 'Rio'],
  'Buenos Aires': ['Buenos Aires'],
  'Santiago': ['Santiago', 'Santiago de Chile'],

  // Asia (výběr)
  'Tokyo': ['Tokyo', 'Tokio'],
  'Osaka': ['Osaka'],
  'Kyoto': ['Kyoto', 'Kjóto', 'Kjoto'],
  'Yokohama': ['Yokohama'],
  'Seoul': ['Seoul', 'Soul'],
  'Busan': ['Busan', 'Pusan'],
  'Beijing': ['Beijing', 'Peking'],
  'Shanghai': ['Shanghai', 'Šanghaj', 'Sanghaj'],
  'Shenzhen': ['Shenzhen', 'Šenčen', 'Sencen'],
  'Guangzhou': ['Guangzhou', 'Kanton'],
  'Hong Kong': ['Hong Kong', 'Hongkong'],
  'Taipei': ['Taipei', 'Tchaj-pej'],
  'Singapore': ['Singapore', 'Singapur'],
  'Bangkok': ['Bangkok'],
  'Kuala Lumpur': ['Kuala Lumpur'],
  'Jakarta': ['Jakarta', 'Džakarta', 'Dzakarta'],
  'Manila': ['Manila'],
  'Mumbai': ['Mumbai', 'Bombaj'],
  'Delhi': ['Delhi', 'New Delhi', 'Nové Dillí', 'Nove Dilli', 'Dillí', 'Dilli'],
  'Bengaluru': ['Bengaluru', 'Bangalore'],

  // Oceania
  'Sydney': ['Sydney', 'Sydnej'],
  'Melbourne': ['Melbourne', 'Melbourn'],
  'Brisbane': ['Brisbane'],
  'Perth': ['Perth'],
  'Adelaide': ['Adelaide', 'Adelaida'],
  'Canberra': ['Canberra'],
  'Auckland': ['Auckland', 'Okland'],
  'Wellington': ['Wellington']
};

/** alias → kanonické EN (rychlý index) */
const aliasIndex = (() => {
  const map = new Map();
  for (const [en, aliases] of Object.entries(CITY_ALIASES)) {
    [en, ...(aliases || [])].forEach((a) => {
      const key = normalizeForMatch(a);
      if (key) map.set(key, en);
    });
  }
  return map;
})();

/* ---------- fuzzy metriky ---------- */
function levSimilarity(a, b) {
  a = normalizeForMatch(a);
  b = normalizeForMatch(b);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}

function jaroWinkler(s1, s2) {
  s1 = normalizeForMatch(s1);
  s2 = normalizeForMatch(s2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const matchDistance = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0, transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const m = matches;
  let jaro = (m / s1.length + m / s2.length + (m - transpositions) / m) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenSetSim(a, b) {
  a = normalizeForMatch(a);
  b = normalizeForMatch(b);
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

function bestScore(query, candidate) {
  const jw = jaroWinkler(query, candidate);
  const lv = levSimilarity(query, candidate);
  const ts = tokenSetSim(query, candidate);
  let score = Math.max(jw, lv, ts);

  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (c.startsWith(q) || q.startsWith(c)) score = Math.max(score, 0.92);
  if (c.includes(q) || q.includes(c)) score = Math.max(score, 0.88);
  return score;
}

function dynamicThreshold(q) {
  const L = normalizeForMatch(q).length;
  if (L <= 4) return 0.9;
  if (L <= 7) return 0.86;
  if (L <= 12) return 0.82;
  return 0.8;
}

/* ---------- veřejné API ---------- */
export function findBestCityMatchInfo(input) {
  if (!input) return null;

  // Pokud vstup vypadá jako země, city fuzzy vůbec nespouštíme.
  // Tohle chrání hodnoty typu France / Francie / FR / Hungary / HU.
  if (countryCodeFromInput(input)) return null;

  const norm = normalizeForMatch(collapseDistricts(input));
  if (!norm) return null;

  const exact = aliasIndex.get(norm);
  if (exact) return { canonical: exact, score: 1, matchedAlias: input };

  let best = { canonical: '', score: 0, matchedAlias: '' };
  for (const [aliasNorm, en] of aliasIndex.entries()) {
    const s = bestScore(norm, aliasNorm);
    if (s > best.score) best = { canonical: en, score: s, matchedAlias: aliasNorm };
  }
  const th = dynamicThreshold(norm);
  return best.score >= th ? best : null;
}

/** Převede aliasy na kanonický (TM-friendly) EN název. */
export function canonForInputCity(input) {
  if (!input) return '';

  // Země nejsou města. Vracíme prázdno, aby si vyšší vrstvy mohly držet country-only search.
  if (countryCodeFromInput(input)) return '';

  const hit = findBestCityMatchInfo(input);
  if (hit) return hit.canonical;

  const base = baseCityKey(input);
  if (base === 'prague') return 'Prague';
  if (base === 'bratislava') return 'Bratislava';
  if (base === 'budapest') return 'Budapest';
  if (base === 'vienna') return 'Vienna';

  return input;
}

// Preferované popisky pro UI
export const CANON_LABEL = {
  prague:     { cs:'Praha',     sk:'Praha',     en:'Prague',   de:'Prag',      pl:'Praga',     hu:'Prága' },
  brno:       { cs:'Brno',      sk:'Brno',      en:'Brno',     de:'Brünn',     pl:'Brno',      hu:'Brünn' },
  ostrava:    { cs:'Ostrava',   sk:'Ostrava',   en:'Ostrava',  de:'Ostrau',    pl:'Ostrawa',   hu:'Osztrava' },
  pilsen:     { cs:'Plzeň',     sk:'Plzeň',     en:'Pilsen',   de:'Pilsen',    pl:'Pilzno',    hu:'Pilsen' },
  bratislava: { cs:'Bratislava',sk:'Bratislava',en:'Bratislava',de:'Pressburg',pl:'Bratysława',hu:'Pozsony' },
  vienna:     { cs:'Vídeň',     sk:'Viedeň',    en:'Vienna',   de:'Wien',      pl:'Wiedeń',    hu:'Bécs' },
  krakow:     { cs:'Krakov',    sk:'Krakov',    en:'Kraków',   de:'Krakau',    pl:'Kraków',    hu:'Krakkó' },
  warsaw:     { cs:'Varšava',   sk:'Varšava',   en:'Warsaw',   de:'Warschau',  pl:'Warszawa',  hu:'Varsó' },

  london:     { cs:'Londýn',    sk:'Londýn',    en:'London',   de:'London',    pl:'Londyn',    hu:'London' },
  paris:      { cs:'Paříž',     sk:'Paríž',     en:'Paris',    de:'Paris',     pl:'Paryż',     hu:'Párizs' },
  berlin:     { cs:'Berlín',    sk:'Berlín',    en:'Berlin',   de:'Berlin',    pl:'Berlin',    hu:'Berlin' },
  budapest:   { cs:'Budapešť',  sk:'Budapešť',  en:'Budapest', de:'Budapest',  pl:'Budapeszt', hu:'Budapest' },
  amsterdam:  { cs:'Amsterdam', sk:'Amsterdam', en:'Amsterdam',de:'Amsterdam', pl:'Amsterdam', hu:'Amsterdam' },
  madrid:     { cs:'Madrid',    sk:'Madrid',    en:'Madrid',   de:'Madrid',    pl:'Madryt',    hu:'Madrid' }
};

export function labelForCanon(canonKey, lang = 'cs') {
  const key = normalize(canonKey);
  const L = (lang || 'en').toString().slice(0, 2).toLowerCase();
  const map = CANON_LABEL[key];
  return map?.[L] || canonKey;
}

/* ---------- City → countryCode ---------- */
const CITY_TO_CC = {
  // CZ
  'Prague': 'CZ', 'Brno': 'CZ', 'Ostrava': 'CZ', 'Pilsen': 'CZ', 'Olomouc': 'CZ',
  // SK
  'Bratislava': 'SK',
  // HU
  'Budapest': 'HU', 'Debrecen': 'HU', 'Szeged': 'HU', 'Miskolc': 'HU', 'Pécs': 'HU', 'Győr': 'HU',
  // AT
  'Vienna': 'AT',
  // PL
  'Kraków': 'PL', 'Warsaw': 'PL', 'Wroclaw': 'PL', 'Gdansk': 'PL', 'Poznan': 'PL', 'Lodz': 'PL',
  // DE
  'Berlin': 'DE', 'Hamburg': 'DE', 'Cologne': 'DE', 'Frankfurt': 'DE', 'Munich': 'DE',
  'Stuttgart': 'DE', 'Dusseldorf': 'DE', 'Dresden': 'DE', 'Leipzig': 'DE',
  // CH
  'Zurich': 'CH', 'Geneva': 'CH',
  // NL / BE / LU
  'Amsterdam': 'NL', 'Rotterdam': 'NL', 'The Hague': 'NL',
  'Brussels': 'BE', 'Antwerp': 'BE',
  // FR
  'Paris': 'FR', 'Lyon': 'FR', 'Marseille': 'FR',
  // ES
  'Madrid': 'ES', 'Barcelona': 'ES', 'Valencia': 'ES',
  // PT
  'Lisbon': 'PT', 'Porto': 'PT',
  // IT
  'Rome': 'IT', 'Milan': 'IT', 'Naples': 'IT', 'Turin': 'IT', 'Florence': 'IT', 'Venice': 'IT',
  // Nordics
  'Stockholm': 'SE', 'Gothenburg': 'SE', 'Copenhagen': 'DK', 'Oslo': 'NO', 'Helsinki': 'FI', 'Reykjavik': 'IS',
  // Baltics
  'Tallinn': 'EE', 'Riga': 'LV', 'Vilnius': 'LT',
  // SEE
  'Ljubljana': 'SI', 'Zagreb': 'HR', 'Belgrade': 'RS', 'Sofia': 'BG',
  'Bucharest': 'RO', 'Athens': 'GR', 'Thessaloniki': 'GR', 'Istanbul': 'TR',
  // UK / IE
  'London': 'GB', 'Manchester': 'GB', 'Birmingham': 'GB', 'Liverpool': 'GB', 'Leeds': 'GB',
  'Newcastle upon Tyne': 'GB', 'Glasgow': 'GB', 'Edinburgh': 'GB', 'Bristol': 'GB',
  'Cardiff': 'GB', 'Belfast': 'GB', 'Dublin': 'IE',
  // UA / BY
  'Kyiv': 'UA', 'Lviv': 'UA', 'Odesa': 'UA', 'Minsk': 'BY',
  // Middle East
  'Tel Aviv': 'IL', 'Jerusalem': 'IL', 'Dubai': 'AE', 'Abu Dhabi': 'AE', 'Doha': 'QA', 'Riyadh': 'SA',
  // North America
  'New York': 'US', 'Los Angeles': 'US', 'San Francisco': 'US', 'Chicago': 'US', 'Boston': 'US',
  'Miami': 'US', 'Washington': 'US', 'Seattle': 'US', 'San Diego': 'US', 'Las Vegas': 'US',
  'Dallas': 'US', 'Houston': 'US', 'Austin': 'US', 'Atlanta': 'US', 'Philadelphia': 'US',
  'Phoenix': 'US', 'Denver': 'US',
  'Toronto': 'CA', 'Vancouver': 'CA', 'Montreal': 'CA',
  // LatAm
  'Mexico City': 'MX', 'São Paulo': 'BR', 'Rio de Janeiro': 'BR',
  'Buenos Aires': 'AR', 'Santiago': 'CL',
  // Asia
  'Tokyo': 'JP', 'Osaka': 'JP', 'Kyoto': 'JP', 'Yokohama': 'JP',
  'Seoul': 'KR', 'Busan': 'KR',
  'Beijing': 'CN', 'Shanghai': 'CN', 'Shenzhen': 'CN', 'Guangzhou': 'CN', 'Hong Kong': 'HK',
  'Taipei': 'TW', 'Singapore': 'SG', 'Bangkok': 'TH', 'Kuala Lumpur': 'MY', 'Jakarta': 'ID',
  'Manila': 'PH', 'Mumbai': 'IN', 'Delhi': 'IN', 'Bengaluru': 'IN',
  // Oceania
  'Sydney': 'AU', 'Melbourne': 'AU', 'Brisbane': 'AU', 'Perth': 'AU', 'Adelaide': 'AU', 'Canberra': 'AU',
  'Auckland': 'NZ', 'Wellington': 'NZ'
};

/** Vrátí ISO country code pro zadané město (pokud ho známe). */
export function guessCountryCodeFromCity(input) {
  if (!input) return '';

  // Země není město. Tím zabráníme tomu, aby např. France prošla městskou logikou.
  if (countryCodeFromInput(input)) return '';

  const canonCity = canonForInputCity(input);
  return CITY_TO_CC[canonCity] || '';
}
