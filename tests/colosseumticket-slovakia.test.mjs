import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { normalizeColosseumFeed, parseColosseumPrice, normalizeColosseumPurchaseUrl,
  mergeColosseumMarketPayloads } from '../scripts/sync-colosseumticket-events.mjs';
import { buildColosseumTicketTaxonomy } from '../src/taxonomy/event-taxonomy.js';
import { buildEventCityCatalog, eventCitySuggestions } from '../shared/city/event-city-catalog.js';
import { handler as outbound } from '../netlify/functions/colosseumOutbound.js';
import { buildPartnerOutboundPayload } from '../src/partner-outbound.js';
import { withColosseumGeography } from '../shared/geo/colosseum-geography.js';
import { eventCoordinates } from '../shared/geo/coordinates.js';
import { COLOSSEUM_SK_VENUE_LOCATIONS } from '../shared/geo/colosseum-sk-venue-locations.js';

function parent({ id = 'slovak-show', termId = '123', city = 'Trnava', price = '18 - 22 €', category = 'Divadlo', market = 'SK' } = {}) {
  return { '@_id': id, eventname: 'Slovenské predstavenie', type: category, DESCRIPTION: 'Príbeh pre celú rodinu',
    'TERMÍNY': { 'TERMÍN': { ID_TERMIN: termId, CENA: price,
      location: { city, locationname: 'Divadlo', street: 'Námestie 2' },
      eventdate: { datefrom: '10/11/2099', timefrom: '19:00:00',
        url_objednavka: `https://colosseumticket.${market === 'SK' ? 'sk/sk/podrobnosti-o-podujati' : 'cz/cs/akce'}/${id}?term=${termId}` }
    } } };
}

function payload(market, parents) {
  const normalized = normalizeColosseumFeed(parents, { market, locale: market === 'SK' ? 'sk' : 'cs', affiliateBox: `${market}-affiliate` });
  return { market, source: 'colosseumticket', count: normalized.events.length, ...normalized };
}

test('Euro prices retain their currency and unknown/zero prices keep commercial safeguards', () => {
  for (const [raw, min, max, currency] of [
    ['18 - 22 €', 18, 22, 'EUR'], ['17,50 €', 17.5, 17.5, 'EUR'],
    ['25 – 99 EUR', 25, 99, 'EUR'], ['540 - 620 Kč', 540, 620, 'CZK']
  ]) assert.deepEqual(parseColosseumPrice(raw), { raw, min, max, currency });
  const event = payload('SK', [parent({ price: '0 €' })]).events[0];
  assert.equal(event.priceFrom, '');
  assert.equal(event.price.min, null);
  assert.deepEqual(event.priceOptions, []);
  assert.equal(event.availability, null);
});

test('Slovak source retains its language, original metadata and verified city country', () => {
  const event = payload('SK', [parent({ category: 'Pre deti' })]).events[0];
  assert.deepEqual(event.title, { sk: 'Slovenské predstavenie' });
  assert.equal(event.location.country, 'SK');
  assert.equal(event.currency, 'EUR');
  assert.equal(event.sourceMarket, 'SK');
  assert.equal(new URL(event.tickets).searchParams.get('a_box'), 'SK-affiliate');
  assert.deepEqual(event.sourceMeta.rawCategories, ['Pre deti']);
  assert.ok(buildColosseumTicketTaxonomy(event).audiences.includes('family'));
  assert.ok(buildColosseumTicketTaxonomy(payload('SK', [parent({ category: 'Muzikál ' })]).events[0]).genres.includes('musical'));
  assert.equal(payload('SK', [parent({ city: 'Ostrava' })]).events[0].location.country, 'CZ');
  assert.equal(payload('SK', [parent({ city: 'Unreviewed city' })]).events[0].location.country, undefined);
});

test('Cross-listed Ostrava terms keep Czech identity and ticket URL while gaining Slovak text', () => {
  const cz = payload('CZ', [parent({ market: 'CZ', city: 'Ostrava', id: 'old-czech-id' })]);
  const sk = payload('SK', [parent({ city: 'Ostrava' }), parent({ city: 'Trnava', termId: '123', id: 'another-installation' })]);
  // The provider exports different street abbreviations for the same term.
  sk.events[0].venue.address.street = 'Námestie 123/2';
  const merged = mergeColosseumMarketPayloads([sk, cz]);
  assert.equal(merged.count, 2);
  assert.equal(merged.stats.duplicateMarketOccurrences, 1);
  const ostrava = merged.events.find(event => event.location.city === 'Ostrava');
  assert.equal(ostrava.id, cz.events[0].id);
  assert.equal(ostrava.tickets, cz.events[0].tickets);
  assert.equal(ostrava.title.sk, 'Slovenské predstavenie');
});

test('Both seller hosts are allowed and lookalike/unsafe destinations remain rejected', () => {
  for (const host of ['colosseumticket.sk', 'www.colosseumticket.sk', 'colosseumticket.cz']) {
    const result = normalizeColosseumPurchaseUrl(`https://${host}/sk/show?term=123&a_box=bad&a_box=worse`, { affiliateBox: 'correct' });
    const url = new URL(result.url);
    assert.deepEqual(url.searchParams.getAll('a_box'), ['correct']);
    assert.equal(url.searchParams.get('term'), '123');
  }
  for (const url of ['https://colosseumticket.sk.evil.test/show', 'https://evil.colosseumticket.sk/show',
    'http://colosseumticket.sk/show', 'https://user:pass@colosseumticket.sk/show', 'https://colosseumticket.sk:8443/show']) {
    assert.equal(normalizeColosseumPurchaseUrl(url).url, '');
  }
});

test('Slovak outbound redirect uses the supplied Slovak affiliate, never the Czech environment or visitor value', async () => {
  const previous = process.env.COLOSSEUMTICKET_A_BOX;
  process.env.COLOSSEUMTICKET_A_BOX = 'czech-configured-box';
  try {
    for (const host of ['colosseumticket.sk', 'www.colosseumticket.sk']) {
      const response = await outbound({ httpMethod: 'GET', queryStringParameters: {
        to: `https://${host}/sk/show?term=123&a_box=visitor&a_box=another`, a_box: 'visitor' } });
      const url = new URL(response.headers.Location);
      assert.equal(response.statusCode, 302);
      assert.equal(url.searchParams.get('term'), '123');
      assert.deepEqual(url.searchParams.getAll('a_box'), ['yhvyrwgu']);
    }
    const cz = await outbound({ httpMethod: 'GET', queryStringParameters: { to: 'https://colosseumticket.cz/cs/show' } });
    assert.equal(new URL(cz.headers.Location).searchParams.get('a_box'), 'czech-configured-box');
    const unsafe = await outbound({ httpMethod: 'GET', queryStringParameters: { to: 'https://colosseumticket.sk.evil.test/' } });
    assert.equal(unsafe.headers.Location, 'https://colosseumticket.cz/');
  } finally {
    if (previous === undefined) delete process.env.COLOSSEUMTICKET_A_BOX;
    else process.env.COLOSSEUMTICKET_A_BOX = previous;
  }
});

test('Slovak cities enter the shared city catalog and country/category filters isolate their events', async () => {
  const sk = payload('SK', [parent(), parent({ city: 'Košice', termId: '456', category: 'Pre deti' })]);
  const cz = payload('CZ', [parent({ market: 'CZ', city: 'Praha' })]);
  const merged = mergeColosseumMarketPayloads([cz, sk]);
  const catalog = buildEventCityCatalog([{ events: merged.events, marketCountryCode: 'CZ' }]);
  assert.equal(eventCitySuggestions(catalog, 'kos', { countryCodes: ['SK'] })[0].city, 'Košice');
  assert.equal(eventCitySuggestions(catalog, 'trn', { countryCodes: ['CZ'] }).length, 0);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, async json() { return merged; } });
  try {
    const { fetchEvents } = await import('../src/adapters/colosseumticket.js?slovakia-filter-tests');
    const allSlovak = await fetchEvents({ filters: { countryCode: 'SK', allLocalEvents: true } });
    assert.equal(allSlovak.length, 2);
    const family = await fetchEvents({ filters: { city: 'Kosice', cityCountryCode: 'SK', audience: 'family' } });
    assert.equal(family.length, 1);
    assert.equal(family[0].location.city, 'Košice');
    assert.equal((await fetchEvents({ filters: { city: 'Trnava', countryCode: 'CZ' } })).length, 0);
    assert.equal((await fetchEvents({ filters: { countryCode: 'CZ', allLocalEvents: true } })).length, 1);
    assert.equal((await fetchEvents({ filters: { countryCode: 'DE' } })).length, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('Slovak ticket links emit the same consent-controlled partner analytics payload', () => {
  const dom = new JSDOM('<html lang="sk"><body data-page="events"><a href="https://colosseumticket.sk/sk/show?a_box=yhvyrwgu">Vstupenky</a></body></html>', { url: 'https://ajsee.cz/sk/events' });
  const event = buildPartnerOutboundPayload(dom.window.document.querySelector('a'));
  assert.equal(event.partner, 'colosseumticket');
  assert.equal(event.destination_host, 'colosseumticket.sk');
  assert.equal(event.outbound_url, 'https://colosseumticket.sk/sk/show');
  dom.window.close();
});

test('The shared homepage/events API finds Slovak-only titles and descriptions in every interface language', async () => {
  const originalFetch = globalThis.fetch;
  const feed = payload('SK', [parent({ id: 'api-localized-show' })]);
  feed.events[0].location = { ...feed.events[0].location, lat: 48.3775, lon: 17.5853 };
  globalThis.fetch = async input => {
    const pathname = new URL(input, 'https://ajsee.test').pathname;
    if (pathname.includes('ticketmasterEvents')) return new Response(JSON.stringify({ page: { totalPages: 0 } }));
    if (pathname.includes('event-cities')) return new Response(JSON.stringify({ items: [], providerCountries: { smsticket: ['CZ'], colosseumticket: ['CZ', 'SK'] } }));
    if (pathname.includes('smsticket-events')) return new Response(JSON.stringify({ events: [] }));
    if (pathname.includes('colosseumticket-events')) return new Response(JSON.stringify(feed));
    throw new Error(`Unexpected request ${pathname}`);
  };
  try {
    const { fetchEvents } = await import('../src/api/eventsApi.js?slovakia-language-tests');
    for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
      for (const keyword of ['Slovenské predstavenie', 'Príbeh']) {
        const events = await fetchEvents({ locale, filters: { countryCode: 'SK', city: 'Trnava', keyword, allLocalEvents: true } });
        assert.equal(events.length, 1, `${locale}: ${keyword}`);
        assert.equal(events[0].title.sk, 'Slovenské predstavenie');
      }
    }
    const nearby = await fetchEvents({ locale: 'cs', filters: {
      countryCode: 'CZ', cityCountryCode: 'CZ', nearMeLat: 48.3775, nearMeLon: 17.5853, nearMeRadiusKm: 1, allLocalEvents: true
    } });
    assert.equal(nearby.length, 1, 'the default Czech market must not suppress a Slovak radius result');
    assert.equal(nearby[0].location.country, 'SK');
  } finally { globalThis.fetch = originalFetch; }
});

test('Slovak geographic matching uses reviewed venues and preserves conflicting or unknown locations', async () => {
  for (const venue of COLOSSEUM_SK_VENUE_LOCATIONS) {
    assert.equal(venue.country, 'SK');
    assert.ok(venue.lat > 47 && venue.lat < 50 && venue.lon > 16 && venue.lon < 23);
    assert.ok(venue.verificationUrl.startsWith('https://'));
    const event = { location: { city: venue.city, country: 'SK' },
      venue: { name: venue.venue, city: venue.city, address: { street: venue.street } } };
    const enriched = withColosseumGeography(event);
    assert.deepEqual(eventCoordinates(enriched), { lat: venue.lat, lon: venue.lon });
    assert.equal(enriched.location.country, 'SK');
    assert.equal(eventCoordinates(event), null, 'input remains unchanged');
    const conflict = { ...event, location: { city: venue.city, country: 'CZ' } };
    assert.equal(withColosseumGeography(conflict), conflict);
  }
  const unknown = { location: { city: 'Trnava', country: 'SK' }, venue: { name: 'Unknown hall' } };
  assert.equal(withColosseumGeography(unknown), unknown);
});

test('A failed or empty Slovak refresh preserves its own last good feed independently of Czech data', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ajsee-sk-sync-'));
  const script = fileURLToPath(new URL('../scripts/sync-colosseumticket-events.mjs', import.meta.url));
  function xml(market, count) {
    return '<events>' + Array.from({ length: count }, (_, index) => `<event id="${market}-${index}"><eventname>Show ${index}</eventname><type>Divadlo</type><TERMÍNY><TERMÍN><ID_TERMIN>${index}</ID_TERMIN><CENA>18 €</CENA><location><city>${market === 'SK' ? 'Trnava' : 'Praha'}</city><locationname>Theatre</locationname></location><eventdate><datefrom>10/11/2099</datefrom><timefrom>19:00:00</timefrom><url_objednavka>https://colosseumticket.${market === 'SK' ? 'sk' : 'cz'}/show/${index}</url_objednavka></eventdate></TERMÍN></TERMÍNY></event>`).join('') + '</events>';
  }
  const env = { ...process.env, COLOSSEUMTICKET_A_BOX: 'configured-cz',
    COLOSSEUMTICKET_FEED_FILE: path.join(directory, 'cz.xml'), COLOSSEUMTICKET_SK_FEED_FILE: path.join(directory, 'sk.xml') };
  const run = () => execFileSync(process.execPath, [script], { cwd: directory, env, stdio: 'pipe' });
  try {
    await writeFile(env.COLOSSEUMTICKET_FEED_FILE, xml('CZ', 100));
    await writeFile(env.COLOSSEUMTICKET_SK_FEED_FILE, '<events/>');
    assert.throws(run, /SK sync failed/);
    await writeFile(env.COLOSSEUMTICKET_SK_FEED_FILE, xml('SK', 10));
    run();
    const output = path.join(directory, 'public/data/colosseumticket-events.json');
    assert.equal(JSON.parse(await readFile(output, 'utf8')).count, 110);
    await writeFile(env.COLOSSEUMTICKET_SK_FEED_FILE, '<events/>');
    run();
    const retained = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(retained.count, 110);
    assert.equal(retained.markets.SK.count, 10);
    assert.equal(retained.events.filter(event => event.location.country === 'SK').length, 10);
    await writeFile(env.COLOSSEUMTICKET_SK_FEED_FILE, xml('SK', 10).replaceAll('<city>Trnava</city>', '<city>Ostrava</city>'));
    run();
    const crossListingsOnly = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(crossListingsOnly.events.filter(event => event.location.country === 'SK').length, 10,
      'a Slovak export containing only Czech shows must not erase Slovak inventory');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
