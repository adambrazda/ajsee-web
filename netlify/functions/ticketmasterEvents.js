// /netlify/functions/ticketmasterEvents.js
// ---------------------------------------------------------
// Netlify proxy for Ticketmaster Discovery API (ESM + Lambda-compatible return)
// ---------------------------------------------------------

/**
 * Parse UI date formats to ISO8601:
 * - "YYYY-MM-DD"  -> start of day 00:00:00Z
 * - "dd.mm.yyyy"  -> start of day 00:00:00Z
 * If `endOfDay=true`, returns ...T23:59:59Z.
 */
function toIsoDay(dateStr, endOfDay = false) {
  if (!dateStr) return '';
  let y, m, d;

  const reIso = /^(\d{4})-(\d{2})-(\d{2})$/;      // YYYY-MM-DD
  const reCz  = /^(\d{2})\.(\d{2})\.(\d{4})$/;    // dd.mm.yyyy

  if (reIso.test(dateStr)) {
    const m1 = dateStr.match(reIso);
    y = m1[1]; m = m1[2]; d = m1[3];
  } else if (reCz.test(dateStr)) {
    const m2 = dateStr.match(reCz);
    d = m2[1]; m = m2[2]; y = m2[3];
  } else {
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return '';
    const res = new Date(
      Date.UTC(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate(),
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0
      )
    );
    return res.toISOString();
  }

  const hh = endOfDay ? '23' : '00';
  const mm = endOfDay ? '59' : '00';
  const ss = endOfDay ? '59' : '00';
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
}

export const handler = async (event) => {
  try {
    const q = event?.queryStringParameters || {};

    const API_KEY =
      process.env.TICKETMASTER_API_KEY ||
      process.env.TM_API_KEY;

    if (!API_KEY) {
      console.error('[ticketmasterEvents] Missing API key');
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'TM_API_KEY not set' })
      };
    }

    const BASE =
      process.env.TM_BASE_URL ||
      'https://app.ticketmaster.com/discovery/v2';

    // Base URL
    const url = new URL(`${BASE}/events.json`);
    url.searchParams.set('apikey', API_KEY);

    // Locale & country
    const countryCode = q.countryCode || 'CZ';
    const locale = q.locale || 'cs';
    url.searchParams.set('countryCode', countryCode);
    url.searchParams.set('locale', locale);

    // Sort mapping
    const toTmSort = (s) => {
      if (s === 'nearest') return 'date,asc';
      if (s === 'latest')  return 'date,desc';
      return s || 'date,asc';
    };
    url.searchParams.set('sort', toTmSort(q.sort));

    // Segment mapping (segmentName/segment)
    const segmentValue = q.segmentName || q.segment || '';
    if (segmentValue) url.searchParams.set('segmentName', segmentValue);

    // Date range
    const startDateTime = q.startDateTime || toIsoDay(q.dateFrom, false);
    const endDateTime   = q.endDateTime   || toIsoDay(q.dateTo,   true);
    if (startDateTime) url.searchParams.set('startDateTime', startDateTime);
    if (endDateTime)   url.searchParams.set('endDateTime', endDateTime);

    // Whitelisted passthrough params
    const passthrough = [
      'keyword',
      'city',
      'classificationName',
      'venueId',
      'attractionId',
      'dmaId',
      'marketId',
      'latlong',
      'radius',
      'unit',
      'page',
      'size'
    ];

    for (const key of passthrough) {
      if (q[key] === undefined || q[key] === null || q[key] === '') continue;
      if (key === 'size') {
        const n = Math.max(1, Math.min(200, parseInt(q[key], 10) || 50));
        url.searchParams.set('size', String(n));
      } else {
        url.searchParams.set(key, String(q[key]));
      }
    }

    const finalUrl = url.toString();
    console.log('[ticketmasterEvents] →', finalUrl);

    const resp = await fetch(finalUrl);
    const text = await resp.text(); // předáme raw JSON od TM

    return {
      statusCode: resp.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*'
      },
      body: text
    };
  } catch (err) {
    console.error('[ticketmasterEvents] Error:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: err?.message || String(err) })
    };
  }
};
