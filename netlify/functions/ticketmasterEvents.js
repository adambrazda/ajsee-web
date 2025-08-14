// /netlify/functions/ticketmasterEvents.js
// ---------------------------------------------------------
// Netlify proxy for Ticketmaster Discovery API (ESM + Lambda-compatible return)
// - normalizes city aliases (Praha/Prague/Prag/Praga -> Prague, Praha 1..10 -> Prague)
// - safe date parsing
// - fallback retry with keyword if "city" returns no events
// ---------------------------------------------------------

/** Remove diacritics & normalize */
function norm(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse districts etc. -> base city (praha 1..10 => praha) */
function baseCity(raw = '') {
  let n = norm(raw);
  // Praha {1..10} / Praha I..X
  n = n.replace(/^praha\s+([ivxlcdm]+|\d+)\b.*$/, 'praha');
  // Prague {1..10}
  n = n.replace(/^prague\s+\d+\b.*$/, 'prague');
  return n;
}

/** Canonicalize to EN names that Ticketmaster spolehlivě zná */
function canonicalCity(raw = '') {
  const n = baseCity(raw);

  // CZ/SK/AT/DE/PL/HU – nejčastější aliasy
  if (/^(praha|prague|prag|praga)\b/.test(n)) return 'Prague';
  if (/^(vienna|wien|viden|v%C3%ADde%C5%88|v%C3%ADde%C5%88|viden)\b/.test(n)) return 'Vienna';
  if (/^(munich|muenchen|munch|munchen|muench|muench|mnichov|m%C3%BCnchen|m%C3%BCnch)\b/.test(n)) return 'Munich';
  if (/^bratislava\b/.test(n)) return 'Bratislava';
  if (/^brno\b/.test(n)) return 'Brno';
  if (/^ostrava\b/.test(n)) return 'Ostrava';
  if (/^(warszawa|warsaw|varsava|var%C5%A1ava|warschau)\b/.test(n)) return 'Warsaw';
  if (/^(wroclaw|wroc%C5%82aw|wroclaw)\b/.test(n)) return 'Wroclaw';
  if (/^(krakow|krak%C3%B3w|krakov)\b/.test(n)) return 'Krakow';
  if (/^budapest\b/.test(n)) return 'Budapest';

  // fallback – vrať původní, ale bez period/čárek apod.
  return raw.toString().trim();
}

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

async function callTM(url) {
  const resp = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  const text = await resp.text();
  return { status: resp.status, text };
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

    const canonical = canonicalCity(q.city || '');

    // Base URL
    const url = new URL(`${BASE}/events.json`);
    url.searchParams.set('apikey', API_KEY);

    // Locale & country
    const countryCode = q.countryCode || 'CZ';
    const locale = q.locale || 'cs'; // necháme projít z FE, není to limitující
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

    // City – pošleme kanon v EN (řeší Praha/Prague/Prag/Praga a Praha 1..10)
    if ((q.city || '').trim()) {
      url.searchParams.set('city', canonical);
    }

    const finalUrl = url.toString();
    console.log('[ticketmasterEvents] →', finalUrl);

    // 1) Primární dotaz
    let { status, text } = await callTM(url);

    // 2) Fallback: když 0 výsledků a máme city, zkus keyword=canonical
    if (status === 200) {
      try {
        const json = JSON.parse(text);
        if (!json?._embedded?.events?.length && (q.city || '').trim()) {
          const url2 = new URL(finalUrl);
          url2.searchParams.delete('city');
          url2.searchParams.set('keyword', canonical);
          console.log('[ticketmasterEvents] fallback →', url2.toString());
          const resp2 = await callTM(url2);
          status = resp2.status;
          text = resp2.text;
        }
      } catch { /* ignore parse errors, return raw */ }
    }

    return {
      statusCode: status,
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
