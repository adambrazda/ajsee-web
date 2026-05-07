// netlify/functions/go.js
// ---------------------------------------------------------
// AJSEE shortlinks from published Google Sheets CSV
//
// Usage:
//   /go/eros-ramazzotti
//
// Reads public CSV with columns:
// slug,to,eid,cc,source,placement,active,note
//
// Redirects to:
//   /.netlify/functions/tmOutbound?to=...&eid=...&cc=...&source=...&placement=...
// ---------------------------------------------------------

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSoZ0lZ2Ru14L8vCWupU9PW2a4s0tu_Rue0tyWwqxQdAtoehZs9YfapBNvmoZ7Iv_NZx1MtbHRWYat5/pub?gid=0&single=true&output=csv';

const FALLBACK_URL = 'https://ajsee.cz/events';

function redirect(location, statusCode = 302) {
  return {
    statusCode,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    body: '',
  };
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function cleanSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^go\//, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isActive(value = '') {
  const v = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'ano', 'active', 'aktivni', 'aktivní'].includes(v);
}

// Simple CSV parser supporting quoted commas.
function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;

      row.push(cell);
      cell = '';

      if (row.some((v) => String(v || '').trim() !== '')) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);

  if (row.some((v) => String(v || '').trim() !== '')) {
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || '').trim());

  return rows.slice(1).map((values) => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = String(values[index] || '').trim();
    });

    return item;
  });
}

async function loadRows() {
  const res = await fetch(`${CSV_URL}&cacheBust=${Date.now()}`, {
    headers: {
      Accept: 'text/csv,text/plain,*/*',
      'User-Agent': 'AJSEE Shortlinks',
    },
  });

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status}`);
  }

  const text = await res.text();
  return parseCsv(text);
}

function buildOutboundUrl(row) {
  const to = String(row.to || '').trim();

  if (!to) return '';

  let parsed;

  try {
    parsed = new URL(to);
  } catch {
    return '';
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return '';
  }

  const qs = new URLSearchParams();
  qs.set('to', parsed.toString());

  if (row.eid) qs.set('eid', row.eid);
  if (row.cc) qs.set('cc', String(row.cc).toUpperCase());
  qs.set('source', row.source || 'ig_story');
  qs.set('placement', row.placement || 'shortlink');

  return `/.netlify/functions/tmOutbound?${qs.toString()}`;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};
  const rawSlug =
    q.slug ||
    event.path.split('/').filter(Boolean).pop() ||
    '';

  const slug = cleanSlug(rawSlug);

  if (!slug) {
    return redirect(FALLBACK_URL);
  }

  try {
    const rows = await loadRows();

    const row = rows.find((item) => {
      return cleanSlug(item.slug) === slug && isActive(item.active);
    });

    if (!row) {
      return redirect(FALLBACK_URL);
    }

    const outboundUrl = buildOutboundUrl(row);

    if (!outboundUrl) {
      return redirect(FALLBACK_URL);
    }

    return redirect(outboundUrl);
  } catch (err) {
    console.error('[go] shortlink error:', err);
    return redirect(FALLBACK_URL);
  }
};