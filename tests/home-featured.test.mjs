import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { entryFunction } from './helpers/entry-function.mjs';
import { isHomeDiscovery } from '../src/home-discovery.js';
import { selectHomeFeaturedEvents, buildHomeFeaturedPool, isHomeFeaturedEligible, homeFeaturedBucket } from '../src/home-featured-selection.js';
import { collectHomeFeaturedSources, createHomeFeaturedSnapshot } from '../shared/home-featured-source.js';
import { renderHomeFeaturedMarkup, loadHomeFeaturedSnapshot } from '../src/home-featured.js';
import { createHomeFeaturedHandler } from '../netlify/functions/home-featured.js';
import { createHomeFeaturedRefresh } from '../netlify/functions/home-featured-refresh.js';

const now = new Date('2099-01-01T12:00:00Z');
const make = (id, bucket = 'concert', extra = {}) => ({ id, title: 'Event ' + id, partner: 'smsticket',
  date: '2099-01-10', time: '19:00', datetime: '2099-01-10T19:00:00',
  location: { city: 'Brno', country: 'CZ' }, venue: { name: 'Venue', city: 'Brno' },
  image: 'https://www.smsticket.cz/cdn/events/image.jpg',
  types: [bucket === 'concert' ? 'Koncert' : bucket === 'stage' ? 'Divadlo' : bucket === 'festival' ? 'Festival' : 'Sport'],
  categories: [bucket === 'stage' ? 'Představení' : bucket === 'sport' ? 'Sport' : 'Hudba'],
  tickets: 'https://www.smsticket.cz/vstupenky/' + id + '?a_box=preserved',
  taxonomy: { domains: [bucket === 'stage' ? 'stage' : bucket === 'sport' ? 'sport' : 'music'],
    eventTypes: [bucket === 'festival' ? 'festival' : bucket], genres: bucket === 'festival' ? ['rock'] : [] }, ...extra });

test('recommendations are distinct titles and balance the available live categories', () => {
  const events = [make('c1'), make('c2'), make('s1', 'stage'), make('s2', 'stage'), make('sport', 'sport'),
    make('f', 'festival'), make('repeat', 'concert', { title: 'EVENT C1', location: { city: 'Praha', country: 'CZ' } })];
  const chosen = selectHomeFeaturedEvents(events, {}, { now });
  assert.equal(chosen.length, 6);
  assert.equal(new Set(chosen.map(event => String(event.title).toLowerCase())).size, 6);
  assert.deepEqual(chosen.map(homeFeaturedBucket), ['concert', 'concert', 'stage', 'stage', 'sport', 'festival']);
  assert.equal(chosen[0], events[0]);
  assert.ok(chosen.every(event => event.tickets.endsWith('a_box=preserved')));
});

test('redaction selects the next eligible performance and automatically drops an expired pin', () => {
  const pin = { provider: 'colosseumticket', providerEventId: 'pin' };
  const base = { partner: 'colosseumticket', providerEventId: 'pin', title: 'Pinned show', tickets: 'https://colosseumticket.cz/cs/udalost/pin?a_box=keep' };
  const events = [make('expired', 'stage', { ...base, date: '2099-01-01', datetime: '2099-01-01T19:00:00' }),
    make('next', 'stage', { ...base, date: '2099-01-04', datetime: '2099-01-04T19:00:00' }), make('later', 'stage', { ...base, date: '2099-01-06', datetime: '2099-01-06T19:00:00' }),
    ...Array.from({ length: 7 }, (_, index) => make('regular' + index))];
  const pool = buildHomeFeaturedPool(events, { editorial: [pin] }, { now });
  assert.equal(selectHomeFeaturedEvents(pool, {}, { now })[0].id, 'next');
  assert.equal(selectHomeFeaturedEvents(pool, {}, { now: new Date('2099-01-05T12:00:00Z') })[0].id, 'later');
});

test('invalid, started, canceled, postponed, undated and supplementary listings never become tips', () => {
  for (const extra of [{ datetime: '2099-01-01T11:00:00', date: '2099-01-01' },
    { saleStatus: 'cancelled' }, { saleStatus: 'canceled' }, { saleStatus: 'postponed' },
    { dateAvailability: { dateTBA: true } }, { title: 'Parking pass' }, { image: '' },
    { tickets: 'https://smsticket.cz/vstupenky/1' }, { tickets: 'javascript:alert(1)' },
    { tickets: 'https://other.test/?a_box=keep' }, { location: { country: 'CZ' } }]) {
    assert.equal(isHomeFeaturedEligible(make('bad', 'concert', extra), { now }), false, JSON.stringify(extra));
  }
  assert.equal(isHomeFeaturedEligible(make('valid'), { now }), true);
  assert.equal(homeFeaturedBucket(make('dolls', 'festival', { taxonomy: { domains: ['experience'], eventTypes: ['festival'] } })), '');
});

test('unknown sales availability never becomes a sold-out claim, and offsale remains neutral', () => {
  assert.equal(isHomeFeaturedEligible(make('neutral', 'concert', { saleStatus: 'offsale', availability: null, seats: 0 }), { now }), true);
  const { markup } = renderHomeFeaturedMarkup({ policy: {}, events: [make('neutral', 'concert', { saleStatus: 'offsale', seats: 0 })] }, 'cs', { now });
  assert.doesNotMatch(markup, /event-sold-badge|Vyprodáno/);
});

test('foreign quota is respected without starving an available domestic category', () => {
  const foreign = [make('foreign1', 'sport', { location: { city: 'Vienna', country: 'AT' }, homeFeatured: { providerRelevance: 1 } }),
    make('foreign2', 'festival', { location: { city: 'Vienna', country: 'AT' }, homeFeatured: { providerRelevance: 1 } })];
  const events = [...foreign, make('localfestival', 'festival'), make('localmusic'), make('localmusic2'), make('localstage', 'stage'), make('localstage2', 'stage')];
  const chosen = selectHomeFeaturedEvents(events, { maxForeign: 1 }, { now });
  assert.equal(chosen.filter(event => event.location.country !== 'CZ').length, 1);
  assert.ok(chosen.some(event => event.id === 'localfestival'));
});

test('Ticketmaster cards retain the server outbound route and provider a_box links stay exact', () => {
  const destination = 'https://ticketmaster.cz/event/test?camefrom=preserved';
  const event = make('tm', 'concert', { partner: 'ticketmaster', tickets: '/.netlify/functions/tmOutbound?to=' + encodeURIComponent(destination) });
  const { markup } = renderHomeFeaturedMarkup({ events: [event, make('sms')], policy: {} }, 'en', { now });
  const dom = new JSDOM(markup, { url: 'https://ajsee.test/' });
  const tm = dom.window.document.querySelector('[data-partner="ticketmaster"]');
  const sms = dom.window.document.querySelector('[data-partner="smsticket"]');
  assert.equal(new URL(tm.href).pathname, '/.netlify/functions/tmOutbound');
  assert.equal(new URL(tm.href).searchParams.get('to'), destination);
  assert.equal(sms.getAttribute('href'), 'https://www.smsticket.cz/vstupenky/sms?a_box=preserved');
  dom.window.close();
});

test('an unavailable provider is disclosed in the snapshot while other sources remain usable', async () => {
  const feed = { events: Array.from({ length: 8 }, (_, index) => make('sms' + index)), syncedAt: now.toISOString() };
  const requested = [];
  const sources = await collectHomeFeaturedSources({ localFeeds: { smsticket: feed }, now,
    fetchJson: async url => { requested.push(String(url)); throw new Error('Unavailable'); } });
  const snapshot = createHomeFeaturedSnapshot(sources, {}, { now });
  assert.equal(snapshot.sources.smsticket.state, 'ok');
  assert.equal(snapshot.sources.colosseumticket.state, 'unavailable');
  assert.ok(snapshot.events.length >= 6);
  assert.ok(requested.some(url => url.includes('startDateTime=2099-01-02T12%3A00%3A00Z')));
  assert.ok(requested.every(url => !url.includes('apikey=')));
});

test('fresh inline recommendations need no network at all', async () => {
  const snapshot = { version: 1, generatedAt: now.toISOString(), policy: {}, events: [make('one')] };
  const dom = new JSDOM('<script id="home-featured-data" type="application/json"></script>');
  dom.window.document.querySelector('script').textContent = JSON.stringify(snapshot);
  const result = await loadHomeFeaturedSnapshot(dom.window.document, { now: +now,
    fetchImpl: () => { throw new Error('Initial homepage must not fetch a source'); } });
  assert.deepEqual(result, snapshot);
  dom.window.close();
});

test('homepage recommendations return before the complete listing fetch, while active search uses it', async () => {
  for (const filters of [{ category: 'all', maxPrice: null }, { city: 'Hodonín' }]) {
    const dom = new JSDOM('<h2 data-home-events-title></h2><div id="eventsList"></div>');
    let listingRequests = 0;
    const render = entryFunction('home-entry.js', 'renderEvents', {
      _lastSearchResult: null, _lastFetchSig: '', homeSearchRequested: false,
      document: dom.window.document, window: dom.window, isHome: () => true, isHomeDiscovery,
      t: (key, fallback) => fallback, setBusy() {}, loadHomeFeaturedSnapshot: async () => ({ events: [], policy: {} }),
      renderHomeFeaturedMarkup: () => ({ events: [], markup: '' }), ensureSharedEventGridStyles() {}, esc: String,
      wireHomeEventCards() {}, wireSharedEventImageFraming() {}, wireSharedEventCardAnalytics() {},
      buildApiFilters: value => value, makeFetchSig: () => 'search', pagination: { page: 1, perPage: 12 },
      fetchHomeEventsForRender: async () => { listingRequests++; throw new Error('Stop after observing the search request'); }
    });
    await render('cs', filters);
    assert.equal(listingRequests, filters.city ? 1 : 0);
    dom.window.close();
  }
});

test('all six locales name the recommendation block consistently and initial delays are removed', () => {
  for (const lang of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) {
    const source = JSON.parse(readFileSync(new URL('../src/locales/' + lang + '.json', import.meta.url), 'utf8'));
    const published = JSON.parse(readFileSync(new URL('../public/locales/' + lang + '.json', import.meta.url), 'utf8'));
    for (const key of ['home.events.title', 'home.events.intro', 'home.events.searchIntro', 'home.events.empty']) {
      assert.ok(source[key]); assert.equal(source[key], published[key]);
    }
  }
  const entry = readFileSync(new URL('../src/home-entry.js', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /setTimeout\(armInitialHomeEventsRender|setTimeout\(runInitialHomeEventsRender/);
});

test('the public snapshot endpoint serves cached or bundled data without invoking provider APIs', async () => {
  const fallback = { version: 1, generatedAt: '2099-01-01T00:00:00Z', events: Array.from({ length: 6 }, (_, index) => make('a' + index)) };
  const updated = { ...fallback, generatedAt: '2099-01-02T00:00:00Z' };
  const handler = createHomeFeaturedHandler({ fallback, getStoreFn: () => ({ get: async () => updated }) });
  assert.deepEqual(await (await handler(new Request('https://ajsee.test/', { method: 'GET' }))).json(), updated);
  assert.equal((await handler(new Request('https://ajsee.test/', { method: 'POST' }))).status, 405);
  const unavailable = createHomeFeaturedHandler({ fallback, getStoreFn: () => { throw new Error('Store unavailable'); } });
  assert.deepEqual(await (await unavailable(new Request('https://ajsee.test/'))).json(), fallback);
});

test('scheduled refresh cannot replace a good cached snapshot with a failed or insufficient source collection', async () => {
  const events = Array.from({ length: 8 }, (_, index) => make('event' + index));
  let writes = 0;
  const deps = { now: () => now, getStoreFn: () => ({ setJSON: async () => { writes++; } }) };
  await createHomeFeaturedRefresh({ ...deps, collectSources: async () => ({ events, sources: { smsticket: { state: 'unavailable' } } }) })();
  assert.equal(writes, 0);
  await createHomeFeaturedRefresh({ ...deps, collectSources: async () => ({ events: events.slice(0, 2), sources: { smsticket: { state: 'ok' } } }) })();
  assert.equal(writes, 0);
  await createHomeFeaturedRefresh({ ...deps, collectSources: async () => ({ events, sources: { smsticket: { state: 'ok' } } }) })();
  assert.equal(writes, 1);
});
