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
//   Tím zabráníme falešným výsledkům typu Paris GB / Madrid GB.
// - Nově kontrolujeme i market v URL, aby např. Paříž FR nepustila
//   falešný / neplatný výsledek z ticketmaster.com.
// ---------------------------------------------------------

import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

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

function isUrlCompatibleWithCountry(rawUrl = '', countryCode = '') {
  const cc = String(countryCode || '').trim().toUpperCase();

  if (!cc) return true;

  const expectedHost = COUNTRY_MARKET_HOST[cc];

  // Pokud zemi neumíme mapovat, neblokujeme výsledek.
  if (!expectedHost) return true;

  const sourceUrl = String(rawUrl || '').trim();

  if (!sourceUrl) return false;

  try {
    const parsed = new URL(sourceUrl);
    const host = normalizeHost(parsed.hostname);

    // A) Impact wrapper: rozhoduje assetId/programId.
    if (host === 'ticketmaster.evyy.net') {
      const impactCountry = getImpactCountry(sourceUrl);

      if (impactCountry) {
        return impactCountry === cc;
      }

      const nested = getNestedTargetUrl(sourceUrl);
      return nested ? isUrlCompatibleWithCountry(nested, cc) : false;
    }

    // B) Přímý Ticketmaster market.
    if (hostMatches(host, expectedHost)) return true;

    // C) UK výjimky v rámci Ticketmaster ekosystému.
    if (cc === 'GB') {
      if (host === 'universe.com' || host.endsWith('.universe.com')) return true;
      if (host === 'ticketweb.uk' || host.endsWith('.ticketweb.uk')) return true;
    }

    // D) Obecný ticketmaster.com NEpouštíme pro evropská města,
    // protože vrací falešné / neplatné výsledky typu Paris .com.
    if (host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com')) {
      return false;
    }

    // E) Pokud URL obsahuje vnořený target, zkusíme ještě ten.
    const nested = getNestedTargetUrl(sourceUrl);
    if (nested) {
      return isUrlCompatibleWithCountry(nested, cc);
    }

    return false;
  } catch {
    return false;
  }
}

function filterRawEventsByStrictCityCountryAndMarket(events = [], { strictCity = '', strictCountry = '' } = {}) {
  const cc = String(strictCountry || '').trim().toUpperCase();
  const city = String(strictCity || '').trim();

  return events.filter((ev) => {
    const venue = ev?._embedded?.venues?.[0] || {};
    const evCountry = String(venue?.country?.countryCode || '').trim().toUpperCase();
    const evCity = String(venue?.city?.name || '').trim();

    if (cc && evCountry && evCountry !== cc) return false;
    if (city && evCity && !isSameCity(evCity, city)) return false;

    if (cc && !isUrlCompatibleWithCountry(ev?.url || '', cc)) return false;

    return true;
  });
}

/** Normalize TM segment to our internal category */
function mapSegmentToCategory(ev) {
  const seg = ev?.classifications?.[0]?.segment?.name || '';
  const genre = ev?.classifications?.[0]?.genre?.name || '';
  const subGen = ev?.classifications?.[0]?.subGenre?.name || '';
  const name = ev?.name || '';

  const hasFest =
    /festival/i.test(genre) ||
    /festival/i.test(subGen) ||
    /festival/i.test(name);

  switch (seg) {
    case 'Music':
      return hasFest ? 'festival' : 'concert';

    case 'Sports':
      return 'sport';

    case 'Arts & Theatre':
      return hasFest ? 'festival' : 'theatre';

    default:
      return hasFest ? 'festival' : 'other';
  }
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

    const nestedUrl = parsed.searchParams.get('url') || parsed.searchParams.get('to');

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
function buildTicketmasterOutboundUrl(rawUrl = '', eventId = '') {
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
  const outboundUrl = buildTicketmasterOutboundUrl(tmRawUrl, ev.id || '');

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

function filterStrictCityCountry(mappedEvents, { strictCity = '', strictCountry = '' } = {}) {
  const cc = String(strictCountry || '').trim().toUpperCase();
  const city = String(strictCity || '').trim();

  return mappedEvents.filter((ev) => {
    const evCountry = String(ev?.location?.country || '').trim().toUpperCase();
    const evCity = String(ev?.location?.city || '').trim();

    if (cc && evCountry && evCountry !== cc) return false;
    if (city && evCity && !isSameCity(evCity, city)) return false;

    return true;
  });
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

  const locales = [locale, 'cs', 'en'].filter(
    (v, i, arr) => !!v && arr.indexOf(v) === i
  );

  const sort = toTmSort(filters.sort);
  const page = Number.isFinite(+filters.page) ? String(+filters.page) : '0';
  const size = Number.isFinite(+filters.size) ? String(+filters.size) : '12';

  const segmentMap = {
    concert: 'Music',
    sport: 'Sports',
    theatre: 'Arts & Theatre',
    festival: 'Arts & Theatre',
  };

  const segmentName = filters.category ? (segmentMap[filters.category] || '') : '';

  const putCommonParams = (qs) => {
    if (filters.keyword) qs.set('keyword', String(filters.keyword));
    if (segmentName) qs.set('segmentName', segmentName);

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
      // 1) nejpřesnější pokus: city + country
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });

      // 2) fallback: keyword + country
      attempts.push({
        mode: 'keyword',
        keyword: tmCity,
        countryCode: selectedCityCountry,
        strictCity: tmCity,
        strictCountry: selectedCityCountry,
      });

      // 3) fallback: city bez countryCode, ale výsledek striktně odfiltrujeme podle země.
      // Důležité pro UK, kde city=London někdy funguje lépe bez countryCode.
      attempts.push({
        mode: 'city',
        city: tmCity,
        countryCode: '',
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

  const seen = new Set();

  const uniqAttempts = attempts.filter((a) => {
    const key = keyOf(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hasGeo = !!(
    filters.latlong ||
    (filters.nearMeLat != null && filters.nearMeLon != null)
  );

  for (const locTry of locales) {
    for (const attempt of uniqAttempts) {
      const qs = new URLSearchParams();

      putCommonParams(qs);
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
        attempt.mode
      );

      try {
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 429) continue;
          continue;
        }

        const data = await res.json();
        const list = data?._embedded?.events || [];

        if (!Array.isArray(list) || !list.length) continue;

        const strictRawList = (attempt.strictCity || attempt.strictCountry)
          ? filterRawEventsByStrictCityCountryAndMarket(list, {
              strictCity: attempt.strictCity,
              strictCountry: attempt.strictCountry,
            })
          : list;

        if (!strictRawList.length) continue;

        const mapped = strictRawList.map((ev) => mapTicketmasterEvent(ev, locale));

        const strictMapped = (attempt.strictCity || attempt.strictCountry)
          ? filterStrictCityCountry(mapped, {
              strictCity: attempt.strictCity,
              strictCountry: attempt.strictCountry,
            })
          : mapped;

        if (!strictMapped.length) continue;

        return strictMapped;
      } catch (err) {
        console.error('[Ticketmaster adapter] fetch error for locale:', locTry, attempt, err);
      }
    }
  }

  return [];
}

export default { fetchEvents };
