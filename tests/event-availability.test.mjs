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

const homeSource = fs.readFileSync(new URL('../src/home-entry.js', import.meta.url), 'utf8');
const eventsSource = fs.readFileSync(new URL('../src/events-entry.js', import.meta.url), 'utf8');
const expiredBatch = Array.from({ length: 50 }, (_, i) => ({ ...tm('2022-01-01'), id: `old-${i}` }));
const futureBatch = Array.from({ length: 20 }, (_, i) => ({ ...tm('2099-01-01'), id: `future-${i}` }));

test('homepage fetches beyond a full expired batch, without loading FX, and preserves deduplication', async () => {
  let calls = 0;
  const code = homeSource.slice(homeSource.indexOf('function homePriceEventKey('), homeSource.indexOf('async function renderEvents('));
  const run = new Function('getAllHomeEvents', 'hasActivePriceFilter', 'filterCurrentEventBatch', `
    const HOME_PRICE_FILTER_MAX_BATCHES=3, HOME_PRICE_FILTER_API_BATCH_SIZE=50, HOME_PRICE_FILTER_TARGET_COUNT=6;
    ${code}; return fetchHomeEventsForRender;`)(async () => ++calls === 1 ? expiredBatch : [...futureBatch, futureBatch[0]], () => false, events => filterCurrentEventBatch(events, now));
  const result = await run('en', {});
  assert.equal(calls, 2);
  assert.equal(result.length, 20);
  assert.ok(result.every(event => event.id.startsWith('future-')));
});

test('homepage stops at its bounded request limit if all fetched batches are expired', async () => {
  let calls = 0;
  const code = homeSource.slice(homeSource.indexOf('function homePriceEventKey('), homeSource.indexOf('async function renderEvents('));
  const run = new Function('getAllHomeEvents', 'hasActivePriceFilter', 'filterCurrentEventBatch', `
    const HOME_PRICE_FILTER_MAX_BATCHES=3, HOME_PRICE_FILTER_API_BATCH_SIZE=50, HOME_PRICE_FILTER_TARGET_COUNT=6;
    ${code}; return fetchHomeEventsForRender;`)(async () => { calls++; return expiredBatch; }, () => false, events => filterCurrentEventBatch(events, now));
  assert.deepEqual(await run('en', {}), []);
  assert.equal(calls, 3);
});

test('events pager counts raw batches, fills a page after expiry filtering and then stops at provider end', async () => {
  let calls = 0;
  const pager = { apiPage: 0, loading: false, hasMore: true, buffer: [] };
  const code = eventsSource.slice(eventsSource.indexOf('async function fetchNextEventsBatch('), eventsSource.indexOf('function eventsPagerLabel('));
  const deps = { eventsPager: pager, getAllEvents: async () => ++calls === 1 ? expiredBatch : futureBatch,
    filterEventPriceBatch: events => events, filterCurrentEventBatch: events => filterCurrentEventBatch(events, now),
    mergeEventsIntoBuffer: events => pager.buffer.push(...events), hasAiRelevance: () => false,
    shouldPreserveSeatPlanApiOrder: () => false, sortBufferedEvents: () => {},
    isTicketmasterRateLimited: () => false, isTicketmasterRateLimitError: () => false,
    hasActivePriceFilter: () => false };
  const run = new Function(...Object.keys(deps), `const EVENTS_API_BATCH_SIZE=50, EVENTS_PRICE_FILTER_MAX_BATCHES_PER_RENDER=5, pagination={perPage:20}; ${code}; return ensureEventsPageLoaded;`)(...Object.values(deps));
  await run('en', { sort: 'nearest' }, 1);
  assert.equal(calls, 2); assert.equal(pager.apiPage, 2); assert.equal(pager.buffer.length, 20);
  assert.equal(pager.hasMore, false);
  assert.ok(pager.buffer.every(event => event.id.startsWith('future-')));
});
