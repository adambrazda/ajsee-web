import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import pilot from '../content/event-detail-pilot.json' with { type: 'json' };
import COPY from '../content/event-detail-copy.json' with { type: 'json' };
import { advanceOccurrence, resolveEvent, localDateTime, PRICE_TTL_MS, LANGUAGES, detailPath, pageCacheSeconds } from '../shared/event-details/state.js';
import { renderEventPage } from '../shared/event-details/page.js';
import { collectEventDetails } from '../shared/event-details/sources.js';
import { createEventDetailPage } from '../netlify/functions/event-detail-page.js';
import { createEventDetailRefresh } from '../netlify/functions/event-detail-refresh.js';
import { eventDetailHref, EVENT_DETAIL_ROUTES } from '../src/event-detail-routes.js';
import { renderSharedEventCard } from '../src/event-card.js';

const now = new Date('2026-10-21T10:00:00Z'), event = pilot.events[0];
const record = (seed = event, overrides = {}) => ({ id: seed.id, partner: seed.partner, datetime: seed.startDate.slice(0,19), venue: seed.venue, price: { min: 720, currency:'CZK' }, ...overrides });
const snapshot = (seed = event, row = record(seed)) => ({ version:1, generatedAt:now.toISOString(), events:[advanceOccurrence(seed,null,row,now.toISOString())] });
const shell = lang => `<!doctype html><html lang="${lang}"><head><!--AJSEE_EVENT_HEAD--></head><body data-page="event-detail"><header class="site-header"></header><!--AJSEE_EVENT_BODY--><footer></footer></body></html>`;

test('an exact occurrence advances its date and records its original date across DST', () => {
  const row=advanceOccurrence(event,null,record(event,{datetime:'2027-04-25T16:00:00'}),now.toISOString());
  assert.equal(row.startDate,'2027-04-25T16:00:00+02:00'); assert.equal(row.status,'rescheduled'); assert.equal(row.previousStartDate,event.startDate);
  assert.equal(localDateTime('2026-12-13T16:00:00'),'2026-12-13T16:00:00+01:00');
  assert.equal(localDateTime('2027-03-28T02:30:00'),null); assert.equal(localDateTime('2026-10-25T02:30:00'),null);
  assert.equal(localDateTime('2026-10-25T02:30:00+02:00'),'2026-10-25T02:30:00+02:00');
  assert.equal(localDateTime('2027-02-31T14:00:00'),null);
  const returned=advanceOccurrence(event,row,record(),now.toISOString());assert.equal(returned.status,'scheduled');assert.equal(returned.previousStartDate,undefined);
});

test('missing, offsale and mismatched records cannot claim cancellation or another occurrence', () => {
  const old=snapshot().events[0];
  for(const row of [null,record(event,{id:'another-occurrence'})]) {
    const next=advanceOccurrence(event,old,row,now.toISOString()); assert.equal(next.startDate,old.startDate);assert.equal(next.status,'scheduled');assert.equal(next.lastVerifiedAt,old.lastVerifiedAt);
  }
  assert.equal(advanceOccurrence(event,old,record(event,{saleStatus:'offsale'}),now.toISOString()).status,'scheduled');
  const cancelled=advanceOccurrence(event,old,record(event,{saleStatus:'canceled',datetime:''}),now.toISOString());
  assert.equal(cancelled.status,'cancelled');assert.equal(advanceOccurrence(event,cancelled,null,now.toISOString()).status,'cancelled');
});

test('price expiry applies at request time and an empty new price cannot revive an older one', () => {
  const saved=snapshot(); assert.equal(resolveEvent(event,saved,now).price.minimum,720);
  assert.equal(resolveEvent(event,saved,new Date(+now+PRICE_TTL_MS+1)).price,null);
  const next=advanceOccurrence(event,saved.events[0],record(event,{price:null}),now.toISOString()); assert.equal(next.price,null);
  assert.equal(advanceOccurrence(event,null,record(event,{price:{min:0,currency:'CZK'}}),now.toISOString()).price,null);
  assert.equal(resolveEvent(event,{version:1,events:[{...saved.events[0],lastVerifiedAt:'2099-01-01T00:00:00Z'}]},now).price,null);
  assert.equal(resolveEvent(event,saved,now).tickets,event.tickets);
});

test('CDN caching cannot extend the verified price or a past event into the next calendar day', () => {
  const current = resolveEvent(event, snapshot(), now);
  assert.equal(pageCacheSeconds(current, now), 300);
  assert.equal(pageCacheSeconds(current, new Date(+now + PRICE_TTL_MS - 2000)), 2);
  assert.equal(pageCacheSeconds({ ...current, price: null }, new Date('2026-12-13T23:59:58+01:00')), 2);
  assert.equal(pageCacheSeconds({ ...current, price: null }, new Date('2027-03-28T23:59:58+02:00')), 2);
});

for(const lang of LANGUAGES) test(`${lang}: HTML, metadata, language links and schema describe the same fresh occurrence`, () => {
  const moved=record(event,{datetime:'2027-04-25T16:00:00'}), html=renderEventPage(shell(lang),event,snapshot(event,moved),{lang,now});
  const dom=new JSDOM(html),doc=dom.window.document;
  assert.equal(doc.documentElement.lang,lang);assert.equal(doc.querySelectorAll('h1').length,1);assert.ok(doc.querySelector('h1').textContent.includes(event.title));
  assert.equal(doc.querySelector('time').dateTime,'2027-04-25T16:00:00+02:00');
  assert.equal(doc.querySelector('link[rel=canonical]').href,'https://ajsee.cz'+detailPath(event.slug,lang));
  assert.equal(doc.querySelectorAll('link[hreflang]').length,7);assert.equal(doc.querySelectorAll('.detail-languages a').length,6);
  assert.equal(doc.querySelector('.detail-cta').getAttribute('href'),event.tickets);assert.equal(doc.querySelector('.detail-cta').dataset.eventId,event.id);
  const graph=JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
  assert.equal(graph[0].startDate,doc.querySelector('time').dateTime);assert.equal(graph[0].previousStartDate,event.startDate);
  assert.equal(graph[0].offers.price,720);assert.equal(graph[0].offers.availability,undefined);assert.equal(graph[0].inLanguage,undefined);
  assert.equal(graph[1].inLanguage,lang);assert.ok(doc.querySelector('.detail-status').textContent.includes(COPY[lang].labels.rescheduled.split('{')[0]));
  const stale=new JSDOM(renderEventPage(shell(lang),event,snapshot(),{lang,now:new Date(+now+PRICE_TTL_MS+1)}));
  assert.equal(JSON.parse(stale.window.document.querySelector('script[type="application/ld+json"]').textContent)['@graph'][0].offers,undefined);
  assert.equal(stale.window.document.querySelector('.detail-price-note'),null);
  assert.equal(stale.window.document.querySelector('.detail-price').textContent.replaceAll('\u00a0',' '),COPY[lang].labels.unknownPrice);
  for(const related of doc.querySelectorAll('.detail-related-card a')) assert.ok(related.getAttribute('href').startsWith(lang==='cs'?'/':'/'+lang+'/'));
  dom.window.close();stale.window.close();
});

test('HTML and schema remove purchase offers for cancelled, postponed and past occurrences', () => {
  for(const [status,date] of [['cancelled',now],['postponed',now],['scheduled',new Date('2027-01-01T10:00:00Z')]]) {
    const saved=snapshot();saved.events[0].status=status;
    const dom=new JSDOM(renderEventPage(shell('en'),event,saved,{lang:'en',now:date})),doc=dom.window.document;
    assert.equal(doc.querySelector('.detail-cta'),null);assert.ok(doc.querySelector('.detail-status'));
    assert.equal(JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph'][0].offers,undefined);dom.window.close();
  }
});

test('server page survives a Blob outage, respects HEAD, and rejects unknown routes and methods', async () => {
  const handler=createEventDetailPage({now:()=>now,getStoreFn:()=>({get:async()=>{throw Error('offline');}}),loadAsset:async name=>name==='seed.json'?JSON.stringify(snapshot()):shell(name.slice(0,2))});
  const url='https://ajsee.cz/en/udalosti/'+event.slug+'/';
  const response=await handler(new Request(url));assert.equal(response.status,200);assert.equal(response.headers.get('Content-Language'),'en');
  assert.ok((await response.text()).includes('Tickets at ColosseumTicket'));
  assert.equal((await handler(new Request(url,{method:'HEAD'}))).body,null);
  assert.equal((await handler(new Request(url,{method:'POST'}))).status,405);
  assert.equal((await handler(new Request('https://ajsee.cz/udalosti/not-a-pilot/'))).status,404);
  assert.equal((await handler(new Request('https://ajsee.cz/.netlify/functions/event-detail-page?slug='+event.slug))).status,404);
  assert.equal((await handler(new Request(url.slice(0,-1)))).status,301);
});

test('a refresh advances a healthy provider while an unavailable provider retains its own occurrence', async () => {
  const sms=pilot.events.find(item=>item.id==='smsticket-76162'), tm=pilot.events.find(item=>item.partner==='ticketmaster');
  const fillers=Array.from({length:100},(_,i)=>({...record(sms),id:'smsticket-filler-'+i}));
  const feeds={smsticket:{syncedAt:now.toISOString(),events:[...fillers,record(sms)]},colosseumticket:{generatedAt:'2026-05-01T00:00:00Z',events:[record()]}};
  let requests=0;
  const result=await collectEventDetails(pilot.events,{now,localFeeds:feeds,previous:snapshot(),fetchImpl:async()=>{requests++;throw Error('outage');}});
  assert.equal(requests,1);assert.equal(result.sources.colosseumticket.state,'unavailable');assert.equal(result.events.find(item=>item.id===event.id).price.minimum,720);
  assert.equal(result.events.find(item=>item.id===sms.id).sourceState,'ok');assert.equal(result.events.find(item=>item.id===tm.id).status,'scheduled');
  assert.equal(result.events.find(item=>item.id==='smsticket-68785').status,'scheduled');
});

test('scheduled snapshot persistence is separate from page reads', async () => {
  let written;
  const fn=createEventDetailRefresh({now:()=>now,getStoreFn:()=>({get:async()=>null,setJSON:async(key,value)=>{assert.equal(key,'current');written=value;}}),collect:async events=>({version:1,generatedAt:now.toISOString(),events:events.map(item=>advanceOccurrence(item,null,null,now.toISOString()))})});
  await fn();assert.equal(written.events.length,4);
});

test('only the four exact occurrences navigate to public detail pages; other cards retain modal actions', () => {
  assert.deepEqual(Object.keys(EVENT_DETAIL_ROUTES).sort(),pilot.events.map(item=>item.id).sort());
  for(const lang of LANGUAGES) for(const seed of pilot.events) {
    const dom=new JSDOM(renderSharedEventCard({event:seed,locale:lang,modalId:seed.id,titleRaw:seed.title,titleHtml:seed.title}));
    assert.equal(dom.window.document.querySelector('.event-title-action').getAttribute('href'),eventDetailHref(seed,lang));
    assert.equal(dom.window.document.querySelectorAll('.js-event-detail').length,0);dom.window.close();
  }
  assert.equal(eventDetailHref({id:'colosseumticket-5470841-other-date'}),'');
  assert.equal(new JSDOM(renderSharedEventCard({event:{id:'other'}})).window.document.querySelectorAll('button.js-event-detail').length,2);
});

if(process.env.EVENT_DETAIL_BUILT==='1') test('24 published pages are localized in first HTML, discoverable and packaged for server rendering',async()=>{
  const sitemap=await fs.readFile('dist/sitemap.xml','utf8');
  assert.equal((sitemap.match(/<loc>/g)||[]).length,222);
  for(const lang of LANGUAGES){
    assert.ok((await fs.readFile('dist/event-detail-assets/'+lang+'.txt','utf8')).includes('<!--AJSEE_EVENT_BODY-->'));
    for(const seed of pilot.events){
      const path=detailPath(seed.slug,lang),dom=new JSDOM(await fs.readFile('dist'+path+'index.html','utf8')),doc=dom.window.document;
      assert.ok(sitemap.includes('https://ajsee.cz'+path));assert.equal(doc.documentElement.lang,lang);assert.equal(doc.querySelector('meta[name=robots]'),null);
      assert.equal(doc.querySelectorAll('link[hreflang]').length,7);assert.equal(doc.querySelectorAll('.detail-languages').length,1);
      assert.equal(doc.querySelector('.detail-cta').getAttribute('href'),seed.tickets);assert.equal(doc.querySelector('.detail-lead').textContent.replaceAll('\u00a0',' '),COPY[lang].events[seed.id].introduction);
      dom.window.close();
    }
  }
});
