import test from 'node:test';
import assert from 'node:assert/strict';
import { entryRuntime } from './helpers/entry-runtime.mjs';
import { getDatePresetRange } from '../src/events-filter-ux.js';
import {
  CATALOGUE_FILTERS_HASH, CATALOGUE_RESULTS_HASH,
  catalogueHistoryRecord, navigateToCatalogue, readCatalogueTransfer
} from '../src/catalogue-search.js';

function browserTab() {
  const data = new Map();
  const win = {
    location: {
      origin: 'https://ajsee.test',
      assign(href) { this.href = href; },
      replace(href) { this.href = href; this.replaced = true; }
    },
    history: { state: null },
    sessionStorage: {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: key => data.delete(key)
    }
  };
  return win;
}

test('AI handoff preserves filters on the localized catalogue and keeps the query out of URLs', () => {
  const win = browserTab();
  const query = 'Find a concert in Prague under 800 CZK';
  const filters = {
    category: 'concert', city: 'Praha', cityLabel: 'Praha', cityCountryCode: 'CZ',
    countryCode: 'CZ', placeType: 'city',
    dateFrom: '2099-10-17', dateTo: '2099-10-18', maxPrice: 800, priceCurrency: 'CZK',
    keyword: 'Jazz', searchMode: 'exact', keywordMatch: 'strict', sort: 'relevance'
  };
  navigateToCatalogue({ locale: 'en', query, filters }, win);
  const url = new URL(win.location.href);
  assert.equal(url.pathname, '/en/events/');
  assert.equal(url.hash, CATALOGUE_RESULTS_HASH);
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(url.href.includes(encodeURIComponent(query)), false);
  const runtime = entryRuntime('events-entry.js', { query: url.search, locale: 'en' });
  runtime.init();
  assert.equal(runtime.read().category, 'concert');
  assert.equal(runtime.read().city, 'Praha');
  assert.equal(runtime.read().dateFrom, '2099-10-17');
  assert.equal(runtime.read().dateTo, '2099-10-18');
  assert.equal(runtime.read().maxPrice, 800);
  runtime.dom.window.close();

  const transfer = readCatalogueTransfer(win);
  assert.equal(transfer.query, query);
  assert.equal(transfer.privateFilters.keyword, 'Jazz');
  assert.equal(readCatalogueTransfer(win), null);
  win.history.state = { catalogueSearch: catalogueHistoryRecord(url, filters, transfer) };
  assert.equal(readCatalogueTransfer(win).privateFilters.keyword, 'Jazz');
});

test('nearby handoff restores exact position in this tab without exposing it in the URL', () => {
  const win = browserTab();
  const filters = { placeType: 'nearMe', nearMeLat: 50.08123, nearMeLon: 14.43789, nearMeRadiusKm: 50 };
  navigateToCatalogue({ locale: 'cs', filters }, win);
  const url = new URL(win.location.href);
  assert.equal(url.pathname, '/events');
  assert.equal(url.searchParams.get('placeType'), 'nearMe');
  assert.equal(url.searchParams.has('lat'), false);
  assert.equal(url.searchParams.has('lon'), false);
  assert.deepEqual(readCatalogueTransfer(win).privateFilters, filters);
});

test('failed and partial searches open manual filters, including when session storage is blocked', () => {
  const win = browserTab();
  navigateToCatalogue({ locale: 'cs', query: 'My query', notice: 'failed' }, win);
  assert.equal(new URL(win.location.href).hash, CATALOGUE_FILTERS_HASH);
  assert.equal(readCatalogueTransfer(win).notice, 'failed');
  navigateToCatalogue({ locale: 'cs', query: 'Another query', notice: 'partial',
    question: 'Which date?', filters: { category: 'theatre' } }, win);
  assert.equal(new URL(win.location.href).searchParams.get('segment'), 'theatre');
  assert.equal(readCatalogueTransfer(win).question, 'Which date?');

  win.sessionStorage.setItem = () => { throw new Error('Storage disabled'); };
  navigateToCatalogue({ locale: 'cs', query: 'Find this', filters: { keyword: 'Private term', category: 'sport' } }, win);
  assert.equal(new URL(win.location.href).hash, CATALOGUE_FILTERS_HASH);
  assert.equal(new URL(win.location.href).searchParams.has('q'), false);
});

test('weekend quick link materializes real dates and preserves them in the catalogue address', () => {
  const runtime = entryRuntime('events-entry.js', { query: '?datePreset=weekend' });
  runtime.init();
  const { from, to } = getDatePresetRange('weekend');
  assert.equal(runtime.read().dateFrom, from);
  assert.equal(runtime.read().dateTo, to);
  runtime.sync();
  const query = new URLSearchParams(runtime.dom.window.location.search);
  assert.equal(query.get('from'), from);
  assert.equal(query.get('to'), to);
  assert.equal(query.has('datePreset'), false);
  runtime.dom.window.close();
});
