import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isCurrentEvent, filterCurrentEventBatch, formatEventDateRange } from '../src/event-availability.js';
import { mapTicketmasterEvent } from '../src/adapters/ticketmaster.js';

const now = new Date('2026-10-06T12:00:00Z');
const tm = (datetime, dateAvailability = {}) => ({ partner: 'ticketmaster', datetime, dateAvailability });

test('expired one-off events are removed even with an unexpired sale window', () => {
  assert.equal(isCurrentEvent(tm('2022-05-02', { salesEndDateTime: '2099-01-01T00:00:00Z' }), now), false);
  assert.equal(isCurrentEvent(tm('2026-10-05T19:00:00Z'), now), false);
});

test('current-day and future events survive without relying on ticket-sale dates', () => {
  assert.equal(isCurrentEvent(tm('2026-10-06T01:00:00Z'), now), true);
  assert.equal(isCurrentEvent(tm('2026-10-07', { salesEndDateTime: '2026-01-01' }), now), true);
});

test('explicit multi-day/season end preserves ongoing events and expires finished ones', () => {
  assert.equal(isCurrentEvent(tm('2026-09-01', { endDateTime: '2027-06-01T20:00:00Z' }), now), true);
  assert.equal(isCurrentEvent(tm('2026-09-01', { endLocalDate: '2026-10-06' }), now), true);
  assert.equal(isCurrentEvent(tm('2026-09-01', { endLocalDate: '2026-10-05', salesEndDateTime: '2099-01-01' }), now), false);
});

test('a public sale end can preserve only an explicitly multi-day pass with no event end', () => {
  const metadata = { spanMultipleDays: true, salesEndDateTime: '2027-06-01T20:00:00Z' };
  assert.equal(isCurrentEvent(tm('2026-09-01', metadata), now), true);
  assert.equal(isCurrentEvent(tm('2026-09-01', { ...metadata, salesEndDateTime: '2026-10-05' }), now), false);
  assert.equal(isCurrentEvent(tm('2026-09-01', { spanMultipleDays: true }), now), false);
});

test('venue-local midnight, not visitor or server midnight, decides the event day', () => {
  const instant = new Date('2026-10-06T00:30:00Z');
  assert.equal(isCurrentEvent(tm('2026-10-05', { timezone: 'America/Los_Angeles' }), instant), true);
  assert.equal(isCurrentEvent(tm('2026-10-05', { timezone: 'Europe/Prague' }), instant), false);
  assert.equal(isCurrentEvent(tm('2026-10-06', { timezone: 'Pacific/Auckland' }), new Date('2026-10-06T23:30:00Z')), false);
});

test('UTC end instants are converted to venue dates; explicit local dates take precedence', () => {
  const instant = new Date('2026-10-06T12:00:00Z');
  assert.equal(isCurrentEvent(tm('2026-10-01', { endDateTime: '2026-10-05T23:30:00Z', timezone: 'Europe/Prague' }), instant), true);
  assert.equal(isCurrentEvent(tm('2026-10-01', { endLocalDate: '2026-10-05', endDateTime: '2026-10-05T23:30:00Z', timezone: 'Europe/Prague' }), instant), false);
});

test('unknown/TBA dates are not treated as proof of expiry; malformed bounds do not throw', () => {
  assert.equal(isCurrentEvent(tm(''), now), true);
  assert.equal(isCurrentEvent(tm('invalid'), now), true);
  assert.equal(isCurrentEvent(tm('2022-05-02', { dateTBA: true }), now), true);
  assert.equal(isCurrentEvent(tm('2022-05-02', { dateTBD: true }), now), true);
  assert.equal(isCurrentEvent(tm('2026-10-07', { endLocalDate: '2026-02-30' }), now), true);
  assert.equal(isCurrentEvent(tm('2026-10-07', { endLocalDate: '2026-10-01' }), now), true);
  assert.equal(isCurrentEvent(tm('2026-10-05', { timezone: 'invalid/timezone' }), now), false);
});

test('provider-owned SMS Ticket series rules remain unchanged', () => {
  const series = { partner: 'smsticket', date: '2026-05-01', bookingEndsAt: '2026-12-31' };
  assert.deepEqual(filterCurrentEventBatch([tm('2022-01-01'), series, tm('2099-01-01')], now), [series, tm('2099-01-01')]);
});

test('Ticketmaster mapping preserves event end and timezone and hides obsolete TBA placeholder dates', () => {
  const raw = { id: 'season', name: 'Season ticket', dates: {
    start: { localDate: '2026-09-01', dateTime: '2026-09-01T18:00:00Z' },
    end: { dateTime: '2027-06-01T22:00:00Z' }, timezone: 'Europe/London', spanMultipleDays: true
  }, sales: { public: { endDateTime: '2027-05-01T20:00:00Z' } } };
  const mapped = mapTicketmasterEvent(raw, 'en');
  assert.equal(mapped.dateAvailability.endDateTime, raw.dates.end.dateTime);
  assert.equal(mapped.dateAvailability.timezone, 'Europe/London');
  assert.equal(isCurrentEvent(mapped, now), true);
  raw.dates.start.dateTBA = true;
  assert.equal(mapTicketmasterEvent(raw, 'en').datetime, '');
});

test('cards and modal can show a localized real date range; sale end is not invented as event end', () => {
  const event = tm('2026-09-01', { endLocalDate: '2027-06-01' });
  for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
    const label = formatEventDateRange(event, locale);
    assert.match(label, /2026/); assert.match(label, /2027/); assert.match(label, / – /);
  }
  assert.match(formatEventDateRange(tm('2026-09-01', { spanMultipleDays: true, salesEndDateTime: '2099-01-01' }), 'cs'), / – …$/);
  assert.equal(formatEventDateRange(tm('2026-09-01'), 'cs'), '');
});


import { createEventSearchSession } from '../src/event-search-session.js';
import { withEventPageInfo } from '../src/event-pagination.js';
const expiredBatch = Array.from({ length: 50 }, (_, i) => ({ ...tm('2022-01-01'), id: `old-${i}` }));
const futureBatch = Array.from({ length: 20 }, (_, i) => ({ ...tm('2099-01-01'), id: `future-${i}` }));
const page=(events,hasMore)=>withEventPageInfo(events,{hasMore,frontier:Date.parse('2099-01-01'),ticketmasterCursor:{streams:{}}});

test('shared homepage and events search refills an expired batch without fetching exchange rates',async()=>{
 let calls=0;
 const session=createEventSearchSession({now:()=>now,getRates:async()=>{throw new Error('must not load FX');},fetchBatch:async()=>++calls===1?page(expiredBatch,true):page([...futureBatch,futureBatch[0]],false)});
 const result=await session.load(6);
 assert.equal(calls,2);assert.equal(result.events.length,20);assert.ok(result.events.every(e=>e.id.startsWith('future-')));
});
test('expiry does not falsely exhaust a provider at the bounded request limit',async()=>{
 let calls=0;
 const session=createEventSearchSession({now:()=>now,fetchBatch:async()=>{calls++;return page(expiredBatch,true);}});
 const result=await session.load(6,{maxBatches:3});assert.equal(calls,3);assert.equal(result.events.length,0);assert.equal(result.hasMore,true);
});
test('provider exhaustion after expired rows gives a definitive result only after continuation',async()=>{
 let calls=0;
 const session=createEventSearchSession({now:()=>now,fetchBatch:async()=>++calls===1?page(expiredBatch,true):page(futureBatch,false)});
 const result=await session.load(20);assert.equal(calls,2);assert.equal(result.events.length,20);assert.equal(result.hasMore,false);
});
