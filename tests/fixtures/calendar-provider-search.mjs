import assert from 'node:assert/strict';
import { fetchEvents } from '../../src/api/eventsApi.js';
import { createEventSearchSession } from '../../src/event-search-session.js';
import { eventStartInstant } from '../../src/event-calendar.js';

const NativeDate = Date;
class FixedDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-10-10T12:00:00Z'])); }
  static now() { return new NativeDate('2026-10-10T12:00:00Z').getTime(); }
}
globalThis.Date = FixedDate;
const local = (id, date, time, partner = 'smsticket') => ({ id, partner, date,
  datetime: `${date}T${time}:00`, time, title: id, country: 'CZ',
  category: 'concert', types: ['Koncert'], priceFrom: '50 Kč',
  location: { city: 'Praha', country: 'CZ' }, venue: { city: 'Praha', name: 'Venue' },
  tickets: `https://${partner === 'smsticket' ? 'www.smsticket.cz' : 'colosseumticket.cz'}/vstupenky/${id}?a_box=retained`
});
const koma = { ...local('koma', '2026-10-08', '16:00'), title: 'Festival KOMA 2026',
  types: ['Festival'], bookingEndsAt: '2026-10-11T15:00:00',
  description: { cs: 'Čtyři dny plné komiksu. Mezinárodní komiksový festival KOMA se uskuteční v termínu 8. – 11. října 2026.' },
  location: { city: 'Brno', country: 'CZ' }, venue: { name: 'Káznice', city: 'Brno' }
};
const rawTm = (id, day, utc) => ({ id, name: id, url: `https://www.ticketmaster.cz/event/${id}`,
  dates: { start: { localDate: day, localTime: '00:30:00', dateTime: utc }, timezone: 'Europe/Prague' },
  classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
  _embedded: { venues: [{ name: 'Venue', city: { name: 'Praha' }, country: { countryCode: 'CZ' } }] }
});
const tmPass = rawTm('pass', '2026-10-08', '2026-10-08T14:00:00Z');
tmPass.dates.end = { localDate: '2026-10-11' };
tmPass.dates.spanMultipleDays = true;
globalThis.fetch = async input => {
  const url = new URL(String(input), 'https://ajsee.test');
  let data;
  if (url.pathname.includes('event-cities')) data = { items: [] };
  else if (url.pathname.includes('smsticket-events')) data = { events: [koma,
    local('sms-midnight', '2026-10-10', '00:30'), local('sms-tomorrow', '2026-10-11', '00:30')] };
  else if (url.pathname.includes('colosseumticket-events')) data = { events: [
    { ...local('col-pass', '2026-10-08', '19:00', 'colosseumticket'),
      dateAvailability: { endLocalDate: '2026-10-11', timezone: 'Europe/Prague' } },
    local('col-tomorrow', '2026-10-11', '00:30', 'colosseumticket')] };
  else if (url.pathname.includes('ticketmasterEvents')) data = { _embedded: { events: [tmPass,
    rawTm('midnight', '2026-10-10', '2026-10-09T22:30:00Z'),
    rawTm('tomorrow', '2026-10-11', '2026-10-10T22:30:00Z')] }, page: { totalPages: 1 } };
  else throw new Error(`unexpected request ${url.pathname}`);
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
};
const results = {};
for (const maxPrice of [null, 100]) {
  const session = createEventSearchSession({ filters: { countryCode: 'CZ',
    dateFrom: '2026-10-10', dateTo: '2026-10-10', maxPrice, priceCurrency: 'CZK' },
    fetchBatch: fetchEvents, getRates: async () => ({}) });
  const state = await session.load(20);
  const ids = state.events.map(e => e.id).sort();
  const expected = ['col-pass', 'koma', 'sms-midnight'];
  if (maxPrice === null) expected.push('ticketmaster-midnight', 'ticketmaster-pass');
  assert.deepEqual(ids, expected.sort());
  assert.equal(state.hasMore, false);
  for (const e of state.events.filter(e => e.partner !== 'ticketmaster')) assert.match(e.tickets, /a_box=retained/);
  results[String(maxPrice)] = ids;
}
results.localMidnightInstant = eventStartInstant(local('sort', '2026-10-10', '00:30'));
assert.equal(results.localMidnightInstant, NativeDate.parse('2026-10-09T22:30:00Z'));
console.log(JSON.stringify(results));
