// /src/adapters/ticketmaster.js
// ---------------------------------------------------------
// Ticketmaster Discovery API adapter (via Netlify function proxy)
// Supports: city, keyword, segmentName, classificationName, dateFrom/To,
// page, size, sort (nearest/latest), plus optional geo/ids.
// ---------------------------------------------------------

import { canonForInputCity, guessCountryCodeFromCity } from '../city/canonical.js';

/** Map UI sort to TM sort string */
function toTmSort(sortUi) {
  if (sortUi === 'latest')  return 'date,desc';
  if (sortUi === 'nearest') return 'date,asc';
  // bezpečný default
  return 'date,asc';
}

/** Convert user-input city to a Ticketmaster-friendly EN name (if máš mapu) */
function toTmCity(raw = '') {
  const c = canonForInputCity?.(raw);
  return (c && String(c)) || String(raw || '').trim();
}

/** Normalize TM segment to our internal category */
function mapSegmentToCategory(ev) {
  const seg     = ev?.classifications?.[0]?.segment?.name || '';
  const genre   = ev?.classifications?.[0]?.genre?.name || '';
  const subGen  = ev?.classifications?.[0]?.subGenre?.name || '';
  const name    = ev?.name || '';
  const hasFest = /festival/i.test(genre) || /festival/i.test(subGen) || /festival/i.test(name);

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

/** Pick sensible date string (avoid boolean dateTBD) */
function pickDate(ev) {
  const dt = ev?.dates?.start || {};
  if (dt.dateTime) return dt.dateTime;              // ISO
  if (dt.localDate && dt.localTime) return `${dt.localDate}T${dt.localTime}`;
  if (dt.localDate) return dt.localDate;            // YYYY-MM-DD
  return '';                                        // unknown
}

/** Safely pick biggest image URL */
function pickImage(ev) {
  const img =
    (ev?.images || [])
      .filter(im => im?.url)
      .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
  return img;
}

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  // country může být zadána jako countryCode i country
  const explicitCountry = String(filters.countryCode || filters.country || '').toUpperCase();

  // City + guessed country
  const rawCity   = String(filters.city || '').trim();
  const tmCity    = rawCity ? toTmCity(rawCity) : '';
  const guessedCC = rawCity ? (guessCountryCodeFromCity?.(rawCity) || '') : '';

  // vyzkoušíme pár locales (někdy TM vrací víc s en/cs*)
  const locales = [locale, 'cs', 'en'].filter((v, i, arr) => !!v && arr.indexOf(v) === i);

  const sort = toTmSort(filters.sort);
  const page = Number.isFinite(+filters.page) ? String(+filters.page) : '0';
  const size = Number.isFinite(+filters.size) ? String(+filters.size) : '12';

  const segmentMap = {
    concert:  'Music',
    sport:    'Sports',
    theatre:  'Arts & Theatre',
    festival: 'Arts & Theatre',
  };
  const segmentName = filters.category ? (segmentMap[filters.category] || '') : '';

  const putCommonParams = (qs) => {
    if (filters.keyword)            qs.set('keyword', String(filters.keyword));
    if (segmentName)                qs.set('segmentName', segmentName);
    if (filters.classificationName) qs.set('classificationName', String(filters.classificationName));
    if (filters.dateFrom)           qs.set('dateFrom', String(filters.dateFrom));
    if (filters.dateTo)             qs.set('dateTo', String(filters.dateTo));

    // GEO: prefer explicit latlong; fallback z nearMeLat/nearMeLon
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

    if (filters.venueId)            qs.set('venueId', String(filters.venueId));
    if (filters.attractionId)       qs.set('attractionId', String(filters.attractionId));
    if (filters.dmaId)              qs.set('dmaId', String(filters.dmaId));
    if (filters.marketId)           qs.set('marketId', String(filters.marketId));

    qs.set('sort', sort);
    qs.set('page', page);
    qs.set('size', size);
  };

  // Připrav pokusy:
  // A) city – přesnější; (countryCode k city neposíláme)
  // B) keyword=city (+ country pokud známe)
  // C) široké vyhledávání s country, když není city (default CZ pro český web)
  const attempts = [];
  if (tmCity) {
    attempts.push({ mode: 'city',    city: tmCity,    countryCode: '' }); // k city ne
    attempts.push({ mode: 'keyword', keyword: tmCity, countryCode: explicitCountry || guessedCC || '' });
  } else {
    attempts.push({ mode: 'broad', countryCode: explicitCountry || 'CZ' });
  }

  // Dedup pokusů podle (mode, city/keyword, countryCode)
  const keyOf = (a) => `${a.mode}|${a.city || a.keyword || ''}|${a.countryCode || ''}`;
  const seen = new Set();
  const uniqAttempts = attempts.filter(a => (seen.has(keyOf(a)) ? false : (seen.add(keyOf(a)), true)));

  const hasGeo = !!(filters.latlong || (filters.nearMeLat != null && filters.nearMeLon != null));

  for (const locTry of locales) {
    for (const attempt of uniqAttempts) {
      const qs = new URLSearchParams();
      putCommonParams(qs);
      qs.set('locale', locTry);

      // countryCode posíláme jen pokud:
      // - nemáme geo
      // - a režim není "city"
      if (!hasGeo && attempt.countryCode && attempt.mode !== 'city') {
        qs.set('countryCode', attempt.countryCode);
      }

      if (attempt.mode === 'city') {
        qs.set('city', attempt.city);
      } else if (attempt.mode === 'keyword' && attempt.keyword && !filters.keyword) {
        qs.set('keyword', attempt.keyword);
      }

      const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;
      console.info('[TM adapter] GET', url, '| desired city =', rawCity || '(none)', '| using =', attempt.mode);

      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 429) continue; // přejdi na další pokus/locale
          continue;
        }

        const data = await res.json();
        const list = data?._embedded?.events || [];
        if (!Array.isArray(list) || !list.length) continue;

        // Map to FE shape
        return list.map(ev => {
          const cat = mapSegmentToCategory(ev);
          const dt  = pickDate(ev);
          const img = pickImage(ev);

          const venue   = ev?._embedded?.venues?.[0] || {};
          const city    = venue?.city?.name || '';
          const country = venue?.country?.countryCode || '';
          const latRaw  = venue?.location?.latitude ?? venue?.location?.lat ?? '';
          const lonRaw  = venue?.location?.longitude ?? venue?.location?.lon ?? '';
          const lat     = Number.isFinite(+latRaw) ? +latRaw : undefined;
          const lon     = Number.isFinite(+lonRaw) ? +lonRaw : undefined;
          const desc    = [ev?.info, ev?.pleaseNote].filter(Boolean).join(' — ');
          const price   = Array.isArray(ev?.priceRanges) && ev.priceRanges.length
            ? (ev.priceRanges[0]?.min ?? null)
            : null;

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
            url: ev.url || '',
            tickets: ev.url || '',
            priceFrom: price,
            promo: null
          };
        });
      } catch (err) {
        console.error('[Ticketmaster adapter] fetch error for locale:', locTry, attempt, err);
        // zkus další pokus/locale
      }
    }
  }

  return [];
}

export default { fetchEvents };
