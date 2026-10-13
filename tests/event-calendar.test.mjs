import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDay, eventDateBounds, eventStartInstant, matchesEventDateRange,
  ticketmasterCalendarRange, isLocalEventDateAvailable } from '../src/event-calendar.js';
import { withProviderDateRange } from '../src/provider-event-dates.js';
import { formatEventDateTime } from '../src/event-date-time.js';
import { ticketmasterPageInfo } from '../src/event-pagination.js';

test('venue-local day includes both sides of UTC midnight and excludes neighbouring local days', () => {
  const cases = [
    ['2026-06-14T22:30:00Z', 'Europe/Prague', '2026-06-15'],
    ['2026-06-16T03:30:00Z', 'America/New_York', '2026-06-15'],
    ['2026-06-14T10:30:00Z', 'Pacific/Kiritimati', '2026-06-15'],
    ['2026-06-16T10:30:00Z', 'Pacific/Pago_Pago', '2026-06-15']
  ];
  for (const [datetime, timezone, localDay] of cases) {
    const event = { datetime, dateAvailability: { timezone } };
    assert.equal(eventDateBounds(event).start, localDay);
    assert.equal(matchesEventDateRange(event, localDay, localDay), true);
    assert.equal(matchesEventDateRange(event, '2026-06-14', '2026-06-14'), false);
    assert.equal(matchesEventDateRange(event, '2026-06-16', '2026-06-16'), false);
  }
});

test('explicit local dates win over UTC timestamps; conversion wins over a truncated UTC date', () => {
  const event = { datetime: '2026-06-14T22:30:00Z', date: '2026-06-14', timezone: 'Europe/Prague' };
  assert.equal(eventDateBounds(event).start, '2026-06-15');
  assert.equal(formatEventDateTime(event), '15. června 2026 ·\u00a000:30');
  assert.equal(eventDateBounds({ ...event, dateAvailability: { startLocalDate: '2026-06-16' } }).start, '2026-06-16');
});

test('declared intervals overlap a selected day and open-sided ranges', () => {
  const event = { date: '2026-10-08', dateAvailability: { endLocalDate: '2026-10-11' } };
  for (const day of ['2026-10-08', '2026-10-10', '2026-10-11']) {
    assert.equal(matchesEventDateRange(event, day, day), true);
  }
  assert.equal(matchesEventDateRange(event, '2026-10-12', ''), false);
  assert.equal(matchesEventDateRange(event, '', '2026-10-07'), false);
  assert.equal(matchesEventDateRange(event, '2026-10-10', ''), true);
  assert.equal(matchesEventDateRange(event, '', '2026-10-10'), true);
});

test('actual UTC end is converted to venue day while sale/booking dates never extend a show', () => {
  const base = { date: '2026-10-08', bookingEndsAt: '2027-01-01',
    dateAvailability: { timezone: 'Europe/Prague', salesEndDateTime: '2027-01-01' } };
  assert.equal(matchesEventDateRange(base, '2026-10-10', '2026-10-10'), false);
  assert.equal(matchesEventDateRange({ ...base, dateAvailability: {
    ...base.dateAvailability, endDateTime: '2026-10-09T23:30:00Z'
  } }, '2026-10-10', '2026-10-10'), true);
  assert.equal(matchesEventDateRange({ ...base, dateAvailability: {
    ...base.dateAvailability, spanMultipleDays: true
  } }, '2026-10-10', '2026-10-10'), false);
});

test('invalid, uncertain and reversed calendar bounds do not invent matches', () => {
  for (const date of ['invalid', '2026-02-30', '']) {
    assert.equal(matchesEventDateRange({ date }, '2026-02-28', '2026-03-02'), false);
  }
  const event = { date: '2026-10-10' };
  assert.equal(matchesEventDateRange(event, '2026-10-11', '2026-10-09'), false);
  assert.equal(matchesEventDateRange(event, '2026-02-30', ''), false);
  assert.equal(matchesEventDateRange({ ...event, dateAvailability: { dateTBA: true } }, '2026-10-10', ''), false);
  assert.equal(matchesEventDateRange({ ...event, dateAvailability: { endLocalDate: '2026-10-01' } }, '2026-10-11', ''), false);
});

const festival = (description, date = '2026-10-08') => ({ partner: 'smsticket', date,
  title: 'Festival KOMA 2026', types: ['Festival'], description: { cs: description }, tickets: 'https://www.smsticket.cz/vstupenky/70117?a_box=kept' });

test('KOMA-like explicit provider description range becomes an event end without touching commerce URLs', () => {
  const original = festival('Čtyři dny plné komiksu. Festival KOMA se uskuteční v termínu 8. – 11. října 2026.');
  const normalized = withProviderDateRange(original);
  assert.equal(normalized.dateAvailability.endLocalDate, '2026-10-11');
  assert.equal(normalized.dateAvailability.endSource, 'provider-description-range');
  assert.equal(original.dateAvailability, undefined);
  assert.equal(normalized.tickets, original.tickets);
  assert.equal(matchesEventDateRange(normalized, '2026-10-10', '2026-10-10'), true);
  assert.equal(formatEventDateTime(normalized), '8. října 2026 – 11. října 2026');
});

test('description parsing validates numeric/ISO ranges, cross-year dates and ambiguous editions', () => {
  for (const text of ['8.–11.10.2026', '8.10. – 11.10.2026', '2026-10-08 – 2026-10-11']) {
    assert.equal(withProviderDateRange(festival('Festival KOMA ' + text)).dateAvailability?.endLocalDate, '2026-10-11');
  }
  assert.equal(withProviderDateRange(festival('Festival KOMA 28.12. – 2.1.2027', '2026-12-28')).dateAvailability.endLocalDate, '2027-01-02');
  for (const text of ['8.–11. října 2025', '8.–32. října 2026', '8.–11. října 2026; 8.–12. října 2026']) {
    assert.equal(withProviderDateRange(festival('Festival KOMA ' + text)).dateAvailability, undefined);
  }
});

test('sale periods and a theatre run cannot extend one performance', () => {
  for (const text of ['Předprodej v termínu 8.–11. října 2026', 'Rezervace 8.–11. října 2026', 'Early bird 8.–11. října 2026']) {
    assert.equal(withProviderDateRange(festival('Festival KOMA ' + text)).dateAvailability, undefined);
  }
  assert.equal(withProviderDateRange({ ...festival('Hrajeme 8.–11. října 2026'), types: ['Divadlo'] }).dateAvailability, undefined);
  assert.equal(withProviderDateRange(festival(''), { endLocalDate: '2026-10-12' }).dateAvailability.endLocalDate, '2026-10-12');
});

test('declared event ends control local expiry independently of a stale open booking window', () => {
  const event = { country: 'CZ', date: '2026-10-08', bookingEndsAt: '2027-01-01',
    dateAvailability: { endLocalDate: '2026-10-11' } };
  assert.equal(isLocalEventDateAvailable(event, new Date('2026-10-10T12:00Z'), { allowBooking: true }), true);
  assert.equal(isLocalEventDateAvailable(event, new Date('2026-10-11T22:01Z'), { allowBooking: true }), false);
  assert.equal(isLocalEventDateAvailable({ date: '2026-10-11' }, new Date('2026-10-11T23:30Z')), true);
});

test('sorting and raw pagination boundaries use the same venue instant across DST and midnight', () => {
  const local = { datetime: '2026-06-15T00:30:00', country: 'CZ' };
  assert.equal(eventStartInstant(local), Date.parse('2026-06-14T22:30:00Z'));
  const winter = { ...local, datetime: '2026-12-15T00:30:00' };
  assert.equal(eventStartInstant(winter), Date.parse('2026-12-14T23:30:00Z'));
  const metadata = ticketmasterPageInfo({ _embedded: { events: [{ dates: {
    start: { localDate: '2026-06-15', localTime: '00:30:00' }, timezone: 'Europe/Prague'
  } }] }, page: { totalPages: 2 } }, { page: 0, size: 50, sort: 'date,asc' });
  assert.equal(metadata.frontier, eventStartInstant(local));
  local.datetime = '2026-06-15T01:30:00';
  assert.equal(eventStartInstant(local), Date.parse('2026-06-14T23:30:00Z'), 'cached time must follow date changes');
});

test('visitor timezone never enters a Ticketmaster venue-day overlap query', () => {
  assert.equal(ticketmasterCalendarRange('2026-06-15', '2026-06-15'), '2026-06-15T00:00:00,2026-06-16T00:00:00');
  assert.equal(ticketmasterCalendarRange('15.6.2026', '16.6.2026'), '2026-06-15T00:00:00,2026-06-17T00:00:00');
  assert.match(ticketmasterCalendarRange('2026-06-15', ''), /^2026-06-15T00:00:00,/);
  assert.match(ticketmasterCalendarRange('', '2026-06-15'), /,2026-06-16T00:00:00$/);
  assert.equal(ticketmasterCalendarRange('2026-02-30', ''), '');
  assert.equal(calendarDay('2026-06-15T24:30:00'), '');
});

test('fractional provider wall times retain their exact ordering around midnight', () => {
  const event = { datetime: '2026-06-15T00:30:00.500', time: '00:30:00.500', country: 'CZ' };
  assert.equal(eventStartInstant(event), Date.parse('2026-06-14T22:30:00.500Z'));
  assert.equal(matchesEventDateRange(event, '2026-06-15', '2026-06-15'), true);
});

test('one lecture at Go Kamera does not inherit the whole festival date range', () => {
  const event = { date: '2026-11-04', title: 'Go Kamera 2026, Michal Kleslo', types: ['Festival'],
    description: { cs: 'CESTOVATELSKÝ FESTIVAL GO KAMERA 4.11.—6.11.2026 pořádá CK LIVINGSTONE.\nMichal Kleslo, lezec: Hory střední Ameriky' } };
  const normalized = withProviderDateRange(event);
  assert.equal(normalized.dateAvailability, undefined);
  assert.equal(matchesEventDateRange(normalized, '2026-11-05', '2026-11-05'), false);
});

test('a Czech hall description is not mistaken for an English ticket-sale period', () => {
  const event = festival('Festival KOMA se uskuteční v sále galerie v termínu 8.–11. října 2026.');
  assert.equal(withProviderDateRange(event).dateAvailability.endLocalDate, '2026-10-11');
});
