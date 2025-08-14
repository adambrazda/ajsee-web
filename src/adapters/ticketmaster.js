// /src/adapters/ticketmaster.js
// ---------------------------------------------------------
// Ticketmaster Discovery API adapter (via Netlify function proxy)
// Supports: city, keyword, segmentName, classificationName, dateFrom/To,
// page, size, sort (nearest/latest), plus optional geo/ids.
// ---------------------------------------------------------

/** Normalize to basic (for local equality checks) */
function normBasic(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  .trim();
}

/** Canonical city (must mirror server behavior for best UX labels) */
function canonicalCityLabel(raw = '') {
  const n = normBasic(raw).replace(/^praha\s+([ivxlcdm]+|\d+)\b.*$/, 'praha').replace(/^prague\s+\d+\b.*$/, 'prague');
  if (/^(praha|prague|prag|praga)\b/.test(n)) return 'Prague';
  if (/^(vienna|wien|viden|v%C3%ADde%C5%88|viden)\b/.test(n)) return 'Vienna';
  if (/^(munich|muenchen|mnichov|m%C3%BCnchen)\b/.test(n)) return 'Munich';
  if (/^bratislava\b/.test(n)) return 'Bratislava';
  if (/^brno\b/.test(n)) return 'Brno';
  if (/^ostrava\b/.test(n)) return 'Ostrava';
  if (/^(warszawa|warsaw|warschau|varsava)\b/.test(n)) return 'Warsaw';
  if (/^(wroclaw|wroc%C5%82aw)\b/.test(n)) return 'Wroclaw';
  if (/^(krakow|krak%C3%B3w|krakov)\b/.test(n)) return 'Krakow';
  if (/^budapest\b/.test(n)) return 'Budapest';
  return raw.toString().trim();
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

/** Map UI sort to TM sort string */
function toTmSort(sortUi) {
  if (sortUi === 'latest') return 'date,desc';
  if (sortUi === 'nearest') return 'date,asc';
  return sortUi || 'date,asc';
}

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  const countryCode = (filters.countryCode || 'CZ').toUpperCase();

  const qs = new URLSearchParams();
  qs.set('countryCode', countryCode);

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

  if (filters.keyword) qs.set('keyword', String(filters.keyword));
  if (filters.city) qs.set('city', String(filters.city)); // server si to kanonizuje
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

  for (const loc of locales) {
    qs.set('locale', loc);
    const url = `/.netlify/functions/ticketmasterEvents?${qs.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const list = data?._embedded?.events || [];
      if (!list.length) continue;

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

        const cityRaw = ev?._embedded?.venues?.[0]?.city?.name || '';
        const country = ev?._embedded?.venues?.[0]?.country?.countryCode || '';

        // sjednocená label hodnota, aby FE filtr (contains) nepadal na Praha/Prague
        const city = canonicalCityLabel(cityRaw);

        const desc = [ev?.info, ev?.pleaseNote].filter(Boolean).join(' — ');

        return {
          id: `ticketmaster-${ev.id}`,
          title: { [loc]: ev.name },
          description: { [loc]: desc },
          category: cat,
          datetime: dt,
          location: { city, country },
          image: img,
          partner: 'ticketmaster',
          url: ev.url || '',
          tickets: ev.url || '',
          priceFrom: null,
          promo: null
        };
      });
    } catch (err) {
      console.error('[Ticketmaster adapter] fetch error for locale:', loc, err);
    }
  }

  return [];
}
