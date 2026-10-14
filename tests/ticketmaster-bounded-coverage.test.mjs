import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/adapters/ticketmaster.js';

test('the request cap keeps every deferred query reachable before advancing busy streams', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(input, 'https://ajsee.test');
    requests.push(url);
    return new Response(JSON.stringify({ page: { totalPages: 10 }, _embedded: { events: [{
      id: 'bounded', name: 'Rock Musical Festival', url: 'https://www.ticketmaster.at/event/bounded',
      classifications: [{ segment: { name: 'Music' }, genre: { name: 'Festival' } }],
      dates: { start: { localDate: '2099-05-01', dateTime: '2099-05-01T18:00:00Z' } },
      _embedded: { venues: [{ name: 'Test', city: { name: 'Vienna' }, country: { countryCode: 'AT' } }] }
    }] } }));
  };
  try {
    const filters = { city: 'Vienna', cityCountryCode: 'AT', category: 'festival', paginationMode: 'cursor', size: 50,
      discoveryKeywords: ['rock muzikál', 'rock musical'] };
    let cursor;
    let streamCount;
    for (let i = 0; i < (streamCount ? Math.ceil(streamCount / 8) + 1 : 1); i++) {
      const before = requests.length;
      const batch = await fetchEvents({ locale: 'en', filters: { ...filters, ticketmasterCursor: cursor } });
      assert.ok(requests.length - before <= 8);
      cursor = batch.pageInfo.ticketmasterCursor;
      streamCount = Object.keys(cursor.streams).length;
      assert.equal(batch.pageInfo.interrupted, false);
      assert.equal(batch.pageInfo.hasMore, true);
    }
    assert.ok(streamCount > 8, 'fixture must exceed the request cap');
    const firstAdvance = requests.findIndex(url => url.searchParams.get('page') !== '0');
    assert.ok(firstAdvance >= streamCount, 'every stream must receive a first page before a busy stream advances');
    assert.ok(Object.values(cursor.streams).every(stream => stream.nextPage >= 1));
    assert.ok(requests.some(url => !url.searchParams.has('keyword')), 'broad coverage survives targeted streams');
    const later = await fetchEvents({ locale: 'en', filters: { ...filters, ticketmasterCursor: cursor } });
    assert.ok(later.length > 0);
    assert.equal(later.pageInfo.discoveryPending, false);
  } finally { globalThis.fetch = original; }
});
