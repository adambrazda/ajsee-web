import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { eventPriceLabels, eventInventoryState, renderEventCommerce } from '../src/event-commerce.js';
import { mapTicketmasterEvent } from '../src/adapters/ticketmaster.js';
import { renderSharedEventCard } from '../src/event-card.js';
const clean = s => s.replace(/[\u00a0\u202f]/g,' ');
const now = Date.parse('2026-10-06T18:00:00Z');
const inv = (overrides = {}) => ({partner:'ticketmaster',ticketInventory:{source:'ticketmaster',scope:'seller',observedAt:'2026-10-06T17:59:00Z',status:'limited',remaining:37,...overrides}});

test('Ticketmaster preserves all price bounds without changing minimum-price filter metadata',()=>{
 const event = mapTicketmasterEvent({id:'price',name:'Price',dates:{status:{code:'onsale'}},priceRanges:[{min:490,max:1290,currency:'CZK'}]},'cs');
 assert.deepEqual(event.priceOptions,[{amount:490,currency:'CZK'}]);
 assert.equal(event.saleStatus,'onsale');
 assert.equal(clean(eventPriceLabels(event,'cs')[0]),'490 Kč – 1 290 Kč');
});
test('single minimum, free minimum, decimals and missing price stay distinct',()=>{
 assert.equal(clean(eventPriceLabels({priceFrom:'350 Kč'},'cs')[0]),'Od 350 Kč');
 assert.equal(clean(eventPriceLabels({priceFrom:0,currency:'EUR'},'en')[0]),'From €0');
 assert.equal(eventPriceLabels({priceFrom:null,currency:'EUR'}).length,0);
 assert.equal(eventPriceLabels({priceFrom:'no price'}).length,0);
 assert.equal(eventPriceLabels({priceFrom:'-40 Kč'}).length,0);
 assert.match(eventPriceLabels({priceFrom:'28.50 GBP'},'en')[0],/28\.50/);
});
test('text ranges and narrow spaces are parsed safely, explanatory numbers are not concatenated',()=>{
 assert.equal(clean(eventPriceLabels({priceFrom:'490–1\u202f290 Kč'},'cs')[0]),'490 Kč – 1 290 Kč');
 assert.equal(clean(eventPriceLabels({priceFrom:'4\u202f990 Kč'},'cs')[0]),'Od 4 990 Kč');
 assert.equal(eventPriceLabels({priceFrom:'500 Kč (2 osoby)'}).length,0);
 assert.equal(eventPriceLabels({priceFrom:'900–500 Kč'}).length,0);
 assert.equal(eventPriceLabels({priceFrom:'<img src=x onerror=alert(1)>500 Kč'}).length,0);
});
test('range grouping preserves currencies and never invents an upper bound',()=>{
 const p=eventPriceLabels({priceRanges:[{min:10,max:20,currency:'GBP'},{min:5,max:30,currency:'GBP'},{min:100,max:200,currency:'CZK'}]},'en');
 assert.equal(p.length,2); assert.match(p[0],/5.*30/); assert.match(p[1],/100.*200/);
 assert.match(eventPriceLabels({priceRanges:[{min:10,max:20,currency:'EUR'},{min:5,currency:'EUR'}]},'en')[0],/^From/);
});
test('merged ticket options use minimum per currency without false currency conversions',()=>{
 const p=eventPriceLabels({ticketOptions:[{priceFrom:'500 CZK'},{priceFrom:'390 CZK'},{priceFrom:'20 EUR'}]},'en');
 assert.equal(p.length,2);assert.match(p[0],/390/);assert.match(p[1],/20/);
});
test('current providers remain neutral; on-sale is not ample, and off-sale is not sold out',()=>{
 for(const event of [{partner:'smsticket',priceFrom:'500 Kč'},{partner:'ticketmaster',saleStatus:'onsale'},{}]){
  assert.equal(eventInventoryState(event,now).status,'unknown');
 }
 assert.equal(eventInventoryState({saleStatus:'offsale'},now).status,'offsale');
 assert.doesNotMatch(renderEventCommerce({saleStatus:'offsale'},'cs'),/Vyprodáno|Dostatek/);
});
test('verified inventory statuses produce distinct tones and seller-scoped sold-out badge',()=>{
 for(const [status,tone] of [['plentiful','green'],['limited','orange'],['last','red'],['sold_out','neutral'],['available','neutral'],['unavailable','neutral']]){
  assert.equal(eventInventoryState(inv({status,remaining:null}),now).tone,tone);
 }
 assert.match(renderEventCommerce(inv({status:'sold_out',remaining:0}),'cs',{now}),/Vyprodáno u prodejce/);
});
test('missing, stale, future, wrong-seller and contradictory inventory evidence stays neutral',()=>{
 for(const changes of [{observedAt:''},{observedAt:'2026-10-06T17:00:00Z'},{observedAt:'2026-10-06T19:00:00Z'},{source:'other'},{scope:'venue'},{status:'sold_out',remaining:5},{status:'last',remaining:0}]){
  assert.equal(eventInventoryState(inv(changes),now).status,'unknown');
 }
 assert.equal(eventInventoryState({...inv(),saleStatus:'canceled'},now).status,'canceled');
});
test('count under 100 is only shown in detail with evidence and last-updated time',()=>{
 assert.match(renderEventCommerce(inv(),'cs',{detail:true,now}),/přibližně 37 vstupenek/);
 assert.match(renderEventCommerce(inv(),'cs',{detail:true,now}),/Aktualizováno:/);
 assert.doesNotMatch(renderEventCommerce(inv(),'cs',{now}),/přibližně 37/);
 for(const remaining of [100,101,null,-1,1.5,'37']) assert.doesNotMatch(renderEventCommerce(inv({remaining}),'cs',{detail:true,now}),/přibližně/);
});
test('all six locales render prices, neutral availability and notes without leaking Czech',()=>{
 for(const locale of ['cs','sk','en','de','pl','hu']){
  const html=renderEventCommerce({priceFrom:'500 Kč'},locale,{detail:true});
  assert.match(html,/500/);assert.doesNotMatch(html,/undefined|NaN/);
  if(locale!=='cs') assert.doesNotMatch(html,/Ověřit dostupnost|Cena u prodejce/);
 }
});
test('card exposes a touch/keyboard-native expandable explanation and a hover title',()=>{
 const dom=new JSDOM(renderSharedEventCard({event:{priceFrom:'390 Kč'},locale:'en'}));
 const details=dom.window.document.querySelector('.event-stock');
 const summary=details.querySelector('summary');
 assert.match(summary.title,/seller/);
 assert.equal(details.open,false);summary.click();assert.equal(details.open,true);summary.click();assert.equal(details.open,false);
 assert.match(dom.window.document.querySelector('.event-price').textContent,/From/);
 assert.equal(dom.window.document.querySelector('.event-stock-dot').getAttribute('aria-hidden'),'true');
 dom.window.close();
});
