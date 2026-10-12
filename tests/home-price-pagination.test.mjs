import test from 'node:test';
import assert from 'node:assert/strict';
import { entryFunction } from './helpers/entry-function.mjs';
import { createEventSearchSession } from '../src/event-search-session.js';
import { withEventPageInfo } from '../src/event-pagination.js';
const e=(id,price='1000 CZK')=>({id,partner:'ticketmaster',datetime:'2099-01-01',title:id,priceFrom:price,currency:'CZK'});
const page=(events,hasMore)=>withEventPageInfo(events,{hasMore,frontier:Date.parse('2099-01-01'),ticketmasterCursor:{streams:{}}});
function home(fetchBatch,getRates=async()=>({})) {
  return entryFunction('home-entry.js','fetchHomeEventsForRender',{
    createEventSearchSession,getAllHomeEvents:fetchBatch,getRatesForPriceFilter:getRates,
    HOME_PRICE_FILTER_TARGET_COUNT:6,HOME_PRICE_FILTER_MAX_BATCHES:3
  });
}

test('homepage considers all local candidates and finds a cheap event beyond candidate 300',async()=>{
  const candidates=Array.from({length:301},(_,i)=>e(String(i),i===300?'50 CZK':'1000 CZK'));
  let requests=0,rates=0;
  const result=await home(async({filters})=>{requests++;assert.equal(filters.allLocalEvents,true);return page(candidates,false);},async()=>{rates++;return{};})('cs',{maxPrice:100,priceCurrency:'CZK'});
  assert.equal(requests,1);assert.equal(rates,1);assert.deepEqual(result.map(e=>e.id),['300']);
  assert.equal(result.searchState.hasMore,false);
});

test('homepage bounded search exposes an incomplete result rather than proving no affordable events',async()=>{
  let requests=0;
  const result=await home(async()=>{requests++;return page([e(String(requests))],true);})('cs',{maxPrice:100,priceCurrency:'CZK'});
  assert.equal(requests,3);assert.equal(result.length,0);assert.equal(result.searchState.hasMore,true);
});

test('homepage loads no exchange rates without a price filter and deduplicates provider IDs',async()=>{
  const result=await home(async()=>page([e('one'),e('one'),e('two')],false),async()=>{throw new Error('FX must not load');})('en',{});
  assert.deepEqual(result.map(e=>e.id),['one','two']);assert.equal(result.searchState.totalKnown,2);
});

test('homepage same-currency matching survives missing exchange rates',async()=>{
  const result=await home(async()=>page([e('local','50 CZK'),{...e('foreign','1 GBP'),currency:'GBP'}],false),async()=>{throw new Error('FX unavailable');})('cs',{maxPrice:100,priceCurrency:'CZK'});
  assert.deepEqual(result.map(e=>e.id),['local']);
});

test('homepage keeps current filters and locale in the provider request',async()=>{
  await home(async({locale,filters})=>{assert.equal(locale,'pl');assert.equal(filters.audience,'family');assert.equal(filters.city,'Praha');assert.equal(filters.maxPrice,300);return page([],false);})('pl',{audience:'family',city:'Praha',maxPrice:300,priceCurrency:'CZK'});
});
