import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/api/eventsApi.js';
import { createEventSearchSession } from '../src/event-search-session.js';

const requests = [];
const raw = (id, name, day) => ({ id, name, url: `https://www.ticketmaster.cz/event/${id}`,
  classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
  dates: { start: { localDate: `2099-01-0${day}`, dateTime: `2099-01-0${day}T18:00:00Z` } },
  _embedded: { venues: [{ city: { name: 'Praha' }, country: { countryCode: 'CZ' }, name: 'Test venue' }] } });
const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });
globalThis.fetch = async input => {
  const url = new URL(String(input), 'https://ajsee.test'); requests.push(url);
  let data;
  if (url.pathname.includes('event-cities')) data = { items: [] };
  else if (url.pathname.includes('ticketmasterEvents')) {
    const festival = url.searchParams.get('classificationName') === 'Festival';
    const page = Number(url.searchParams.get('page'));
    const events = festival ? [] : page === 0
      ? Array.from({ length: 50 }, (_, i) => raw(String(i), i === 0 ? 'First Festival' : `Concert ${i}`, 1))
      : [raw('next', 'Later Festival', 2)];
    data = { _embedded: { events }, page: { totalPages: festival ? 0 : 2, number: page } };
  } else if (url.pathname.includes('smsticket-events')) data = { events: Array.from({ length: 301 }, (_, i) => ({
    id: `sms-${i}`, partner: 'smsticket', sourceId: String(i), category: 'concert', title: `Local ${i}`,
    datetime: new Date(Date.UTC(2099, 0, i + 1, 18)).toISOString(), location: { city: 'Praha', country: 'CZ' },
    types: ['Koncert'], priceFrom: i === 300 ? '50 Kč' : '1000 Kč', tickets: `https://www.smsticket.cz/vstupenky/${i}?a_box=kept`
  })) };
  else if (url.pathname.includes('colosseumticket-events')) data = { events: [] };
  else throw new Error(`Unexpected request ${url}`);
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
};

test('the real aggregation continues after 49 out of 50 raw Music candidates are removed', async () => {
  const session = createEventSearchSession({ filters: { city: 'Praha', cityCountryCode: 'CZ', category: 'festival' }, fetchBatch: fetchEvents });
  const state = await session.load(20);
  assert.deepEqual(state.events.map(e => e.id), ['ticketmaster-0', 'ticketmaster-next']);
  assert.equal(state.hasMore, false);
  const festival = requests.filter(url => url.searchParams.get('classificationName') === 'Festival');
  assert.equal(festival.length, 1, 'an exhausted query must not be fetched on a later page');
  assert.ok(requests.some(url => url.searchParams.get('segmentName') === 'Music' && url.searchParams.get('page') === '1'));
});

test('the real static adapter finds an affordable event after candidate 300 without additional feed requests', async () => {
  const before = requests.filter(url => url.pathname.includes('smsticket-events')).length;
  const session = createEventSearchSession({ filters: { city: 'Praha', cityCountryCode: 'CZ', maxPrice: 100, priceCurrency: 'CZK' },
    fetchBatch: fetchEvents, getRates: async () => ({}) });
  const state = await session.load(6);
  assert.deepEqual(state.events.map(e => e.id), ['sms-300']);
  assert.equal(requests.filter(url => url.pathname.includes('smsticket-events')).length, before);
  assert.match(state.events[0].tickets, /a_box=kept/);
});
