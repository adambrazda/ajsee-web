import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventLocalStart, formatEventDateTime } from '../src/event-date-time.js';
import { mapTicketmasterEvent } from '../src/adapters/ticketmaster.js';
import { mergeExactSmsticketOccurrences } from '../src/adapters/smsticket.js';
import { mergeExactCrossProviderOccurrences } from '../src/event-cross-provider-merge.js';
import { renderSharedEventCard } from '../src/event-card.js';

const localEvent = (partner, time = '19:30') => ({
  id: `${partner}-test`, partner, date: '2026-10-11',
  datetime: `2026-10-11T${time}:00`, time,
  title: { cs: 'Stejné představení' },
  location: { city: 'Praha' }, venue: { name: 'Divadlo', city: 'Praha' },
  tickets: `https://${partner === 'smsticket' ? 'www.smsticket.cz' : 'colosseumticket.cz'}/vstupenky/test?a_box=test-affiliate&term=${time}`
});

test('SMS Ticket and ColosseumTicket show feed start time beside the localized date', () => {
  for (const partner of ['smsticket', 'colosseumticket']) {
    assert.equal(formatEventDateTime(localEvent(partner)), '11. října 2026 ·\u00a019:30');
    assert.deepEqual(eventLocalStart({ ...localEvent(partner), time: '09:30:00' }), {
      date: '2026-10-11', time: '09:30'
    });
  }
});

test('all six languages use the same 24-hour venue time', () => {
  for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
    const label = formatEventDateTime(localEvent('smsticket', '09:30'), locale);
    assert.ok(label.startsWith(new Date('2026-10-11T12:00:00Z').toLocaleDateString(locale, {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
    })));
    assert.ok(label.endsWith(' ·\u00a009:30'));
  }
});

test('missing SMS start_time never exposes its synthetic noon datetime', () => {
  const event = { ...localEvent('smsticket', '12:00'), time: '' };
  assert.equal(formatEventDateTime(event), '11. října 2026');
  assert.equal(formatEventDateTime({ ...localEvent('colosseumticket'), datetime: '2026-10-11', time: '' }), '11. října 2026');
});

test('date-only, unknown and invalid dates/times never invent a show time', () => {
  assert.equal(formatEventDateTime({ date: '2026-10-11' }), '11. října 2026');
  assert.equal(formatEventDateTime({ datetime: 'invalid' }), '');
  assert.equal(formatEventDateTime({ datetime: '2026-02-30T19:00:00', time: '19:00' }), '');
  assert.equal(formatEventDateTime({ time: '19:00' }), '');
  for (const time of ['24:00', '19:60', '19:00:60', 'TBA', '<script>', '']) {
    assert.equal(formatEventDateTime({ ...localEvent('smsticket'), time }), '11. října 2026');
  }
});

test('a genuine midnight remains valid and is not treated as a missing time', () => {
  assert.ok(formatEventDateTime(localEvent('smsticket', '00:00')).endsWith(' ·\u00a000:00'));
});

test('Ticketmaster retains local start time and uncertainty flags without changing its outbound URL', () => {
  const raw = { id: 'show', name: 'Show', url: 'https://www.ticketmaster.cz/event/12345',
    dates: { start: { localDate: '2026-10-11', localTime: '19:30:00', dateTime: '2026-10-11T17:30:00Z' }, timezone: 'Europe/Prague' },
    _embedded: { venues: [{ country: { countryCode: 'CZ' } }] }
  };
  const event = mapTicketmasterEvent(raw, 'cs');
  assert.equal(event.dateAvailability.startLocalTime, '19:30:00');
  assert.equal(formatEventDateTime(event), '11. října 2026 ·\u00a019:30');
  for (const flag of ['timeTBA', 'noSpecificTime', 'dateTBA', 'dateTBD']) {
    const mapped = mapTicketmasterEvent({ ...raw, dates: { ...raw.dates, start: { ...raw.dates.start, [flag]: true } } }, 'cs');
    assert.equal(mapped.dateAvailability[flag], true);
    assert.equal(formatEventDateTime(mapped), flag.startsWith('date') ? '' : '11. října 2026');
    assert.equal(mapped.tickets, event.tickets);
    assert.equal(mapped.url, event.url);
  }
});

test('venue timezone handles summer/winter time and dates across UTC midnight', () => {
  const cases = [
    ['2026-10-11T17:30:00Z', 'Europe/Prague', '2026-10-11', '19:30'],
    ['2026-11-11T18:30:00Z', 'Europe/Prague', '2026-11-11', '19:30'],
    ['2026-10-11T13:30:00Z', 'Europe/London', '2026-10-11', '14:30'],
    ['2026-11-11T14:30:00Z', 'Europe/London', '2026-11-11', '14:30'],
    ['2026-10-10T23:30:00Z', 'Europe/Prague', '2026-10-11', '01:30'],
    ['2026-10-11T01:30:00Z', 'America/New_York', '2026-10-10', '21:30'],
    ['2026-10-25T00:30:00Z', 'Europe/Prague', '2026-10-25', '02:30'],
    ['2026-10-25T01:30:00Z', 'Europe/Prague', '2026-10-25', '02:30']
  ];
  for (const [datetime, timezone, date, time] of cases) {
    assert.deepEqual(eventLocalStart({ partner: 'ticketmaster', datetime, dateAvailability: { timezone } }), { date, time });
  }
});

test('explicit local Ticketmaster values win; absolute timestamps without a valid venue zone do not invent local time', () => {
  assert.deepEqual(eventLocalStart({ datetime: '2026-10-10T23:30:00Z', dateAvailability: {
    startLocalDate: '2026-10-11', startLocalTime: '19:30:00', timezone: 'Europe/Prague'
  } }), { date: '2026-10-11', time: '19:30' });
  for (const timezone of ['', 'not/a-timezone']) {
    assert.equal(eventLocalStart({ datetime: '2026-10-11T17:30:00Z', dateAvailability: { timezone } }).time, '');
  }
  assert.equal(eventLocalStart({ datetime: '2026-10-11T17:30:00+02:00', timezone: 'Europe/London' }).time, '16:30');
});

test('multi-day date ranges remain ranges without suggesting a daily show time', () => {
  const event = { ...localEvent('ticketmaster'), dateAvailability: { startLocalDate: '2026-10-11', endLocalDate: '2026-10-13' } };
  assert.equal(formatEventDateTime(event), '11. října 2026 – 13. října 2026');
  assert.ok(formatEventDateTime({ ...event, dateAvailability: { startLocalDate: '2026-10-11', spanMultipleDays: true } }).endsWith(' – …'));
});

test('two same-day performances stay distinct; cross-provider offers retain their exact commission URLs', () => {
  const smsEarly = localEvent('smsticket', '09:30');
  const smsLate = { ...localEvent('smsticket', '10:30'), id: 'smsticket-late' };
  const colEarly = localEvent('colosseumticket', '09:30');
  const colLate = { ...localEvent('colosseumticket', '10:30'), id: 'colosseumticket-late' };
  assert.equal(mergeExactSmsticketOccurrences([smsEarly, smsLate]).length, 2);
  const merged = mergeExactCrossProviderOccurrences([smsEarly, colEarly, smsLate, colLate]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(e => eventLocalStart(e).time), ['09:30', '10:30']);
  for (const [i, sms, col] of [[0, smsEarly, colEarly], [1, smsLate, colLate]]) {
    assert.equal(merged[i].tickets, sms.tickets);
    assert.deepEqual(merged[i].ticketOptions.map(o => o.url).sort(), [sms.tickets, col.tickets].sort());
  }
});

test('formatting does not mutate any event or commission URL, and card CTA keeps its full tracking contract', () => {
  for (const partner of ['smsticket', 'colosseumticket', 'ticketmaster']) {
    const event = Object.freeze({ ...localEvent(partner),
      dateAvailability: Object.freeze({ startLocalDate: '2026-10-11', startLocalTime: '19:30', timezone: 'Europe/Prague' })
    });
    const before = JSON.stringify(event);
    const dateHtml = formatEventDateTime(event);
    const href = partner === 'ticketmaster'
      ? '/.netlify/functions/tmOutbound?eventId=show&country=CZ&source_page=events_page&placement=event_card&u=https%3A%2F%2Fwww.ticketmaster.cz%2Fevent%2F12345'
      : event.tickets;
    const html = renderSharedEventCard({ event, dateHtml, ticketsHref: href, resultPosition: 2 });
    assert.equal(JSON.stringify(event), before);
    assert.ok(html.includes(dateHtml));
    assert.ok(html.includes(`href="${href.replace(/&/g, '&amp;')}"`));
    assert.match(html, /data-placement="event_card"/);
    assert.match(html, /data-result-position="2"/);
  }
});

test('homepage, search and modal all use the shared venue-local date/time formatter', () => {
  for (const file of ['home-entry.js', 'events-entry.js', 'event-modal.js']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.match(source, /import \{ formatEventDateTime \} from '\.\/event-date-time\.js'/);
    assert.match(source, /formatEventDateTime\((?:ev|eventData), (?:locale|intlLocale)\)/);
  }
});
