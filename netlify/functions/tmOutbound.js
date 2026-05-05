// netlify/functions/tmOutbound.js
// ---------------------------------------------------------
// Bezpečný outbound redirect pro Ticketmaster odkazy.
//
// Cíl:
// - Primárně zachovat affiliate / Impact cestu přes ticketmaster.evyy.net.
// - Neposílat uživatele z frontendu přímo na affiliate redirect.
// - Pokud affiliate redirect chain narazí na problémovou doménu nebo chybu,
//   použít čistý fallback na přímý Ticketmaster event URL.
// - Nepouštět interní technické parametry AJSEE do finální Ticketmaster URL.
// - V maximální rozumné míře chránit affiliate provizi.
// ---------------------------------------------------------

const BLOCKED_HOSTS = new Set([
  'ojrq.net',
  'www.ojrq.net',
]);

const INTERNAL_QUERY_PARAMS = [
  'url',
  'to',
  'eventId',
  'eid',
  'affiliateUrl',
  'directUrl',
  'fallbackUrl',
  'sourceUrl',
];

function isTicketmasterHost(hostname = '') {
  const h = String(hostname || '').toLowerCase();

  return (
    h === 'ticketmaster.com' ||
    h.endsWith('.ticketmaster.com') ||
    /(^|\.)ticketmaster\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(h)
  );
}

function isAllowedAffiliateHost(hostname = '') {
  const h = String(hostname || '').toLowerCase();
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

/**
 * Vyčistí přímou Ticketmaster URL od interních parametrů,
 * které patří tmOutbound funkci, ne cílové Ticketmaster stránce.
 */
function sanitizeTicketmasterUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);

    if (!isTicketmasterHost(parsed.hostname)) return '';

    for (const key of INTERNAL_QUERY_PARAMS) {
      parsed.searchParams.delete(key);
    }

    // Odstraníme jen falešný placeholder, pokud by se někde znovu objevil.
    const irclickid = parsed.searchParams.get('irclickid');

    if (
      irclickid &&
      (
        irclickid.includes('<') ||
        irclickid.includes('>') ||
        irclickid.toUpperCase().includes('SET_YOUR_CLICK_ID')
      )
    ) {
      parsed.searchParams.delete('irclickid');
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Z affiliate URL vytáhne cílový Ticketmaster event link z parametru "u".
 * Pokud dostane rovnou Ticketmaster link, vrátí jeho očištěnou verzi.
 */
function extractDirectTicketmasterUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);

    // Přímý Ticketmaster link.
    if (isTicketmasterHost(parsed.hostname)) {
      return sanitizeTicketmasterUrl(parsed.toString());
    }

    // Impact / affiliate link typicky nese cílovou URL v parametru "u".
    const encoded = parsed.searchParams.get('u');
    if (!encoded) return '';

    return sanitizeTicketmasterUrl(encoded);
  } catch {
    return '';
  }
}

/**
 * Někdy může přijít Ticketmaster URL, která v sobě nese
 * interní parametr "url" nebo "to" s affiliate linkem.
 * V takovém případě affiliate link vytáhneme a preferujeme ho kvůli provizi.
 */
function extractNestedAffiliateUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);

    if (isAllowedAffiliateHost(parsed.hostname)) {
      return parsed.toString();
    }

    const nested =
      parsed.searchParams.get('to') ||
      parsed.searchParams.get('url') ||
      '';

    if (!nested) return '';

    const nestedUrl = new URL(nested);

    if (!isAllowedAffiliateHost(nestedUrl.hostname)) return '';

    return nestedUrl.toString();
  } catch {
    return '';
  }
}

/**
 * Zkontroluje prvních pár kroků affiliate redirectu.
 * Když narazí na blokovanou doménu nebo chybu, vrátí ok:false.
 */
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

      clearTimeout(timeout);

      const location = response.headers.get('location');

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

      return {
        ok: false,
        reason: err?.message || String(err),
      };
    }
  }

  return { ok: true, reason: 'max-hops-reached' };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};

  // Nový parametr je "to".
  // "url" necháváme jen kvůli zpětné kompatibilitě se staršími odkazy.
  const rawUrl = q.to || q.url || '';

  if (!rawUrl) {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  let parsedInput;

  try {
    parsedInput = new URL(rawUrl);
  } catch {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  const inputHost = parsedInput.hostname.toLowerCase();

  const inputIsAffiliate = isAllowedAffiliateHost(inputHost);
  const inputIsTicketmaster = isTicketmasterHost(inputHost);

  if (!inputIsAffiliate && !inputIsTicketmaster) {
    return safeRedirect('https://www.ticketmaster.cz/');
  }

  // Kvůli ochraně provize se pokusíme vždy najít affiliate URL.
  // Buď je rawUrl přímo affiliate URL, nebo je schovaná v parametru "to" / "url".
  const affiliateUrl = inputIsAffiliate
    ? parsedInput.toString()
    : extractNestedAffiliateUrl(parsedInput.toString());

  // Čistý fallback na Ticketmaster.
  // Nikdy do něj nepouštíme interní parametry url/to/eventId/eid apod.
  const directUrl = affiliateUrl
    ? extractDirectTicketmasterUrl(affiliateUrl)
    : sanitizeTicketmasterUrl(parsedInput.toString());

  if (!directUrl) {
    // Když nemáme bezpečný přímý fallback, ale máme affiliate URL,
    // raději zachováme affiliate cestu než ji zbytečně zahodit.
    if (affiliateUrl) {
      return safeRedirect(affiliateUrl);
    }

    return safeRedirect('https://www.ticketmaster.cz/');
  }

  // Primární cesta: affiliate link.
  // Direct fallback použijeme jen tehdy, když affiliate redirect vypadá rozbitě.
  if (affiliateUrl) {
    const check = await inspectAffiliateRedirect(affiliateUrl);

    if (!check.ok) {
      console.warn('[tmOutbound] Affiliate redirect failed, using clean direct fallback:', {
        reason: check.reason,
        eventId: q.eid || q.eventId || null,
      });

      return safeRedirect(directUrl);
    }

    return safeRedirect(affiliateUrl);
  }

  // Pokud affiliate URL k dispozici není, použijeme čistý přímý Ticketmaster link.
  return safeRedirect(directUrl);
};