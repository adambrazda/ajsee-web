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

test('the shared session ranks complete candidates while classic sort stays chronological', async () => {
  const { createEventSearchSession } = await import('../src/event-search-session.js');
  const { withEventPageInfo } = await import('../src/event-pagination.js');
  const events = [{ id:'early',title:'Hamlet',date:'2099-01-01' },{ id:'best',title:'Mamma Mia',date:'2099-01-03' }];
  for(const [filters,expected] of [[{sort:'nearest'},['early','best']],[{sort:'latest'},['best','early']],[{sort:'relevance',searchMode:'exact',keyword:'Mamma Mia'},['best','early']]]) {
    const session=createEventSearchSession({filters,fetchBatch:async()=>withEventPageInfo(events,{hasMore:false})});
    assert.deepEqual((await session.load(20)).events.map(e=>e.id),expected);
  }
});

test('later relevance cannot displace an already viewed page or repeat an event',async()=>{
  const { createEventSearchSession } = await import('../src/event-search-session.js');
  const { withEventPageInfo } = await import('../src/event-pagination.js');
  let calls=0;
  const session=createEventSearchSession({filters:{sort:'relevance',searchMode:'exact',keyword:'Mamma Mia'},fetchBatch:async()=>withEventPageInfo(++calls===1?[{id:'viewed',title:'Hamlet',date:'2099-01-01'}]:[{id:'unseen',title:'Other show',date:'2099-01-02'},{id:'new-best',title:'Mamma Mia',date:'2099-01-03'}],{hasMore:calls===1})});
  assert.equal((await session.load(1)).events[0].id,'viewed');
  assert.deepEqual((await session.load(3)).events.map(e=>e.id),['viewed','new-best','unseen']);
});
