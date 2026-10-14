import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventSearchSession } from '../src/event-search-session.js';
import { withEventPageInfo, ticketmasterPageInfo } from '../src/event-pagination.js';

const event = (id, day, price = 500, partner = 'ticketmaster') => ({
  id, partner, title: id, datetime: new Date(Date.UTC(2099, 0, day, 18)).toISOString(),
  location: { city: 'Praha', country: 'CZ' }, venue: { name: 'Test venue', city: 'Praha' },
  priceFrom: `${price} CZK`, currency: 'CZK', tickets: `https://seller.test/${id}?affiliate=kept`
});
const batch = (events, hasMore = false, frontier = null, next = 1) => withEventPageInfo(events, {
  hasMore, frontier, ticketmasterCursor: { streams: { test: { nextPage: next, hasMore, frontier } } }
});

test('a sparse filtered page retains authoritative continuation', async () => {
  let calls = 0;
  const session = createEventSearchSession({ fetchBatch: async args => {
    assert.equal(args.filters.paginationMode, 'cursor');
    calls++;
    return calls === 1 ? batch([event('first', 1)], true, Date.parse(event('end', 1).datetime)) : batch([event('later', 2)]);
  } });
  const state = await session.load(20);
  assert.equal(calls, 2);
  assert.deepEqual(state.events.map(e => e.id), ['first', 'later']);
  assert.equal(state.hasMore, false);
});

test('chronological pages wait for provider boundaries and never repeat published events', async () => {
  let calls = 0;
  const local = Array.from({ length: 80 }, (_, i) => event(`local-${i}`, i + 1, 500, 'smsticket'));
  const session = createEventSearchSession({ fetchBatch: async () => {
    calls++;
    if (calls === 1) return batch([...local, event('tm-first', 1)], true, Date.parse(event('bound', 3).datetime));
    if (calls === 2) return batch([event('tm-next', 4)], true, Date.parse(event('bound', 10).datetime));
    return batch([event('tm-final', 11)]);
  } });
  const first = await session.load(20);
  const firstIds = first.events.slice(0, 20).map(e => e.id);
  const seen = new Set(firstIds);
  for (let page = 2; page <= 5; page++) {
    const state = await session.load(page * 20);
    assert.deepEqual(state.events.slice(0, 20).map(e => e.id), firstIds);
    for (const e of state.events.slice((page - 1) * 20, page * 20)) {
      assert.ok(!seen.has(e.id), e.id); seen.add(e.id);
    }
  }
  assert.equal(seen.size, 83);
  assert.equal(calls, 3);
});

test('local price filtering considers a cheap event beyond the first 300 candidates', async () => {
  const events = Array.from({ length: 301 }, (_, i) => event(`sms-${i}`, i + 1, i === 300 ? 50 : 1000, 'smsticket'));
  let ratesCalls = 0;
  const session = createEventSearchSession({ filters: { maxPrice: 100, priceCurrency: 'CZK' },
    fetchBatch: async () => batch(events), getRates: async () => { ratesCalls++; return {}; } });
  const state = await session.load(20);
  assert.deepEqual(state.events.map(e => e.id), ['sms-300']);
  assert.equal(state.hasMore, false);
  assert.equal(ratesCalls, 1);
});

test('distinct provider IDs with the same title, city and time survive a page boundary', async () => {
  const events = ['one', 'two'].map(id => ({
    ...event(id, 1, 500, 'colosseumticket'), title: 'Parallel workshop'
  }));
  const session = createEventSearchSession({ fetchBatch: async () => batch(events) });
  const first = await session.load(1);
  assert.equal(first.totalKnown, 2);
  const next = await session.load(2);
  assert.deepEqual(next.events.map(e => e.id), ['one', 'two']);
});

test('zero affordable results remain resumable when the bounded remote search is incomplete', async () => {
  let calls = 0, ratesCalls = 0;
  const session = createEventSearchSession({ filters: { maxPrice: 100, priceCurrency: 'CZK' },
    getRates: async () => { ratesCalls++; return {}; }, fetchBatch: async ({ filters }) => {
      calls++;
      assert.equal(filters.includeSmsticket, calls === 1);
      if (calls > 1) assert.equal(filters.ticketmasterCursor.streams.test.nextPage, calls);
      return batch([event(`page-${calls}`, calls, calls === 6 ? 50 : 1000)], calls < 6,
        Date.parse(event('bound', calls).datetime), calls + 1);
    } });
  const first = await session.load(20, { maxBatches: 3 });
  assert.equal(first.events.length, 0); assert.equal(first.hasMore, true); assert.equal(calls, 3);
  const continued = await session.load(20, { maxBatches: 3 });
  assert.deepEqual(continued.events.map(e => e.id), ['page-6']);
  assert.equal(continued.hasMore, false); assert.equal(ratesCalls, 1);
});

test('a price search does not claim unknown or unconvertible prices match', async () => {
  const session = createEventSearchSession({ filters: { maxPrice: 100, priceCurrency: 'CZK' },
    getRates: async () => { throw new Error('FX unavailable'); }, fetchBatch: async () => batch([
      event('known', 1, 50), { ...event('foreign', 2), priceFrom: '1 GBP', currency: 'GBP' },
      { ...event('unknown', 3), priceFrom: null, currency: '' }
    ]) });
  assert.deepEqual((await session.load(20)).events.map(e => e.id), ['known']);
});

test('no price filter does not request exchange rates and excludes expired Ticketmaster dates', async () => {
  const session = createEventSearchSession({ getRates: async () => { throw new Error('must not fetch FX'); },
    now: () => new Date('2026-10-12'), fetchBatch: async () => batch([
      { ...event('past', 1), datetime: '2022-01-01' }, event('future', 2)
    ]) });
  assert.deepEqual((await session.load(6)).events.map(e => e.id), ['future']);
});

test('latest ordering uses the reverse safe boundary', async () => {
  let calls = 0;
  const session = createEventSearchSession({ filters: { sort: 'latest' }, fetchBatch: async () => ++calls === 1
    ? batch([event('local-early', 1), event('latest', 30)], true, Date.parse(event('bound', 20).datetime))
    : batch([event('middle', 10)]) });
  assert.deepEqual((await session.load(1)).events.map(e => e.id), ['latest']);
  assert.deepEqual((await session.load(6)).events.map(e => e.id), ['latest', 'middle', 'local-early']);
});

test('complete local candidates are ranked before the AI preview is cut', async () => {
  const events = Array.from({ length: 120 }, (_, i) => ({ ...event(`sms-${i}`, i + 1, 500, 'smsticket'), title: i === 100 ? 'Rockový muzikál' : 'Hamlet' }));
  const session = createEventSearchSession({ filters: { searchMode: 'discovery', keywordMatch: 'soft', sort: 'relevance', keyword: 'rock muzikál' }, fetchBatch: async () => batch(events) });
  assert.equal((await session.load(6)).events[0].id, 'sms-100');
});

test('first-page provider promotions are committed once and do not recur', async () => {
  const all = Array.from({ length: 81 }, (_, i) => event(`event-${i}`, i + 1));
  const session = createEventSearchSession({ fetchBatch: async () => batch(all),
    mixFirstPage: events => [events.at(-1), ...events.slice(0, -1)] });
  const seen = new Set();
  for (let page = 1; page <= 5; page++) {
    const state = await session.load(page * 20);
    if (page === 1) assert.equal(state.events[0].id, 'event-80');
    for (const e of state.events.slice((page - 1) * 20, page * 20)) { assert.ok(!seen.has(e.id)); seen.add(e.id); }
  }
  assert.equal(seen.size, 81);
});

test('upstream totals and proxy-preserved page state survive filtering and deduplication', () => {
  assert.equal(ticketmasterPageInfo({ _embedded: { events: [] }, page: { totalPages: 2 } }, { page: 0, size: 50 }).hasMore, true);
  const saved = { hasMore: true, nextPage: 3, frontier: 500 };
  assert.equal(ticketmasterPageInfo({ _ajseePageInfo: saved, page: { totalPages: 0 } }, { page: 2, size: 50 }), saved);
});

test('a failed source releases partial local data and requires a fresh search for ordering', async () => {
  let calls = 0;
  const session = createEventSearchSession({ fetchBatch: async () => {
    calls++;
    return withEventPageInfo([event('available-local', 3, 500, 'smsticket')], {
      hasMore: true, frontier: null, interrupted: true,
      ticketmasterCursor: { streams: { retry: { hasMore: true, nextPage: 0, frontier: null, failed: true } } }
    });
  } });
  const result = await session.load(20);
  assert.equal(calls, 1, 'a timeout must not trigger three automatic retries');
  assert.deepEqual(result.events.map(e => e.id), ['available-local']);
  assert.equal(result.incomplete, true);
  assert.equal(result.pending, true);
  assert.equal(result.hasMore, false, 'continuation cannot append unknown earlier events behind a published page');
  await session.load(40);
  assert.equal(calls, 1);
});

test('a failed source never turns an empty partial search into definitive zero', async () => {
  const session = createEventSearchSession({ fetchBatch: async () => withEventPageInfo([], {
    hasMore: false, failedProviders: ['colosseumticket'], ticketmasterCursor: { streams: {} }
  }) });
  const result = await session.load(6);
  assert.equal(result.events.length, 0);
  assert.equal(result.incomplete, true);
  assert.equal(result.pending, true);
});

test('exchange rates and providers start together rather than adding their latency', async () => {
  let finishRates;
  let providerStarted = false;
  const session = createEventSearchSession({ filters: { maxPrice: 100, priceCurrency: 'CZK' },
    getRates: () => new Promise(resolve => { finishRates = resolve; }),
    fetchBatch: async () => { providerStarted = true; return batch([event('local', 1, 50)]); }
  });
  const running = session.load(6);
  await new Promise(resolve => setImmediate(resolve));
  const startedBeforeRates = providerStarted;
  finishRates({});
  const result = await running;
  assert.equal(startedBeforeRates, true);
  assert.deepEqual(result.events.map(e => e.id), ['local']);
});

test('geographic coverage survives later remote batches that skip local providers', async () => {
  let calls = 0;
  const session = createEventSearchSession({ fetchBatch: async () => {
    calls++;
    return withEventPageInfo([event(`geo-${calls}`, calls)], {
      hasMore: calls < 2, frontier: Date.parse(event('boundary', calls).datetime), ticketmasterCursor: { streams: {} },
      ...(calls === 1 ? { geographyCoverage: { colosseumticket: { located: 3, missing: 2 } } } : {})
    });
  } });
  const result = await session.load(20);
  assert.equal(calls, 2);
  assert.equal(result.geographyLimited, true);
  assert.deepEqual(result.geographyCoverage.colosseumticket, { located: 3, missing: 2 });
});
