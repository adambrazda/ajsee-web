import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { entryFunction } from './helpers/entry-function.mjs';

function controls(buffer, hasMore) {
  const dom = new JSDOM('<div id="pager"></div>');
  const host = dom.window.document.querySelector('#pager');
  const pagination = { page: 1, perPage: 20 };
  const eventsPager = { buffer, hasMore, loading: false, totalKnown: buffer.length };
  let renders = 0;
  const update = entryFunction('events-entry.js', 'updateEventsPagerControls', {
    isHome: () => false, injectOnce() {}, ensureEventsPagerHost: () => host,
    pagination, eventsPager, t: (key, fallback) => fallback, esc: String, eventsPagerLabel: () => 'results',
    renderAndSync: async () => { renders++; }, scrollToSharedEventResults() {}, _userInteractedWithFilters: false
  });
  update();
  return { dom, host, pagination, eventsPager, update, renders: () => renders };
}

test('a zero-match incomplete price search exposes continuation', () => {
  const c = controls([], true);
  assert.equal(c.host.hidden, false);
  const next = c.host.querySelector('[data-events-page-next]');
  assert.ok(next); assert.equal(next.disabled, false);
  assert.match(next.textContent, /Pokračovat/);
  c.dom.window.close();
});

test('an exhausted zero-match search hides pagination', () => {
  const c = controls([], false);
  assert.equal(c.host.hidden, true); assert.equal(c.host.innerHTML, '');
  c.dom.window.close();
});

test('continuing a partially filled page does not skip its unfilled slots', async () => {
  const c = controls(Array.from({length:19}, (_,i)=>({id:String(i)})), true);
  c.host.querySelector('[data-events-page-next]').click();
  await Promise.resolve();
  assert.equal(c.pagination.page, 1); assert.equal(c.renders(), 1);
  c.eventsPager.buffer.push({id:'20'}); c.update();
  c.host.querySelector('[data-events-page-next]').click();
  await Promise.resolve();
  assert.equal(c.pagination.page, 2);
  c.dom.window.close();
});

test('a completed request from an abandoned filter session cannot overwrite the new session', async () => {
  let finish;
  const old = {load:()=>new Promise(resolve=>{finish=resolve;})};
  const pager = {session:old,buffer:[],loading:false};
  const fetch = entryFunction('events-entry.js','fetchNextEventsBatch',{
    eventsPager:pager,pagination:{page:1,perPage:20}
  });
  const running=fetch('cs',{});
  const current={};pager.session=current;pager.buffer=[{id:'new-filter'}];pager.loading=true;
  finish({events:[{id:'old-filter'}],hasMore:false,totalKnown:1});await running;
  assert.deepEqual(pager.buffer,[{id:'new-filter'}]);assert.equal(pager.loading,true);
});
