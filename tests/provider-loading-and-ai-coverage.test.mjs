import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/api/eventsApi.js';
import { createEventSearchSession } from '../src/event-search-session.js';

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });
const response = data => new Response(JSON.stringify(data));
const local = (partner, id, title) => ({
  id: `${partner}-${id}`, partner, sourceId: id, title, category: 'concert',
  datetime: '2099-01-01T19:00:00+01:00', location: { city: 'Praha', country: 'CZ' },
  venue: { name: id, city: 'Praha', country: 'CZ' }, categories: ['Hudba'], types: ['Hudba'],
  tickets: `https://${partner === 'smsticket' ? 'www.smsticket.cz/vstupenky' : 'colosseumticket.cz/cs/akce'}/${id}?a_box=kept`
});

test('independent local feeds start while Ticketmaster is still waiting', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = [];
  globalThis.fetch = async input => {
    const path = new URL(input, 'https://ajsee.test').pathname;
    started.push(path);
    if (path.includes('ticketmasterEvents')) {
      await waiting;
      return response({ page: { totalPages: 0 } });
    }
    if (path.includes('smsticket-events')) return response({ events: [local('smsticket', 'parallel', 'Local concert')] });
    if (path.includes('colosseumticket-events')) return response({ events: [local('colosseumticket', 'parallel-col', 'Another concert')] });
    throw new Error(`Unexpected fetch ${path}`);
  };
  const pending = fetchEvents({ locale: 'cs', filters: { countryCode: 'CZ', paginationMode: 'cursor', allLocalEvents: true } });
  await new Promise(resolve => setImmediate(resolve));
  const beforeRelease = [...started];
  release();
  const events = await pending;
  assert.ok(beforeRelease.some(path => path.includes('smsticket-events')), 'SMS Ticket must start before Ticketmaster resolves');
  assert.ok(beforeRelease.some(path => path.includes('colosseumticket-events')), 'Colosseum must start before Ticketmaster resolves');
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.tickets.includes('a_box=kept')));
});

test('AI finds a remote match beyond the chronological prefix before publishing its preview', async () => {
  const queries = [];
  const raw = (id, name) => ({
    id, name, url: `https://www.ticketmaster.co.uk/event/${id}`,
    classifications: [{ segment: { name: 'Arts & Theatre' }, genre: { name: 'Theatre' } }],
    dates: { start: { localDate: '2099-02-01', dateTime: '2099-02-01T19:00:00Z' }, timezone: 'Europe/London' },
    _embedded: { venues: [{ name: 'Theatre', city: { name: 'London' }, country: { countryCode: 'GB' } }] }
  });
  const inventory = Array.from({ length: 120 }, (_, i) => raw(`remote-${i}`, i === 100 ? 'Rock Musical' : `Hamlet ${i}`));
  globalThis.fetch = async input => {
    const url = new URL(input, 'https://ajsee.test');
    assert.ok(url.pathname.includes('ticketmasterEvents'));
    queries.push(url);
    const keyword = url.searchParams.get('keyword');
    const matches = keyword ? inventory.filter(event => event.name.toLowerCase().includes(keyword.toLowerCase())) : inventory;
    const page = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    return response({ _embedded: { events: matches.slice(page * size, (page + 1) * size) }, page: { totalPages: Math.ceil(matches.length / size) } });
  };
  const session = createEventSearchSession({ filters: {
    placeType: 'country', countryCode: 'GB', category: 'theatre', keyword: 'rock muzikál',
    searchMode: 'discovery', keywordMatch: 'soft', sort: 'relevance'
  }, fetchBatch: fetchEvents });
  const result = await session.load(6);
  assert.equal(result.events[0]?.id, 'ticketmaster-remote-100');
  assert.ok(queries.some(url => url.searchParams.get('keyword') === 'rock musical'));
  assert.ok(queries.some(url => !url.searchParams.has('keyword')), 'soft discovery must retain a broad candidate stream');
  assert.ok(queries.every(url => url.searchParams.get('countryCode') === 'GB'), 'targeted searches must retain the country');
  assert.equal(result.hasMore, true, 'ranking must not claim the remote inventory is exhausted');
});

test('place-free AI targets remote markets while broad discovery retains the CZ default', async () => {
  const queries = [];
  globalThis.fetch = async input => {
    const url = new URL(input, 'https://ajsee.test');
    assert.ok(url.pathname.includes('ticketmasterEvents'));
    queries.push(url);
    return response({ page: { totalPages: 0 } });
  };
  await fetchEvents({ locale: 'cs', filters: { keyword: 'jazz', countryCode: 'CZ',
    searchMode: 'discovery', keywordMatch: 'soft', sort: 'relevance', paginationMode: 'cursor' } });
  const targeted = queries.filter(url => url.searchParams.has('keyword'));
  const broad = queries.filter(url => !url.searchParams.has('keyword'));
  assert.ok(targeted.length > 0 && targeted.every(url => !url.searchParams.has('countryCode') && url.searchParams.get('locale') === '*'));
  assert.ok(broad.length > 0 && broad.every(url => url.searchParams.get('countryCode') === 'CZ'));
});

test('a stuck Ticketmaster body settles within the provider budget and can be retried', async () => {
  let attempts = 0;
  let requestSignal;
  globalThis.fetch = async (input, options) => {
    assert.ok(String(input).includes('ticketmasterEvents'));
    attempts++;
    requestSignal = options.signal;
    return { ok: true, status: 200, text: () => new Promise(() => {}) };
  };
  const filters = { countryCode: 'CZ', dateFrom: '2099-06-01', paginationMode: 'cursor', allLocalEvents: true };
  const started = performance.now();
  const session = createEventSearchSession({ filters, fetchBatch: fetchEvents });
  const result = await session.load(20);
  assert.ok(performance.now() - started < 6500);
  assert.equal(attempts, 1, 'timeout must stop additional fallbacks');
  assert.equal(requestSignal.aborted, true);
  assert.equal(result.incomplete, true);
  assert.equal(result.pending, true);
  globalThis.fetch = async () => { attempts++; return response({ page: { totalPages: 0 } }); };
  const recovered = await createEventSearchSession({ filters, fetchBatch: fetchEvents }).load(20);
  assert.ok(attempts > 1, 'a rejected response must not poison the request cache');
  assert.equal(recovered.incomplete, false);
});
