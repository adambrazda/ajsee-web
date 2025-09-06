// netlify/functions/moderate-comment.js
// jednoduché “API” pro označení spam/ham/delete — chráněno vlastním API klíčem
export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*', // zvaž omezení
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  try {
    const TOKEN = process.env.NETLIFY_API_TOKEN;
    const API_KEY = process.env.MODERATION_API_KEY; // nastav v Netlify → Site settings → Environment
    if (!TOKEN || !API_KEY) {
      return { statusCode: 500, headers: cors, body: 'Missing NETLIFY_API_TOKEN or MODERATION_API_KEY' };
    }

    // jednoduchá autentizace
    const provided = event.headers['x-api-key'] || event.headers['X-Api-Key'];
    if (provided !== API_KEY) {
      return { statusCode: 401, headers: cors, body: 'Unauthorized' };
    }

    const { id, action } = JSON.parse(event.body || '{}');
    if (!id || !action) {
      return { statusCode: 400, headers: cors, body: 'Missing id or action' };
    }

    const methodMap = {
      spam:   { path: `/submissions/${id}/spam`,   method: 'PUT' },
      ham:    { path: `/submissions/${id}/ham`,    method: 'PUT' },
      delete: { path: `/submissions/${id}`,        method: 'DELETE' },
    };
    const conf = methodMap[action];
    if (!conf) return { statusCode: 400, headers: cors, body: 'Invalid action' };

    const res = await fetch(`https://api.netlify.com/api/v1${conf.path}`, {
      method: conf.method,
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: res.status, headers: cors, body: `Netlify API error: ${txt}` };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: `Error: ${err.message}` };
  }
}
