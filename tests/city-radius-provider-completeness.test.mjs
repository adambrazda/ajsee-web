import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/api/eventsApi.js';
import { createEventSearchSession } from '../src/event-search-session.js';
import { distanceKm } from '../shared/geo/coordinates.js';

test('city radius uses full local feeds, includes nearby towns, and discloses unlocated inventory', async () => {
  const original = globalThis.fetch;
  const requests = [];
  const local = (id, city, lat, lon, partner = 'smsticket') => ({
    id, partner, sourceId: id, title: id, datetime: '2099-01-01T19:00:00+01:00', category: 'concert',
    types: ['Hudba'], categories: ['Hudba'], location: { city, country: 'CZ', lat, lon },
    venue: { name: id, city }, priceFrom: '100 Kč', tickets: `https://seller.test/${id}?a_box=kept`
  });
  const sms = [local('sms-center', 'Praha', 50.08, 14.43), local('sms-neighbour', 'Říčany', 50, 14.65), local('sms-far', 'Brno', 49.2, 16.6)];
  const col = [local('col-neighbour', 'Říčany', 50, 14.65, 'colosseumticket'),
    local('col-far', 'Brno', 49.2, 16.6, 'colosseumticket'),
    local('col-unknown', 'Praha', null, null, 'colosseumticket')];
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    const payload = url.includes('ticketmasterEvents') ? { page: { totalPages: 0 } }
      : url.includes('smsticket-events') ? { events: url.includes('-events-praha') ? sms.filter(event => event.location.city === 'Praha') : sms }
      : url.includes('colosseumticket-events') ? { events: url.includes('-events-praha') ? col.filter(event => event.location.city === 'Praha') : col }
      : url.includes('event-cities') ? { items: [] } : null;
    assert.ok(payload, url);
    return new Response(JSON.stringify(payload));
  };
  try {
    const filters = { city: 'Praha', cityLabel: 'Praha', placeType: 'cityRadius',
      countryCode: 'CZ', cityCountryCode: 'CZ', nearMeLat: 50.08, nearMeLon: 14.43, nearMeRadiusKm: 30 };
    const session = createEventSearchSession({ filters, fetchBatch: fetchEvents });
    const result = await session.load(20);
    assert.deepEqual(new Set(result.events.map(event => event.id)), new Set(['sms-center', 'sms-neighbour', 'col-neighbour']));
    assert.equal(result.geographyLimited, true);
    assert.equal(result.hasMore, false);
    assert.equal(result.incomplete, false, 'missing geography differs from a failed HTTP source');
    assert.deepEqual(result.geographyCoverage.colosseumticket, { located: 2, missing: 1 });
    assert.ok(requests.includes('/data/smsticket-events.json'));
    assert.ok(requests.includes('/data/colosseumticket-events.json'));
    assert.ok(!requests.some(url => /(?:smsticket|colosseumticket)-events-praha/.test(url)));
    assert.ok(result.events.every(event => event.tickets.includes('a_box=kept')));
    assert.equal((await session.load(40)).geographyLimited, true);
    const boundary = distanceKm(50.08, 14.43, 50, 14.65);
    const inclusive = await createEventSearchSession({ filters: { ...filters, nearMeRadiusKm: boundary }, fetchBatch: fetchEvents }).load(20);
    assert.deepEqual(new Set(inclusive.events.map(event => event.id)), new Set(['sms-center', 'sms-neighbour', 'col-neighbour']));
    const narrower = await createEventSearchSession({ filters: { ...filters, nearMeRadiusKm: boundary - 0.0001 }, fetchBatch: fetchEvents }).load(20);
    assert.deepEqual(narrower.events.map(event => event.id), ['sms-center']);
    const exact = await fetchEvents({ locale: 'cs', filters: { city: 'Praha', cityCountryCode: 'CZ', allLocalEvents: true } });
    assert.ok(!exact.some(event => event.location.city === 'Říčany'), 'an exact-city query still excludes neighbouring towns');
  } finally { globalThis.fetch = original; }
});
