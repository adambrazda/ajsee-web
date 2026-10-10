import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestCities } from '../src/city/suggestClient.js';
import { loadEventCityCatalog, countryCodeForEventCity } from '../src/city/eventCityCatalog.js';

test('catalog failure can recover; an empty autocomplete answer does not stay cached', async () => {
  const previousFetch = globalThis.fetch;
  const previousNow = Date.now;
  let clock = previousNow();
  let catalogAttempts = 0;
  let remoteAttempts = 0;
  const items = ['Hodonín', 'Kyjov', 'Pardubice'].map(city => ({ city, countryCode: 'CZ', aliases: [city] }));
  Date.now = () => clock;
  globalThis.fetch = async (url) => {
    if (String(url) === '/data/event-cities.json') {
      catalogAttempts++;
      if (catalogAttempts === 1) throw new Error('temporary failure');
      return { ok: true, json: async () => ({ items }) };
    }
    remoteAttempts++;
    if (remoteAttempts === 1) return { ok: false };
    return { ok: true, json: async () => ({ items: [{ city: 'Hodonín', countryCode: 'CZ' }] }) };
  };
  try {
    assert.deepEqual(await suggestCities({ locale: 'cs', keyword: 'Hodonín' }), []);
    clock += 1200;
    const recovered = await suggestCities({ locale: 'cs', keyword: 'Hodonín' });
    assert.equal(catalogAttempts, 2);
    assert.equal(remoteAttempts, 2);
    assert.equal(recovered[0].city, 'Hodonín');
    assert.equal(countryCodeForEventCity('hodonin'), 'CZ');
    assert.deepEqual((await suggestCities({ locale: 'cs', keyword: 'Ho', countryCodes: ['CZ'] })).map(item => item.city), ['Hodonín']);
    assert.equal(remoteAttempts, 2, 'short prefix uses the feed index without a Ticketmaster request');
    assert.ok((await suggestCities({ locale: 'en', keyword: 'Czechia' })).every(item => item.type === 'country' && item.countryCode === 'CZ'));
    await loadEventCityCatalog();
    assert.equal(catalogAttempts, 2, 'successful catalog is shared across callers');
  } finally {
    globalThis.fetch = previousFetch;
    Date.now = previousNow;
    suggestCities.__cache?.clear();
  }
});
