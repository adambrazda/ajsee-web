// /src/adapters/ticketmaster.js
// ---------------------------------------------------------
// Ticketmaster Discovery API adapter (via Netlify function proxy)
// Supports: city, keyword, segmentName, classificationName, dateFrom/To,
// page, size, sort (nearest/latest), plus optional geo/ids.
// ---------------------------------------------------------

import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

/** Normalize to basic (for local equality checks) */
function normBasic(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map UI sort to TM sort string */
function toTmSort(sortUi) {
  if (sortUi === 'latest') return 'date,desc';
  if (sortUi === 'nearest') return 'date,asc';
  return sortUi || 'date,asc';
}

/** Convert user-input city to a Ticketmaster-friendly EN name */
function toTmCity(raw = '') {
  const c = canonForInputCity?.(raw);
  return (c && String(c)) || String(raw || '').trim();
}

/** Normalize TM segment to our internal category */
function mapSegmentToCategory(ev) {
  const seg = ev?.classifications?.[0]?.segment?.name || '';
  const genre = ev?.classifications?.[0]?.genre?.name || '';
  const subGenre = ev?.classifications?.[0]?.subGenre?.name || '';
  const name = ev?.name || '';

  const hasFestivalHint =
    /festival/i.test(genre) || /festival/i.test(subGenre) || /festival/i.test(name);

  switch (seg) {
    case 'Music':
      return hasFestivalHint ? 'festival' : 'concert';
    case 'Sports':
      return 'sport';
    case 'Arts & Theatre':
      return hasFestivalHint ? 'festival' : 'theatre';
    default:
      return hasFestivalHint ? 'festival' : 'other';
  }
}

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  const explicitCountry = String(filters.countryCode || '').toUpperCase();

  // City (canonical EN for TM) + guessed country (if we can)
  const rawCity = String(filters.city || '').trim();
  const tmCity = rawCity ? toTmCity(rawCity) : '';
  const guessedCC = rawCity ? (guessCountryCodeFromCity?.(rawCity) || '') : '';

  // Try a couple of locales; return first with results
  const locales = [locale, 'cs', 'en'].filter((v, i, arr) => !!v && arr.indexOf(v) === i);

  const sort = toTmSort(filters.sort);
  const page = Number.isFinite(+filters.page) ? String(+filters.page) : '0';
  const size = Number.isFinite(+filters.size) ? String(+filters.size) : '50';

  const segmentMap = {
    concert: 'Music',
    sport: 'Sports',
    theatre: 'Arts & Theatre',
    festival: 'Arts & Theatre',
  };
  const segmentName = filters.category ? (segmentMap[filters.category] || '') : '';

  // Build base QS (shared for attempts)
  const putCommonParams = (qs) => {
    if (filters.keyword) qs.set('keyword', String(filters.keyword));
    if (segmentName) qs.set('segmentName', segmentName);
    if (filters.classificationName) qs.set('classificationName', String(filters.classificationName));
    if (filters.dateFrom) qs.set('dateFrom', String(filters.dateFrom));
    if (filters.dateTo) qs.set('dateTo', String(filters.dateTo));
    if (filters.latlong) qs.set('latlong', String(filters.latlong));
    if (filters.radius) qs.set('radius', String(filters.radius));
    if (filters.unit) qs.set('unit', String(filters.unit));
    if (filters.venueId) qs.set('venueId', String(filters.venueId));
    if (filters.attractionId) qs.set('attractionId', String(filters.attractionId));
    if (filters.dmaId) qs.set('dmaId', String(filters.dmaId));
    if (filters.marketId) qs.set('marketId', String(filters.marketId));
    qs.set('sort', sort);
    qs.set('page', page);
    qs.set('size', size);
  };

  // Prepare up to two attempts to avoid 429:
  // A) strict city + best country
  // B) fallback keyword + best country (TM umí najít i městské části / širší okolí)
  const attempts = [];
  if (tmCity) {
    attempts.push({ mode: 'city', city: tmCity, countryCode: explicitCountry || guessedCC || '' });
    attempts.push({ mode: 'keyword', keyword: tmCity, countryCode: explicitCountry || guessedCC || '' });
  } else {
    // no city filter -> respect explicit country if supplied (else none)
    attempts.push({ mode: 'broad', countryCode: explicitCountry || '' });
  }

  for (const loc of locales) {
    for (const attempt of attempts) {
      const qs = new URLSearchParams();
      putCommonParams(qs);

      // locale first (TM sometimes changes matching by locale)
      qs.set('locale', loc);

      // countryCode rules
      if (attempt.countryCode) {
        qs.set('countryCode', attempt.countryCode);
      } else if (!tmCity && explicitCountry) {
        qs.set('countryCode', explicitCountry);
      }

      // city/keyword according to attempt
      if (attempt.mode === 'city') {
        qs.set('city', attempt.city);
      } else if (attempt.mode === 'keyword' && attempt.keyword) {
        // keep any user keyword? Prefer city as keyword if no explicit user keyword set
        if (!filters.keyword) qs.set('keyword', attempt.keyword);
      }

      const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;
      console.info(
        '[TM adapter] GET',
        url,
        '| desired city =', rawCity || '(none)',
        '| using =', attempt.mode
      );

      try {
        const res = await fetch(url);
        if (!res.ok) {
          // handle 429 gracefully by moving to next attempt/locale
          if (res.status === 429) continue;
          // other errors: try next attempt/locale
          continue;
        }
        const data = await res.json();
        const list = data?._embedded?.events || [];
        if (!list.length) continue;

        // Map to FE shape
        return list.map(ev => {
          const cat = mapSegmentToCategory(ev);
          const dt =
            ev?.dates?.start?.dateTime ||
            ev?.dates?.start?.localDate ||
            ev?.dates?.start?.dateTBD ||
            '';

          const img =
            (ev?.images || [])
              .filter(im => im?.url)
              .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';

          const venue = ev?._embedded?.venues?.[0] || {};
          const cityRaw = venue?.city?.name || '';
          const country = venue?.country?.countryCode || '';
          const lat = Number(venue?.location?.latitude ?? venue?.location?.lat ?? '');
          const lon = Number(venue?.location?.longitude ?? venue?.location?.lon ?? '');

          // Keep venue-reported city as-is (užitečné pro městské části)
          const city = cityRaw;

          const desc = [ev?.info, ev?.pleaseNote].filter(Boolean).join(' — ');

          return {
            id: `ticketmaster-${ev.id}`,
            title: { [loc]: ev.name },
            description: { [loc]: desc },
            category: cat,
            datetime: dt,
            location: { city, country, lat, lon },
            image: img,
            partner: 'ticketmaster',
            url: ev.url || '',
            tickets: ev.url || '',
            priceFrom: null,
            promo: null
          };
        });
      } catch (err) {
        console.error('[Ticketmaster adapter] fetch error for locale:', loc, attempt, err);
        // try next attempt/locale
      }
    }
  }

  return [];
}
