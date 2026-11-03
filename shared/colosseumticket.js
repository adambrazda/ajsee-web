// Seller markets are separate from the country in which an event takes place.
export const COLOSSEUMTICKET_MARKETS = Object.freeze({
  CZ: Object.freeze({
    feedUrl: 'https://colosseumticket.cz/api/export/affiliate.xml',
    locale: 'cs',
    affiliateEnv: 'COLOSSEUMTICKET_A_BOX',
    affiliateBox: ''
  }),
  SK: Object.freeze({
    feedUrl: 'https://colosseumticket.sk/api/export/affiliate.xml',
    locale: 'sk',
    affiliateEnv: 'COLOSSEUMTICKET_SK_A_BOX',
    // Public partner identifier supplied by AJSEE for the Slovak seller.
    affiliateBox: 'yhvyrwgu'
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
  return String(environment[definition.affiliateEnv] || definition.affiliateBox).trim();
}
