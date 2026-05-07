// netlify/edge-functions/geo-country.js
// ---------------------------------------------------------
// AJSEE Geo country edge function
//
// Cíl:
// - Nastavit / aktualizovat cookie "aj_country" podle Geo IP nebo lang.
// - Používat stejný název cookie, který čte frontend v main.js / events-entry.js.
// - Zachovat kompatibilitu se starou cookie "ajsee_cc" a postupně ji uklidit.
// - Nastavovat cookie pouze pro HTML odpovědi.
// - Nedotýkat se API / Netlify functions / assetů.
// ---------------------------------------------------------

const COOKIE_NAME = 'aj_country';
const LEGACY_COOKIE_NAME = 'ajsee_cc';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dní

export default async (request, context) => {
  const url = new URL(request.url);

  // Neřešíme API, Netlify functions, shortlinky ani assety.
  // Edge function má smysl jen pro HTML stránky.
  if (shouldSkipPath(url.pathname)) {
    return context.next();
  }

  const existingCountry = readCookie(request, COOKIE_NAME);
  const legacyCountry = readCookie(request, LEGACY_COOKIE_NAME);

  // Geo IP z Netlify Edge contextu.
  const geoCC = normalizeCountryCode(context?.geo?.country?.code || '');

  // Fallback podle jazyka v URL, když geo chybí.
  const langParam = (url.searchParams.get('lang') || '').toLowerCase();
  const ccFromLang = langToCC(langParam);

  // Priorita:
  // 1) Geo IP
  // 2) lang fallback
  // 3) existující nová cookie
  // 4) stará legacy cookie
  const nextCC = geoCC || ccFromLang || existingCountry || legacyCountry || '';

  const response = await context.next();

  if (!isHtml(response)) {
    return response;
  }

  const headers = new Headers(response.headers);
  const isHttps = url.protocol === 'https:';

  let changed = false;

  if (nextCC && existingCountry !== nextCC) {
    headers.append(
      'Set-Cookie',
      cookieString(COOKIE_NAME, nextCC, {
        path: '/',
        maxAge: MAX_AGE,
        sameSite: 'Lax',
        secure: isHttps
      })
    );
    changed = true;
  }

  // Úklid starého názvu cookie, aby se v budoucnu nepletla s aj_country.
  if (legacyCountry) {
    headers.append(
      'Set-Cookie',
      cookieString(LEGACY_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'Lax',
        secure: isHttps
      })
    );
    changed = true;
  }

  if (!changed) {
    return response;
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

// -------- helpers --------

function shouldSkipPath(pathname = '') {
  const p = String(pathname || '');

  return (
    p.startsWith('/.netlify/') ||
    p.startsWith('/api/') ||
    p.startsWith('/go/') ||
    p.startsWith('/assets/') ||
    p.startsWith('/images/') ||
    p.startsWith('/fonts/') ||
    p.startsWith('/locales/') ||
    p.startsWith('/blog-data/') ||
    p === '/favicon.ico' ||
    p === '/robots.txt' ||
    p === '/sitemap.xml' ||
    /\.(?:js|css|map|json|png|jpg|jpeg|webp|avif|gif|svg|ico|woff|woff2|ttf|otf|txt|xml)$/i.test(p)
  );
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  const parts = raw.split(';').map((s) => s.trim());

  for (const part of parts) {
    if (!part) continue;

    const idx = part.indexOf('=');
    const key = idx >= 0 ? part.slice(0, idx) : part;

    if (key !== name) continue;

    try {
      return decodeURIComponent(idx >= 0 ? part.slice(idx + 1) : '');
    } catch {
      return idx >= 0 ? part.slice(idx + 1) : '';
    }
  }

  return '';
}

function isHtml(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

function cookieString(name, value, opts = {}) {
  const {
    path = '/',
    maxAge,
    sameSite = 'Lax',
    secure = true
  } = opts;

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`
  ];

  if (Number.isFinite(maxAge)) {
    parts.push(`Max-Age=${maxAge}`);
  }

  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function normalizeCountryCode(value = '') {
  const cc = String(value || '').trim().toUpperCase();

  if (cc === 'UK') return 'GB';

  return /^[A-Z]{2}$/.test(cc) ? cc : '';
}

function langToCC(lang) {
  switch (String(lang || '').slice(0, 2)) {
    case 'cs':
      return 'CZ';
    case 'sk':
      return 'SK';
    case 'de':
      return 'DE';
    case 'pl':
      return 'PL';
    case 'hu':
      return 'HU';

    // Držíme stejnou logiku jako frontend:
    // angličtina sama o sobě neznamená US market.
    // AJSEE defaultně startuje z CZ/EU kontextu.
    case 'en':
      return 'CZ';

    default:
      return '';
  }
}
