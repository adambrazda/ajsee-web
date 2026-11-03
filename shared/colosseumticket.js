// Seller markets are separate from the country in which an event takes place.
export const COLOSSEUMTICKET_MARKETS = Object.freeze({
  CZ: Object.freeze({
    feedUrl: 'https://colosseumticket.cz/api/export/affiliate.xml',
    locale: 'cs',
    affiliateEnv: 'COLOSSEUMTICKET_A_BOX'
  }),
  SK: Object.freeze({
    feedUrl: 'https://colosseumticket.sk/api/export/affiliate.xml',
    locale: 'sk',
    affiliateEnv: 'COLOSSEUMTICKET_SK_A_BOX',
    // AJSEE's supplied Slovak partner ID matches the existing Czech setting
    // (verified 2026-11-03). Keep values in server configuration, not source.
    fallbackAffiliateEnv: 'COLOSSEUMTICKET_A_BOX'
  })
});

export function colosseumMarketForHost(hostname = '') {
  const host = String(hostname).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (host === 'colosseumticket.cz') return 'CZ';
  if (host === 'colosseumticket.sk') return 'SK';
  return '';
}

export function colosseumAffiliateBox(market, environment = {}) {
  const definition = COLOSSEUMTICKET_MARKETS[market];
  if (!definition) return '';
  return String(environment[definition.affiliateEnv] ||
    (definition.fallbackAffiliateEnv ? environment[definition.fallbackAffiliateEnv] : '') || '').trim();
}
