// netlify/functions/tmOutbound.js
// Bezpečný outbound redirect pro Ticketmaster odkazy.
// Primárně zkusí affiliate URL, ale pokud redirect chain obsahuje problémovou doménu
// nebo nastane chyba, pošle uživatele přímo na Ticketmaster URL z parametru "u".

const BLOCKED_HOSTS = new Set([
  'ojrq.net',
  'www.ojrq.net',
]);

function isTicketmasterHost(hostname = '') {
  const h = hostname.toLowerCase();
  return h === 'ticketmaster.com'
    || h.endsWith('.ticketmaster.com')
    || /^(.+\.)?ticketmaster\.[a-z]{2,}$/i.test(h);
}

function isAllowedAffiliateHost(hostname = '') {
  const h = hostname.toLowerCase();
  return h === 'ticketmaster.evyy.net';
}

function safeRedirect(location, statusCode = 302) {
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

function extractDirectTicketmasterUrl(affiliateUrl) {
  try {
    const parsed = new URL(affiliateUrl);

    // Pokud už je to přímý Ticketmaster link, použijeme ho rovnou jako fallback.
    if (isTicketmasterHost(parsed.hostname)) {
      return parsed.toString();
    }

    // Impact / affiliate link typicky nese cílovou URL v parametru "u".
    const encoded = parsed.searchParams.get('u');
    if (!encoded) return '';

    const direct = new URL(encoded);
    if (!isTicketmasterHost(direct.hostname)) return '';

    return direct.toString();
  } catch {
    return '';
  }
}

async function inspectAffiliateRedirect(affiliateUrl) {
  let current = affiliateUrl;

  for (let i = 0; i < 5; i += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'AJSEE-Outbound-Check/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      const location = response.headers.get('location');
      clearTimeout(timeout);

      // Bez dalšího redirectu = cesta vypadá použitelně.
      if (!location) {
        return { ok: true, reason: 'no-location' };
      }

      const next = new URL(location, current);
      const host = next.hostname.toLowerCase();

      if (BLOCKED_HOSTS.has(host)) {
        return { ok: false, reason: `blocked-host:${host}` };
      }

      current = next.toString();
    } catch (err) {
      clearTimeout(timeout);
      return { ok: false, reason: err?.message || String(err) };
    }
  }

  return { ok: true, reason: 'max-hops-reached' };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};
  const rawUrl = q.url || '';

  if (!rawUrl) {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  let affiliateUrl;

  try {
    affiliateUrl = new URL(rawUrl);
  } catch {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  const affiliateHost = affiliateUrl.hostname.toLowerCase();

  const isAllowed =
    isAllowedAffiliateHost(affiliateHost) ||
    isTicketmasterHost(affiliateHost);

  if (!isAllowed) {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  const directUrl = extractDirectTicketmasterUrl(affiliateUrl.toString());

  // Když nemáme bezpečný fallback, raději stále pošleme uživatele na původní URL.
  // Ale u evyy.net by directUrl z parametru "u" měl být dostupný.
  if (!directUrl) {
    return safeRedirect(affiliateUrl.toString());
  }

  const check = await inspectAffiliateRedirect(affiliateUrl.toString());

  if (!check.ok) {
    console.warn('[tmOutbound] Affiliate redirect failed, using direct fallback:', {
      reason: check.reason,
      eventId: q.eventId || null,
    });

    return safeRedirect(directUrl);
  }

  return safeRedirect(affiliateUrl.toString());
};