// Reviewed against the Slovak affiliate feed on 2026-11-03. The Slovak
// storefront also sells Ostrava: a seller domain is not an event country.
const CITY_COUNTRIES = new Map([
  ['bratislava', 'SK'], ['trnava', 'SK'], ['kosice', 'SK'], ['zilina', 'SK'],
  ['nitra', 'SK'], ['presov', 'SK'], ['banska bystrica', 'SK'], ['trencin', 'SK'],
  ['ostrava', 'CZ']
]);

export function colosseumSlovakCityCountry(city = '') {
  return CITY_COUNTRIES.get(String(city).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()) || '';
}

export const COLOSSEUM_SK_VENUE_LOCATIONS = [
  {
    venue: 'Evanjelický kostol Svätého Ducha', city: 'Nitra', street: 'Sládkovičova 2679/12', country: 'SK',
    lat: 48.312443446110436, lon: 18.091593094273545,
    source: 'municipal-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Sládkovičova 12, Nitra',
    verificationUrl: 'https://www.nitra.eu/8997/evanjelicky-kostol'
  },
  {
    venue: 'Evanjelický kostol', city: 'Banská Bystrica', street: 'Lazovná 268', country: 'SK',
    lat: 48.73983211271944, lon: 19.14261057972908,
    source: 'municipal-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Lazovná 268/46, Banská Bystrica',
    verificationUrl: 'https://www.visitbanskabystrica.sk/art/evanjelicky-kostol/',
    addressSourceUrl: 'https://cdn.banskabystrica.sk/2020/08/SMERNA_CAST_aktualizovane_znenie_1_2_3_4_5.pdf'
  },
  {
    venue: 'Veľké koncertné štúdio Slov. rozhlasu', city: 'Bratislava', street: 'Mýtna 1', country: 'SK',
    lat: 48 + 9 / 60 + 14 / 3600, lon: 17 + 6 / 60 + 51 / 3600,
    source: 'national-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Mýtna 1, Bratislava',
    verificationUrl: 'https://slovakia.travel/budova-slovenskeho-rozhlasu-v-bratislave',
    addressSourceUrl: 'https://www.stvr.org/obchod-a-najom-majetku'
  },
  {
    venue: 'areál Budatínskeho hradu', city: 'Žilina', street: 'Topoľová 1', country: 'SK',
    lat: 49 + 14 / 60 + 10 / 3600, lon: 18 + 44 / 60 + 3 / 3600,
    source: 'national-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Budatínsky hrad, Topoľová 1, Žilina',
    verificationUrl: 'https://slovakia.travel/budatinsky-hrad'
  },
  ...['Divadlo Jána Palárika - Veľká sála', 'Javisko Veľkej sály DJP'].map(venue => ({
    venue, city: 'Trnava', street: 'Trojičné námestie 139/2', country: 'SK',
    lat: 48 + 22 / 60 + 39 / 3600, lon: 17 + 35 / 60 + 7 / 3600,
    source: 'national-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Trojičné námestie 2, Trnava',
    verificationUrl: 'https://slovakia.travel/en/jan-palarik-theatre-divadlo-jana-palarika',
    addressSourceUrl: 'https://djp.sk/kontakt'
  })),
  {
    venue: 'Národné divadlo Košice - Historická budova', city: 'Košice', street: 'Hlavná 58', country: 'SK',
    lat: 48 + 43 / 60 + 16 / 3600, lon: 21 + 15 / 60 + 28 / 3600,
    source: 'national-tourism-venue', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Hlavná 58, Košice',
    verificationUrl: 'https://slovakia.travel/en/state-theatre-kosice',
    addressSourceUrl: 'https://www.sdke.sk/sk/divadlo/kontakty'
  },
  {
    venue: 'DOM ODBOROV', city: 'Žilina', street: 'Antona Bernoláka 51', country: 'SK',
    lat: 49.21962194, lon: 18.742512918,
    source: 'venue-published-gps', precision: 'venue', verifiedAt: '2026-11-03',
    matchedAddress: 'Antona Bernoláka 51, Žilina',
    verificationUrl: 'https://www.domodborov.sk/kontakt.php'
  }
];
