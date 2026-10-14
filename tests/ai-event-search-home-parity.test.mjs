import test from 'node:test';
import assert from 'node:assert/strict';
import { entryRuntime } from './helpers/entry-runtime.mjs';
import { entryFunction } from './helpers/entry-function.mjs';
import { createEventListingSession, EVENT_LISTING_PAGE_SIZE, eventListingBatchLimit } from '../src/event-search-listing.js';
import { withEventPageInfo } from '../src/event-pagination.js';

const queries = [
  '', '?city=Hodon%C3%ADn&cityCc=CZ', '?city=Brno&from=2099-10-17&to=2099-10-18&segment=theatre&priceMax=500&priceCurrency=CZK',
  '?city=London&cityCc=GB', '?city=Jihlava&cityCc=CZ', '?country=DE', '?countryCode=FR', '?city=N%C4%9Bmecko',
  '?q=Hamlet', '?keyword=Hamlet', '?search=Hamlet', '?audience=family&from=2099-10-14&to=2099-10-20',
  '?priceMax=0&priceCurrency=CZK', '?placeType=cityRadius&city=Praha&cityCc=CZ&lat=50.08&lon=14.43&radius=30',
  '?placeType=nearMe&lat=48.849&lon=17.132&radius=10',
  '?q=rock+muzik%C3%A1l&searchMode=discovery&keywordMatch=soft&sort=relevance&country=GB',
  '?q=rock+muzik%C3%A1l&searchMode=discovery&keywordMatch=soft&sort=relevance&city=London&cityCc=GB'
];
for (const query of queries) test(`homepage and Events restore the same filters: ${query || 'default'}`, () => {
  for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
    const home = entryRuntime('home-entry.js', { query, locale });
    const events = entryRuntime('events-entry.js', { query, locale });
    try {
      home.init(); events.init();
      assert.deepEqual(home.read(), events.read(), locale);
      assert.deepEqual(home.api(home.read()), events.api(events.read()), locale);
      home.sync(); events.sync();
      assert.equal(home.dom.window.location.search, events.dom.window.location.search);
      if (query === '?country=DE') {
        assert.equal(home.read().countryCode, 'DE');
        assert.equal(home.dom.window.location.search, '?country=DE');
      }
      if (query.includes('Hamlet')) assert.equal(home.read().keyword, 'Hamlet');
    } finally { home.dom.window.close(); events.dom.window.close(); }
  }
});

for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) test(`empty place uses the same market on form submission: ${locale}`, () => {
  for (const cookie of ['', 'aj_country=AT']) {
    const home = entryRuntime('home-entry.js', { locale, cookie }), events = entryRuntime('events-entry.js', { locale, cookie });
    try { home.form(); events.form(); assert.deepEqual(home.read(), events.read()); }
    finally { home.dom.window.close(); events.dom.window.close(); }
  }
});

test('country and city typeahead selections produce identical search state', () => {
  for (const item of [{ label: 'Germany', countryCode: 'DE', type: 'country' },
    { label: 'A country label', countryCode: 'FR', kind: 'country-only' },
    { city: 'Hodonín', countryCode: 'CZ' }, { city: 'Unknown selected city', countryCode: 'GB' }]) {
    const home = entryRuntime('home-entry.js'), events = entryRuntime('events-entry.js');
    try {
      for (const runtime of [home, events]) runtime.choose(runtime.dom.window.document.querySelector('#filter-city')).onChoose(item);
      assert.deepEqual(home.read(), events.read());
    } finally { home.dom.window.close(); events.dom.window.close(); }
  }
});

test('homepage publishes the same first-six results after the same complete first-page search', async () => {
  const inventory = Array.from({ length: 25 }, (_, i) => ({ id: 'event-' + i,
    partner: i === 24 ? 'smsticket' : 'colosseumticket', title: 'Event ' + i,
    datetime: `2099-01-${String(i + 1).padStart(2, '0')}T19:00:00Z`, priceFrom: '50 CZK', currency: 'CZK',
    tickets: `https://example.test/${i}?a_box=preserved` }));
  for (const filters of [{ countryCode: 'CZ' }, { countryCode: 'CZ', maxPrice: 100, priceCurrency: 'CZK' },
    { countryCode: 'CZ', keyword: 'Event', keywordMatch: 'strict', searchMode: 'exact', sort: 'relevance' }]) {
    const requests = [[], []];
    const fetchBatch = side => async ({ filters: request }) => {
      requests[side].push({ size: request.size, includeSmsticket: request.includeSmsticket });
      return withEventPageInfo(inventory, { hasMore: false });
    };
    const home = entryFunction('home-entry.js', 'fetchHomeEventsForRender', {
      createEventListingSession, EVENT_LISTING_PAGE_SIZE, eventListingBatchLimit,
      getAllHomeEvents: fetchBatch(0), getRatesForPriceFilter: async () => ({})
    });
    const result = await home('cs', filters);
    const session = createEventListingSession({ locale: 'cs', filters, fetchBatch: fetchBatch(1), getRates: async () => ({}) });
    const events = await session.load(20, { maxBatches: eventListingBatchLimit(filters) });
    assert.deepEqual(result.slice(0, 6).map(e => e.id), events.events.slice(0, 6).map(e => e.id));
    assert.deepEqual(requests[0], requests[1]);
    assert.ok(result.every(e => e.tickets.endsWith('?a_box=preserved')));
    if (!filters.keyword) assert.equal(result[2].partner, 'smsticket');
  }
});

test('homepage matches the Events empty-state message and actions in all locales', () => {
  for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
    const home = entryRuntime('home-entry.js', { locale }), events = entryRuntime('events-entry.js', { locale });
    try {
      for (const runtime of [home, events]) { runtime.set({ city: 'Hodonín', cityLabel: 'Hodonín', placeType: 'city', maxPrice: 100, priceCurrency: 'CZK' }); runtime.empty(); }
      const copy = runtime => ['h3', 'p', '[data-ajsee-events-remove-filter]', '[data-ajsee-events-clear]'].map(s => runtime.dom.window.document.querySelector('#eventsList ' + s)?.textContent.trim());
      assert.deepEqual(copy(home), copy(events), locale);
    } finally { home.dom.window.close(); events.dom.window.close(); }
  }
});

test('removing the recommended price filter keeps city, category and dates', async () => {
  const home = entryRuntime('home-entry.js');
  try {
    home.set({ city: 'Hodonín', cityLabel: 'Hodonín', cityCountryCode: 'CZ', placeType: 'city',
      category: 'theatre', dateFrom: '2099-10-17', dateTo: '2099-10-18', maxPrice: 100, priceCurrency: 'CZK' });
    home.empty();
    home.dom.window.document.querySelector('[data-ajsee-events-remove-filter]').click();
    await new Promise(resolve => setImmediate(resolve));
    const state = home.read();
    assert.equal(state.maxPrice, null);
    assert.equal(state.city, 'Hodonín'); assert.equal(state.category, 'theatre'); assert.equal(state.dateFrom, '2099-10-17');
    assert.equal(home.renders.length, 1);
  } finally { home.dom.window.close(); }
});

test('clearing the empty state resets all filters and restores the saved market', async () => {
  const home = entryRuntime('home-entry.js', { locale: 'de', cookie: 'aj_country=AT' });
  try {
    home.set({ city: 'Hodonín', cityLabel: 'Hodonín', cityCountryCode: 'CZ', placeType: 'city',
      category: 'theatre', audience: 'family', dateFrom: '2099-10-17', dateTo: '2099-10-18',
      maxPrice: 100, priceCurrency: 'CZK', keyword: 'Hamlet', searchMode: 'exact', keywordMatch: 'strict' });
    home.empty();
    home.dom.window.document.querySelector('[data-ajsee-events-clear]').click();
    await new Promise(resolve => setImmediate(resolve));
    const state = home.read();
    assert.equal(state.city, ''); assert.equal(state.countryCode, 'AT'); assert.equal(state.category, 'all');
    assert.equal(state.audience, ''); assert.equal(state.dateFrom, ''); assert.equal(state.maxPrice, null);
    assert.equal(state.keyword, ''); assert.equal(state.searchMode, undefined); assert.equal(home.renders.length, 1);
  } finally { home.dom.window.close(); }
});
