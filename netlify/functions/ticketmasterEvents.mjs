// Netlify Function: Ticketmaster Discovery API proxy
// - čte query: sort, page, size, locale, countryCode, city, keyword,
//              nearMeLat, nearMeLon, nearMeRadiusKm
// - vyžaduje env: TM_API_KEY (nebo TICKETMASTER_API_KEY – viz fallback)

const TM_API_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';

function mapLangToTm(l) {
  const m = { cs: 'cs-cz', sk: 'sk-sk', pl: 'pl-pl', de: 'de-de', hu: 'hu-hu', en: 'en-gb' };
  const k = (l || 'en').slice(0, 2);
  return m[k] || 'en-gb';
}

function ok(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
function err(message, status = 500, extra = {}) {
  return ok({ error: message, ...extra }, status);
}

export async function handler(event) {
  try {
    const {
      sort = 'date,asc',
      page = '0',
      size = '12',
      locale = 'cs',
      countryCode = 'CZ',
      city = '',
      keyword = '',
      nearMeLat = '',
      nearMeLon = '',
      nearMeRadiusKm = ''
    } = event.queryStringParameters || {};

    const API_KEY =
      process.env.TM_API_KEY ||
      process.env.TICKETMASTER_API_KEY ||
      process.env.TICKETMASTER_KEY; // poslední fallback

    if (!API_KEY) {
      return err('Missing Ticketmaster API key (set TM_API_KEY)', 500);
    }

    const url = new URL(TM_API_BASE);
    url.searchParams.set('apikey', API_KEY);
    url.searchParams.set('size', String(Math.max(1, Math.min(+size || 12, 200))));
    url.searchParams.set('page', String(Math.max(0, +page || 0)));
    url.searchParams.set('sort', sort);
    url.searchParams.set('locale', mapLangToTm(locale));
    if (countryCode) url.searchParams.set('countryCode', countryCode.toUpperCase());
    if (keyword) url.searchParams.set('keyword', keyword);
    if (city) url.searchParams.set('city', city);

    // near me (Discovery API: latlong + radius + unit)
    const lat = parseFloat(nearMeLat);
    const lon = parseFloat(nearMeLon);
    const rad = parseFloat(nearMeRadiusKm);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      url.searchParams.set('latlong', `${lat},${lon}`);
      if (Number.isFinite(rad)) url.searchParams.set('radius', String(Math.max(1, Math.min(rad, 200))));
      url.searchParams.set('unit', 'km');
    }

    // Volání TM Discovery
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });

    // Pokud Ticketmaster vrátí chybu, předejme čitelně dál (ne 500 bez vysvětlení)
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return err('Ticketmaster upstream error', res.status, { upstream: text.slice(0, 2000) });
    }

    const data = await res.json();

    // Normalize „no data“ → prázdné pole, ať se frontend nezhroutí
    if (!data || !data._embedded || !Array.isArray(data._embedded.events)) {
      return ok({ _embedded: { events: [] }, page: data?.page || { size, totalElements: 0, totalPages: 0, number: page } });
    }

    return ok(data);
  } catch (e) {
    // Chyby funkce – vrať srozumitelně
    return err('Function error', 500, { detail: String(e && e.message ? e.message : e) });
  }
}
