// /src/adapters/ticketmaster.js
// ---------------------------------------------------------
// Ticketmaster Discovery API adapter (via Netlify function proxy)
// Supports: city, keyword, segmentName, classificationName, dateFrom/To,
// page, size, sort (nearest/latest), plus optional geo/ids.
//
// DŮLEŽITÉ:
// - Ticketmaster API vrací ev.url.
// - Frontend neposílá uživatele přímo na ev.url.
// - Místo toho používáme vlastní Netlify redirect funkci tmOutbound.
// - Pokud vybereme známé město se zemí, držíme se této země striktně.
//   Tím zabráníme falešným výsledkům typu Paris US / Madrid GB.
// - Výsledky už nevracíme po prvním nenulovém pokusu.
//   Sloučíme city + keyword + fallback pokusy, deduplikujeme a až pak vracíme.
// - U Paříže povolujeme metropolitní venue jako Saint-Denis / Nanterre apod.
// - URL market filtr je měkký: odstraní jen zjevně špatný market, ale nezabije
//   evropské výsledky, které TM vrátí přes obecný ticketmaster.com.
// ---------------------------------------------------------

import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

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
  NO: 'nb-no'
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
  FI: 'ticketmaster.fi',
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
  '2038755|23892': 'FI',
};

/** Map UI sort to TM sort string */
function toTmSort(sortUi) {
  if (sortUi === 'latest') return 'date,desc';
  return 'date,asc';
}

/** Convert user-input city to a Ticketmaster-friendly EN name */
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
    'paris',
    'saint denis',
    'saint-denis',
    'st denis',
    'st-denis',
    'saint ouen',
    'saint-ouen',
    'nanterre',
    'puteaux',
    'courbevoie',
    'la defense',
    'la défense',
    'paris la defense',
    'paris la défense',
    'boulogne billancourt',
    'boulogne-billancourt',
    'levallois perret',
    'levallois-perret',
    'neuilly sur seine',
    'neuilly-sur-seine',
    'issy les moulineaux',
    'issy-les-moulineaux',
    'aubervilliers',
    'pantin',
    'montreuil',
    'vincennes',
    'ivry sur seine',
    'ivry-sur-seine',
    'villepinte',
    'versailles'
  ]
};

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
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
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

    if (normalizeHost(parsed.hostname) !== 'ticketmaster.evyy.net') {
      return '';
    }

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

    return (
      parsed.searchParams.get('u') ||
      parsed.searchParams.get('url') ||
      parsed.searchParams.get('to') ||
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Měkká kontrola URL marketu.
 *
 * Nejde o tvrdý filtr proti ticketmaster.com, protože TM někdy vrací
 * evropský event s country správně FR/ES/NL, ale URL host je obecný .com.
 * Tvrdě blokujeme jen jasně cizí market, např. FR event s ticketmaster.co.uk.
 */
function getUrlMarketScore(rawUrl = '', countryCode = '', depth = 0) {
  const cc = String(countryCode || '').trim().toUpperCase();

  if (!cc) {
    return { allowed: true, score: 0 };
  }

  const expectedHost = COUNTRY_MARKET_HOST[cc];

  if (!expectedHost) {
    return { allowed: true, score: 0 };
  }

  const sourceUrl = String(rawUrl || '').trim();

  if (!sourceUrl) {
    return { allowed: false, score: -100 };
  }

  if (depth > 3) {
    return { allowed: true, score: 0 };
  }

  try {
    const parsed = new URL(sourceUrl);
    const host = normalizeHost(parsed.hostname);

    // Impact wrapper – pokud známe jeho market, musí sedět.
    if (host === 'ticketmaster.evyy.net') {
      const impactCountry = getImpactCountry(sourceUrl);

      if (impactCountry && impactCountry !== cc) {
        return { allowed: false, score: -100 };
      }

      const nested = getNestedTargetUrl(sourceUrl);

      if (nested) {
        const nestedScore = getUrlMarketScore(nested, cc, depth + 1);

        if (!nestedScore.allowed) {
          return nestedScore;
        }

        return {
          allowed: true,
          score: Math.max(impactCountry === cc ? 4 : 0, nestedScore.score)
        };
      }

      return {
        allowed: impactCountry ? impactCountry === cc : true,
        score: impactCountry === cc ? 4 : 0
      };
    }

    // Přesný Ticketmaster market.
    if (hostMatches(host, expectedHost)) {
      return { allowed: true, score: 5 };
    }

    // Universe necháváme projít – TM ho používá jako součást svého ekosystému.
    if (host === 'universe.com' || host.endsWith('.universe.com')) {
      return { allowed: true, score: 2 };
    }

    // UK Ticketweb necháváme pro GB.
    if (cc === 'GB' && (host === 'ticketweb.uk' || host.endsWith('.ticketweb.uk'))) {
      return { allowed: true, score: 2 };
    }

    // Obecný ticketmaster.com není ideální, ale někdy je jediný výstup z API.
    // Necháme projít, ale s nízkým skóre.
    if (isGenericTicketmasterComHost(host)) {
      return { allowed: true, score: 0 };
    }

    // Jiný konkrétní Ticketmaster market = špatně.
    if (host.includes('ticketmaster.')) {
      return { allowed: false, score: -100 };
    }

    // Pokud je uvnitř ještě target, zkusíme ho.
    const nested = getNestedTargetUrl(sourceUrl);

    if (nested) {
      return getUrlMarketScore(nested, cc, depth + 1);
    }

    // Neznámý host raději nepouštíme.
    return { allowed: false, score: -100 };
  } catch {
    return { allowed: false, score: -100 };
  }
}

/**
 * Odstraní jen zjevně špatné URL markety.
 * Pokud by filtr vyhodil vše, vrátí původní list, aby FE nezůstal prázdný
 * jen kvůli atypickému Ticketmaster URL hostu.
 */
function filterObviouslyWrongMarketUrls(events = [], countryCode = '') {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc || !events.length) return events;

  const filtered = events.filter((ev) => {
    const score = getUrlMarketScore(ev?.url || '', cc);
    return score.allowed;
  });

  return filtered.length ? filtered : events;
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

/** Normalize TM segment to our internal category */
function mapSegmentToCategory(ev) {
  const cls = ev?.classifications?.[0] || {};
  const seg = cls?.segment?.name || '';
  const genre = cls?.genre?.name || '';
  const subGen = cls?.subGenre?.name || '';
  const type = cls?.type?.name || '';
  const subType = cls?.subType?.name || '';
  const name = ev?.name || '';

  const hay = normClassification([
    seg,
    genre,
    subGen,
    type,
    subType,
    name
  ].filter(Boolean).join(' '));

  const hasFest =
    hay.includes('festival') ||
    hay.includes('fest');

  if (hasFest) {
    return 'festival';
  }

  if (
    hay.includes('music') ||
    hay.includes('musique') ||
    hay.includes('musica') ||
    hay.includes('musik') ||
    hay.includes('muziek') ||
    hay.includes('concert')
  ) {
    return 'concert';
  }

  if (
    hay.includes('sport') ||
    hay.includes('sports')
  ) {
    return 'sport';
  }

  if (
    hay.includes('arts and theatre') ||
    hay.includes('arts theatre') ||
    hay.includes('theatre') ||
    hay.includes('theater') ||
    hay.includes('teatro') ||
    hay.includes('opera') ||
    hay.includes('comedy') ||
    hay.includes('dance') ||
    hay.includes('ballet') ||
    hay.includes('circus')
  ) {
    return 'theatre';
  }

  return 'other';
}

/** Pick sensible date string */
function pickDate(ev) {
  const dt = ev?.dates?.start || {};

  if (dt.dateTime) return dt.dateTime;
  if (dt.localDate && dt.localTime) return `${dt.localDate}T${dt.localTime}`;
  if (dt.localDate) return dt.localDate;

  return '';
}

/** Safely pick biggest image URL */
function pickImage(ev) {
  return (
    (ev?.images || [])
      .filter((im) => im?.url)
      .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || ''
  );
}

/**
 * Z Ticketmaster URL vytáhne preferovaný odkaz.
 */
function extractPreferredTicketmasterUrl(rawUrl = '') {
  const sourceUrl = String(rawUrl || '').trim();
  if (!sourceUrl) return '';

  try {
    const parsed = new URL(sourceUrl);

    if (parsed.hostname.toLowerCase() === 'ticketmaster.evyy.net') {
      return parsed.toString();
    }

    const nestedUrl =
      parsed.searchParams.get('url') ||
      parsed.searchParams.get('to') ||
      parsed.searchParams.get('u');

    if (nestedUrl) {
      try {
        const nested = new URL(nestedUrl);

        if (nested.hostname.toLowerCase() === 'ticketmaster.evyy.net') {
          return nested.toString();
        }
      } catch {
        // noop
      }
    }

    return parsed.toString();
  } catch {
    return sourceUrl;
  }
}

/**
 * Build safe AJSEE outbound URL for Ticketmaster.
 */
function buildTicketmasterOutboundUrl(rawUrl = '', eventId = '', countryCode = '') {
  const preferredUrl = extractPreferredTicketmasterUrl(rawUrl);

  if (!preferredUrl) return '';

  if (preferredUrl.includes('/.netlify/functions/tmOutbound')) {
    return preferredUrl;
  }

  const qs = new URLSearchParams();
  qs.set('to', preferredUrl);

  if (eventId) {
    qs.set('eid', String(eventId));
  }

  // tmOutbound může podle cc později lépe rozhodnout o fallbacku
  // u obecných ticketmaster.com URL.
  if (countryCode) {
    qs.set('cc', String(countryCode).toUpperCase());
  }

  return `/.netlify/functions/tmOutbound?${qs.toString()}`;
}

function mapTicketmasterEvent(ev, locale) {
  const cat = mapSegmentToCategory(ev);
  const dt = pickDate(ev);
  const img = pickImage(ev);

  const venue = ev?._embedded?.venues?.[0] || {};
  const city = venue?.city?.name || '';
  const country = venue?.country?.countryCode || '';

  const latRaw = venue?.location?.latitude ?? venue?.location?.lat ?? '';
  const lonRaw = venue?.location?.longitude ?? venue?.location?.lon ?? '';

  const lat = Number.isFinite(+latRaw) ? +latRaw : undefined;
  const lon = Number.isFinite(+lonRaw) ? +lonRaw : undefined;

  const desc = [ev?.info, ev?.pleaseNote].filter(Boolean).join(' — ');

  const price =
    Array.isArray(ev?.priceRanges) && ev.priceRanges.length
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
    location: { city, country, lat, lon },
    image: img,
    partner: 'ticketmaster',
    sourceName: 'Ticketmaster',
    url: outboundUrl,
    tickets: outboundUrl,
    priceFrom: price,
    promo: null,
  };
}

function filterRawEventsByStrictCityCountry(events = [], { strictCity = '', strictCountry = '' } = {}) {
  const cc = String(strictCountry || '').trim().toUpperCase();
  const city = String(strictCity || '').trim();

  return events.filter((ev) => {
    const venue = ev?._embedded?.venues?.[0] || {};
    const evCountry = String(venue?.country?.countryCode || '').trim().toUpperCase();
    const evCity = String(venue?.city?.name || '').trim();

    // Země je tvrdá hranice. Tohle chrání Paris FR před Paris US.
    if (cc && evCountry && evCountry !== cc) return false;

    // Město je přesné, ale pro vybrané metropole povolujeme okolní venue.
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

function sortRawEvents(events = [], sort = 'nearest', countryCode = '') {
  const direction = sort === 'date,desc' ? -1 : 1;
  const cc = String(countryCode || '').trim().toUpperCase();

  return [...events].sort((a, b) => {
    const da = rawEventTime(a);
    const db = rawEventTime(b);

    if (da !== db) {
      return direction * (da - db);
    }

    // Při stejném datu preferuj přesný market před obecným ticketmaster.com.
    const sa = getUrlMarketScore(a?.url || '', cc).score;
    const sb = getUrlMarketScore(b?.url || '', cc).score;

    if (sa !== sb) {
      return sb - sa;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function getCategoryQueryVariants(category = 'all') {
  const cat = String(category || 'all').trim().toLowerCase();

  switch (cat) {
    case 'concert':
      return [
        { segmentName: 'Music' }
      ];

    case 'sport':
      return [
        { segmentName: 'Sports' }
      ];

    case 'theatre':
      return [
        { segmentName: 'Arts & Theatre' },
        { classificationName: 'Theatre' },
        { classificationName: 'Theater' }
      ];

    case 'festival':
      return [
        { classificationName: 'Festival' },
        { segmentName: 'Music' },
        { segmentName: 'Arts & Theatre' }
      ];

    case 'all':
    default:
      return [{}];
  }
}

function categoryVariantKey(v = {}) {
  return [
    v.segmentName || '',
    v.classificationName || ''
  ].join('|');
}

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  const explicitCountry = String(
    filters.cityCountryCode || filters.countryCode || filters.country || ''
  ).toUpperCase();

  const rawCity = String(filters.city || '').trim();
  const tmCity = rawCity ? toTmCity(rawCity) : '';

  const guessedCC = rawCity
    ? String(guessCountryCodeFromCity?.(rawCity) || guessCountryCodeFromCity?.(tmCity) || '').toUpperCase()
    : '';

  // Pokud uživatel zadal město, preferujeme zemi z města před globálním defaultem CZ.
  const selectedCityCountry = rawCity
    ? String(filters.cityCountryCode || guessedCC || explicitCountry || '').toUpperCase()
    : '';

const marketLocale = selectedCityCountry
  ? MARKET_LOCALE_BY_COUNTRY[selectedCityCountry]
  : '';

const locales = [
  // Ticketmaster FR/ES/NL často vrací evropské eventy správně až přes obecné "en".
  // U Paříže je to zásadní: fr-fr / cs / en-gb mohou vracet 0, zatímco en vrací výsledky.
  'en',
  marketLocale,
  locale,
  'en-gb'
].filter((v, i, arr) => !!v && arr.indexOf(v) === i);

  const sort = toTmSort(filters.sort);
  const page = Number.isFinite(+filters.page) ? String(+filters.page) : '0';
  const size = Number.isFinite(+filters.size) ? String(+filters.size) : '12';

  const category = filters.category || filters.segment || 'all';
  const categoryVariants = getCategoryQueryVariants(category);

  const putCommonParams = (qs, categoryVariant = {}) => {
    if (filters.keyword) qs.set('keyword', String(filters.keyword));

    if (categoryVariant.segmentName) {
      qs.set('segmentName', String(categoryVariant.segmentName));
    }

    if (categoryVariant.classificationName) {
      qs.set('classificationName', String(categoryVariant.classificationName));
    }

    // Explicitní classificationName zvenku má přednost.
    if (filters.classificationName) {
      qs.set('classificationName', String(filters.classificationName));
    }

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

    qs.set('sort', sort);
    qs.set('page', page);
    qs.set('size', size);
  };

  const attempts = [];

  if (tmCity) {
    if (selectedCityCountry) {
      // 1) city + country
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });

      // 2) keyword + country
      // Pro Paříž je důležité, protože koncerty mohou být v Saint-Denis.
      attempts.push({
        mode: 'keyword',
        keyword: tmCity,
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });

      // 3) city bez countryCode, ale výsledek striktně odfiltrujeme podle země.
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: '',
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });

      // 4) broad country fallback pro kategorii.
      // Pomáhá tam, kde TM city query vrací málo, ale country + segment vrací relevantní metro akce.
      attempts.push({
        mode: 'broad',
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });
    } else {
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: '',
        strictCity: tmCity,
        strictCountry: '',
      });

      attempts.push({
        mode: 'keyword',
        keyword: tmCity,
        countryCode: '',
        strictCity: tmCity,
        strictCountry: '',
      });
    }
  } else {
    attempts.push({
      mode: 'broad',
      countryCode: explicitCountry || 'CZ',
      strictCity: '',
      strictCountry: '',
    });
  }

  const keyOf = (a) =>
    `${a.mode}|${a.city || a.keyword || ''}|${a.countryCode || ''}|${a.strictCountry || ''}`;

  const seenAttempts = new Set();

  const uniqAttempts = attempts.filter((a) => {
    const key = keyOf(a);
    if (seenAttempts.has(key)) return false;
    seenAttempts.add(key);
    return true;
  });

  const hasGeo = !!(
    filters.latlong ||
    (filters.nearMeLat != null && filters.nearMeLon != null)
  );

  const collectedRaw = [];

  for (const locTry of locales) {
    for (const categoryVariant of categoryVariants) {
      for (const attempt of uniqAttempts) {
        const qs = new URLSearchParams();

        putCommonParams(qs, categoryVariant);
        qs.set('locale', locTry);

        if (!hasGeo && attempt.countryCode) {
          qs.set('countryCode', attempt.countryCode);
        }

        if (attempt.mode === 'city') {
          qs.set('city', attempt.city);
        } else if (attempt.mode === 'keyword' && attempt.keyword && !filters.keyword) {
          qs.set('keyword', attempt.keyword);
        }

        const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;

        console.info(
          '[TM adapter] GET',
          url,
          '| desired city =',
          rawCity || '(none)',
          '| selected country =',
          selectedCityCountry || '(none)',
          '| using =',
          attempt.mode,
          '| category variant =',
          categoryVariantKey(categoryVariant) || '(none)'
        );

        try {
          const res = await fetch(url, { cache: 'no-store' });

          if (!res.ok) {
            if (res.status === 429) continue;
            continue;
          }

          const data = await res.json();
          const list = data?._embedded?.events || [];

          if (!Array.isArray(list) || !list.length) continue;

          const strictRawList = (attempt.strictCity || attempt.strictCountry)
            ? filterRawEventsByStrictCityCountry(list, {
                strictCity: attempt.strictCity,
                strictCountry: attempt.strictCountry,
              })
            : list;

          if (!strictRawList.length) continue;

          collectedRaw.push(...strictRawList);
        } catch (err) {
          console.error('[Ticketmaster adapter] fetch error for locale:', locTry, attempt, err);
        }
      }
    }
  }

  let dedupedRaw = dedupeRawEvents(collectedRaw);

  if (!dedupedRaw.length) return [];

  dedupedRaw = filterObviouslyWrongMarketUrls(dedupedRaw, selectedCityCountry || explicitCountry);
  dedupedRaw = sortRawEvents(dedupedRaw, sort, selectedCityCountry || explicitCountry);

  return dedupedRaw.map((ev) => mapTicketmasterEvent(ev, locale));
}

export default { fetchEvents };