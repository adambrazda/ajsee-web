// netlify/edge-functions/geo-lookup.js
// Jednoduchý EDGE endpoint vracející IP a Geo z contextu (pro debug/telemetrii)

export default (request, context) => {
  const url = new URL(request.url);
  const origin = request.headers.get('origin') || '*';

  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const {
    country = {},
    subdivision = {},
    city = '',
    latitude = null,
    longitude = null,
  } = context.geo || {};

  const data = {
    ip: context.ip || '',
    geo: {
      countryCode: country.code || '',
      countryName: country.name || '',
      subdivisionCode: subdivision.code || '',
      subdivisionName: subdivision.name || '',
      city,
      latitude,
      longitude,
    },
    userAgent: request.headers.get('user-agent') || '',
    path: url.pathname,
    query: url.search,
  };

  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'Access-Control-Allow-Origin': origin,
    },
  });
};
