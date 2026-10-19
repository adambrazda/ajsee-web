import test from 'node:test';
import assert from 'node:assert/strict';
import { withSmsticketCountry } from '../shared/geo/smsticket-country.js';
import { buildEventCityCatalog, eventCitySuggestions } from '../shared/city/event-city-catalog.js';

const venues = [
  ['72584', 'Bratislava', 'SK', 48.1436469, 17.1099919],
  ['75270', 'Bratislava', 'SK', 48.1674325, 17.1416625],
  ['76723', 'Bratislava', 'SK', 48.1650417, 17.0962011],
  ['74480', 'Košice', 'SK', 48.7170867, 21.2542489],
  ['72419', 'Žiar nad Hronom', 'SK', 48.5861783, 18.8514806],
  ['72421', 'Žiar nad Hronom', 'SK', 48.5861783, 18.8514806],
  ['72594', 'Žilina', 'SK', 49.2239931, 18.7411769],
  ['76705', 'Trnava', 'SK', 48.3933728, 17.5946014],
  ['74683', 'Warszawa', 'PL', 52.2249236, 20.9799922],
  ['75310', 'Bělehrad', 'RS', 44.810926, 20.461906],
  ['czech', 'Brno', 'CZ', 49.1951, 16.6068],
  ['czech-trnava', 'Trnava', 'CZ', 49.296, 17.841]
];
const fixture = venues.map(([id, city, , lat, lon]) => ({
  id: 'smsticket-' + id, sourceId: id, partner: 'smsticket', country: 'CZ',
  title: { cs: 'Coverage concert ' + id }, date: '2099-01-15', datetime: '2099-01-15T19:00:00',
  category: 'music', types: ['Koncert'], tickets: 'https://www.smsticket.cz/vstupenky/' + id + '?a_box=preserved',
  location: { city, country: 'CZ', lat, lon }, place: { city },
  venue: { name: 'Venue ' + id, city, country: 'CZ', address: { country: 'CZ' } }
}));

test('cached foreign venues are repaired without changing commercial links or Czech namesakes', () => {
  for (const [index, event] of fixture.entries()) {
    const repaired = withSmsticketCountry(event);
    assert.equal(repaired.country, venues[index][2]);
    assert.equal(repaired.location.country, repaired.country);
    assert.equal(repaired.venue.address.country, repaired.country);
    assert.equal(repaired.tickets, event.tickets);
    assert.equal(repaired.datetime, event.datetime);
    assert.equal(repaired.location.lat, event.location.lat);
  }
  assert.equal(withSmsticketCountry({ place: { id: '8655', city: 'Luxor', company: 'Chrámy v Luxoru' } }).country, 'EG');
  assert.equal(withSmsticketCountry({ place: { id: 'unknown', city: 'Luxor', company: 'Unknown' } }).country, undefined);
});

test('the rebuilt city catalog puts the audited Slovak venues in SK, not CZ', () => {
  const catalog = buildEventCityCatalog([{ events: fixture.map(withSmsticketCountry), marketCountryCode: 'CZ' }]);
  const matches = eventCitySuggestions(catalog, 'Koš', { countryCodes: ['SK'] });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].countryCode, 'SK');
  assert.ok(catalog.some(x => x.city === 'Trnava' && x.countryCode === 'CZ'));
  assert.ok(catalog.some(x => x.city === 'Trnava' && x.countryCode === 'SK'));
});

test('real aggregation retains eight Slovak events, country searches and other foreign markets', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'https://ajsee.test');
    let data;
    if (url.pathname.includes('event-cities')) data = { items: buildEventCityCatalog([{ events: fixture.map(withSmsticketCountry) }]) };
    else if (url.pathname.includes('smsticket-events')) data = { events: fixture };
    else if (url.pathname.includes('colosseumticket-events')) data = { events: [] };
    else if (url.pathname.includes('ticketmasterEvents')) data = { page: { totalPages: 0 }, _embedded: { events: [] } };
    else throw new Error('Unexpected request ' + url.pathname);
    return new Response(JSON.stringify(data));
  };
  const { fetchEvents } = await import('../src/api/eventsApi.js');
  const search = filters => fetchEvents({ locale: 'cs', filters: { ...filters, allLocalEvents: true, paginationMode: 'cursor' } });
  for (const [city, country, count] of [['Bratislava', 'SK', 3], ['Košice', 'SK', 1], ['Žilina', 'SK', 1],
    ['Žiar nad Hronom', 'SK', 2], ['Trnava', 'SK', 1], ['Warszawa', 'PL', 1], ['Bělehrad', 'RS', 1]]) {
    const events = await search({ city, cityCountryCode: country, countryCode: country });
    assert.equal(events.length, count, city);
    assert.ok(events.every(x => x.location.country === country));
  }
  const slovakia = await search({ city: 'Slovensko' });
  assert.equal(slovakia.length, 8);
  const czechia = await search({ city: 'Česko' });
  assert.deepEqual(czechia.map(x => x.sourceId).sort(), ['czech', 'czech-trnava']);
  const nearby = await search({ nearMeLat: 48.15, nearMeLon: 17.1, nearMeRadiusKm: 20 });
  assert.equal(nearby.length, 3, 'nearby search must not inherit the default CZ country');
  assert.ok(slovakia.every(x => x.tickets.endsWith('?a_box=preserved')));
});

test('only explicit version-two provider coverage may exclude an uncovered market', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(JSON.stringify({ version: 2, items: [],
    providerCountries: { smsticket: ['CZ', 'SK', 'PL', 'RS', 'EG'] } }));
  const catalog = await import('../src/city/eventCityCatalog.js?coverage=verified');
  await catalog.loadEventCityCatalog();
  assert.equal(catalog.providerCoversCountry('smsticket', 'SK'), true);
  assert.equal(catalog.providerCoversCountry('smsticket', 'FR'), false);
  assert.equal(catalog.providerCoversCountry('unknown', 'SK'), null);
  globalThis.fetch = async () => new Response(JSON.stringify({ version: 1, items: [] }));
  const legacy = await import('../src/city/eventCityCatalog.js?coverage=legacy');
  await legacy.loadEventCityCatalog();
  assert.equal(legacy.providerCoversCountry('smsticket', 'SK'), null);
});
