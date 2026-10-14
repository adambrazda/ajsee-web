const FALLBACK_URL = 'https://colosseumticket.cz/';

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

function normalizeHost(hostname = '') {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

function sanitizeDestination(rawUrl = '') {
  let parsed;

  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:') {
    return '';
  }

  if (normalizeHost(parsed.hostname) !== 'colosseumticket.cz') {
    return '';
  }

  if (parsed.username || parsed.password) {
    return '';
  }

  if (parsed.port && parsed.port !== '443') {
    return '';
  }

  // Never trust a client-supplied affiliate identifier.
  parsed.searchParams.delete('a_box');

  return parsed.toString();
}

function getAffiliateBox() {
  const value = String(
    process.env.COLOSSEUMTICKET_A_BOX || ''
  ).trim();

  return /^[A-Za-z0-9_-]+$/.test(value)
    ? value
    : '';
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};
  const destination = sanitizeDestination(q.to || q.url || '');

  if (!destination) {
    return redirect(FALLBACK_URL);
  }

  const target = new URL(destination);
  const affiliateBox = getAffiliateBox();

  if (affiliateBox) {
    target.searchParams.set('a_box', affiliateBox);
  } else {
    console.warn(
      '[colosseumOutbound] COLOSSEUMTICKET_A_BOX is missing or invalid; using direct seller URL.'
    );
  }

  return redirect(target.toString());
};
