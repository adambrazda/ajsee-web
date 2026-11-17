import { syncPlaceSearchParams, isNearMePlace } from './event-place-runtime.js';
import { syncPriceFilterSearchParams } from './event-price.js';
import { syncAiSearchParams } from './search/event-relevance.js';

export const CATALOGUE_FILTERS_HASH = '#events-filters-form';
export const CATALOGUE_RESULTS_HASH = '#events-upcoming-title';
const TRANSFER_KEY = 'ajsee.catalogue-search';
const DRAFT_KEY = 'ajsee.home-search-draft';
const MAX_AGE = 30 * 60 * 1000;
const LOCALES = new Set(['en', 'de', 'sk', 'pl', 'hu']);
const FILTER_KEYS = [
  'segment', 'city', 'cityCc', 'country', 'countryCode', 'from', 'to', 'dateFrom', 'dateTo',
  'priceMax', 'maxPrice', 'priceCurrency', 'audience', 'placeType', 'lat', 'lon',
  'nearMeLat', 'nearMeLon', 'q', 'keyword', 'search', 'searchMode', 'sort'
];

export function cataloguePath(locale) {
  return LOCALES.has(locale) ? `/${locale}/events/` : '/events';
}

export function hasCatalogueFilterParams(params) {
  return FILTER_KEYS.some(key => params.has(key));
}

export function syncCatalogueFilterParams(params, filters) {
  syncPlaceSearchParams(params, filters);
  syncPriceFilterSearchParams(params, filters);
  syncAiSearchParams(params, filters);

  const values = {
    from: filters.dateFrom,
    to: filters.dateTo,
    segment: filters.category !== 'all' && filters.category,
    audience: filters.audience === 'family' && 'family',
    q: filters.keyword,
    sort: filters.sort !== 'nearest' && filters.sort
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  for (const key of ['dateFrom', 'dateTo', 'datePreset', 'keyword', 'search']) params.delete(key);
}

function recordKey(url) {
  return url.pathname.replace(/\/$/, '').replace(/\.html$/, '') + url.search + url.hash;
}

function isFresh(record) {
  const age = Date.now() - record?.createdAt;
  return age >= 0 && age < MAX_AGE;
}

function readSession(win, key) {
  try { return JSON.parse(win.sessionStorage.getItem(key)); }
  catch { return null; }
}

function writeSession(win, key, record) {
  try {
    if (record) win.sessionStorage.setItem(key, JSON.stringify(record));
    else win.sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
}

export function readHomepageSearchDraft(win = window) {
  const record = readSession(win, DRAFT_KEY);
  return isFresh(record) && typeof record.query === 'string' ? record.query : '';
}

export function rememberHomepageSearchDraft(input, win = window) {
  if (!input) return;
  input.value ||= readHomepageSearchDraft(win);
  win.addEventListener('pagehide', () => {
    const query = input.value.trim();
    writeSession(win, DRAFT_KEY, query ? { query: query.slice(0, 1024), createdAt: Date.now() } : null);
  });
}

// The private fields travel separately from the address used for sharing.
export function catalogueHistoryRecord(url, filters, transfer) {
  if (!transfer) return null;
  const privateFilters = {};
  if (transfer.query) {
    if (filters.keyword) privateFilters.keyword = filters.keyword;
    url.searchParams.delete('q');
  }
  if (isNearMePlace(filters)) {
    const { nearMeLat, nearMeLon, nearMeRadiusKm } = filters;
    Object.assign(privateFilters, { placeType: 'nearMe', nearMeLat, nearMeLon, nearMeRadiusKm });
    url.searchParams.delete('lat');
    url.searchParams.delete('lon');
  }
  return { ...transfer, key: recordKey(url), privateFilters };
}

export function navigateToCatalogue({ locale, filters = {}, query = '', notice = '', question = '', replace = false }, win = window) {
  const url = new URL(cataloguePath(locale), win.location.origin);
  const privateSearch = Boolean(query || notice || isNearMePlace(filters));
  url.hash = notice ? CATALOGUE_FILTERS_HASH : CATALOGUE_RESULTS_HASH;
  syncCatalogueFilterParams(url.searchParams, filters);

  const record = privateSearch ? catalogueHistoryRecord(url, filters, {
    query: query.slice(0, 1024),
    notice,
    question: question.slice(0, 512),
    createdAt: Date.now()
  }) : null;
  const saved = writeSession(win, TRANSFER_KEY, record);
  if (record && !saved) url.hash = CATALOGUE_FILTERS_HASH;

  if (replace) win.location.replace(url.href);
  else win.location.assign(url.href);
}

export function readCatalogueTransfer(win = window) {
  const key = recordKey(new URL(win.location.href));
  const pending = readSession(win, TRANSFER_KEY);
  if (pending?.key === key) {
    writeSession(win, TRANSFER_KEY, null);
    if (isFresh(pending)) return pending;
  }
  const historyRecord = win.history.state?.catalogueSearch;
  return historyRecord?.key === key && isFresh(historyRecord) ? historyRecord : null;
}
