// netlify/functions/tm.js
// Ticketmaster CORS proxy (GET + preflight). Umí:
// - path=events.json  → /discovery/v2/events.json
// - path=/discovery/v2/events.json (funguje také)
// - předá všechny ostatní query parametry (size, sort, startDateTime, countryCode, …)
// - API klíč bere z env TM_API_KEY (fallback: ?apikey= v URL)

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const q = event.queryStringParameters || {};
  const rawPath = (q.path || 'events.json').toString();

  // Normalizace cesty:
  // - když začíná na '/', použij ji tak, jak je
  // - jinak ji považuj za endpoint pod /discovery/v2/
  let path = rawPath.startsWith('/') ? rawPath : `/discovery/v2/${rawPath}`;

  // Bezpečnostní omezení – povolíme jen Discovery API
  if (!path.startsWith('/discovery/')) {
    return {
      statusCode: 400,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Invalid path' }),
    };
  }

  const url = new URL(`https://app.ticketmaster.com${path}`);

  // Zkopíruj všechny query parametry kromě 'path' a 'apikey' (apikey vyřešíme níže)
  Object.entries(q).forEach(([k, v]) => {
    if (k === 'path' || k === 'apikey' || v == null) return;
    url.searchParams.set(k, String(v));
  });

  // API Key: z env (preferováno), fallback z příchozího ?apikey= jen pro lokální test
  const apiKey = process.env.TM_API_KEY || q.apikey;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Missing TM_API_KEY environment variable' }),
    };
  }
  url.searchParams.set('apikey', apiKey);

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    const bodyText = await resp.text();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      'content-type': resp.headers.get('content-type') || 'application/json; charset=utf-8',
      // malý cache na edge / CDN
      'cache-control': 'public, max-age=300',
    };

    return { statusCode: resp.status, headers, body: bodyText };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ error: 'Proxy error', detail: String(err) }),
    };
  }
};
