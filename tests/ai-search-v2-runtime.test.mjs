import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { hasAiRelevance, isSoftDiscovery, rankEventsByRelevance } from '../src/search/event-relevance.js';
const source = fs.readFileSync(new URL('../src/events-entry.js', import.meta.url), 'utf8');

for (const entry of ['events-entry.js', 'home-entry.js']) {
test(`${entry}: sort control follows AI, manual sort, reset and locale changes; keyboard buttons remain focusable`, async () => {
  const controlSource = fs.readFileSync(new URL('../src/' + entry, import.meta.url), 'utf8');
  const dom = new JSDOM('<div><select id="filter-sort"><option value="nearest">Soonest</option><option value="latest">Latest</option></select></div><label for="filter-keyword"></label>');
  const { document } = dom.window;
  const state = { sort: 'nearest' };
  let prefix = '';
  const end = entry === 'home-entry.js' ? 'function normalizeFilterFormUI()' : '/* ───────── geolocation';
  const code = controlSource.slice(controlSource.indexOf('let syncAiSortControl ='), controlSource.indexOf(end));
  let sync;
  const setup = new Function('document', 'window', 'qs', 'currentFilters', 't', 'isSoftDiscovery', 'requestAnimationFrame', 'wireOnce', 'renderAndSync', `let _userInteractedWithFilters = false; ${code}; upgradeSortToSegmented(); return syncAiSortControl;`);
  sync = setup(document, dom.window, selector => document.querySelector(selector), state,
    key => prefix + key, isSoftDiscovery, callback => callback(), () => {}, async () => sync());
  const relevance = document.querySelector('[data-sort="relevance"]');
  assert.equal(relevance.hidden, true);
  Object.assign(state, { searchMode: 'discovery', keywordMatch: 'soft', sort: 'relevance' });
  sync();
  assert.equal(relevance.hidden, false);
  assert.equal(relevance.getAttribute('aria-pressed'), 'true');
  assert.equal(relevance.tabIndex, 0);
  assert.equal(document.querySelector('#filter-sort').value, 'relevance');
  assert.equal(document.querySelector('label').textContent, 'filters.preference');
  document.querySelector('[data-sort="latest"]').click();
  assert.equal(state.sort, 'latest');
  assert.equal(document.querySelector('#filter-sort').value, 'latest');
  prefix = 'en:'; sync();
  assert.equal(relevance.textContent, 'en:filters.relevance');
  delete state.searchMode; delete state.keywordMatch; state.sort = 'nearest'; sync();
  assert.equal(relevance.hidden, true);
  assert.equal(document.querySelector('label').textContent, 'en:filters.keyword');
  dom.window.close();
});
}

test('buffer ranks across provider batches, while classic sort stays chronological', () => {
  const code = source.slice(source.indexOf('function sortBufferedEvents('), source.indexOf('async function fetchNextEventsBatch('));
  const pager = { buffer: [{ id: 'early', title: 'Hamlet', date: '2026-10-01' }] };
  const sort = new Function('eventsPager','hasAiRelevance','rankEventsByRelevance', code + '; return sortBufferedEvents;')(pager,hasAiRelevance,rankEventsByRelevance);
  pager.buffer.push({ id: 'best', title: 'Mamma Mia', date: '2026-10-03' });
  sort('relevance', { sort: 'relevance', searchMode: 'exact', keyword: 'Mamma Mia' });
  assert.deepEqual(pager.buffer.map(e => e.id), ['best','early']);
  sort('nearest');
  assert.deepEqual(pager.buffer.map(e => e.id), ['early','best']);
  sort('latest');
  assert.deepEqual(pager.buffer.map(e => e.id), ['best','early']);
});

test('a later high-scoring batch cannot displace already viewed pages or repeat events', () => {
  const code = source.slice(source.indexOf('function sortBufferedEvents('), source.indexOf('async function fetchNextEventsBatch('));
  const pager = { relevancePinnedCount: 1, buffer: [
    { id: 'viewed', title: 'Hamlet', date: '2026-10-01' },
    { id: 'unseen', title: 'Other show', date: '2026-10-02' },
    { id: 'new-best', title: 'Mamma Mia', date: '2026-10-03' }
  ] };
  const sort = new Function('eventsPager','hasAiRelevance','rankEventsByRelevance', code + '; return sortBufferedEvents;')(pager,hasAiRelevance,rankEventsByRelevance);
  sort('relevance', { sort: 'relevance', searchMode: 'exact', keyword: 'Mamma Mia' });
  assert.deepEqual(pager.buffer.map(e => e.id), ['viewed','new-best','unseen']);
});
