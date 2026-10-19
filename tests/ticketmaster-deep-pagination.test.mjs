import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventSearchSession } from '../src/event-search-session.js';
import { advanceTicketmasterStream } from '../src/ticketmaster-continuation.js';

const raw = (id, timestamp) => ({
  id: String(id), name: 'Coverage concert ' + id, url: 'https://www.ticketmaster.de/event/' + id,
  classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
  dates: { start: { localDate: timestamp.slice(0, 10), dateTime: timestamp } },
  _embedded: { venues: [{ name: 'Venue', city: { name: 'Berlin' }, country: { countryCode: 'DE' } }] }
});

for (const sort of ['nearest', 'latest']) {
  test('real session passes 1000 candidates with boundary ties, stable ' + sort + ' ordering', async t => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    // Seventy simultaneous events cross the first API depth boundary.
    const inventory = Array.from({ length: 1325 }, (_, i) => raw(i,
      new Date(Date.UTC(2099, 0, 1, Math.floor(i / 70))).toISOString()));
    const requests = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input), 'https://ajsee.test');
      const q = url.searchParams, page = Number(q.get('page')), size = Number(q.get('size'));
      requests.push(url);
      assert.ok(page * size < 1000, 'must roll the query before the upstream depth limit');
      const lower = q.get('startDateTime'), upper = q.get('endDateTime');
      let eligible = inventory.filter(event => (!lower || Date.parse(event.dates.start.dateTime) >= Date.parse(lower)) &&
        (!upper || Date.parse(event.dates.start.dateTime) <= Date.parse(upper)));
      eligible = eligible.sort((a, b) => (sort === 'latest' ? -1 : 1) *
        (Date.parse(a.dates.start.dateTime) - Date.parse(b.dates.start.dateTime)) || Number(a.id) - Number(b.id));
      const data = { _embedded: { events: eligible.slice(page * size, (page + 1) * size) },
        page: { size, number: page, totalElements: eligible.length, totalPages: Math.ceil(eligible.length / size) } };
      return new Response(JSON.stringify(data));
    };
    const { fetchEvents } = await import('../src/adapters/ticketmaster.js?deep=' + sort);
    const session = createEventSearchSession({ filters: { countryCode: 'DE', sort }, fetchBatch: fetchEvents });
    let state = await session.load(20);
    const firstPage = state.events.slice(0, 20).map(x => x.id);
    state = await session.load(inventory.length + 1, { maxBatches: 70 });
    assert.equal(state.incomplete, false);
    assert.equal(state.hasMore, false);
    assert.equal(state.events.length, inventory.length);
    assert.equal(new Set(state.events.map(x => x.id)).size, inventory.length);
    assert.deepEqual(state.events.slice(0, 20).map(x => x.id), firstPage);
    assert.ok(requests.some(url => url.searchParams.has(sort === 'latest' ? 'endDateTime' : 'startDateTime')));
    for (let i = 1; i < state.events.length; i++) {
      const delta = Date.parse(state.events[i].datetime) - Date.parse(state.events[i - 1].datetime);
      assert.ok(sort === 'latest' ? delta <= 0 : delta >= 0);
    }
  });
}

test('undated events remain reachable after switching to a bounded date query', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const dated = Array.from({ length: 1100 }, (_, i) => raw('dated-' + i,
    new Date(Date.UTC(2099, 0, 1, 0, i)).toISOString()));
  const uncertain = raw('uncertain', '2099-12-01T19:00:00Z');
  uncertain.dates.start.dateTBA = true;
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'https://ajsee.test'); requests.push(url);
    const q = url.searchParams, page = Number(q.get('page')), size = Number(q.get('size'));
    const lower = q.get('startDateTime');
    const inventory = dated.filter(x => !lower || Date.parse(x.dates.start.dateTime) >= Date.parse(lower));
    if (!lower || q.get('includeTBA') === 'yes') inventory.push(uncertain);
    return new Response(JSON.stringify({ _embedded: { events: inventory.slice(page * size, (page + 1) * size) },
      page: { totalPages: Math.ceil(inventory.length / size), totalElements: inventory.length } }));
  };
  const { fetchEvents } = await import('../src/adapters/ticketmaster.js?deep=uncertain');
  const session = createEventSearchSession({ filters: { countryCode: 'DE' }, fetchBatch: fetchEvents });
  const state = await session.load(1200, { maxBatches: 60 });
  assert.equal(state.events.length, 1101);
  assert.equal(state.hasMore, false);
  assert.equal(state.incomplete, false);
  assert.ok(state.events.some(x => x.id === 'ticketmaster-uncertain'));
  assert.ok(requests.some(url => url.searchParams.get('includeTBA') === 'yes'));
});

for (const sort of ['nearest', 'latest']) {
  test('date-only inventory beyond 1000 retains whole boundary days in ' + sort + ' order', async t => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    const inventory = Array.from({ length: 1100 }, (_, i) => {
      const event = raw('day-' + i, new Date(Date.UTC(2099, 0, Math.floor(i / 20) + 1)).toISOString());
      delete event.dates.start.dateTime;
      event.dates.start.noSpecificTime = true;
      return event;
    });
    globalThis.fetch = async input => {
      const q = new URL(String(input), 'https://ajsee.test').searchParams;
      const page = Number(q.get('page')), size = Number(q.get('size'));
      assert.ok(page * size < 1000);
      const [lower, upper] = (q.get('localStartDateTime') || ',').split(',');
      const all = inventory.filter(x => {
        const day = x.dates.start.localDate + 'T00:00:00';
        return (!lower || day >= lower) && (!upper || day <= upper);
      }).sort((a, b) => (sort === 'latest' ? -1 : 1) * a.dates.start.localDate.localeCompare(b.dates.start.localDate));
      return new Response(JSON.stringify({ _embedded: { events: all.slice(page * size, (page + 1) * size) },
        page: { totalPages: Math.ceil(all.length / size) } }));
    };
    const { fetchEvents } = await import('../src/adapters/ticketmaster.js?dateonly=' + sort);
    const session = createEventSearchSession({ filters: { countryCode: 'DE', sort }, fetchBatch: fetchEvents });
    const state = await session.load(1200, { maxBatches: 60 });
    assert.equal(state.events.length, inventory.length);
    assert.equal(state.incomplete, false);
    assert.equal(state.hasMore, false);
    assert.ok(state.events.every(x => !x.time));
  });
}

test('untraversable identical timestamps remain explicitly incomplete instead of looping', () => {
  const previous = { windowStart: '2099-01-01T19:00:00Z', nextPage: 19, pagesFetched: 39 };
  const next = advanceTicketmasterStream({ hasMore: true, nextPage: 20, boundaryDateTime: previous.windowStart }, previous,
    { size: 50, sort: 'date,asc' });
  assert.equal(next.limited, true);
  assert.equal(next.hasMore, true);
  assert.equal(next.pagesFetched, 40);
  const undated = advanceTicketmasterStream({ hasMore: true, nextPage: 20, boundaryDateTime: null }, {}, { size: 50 });
  assert.equal(undated.limited, true);
});

test('the proxy forwards date-window uncertainty options and preserves raw boundaries before country filtering', async t => {
  const originalFetch = globalThis.fetch, originalKey = process.env.TM_API_KEY;
  process.env.TM_API_KEY = 'coverage-test-key';
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.TM_API_KEY; else process.env.TM_API_KEY = originalKey; });
  const rows = [raw('retained', '2099-01-01T18:00:00Z'), raw('removed', '2099-01-02T18:00:00Z')];
  rows[1]._embedded.venues[0].country.countryCode = 'PL';
  let upstream;
  globalThis.fetch = async input => {
    upstream = new URL(input);
    return new Response(JSON.stringify({ _embedded: { events: rows }, page: { totalPages: 30 } }));
  };
  const { handler } = await import('../netlify/functions/ticketmasterEvents.js');
  const result = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {
    city: 'Coverage-Berlin', countryCode: 'DE', countryStrategy: 'both', paginationMode: 'cursor',
    startDateTime: '2099-01-01T18:00:00Z', includeTBA: 'yes', includeTBD: 'yes', size: '50', page: '19',
    localStartDateTime: '2099-01-01T00:00:00,9999-12-31T23:59:59'
  } });
  const body = JSON.parse(result.body);
  assert.equal(body._embedded.events.length, 1);
  assert.equal(body._ajseePageInfo.boundaryDateTime, '2099-01-02T18:00:00Z');
  assert.equal(upstream.searchParams.get('includeTBA'), 'yes');
  assert.equal(upstream.searchParams.get('includeTBD'), 'yes');
  assert.equal(upstream.searchParams.get('startDateTime'), '2099-01-01T18:00:00Z');
  assert.equal(upstream.searchParams.get('localStartDateTime'), '2099-01-01T00:00:00,9999-12-31T23:59:59');
});
