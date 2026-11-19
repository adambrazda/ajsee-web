const SITE_ORIGIN = 'https://ajsee.cz';
const LANGUAGES = new Set(['cs', 'en', 'de', 'sk', 'pl', 'hu']);

function safeLanguage(lang) {
  const value = String(lang || '').trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.has(value) ? value : 'cs';
}

export function isFirstPartyReviewDestination(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return false;

  try {
    const url = new URL(value, SITE_ORIGIN);
    return url.protocol === 'https:' &&
      ['ajsee.cz', 'www.ajsee.cz'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isColosseumTicketDestination(rawUrl = '') {
  try {
    const url = new URL(String(rawUrl || '').trim());
    return url.protocol === 'https:' &&
      ['colosseumticket.cz', 'colosseumticket.sk'].includes(
        url.hostname.toLowerCase().replace(/^www\./, '')
      );
  } catch {
    return false;
  }
}

export function buildReviewCtaDestination(rawUrl = '', lang = 'cs') {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  // Internal editorial links must not become affiliate links or self-referrals.
  if (isFirstPartyReviewDestination(value)) {
    const url = new URL(value, SITE_ORIGIN);
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  }

  if (isColosseumTicketDestination(value)) {
    const target = new URL(value);
    target.searchParams.delete('a_box');
    const outbound = new URL('/.netlify/functions/colosseumOutbound', SITE_ORIGIN);
    outbound.searchParams.set('to', target.toString());
    outbound.searchParams.set('source', 'review');
    outbound.searchParams.set('placement', 'review_cta');
    outbound.searchParams.set('lang', safeLanguage(lang));
    return `${outbound.pathname}${outbound.search}`;
  }

  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    url.searchParams.set('utm_content', safeLanguage(lang));
    return url.toString();
  } catch {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}utm_content=${encodeURIComponent(safeLanguage(lang))}`;
  }
}
