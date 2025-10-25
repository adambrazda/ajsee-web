// /src/events.js

/**
 * Načte eventy z vašeho Netlify proxy endpointu a (volitelně) aplikuje filtry.
 * Vracejí se jednoduché objekty připravené pro výpis.
 *
 * Endpoint očekává stejné parametry, které používá FE adapter:
 * - city, keyword, segmentName, classificationName, dateFrom, dateTo,
 *   latlong ("lat,lon"), radius, unit ("km" | "miles"), page, size, sort, locale, countryCode...
 */

function toTmSort(sortUi) {
  if (sortUi === 'latest') return 'date,desc';
  if (sortUi === 'nearest') return 'date,asc';
  return sortUi || 'date,asc';
}

const SEGMENT_MAP = {
  concert: 'Music',
  sport: 'Sports',
  theatre: 'Arts & Theatre',
  festival: 'Arts & Theatre', // festival se dá lépe chytat přes classification/genre, ale jako základ OK
};

function mapFiltersToSearchParams({ filters = {}, country = 'CZ', locale = 'cs', size = 24, page = 0 }) {
  const qs = new URLSearchParams();

  // základ
  qs.set('locale', String(locale || 'cs'));
  if (country) qs.set('countryCode', String(country).toUpperCase());
  qs.set('sort', toTmSort(filters.sort));
  qs.set('page', String(page));
  qs.set('size', String(size));

  // mapování UI -> TM
  const seg = filters.category ? SEGMENT_MAP[filters.category] : '';
  if (seg) qs.set('segmentName', seg);

  if (filters.city) qs.set('city', String(filters.city));
  if (filters.keyword) qs.set('keyword', String(filters.keyword));

  if (filters.dateFrom) qs.set('dateFrom', String(filters.dateFrom));
  if (filters.dateTo) qs.set('dateTo', String(filters.dateTo));

  if (filters.nearMeLat != null && filters.nearMeLon != null) {
    qs.set('latlong', `${filters.nearMeLat},${filters.nearMeLon}`);
    qs.set('radius', String(filters.nearMeRadiusKm || 50));
    qs.set('unit', 'km');
  }

  return qs;
}

/**
 * @param {Object} options
 * @param {string} options.country - Kód země (např. 'CZ')
 * @param {string} options.locale  - Jazyk (např. 'cs')
 * @param {Object} options.filters - Volitelné filtry (viz výše)
 * @param {number} options.size    - Počet výsledků
 * @param {number} options.page    - Stránka (0-based)
 */
export async function fetchTicketmasterEvents({
  country = 'CZ',
  locale = 'cs',
  filters = {},
  size = 24,
  page = 0,
} = {}) {
  const qs = mapFiltersToSearchParams({ filters, country, locale, size, page });
  const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chyba načítání událostí z API (HTTP ${res.status})`);
  const data = await res.json();

  // Transformace Ticketmaster struktury na jednoduchý formát
  const list = data?._embedded?.events || [];
  return list.map((event) => {
    const venue = event?._embedded?.venues?.[0] || {};
    const img =
      (event?.images || [])
        .filter((i) => i?.url)
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';

    const seg = event?.classifications?.[0]?.segment?.name || '';
    const genre = event?.classifications?.[0]?.genre?.name || '';
    const subGenre = event?.classifications?.[0]?.subGenre?.name || '';
    const name = event?.name || '';

    const hasFestivalHint = /festival/i.test(genre) || /festival/i.test(subGenre) || /festival/i.test(name);
    let category = 'other';
    if (seg === 'Music') category = hasFestivalHint ? 'festival' : 'concert';
    else if (seg === 'Sports') category = 'sport';
    else if (seg === 'Arts & Theatre') category = hasFestivalHint ? 'festival' : 'theatre';

    const start =
      event?.dates?.start?.dateTime ||
      event?.dates?.start?.localDate ||
      event?.dates?.start?.dateTBD ||
      '';

    return {
      id: `ticketmaster-${event.id}`,
      title: { [locale]: event.name },
      description: { [locale]: [event?.info, event?.pleaseNote].filter(Boolean).join(' — ') },
      category,
      datetime: start,
      location: {
        city: venue?.city?.name || '',
        country: venue?.country?.countryCode || '',
        lat: Number(venue?.location?.latitude ?? venue?.location?.lat ?? ''),
        lon: Number(venue?.location?.longitude ?? venue?.location?.lon ?? ''),
      },
      image: img,
      partner: 'ticketmaster',
      url: event.url || '',
      tickets: event.url || '',
      priceFrom: null,
      promo: null,
    };
  });
}

/**
 * Demo badge (volitelně)
 */
export function showDemoBadge(isDemo) {
  let badge = document.getElementById('demo-badge');
  if (isDemo) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'demo-badge';
      badge.innerHTML = 'Testovací provoz: <b>Demo akce</b>';
      badge.style = 'position:fixed;bottom:18px;left:18px;z-index:99;background:#ffecc3;color:#333;padding:8px 18px;border-radius:10px;box-shadow:0 2px 8px #0001;font-size:1rem;';
      document.body.appendChild(badge);
    } else {
      badge.style.display = 'block';
    }
  } else if (badge) {
    badge.style.display = 'none';
  }
}
