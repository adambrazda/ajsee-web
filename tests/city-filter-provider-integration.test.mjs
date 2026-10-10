import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/api/eventsApi.js';
import { buildEventCityCatalog } from '../shared/city/event-city-catalog.js';

const originalFetch = globalThis.fetch;
const queries = [];
const cities = ['Hodonín', 'Kyjov', 'Kroměříž', 'Pardubice', 'Jihlava', 'Kolín', 'Most',
  'Mosty u Jablunkova', 'Brandýs nad Labem-Stará Boleslav', 'Praha 9'];
const createEvent = (city, source, index) => ({ id: `${source}-${index}`, partner: source, source,
  title: { cs: `${source}: ${city}` }, description: { cs: 'Koncert' }, category: 'concerts',
  date: '2099-10-10', datetime: '2099-10-10T19:00:00', time: '19:00',
  location: { city, ...(source === 'smsticket' ? { country: 'CZ', lat: 48.85, lon: 17.12 } : {}) },
  venue: { city, name: `${city} venue` }, currency: 'CZK', priceFrom: '200 Kč',
  affiliateUrl: `https://${source}.test/event/${index}?a_box=retained`, url: `https://${source}.test/event/${index}?a_box=retained`,
  ticketOptions: [{ url: `https://${source}.test/event/${index}?a_box=retained`, label: 'Vstupenky', affiliate: true }] });
const sms = cities.map((city, i) => createEvent(city, 'smsticket', i));
const col = cities.map((city, i) => createEvent(city, 'colosseumticket', i));
const catalog = buildEventCityCatalog([{ events: sms }, { events: col, marketCountryCode: 'CZ' }]);

globalThis.fetch = async (url) => {
  const text = String(url);
  if (text === '/data/event-cities.json') return { ok: true, json: async () => ({ items: catalog }) };
  if (text.includes('smsticket-events')) return { ok: true, json: async () => ({ events: sms }) };
  if (text.includes('colosseumticket-events')) return { ok: true, json: async () => ({ events: col }) };
  if (text.includes('ticketmasterEvents')) {
    queries.push(new URL(text, 'https://ajsee.cz'));
    return { ok: true, status: 200, headers: new Headers(), json: async () => ({ _embedded: { events: [] }, page: { totalPages: 0, totalElements: 0 } }) };
  }
  throw new Error(`Unexpected request: ${text}`);
};
after(() => { globalThis.fetch = originalFetch; });

test('every regional city survives aggregation, even with an inherited foreign default country', async () => {
  for (const city of cities.filter(city => city !== 'Praha 9')) {
    queries.length = 0;
    const events = await fetchEvents({ locale: 'en', filters: { city, countryCode: 'GB', size: 100 } });
    assert.equal(events.length, 2, city);
    assert.deepEqual(new Set(events.map(event => event.partner)), new Set(['smsticket', 'colosseumticket']), city);
    assert.ok(events.every(event => event.location.city === city), city);
    assert.ok(queries.length > 0);
    assert.ok(queries.every(url => url.searchParams.get('countryCode') === 'CZ'), city);
    assert.ok(queries.every(url => url.searchParams.get('city') === city), city);
    assert.ok(events.every(event => event.affiliateUrl.endsWith('a_box=retained')), city);
  }
});

test('diacritics-free input resolves native city names; short overlapping names do not leak neighboring cities', async () => {
  for (const [input, native] of [['hodonin', 'Hodonín'], ['kromeriz', 'Kroměříž'], ['Most', 'Most'],
    ['brandys nad labem-stara boleslav', 'Brandýs nad Labem-Stará Boleslav']]) {
    const events = await fetchEvents({ locale: 'cs', filters: { city: input, size: 100 } });
    assert.equal(events.length, 2, input);
    assert.ok(events.every(event => event.location.city === native), input);
  }
});

test('supported district and translated city queries still find both partner feeds', async () => {
  const events = await fetchEvents({ locale: 'de', filters: { city: 'Prag', cityCountryCode: 'CZ', size: 100 } });
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.location.city === 'Praha 9'));
});

test('Near Me still retains Hodonín events with purchase URLs from the same source data', async () => {
  const events = await fetchEvents({ locale: 'cs', filters: { nearMeLat: 48.85, nearMeLon: 17.12,
    nearMeRadiusKm: 50, countryCode: 'CZ', size: 100 } });
  const nearbyHodonin = events.filter(event => event.location.city === 'Hodonín');
  const explicitHodonin = await fetchEvents({ locale: 'cs', filters: { city: 'Hodonín', countryCode: 'CZ', size: 100 } });
  assert.equal(nearbyHodonin.length, 1, 'Colosseum has no coordinates and keeps its existing Near Me exclusion');
  assert.ok(explicitHodonin.some(event => event.id === nearbyHodonin[0].id));
  assert.equal(nearbyHodonin[0].affiliateUrl, explicitHodonin.find(event => event.id === nearbyHodonin[0].id).affiliateUrl);
});
