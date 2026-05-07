// netlify/edge-functions/geo-lookup.js
// ---------------------------------------------------------
// AJSEE geo lookup endpoint
//
// Jednoduchý EDGE endpoint vracející IP a Geo z Netlify contextu.
// Používá se jako fallback pro "Near me" a případně pro debug.
// ---------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  'https://ajsee.cz',
  'https://www.ajsee.cz',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

export default (request, context) => {
  const url = new URL(request.url);
  const cors = corsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Cache-Control': 'no-store'
      }
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...cors,
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }

  const {
    country = {},
    subdivision = {},
    city = '',
    latitude = null,
    longitude = null
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
      longitude
    },
    userAgent: request.headers.get('user-agent') || '',
    path: url.pathname,
    query: url.search
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...cors,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
};