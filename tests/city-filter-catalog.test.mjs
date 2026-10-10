import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { canonForInputCity, guessCountryCodeFromCity, matchesCityIdentity } from '../shared/city/canonical.js';
import { buildEventCityCatalog, eventCitySuggestions, eventCityCountryCode } from '../shared/city/event-city-catalog.js';
import { buildEventCities } from '../scripts/build-event-cities.mjs';

test('selected regional cities never become a similar foreign city or short alias', () => {
  for (const city of ['Hodonín', 'Kyjov', 'Kroměříž', 'Pardubice', 'Jihlava', 'Ústí nad Labem',
    'Vrchlabí', 'Mladá Boleslav', 'Břeclav', 'Nový Bor', 'Kolín', 'Klatovy', 'Hustopeče',
    'Lanškroun', 'Čáslav', 'Prachatice', 'Bruntál', 'Kadaň', 'Turnov', 'Římov', 'Kolinec',
    'Brandýs nad Labem-Stará Boleslav', 'Městečko nové z budoucího feedu']) {
    assert.equal(canonForInputCity(city), city, city);
    assert.equal(guessCountryCodeFromCity(city), '', city);
  }
});

test('confirmed international aliases and city districts retain their identity', () => {
  for (const [city, expected, cc] of [['Praha 9', 'Prague', 'CZ'], ['Praha - Libuš', 'Prague', 'CZ'],
    ['Bratislava - Staré Mesto', 'Bratislava', 'SK'], ['Paříž', 'Paris', 'FR'],
    ['Vídeň', 'Vienna', 'AT'], ['Budapešť', 'Budapest', 'HU'], ['Londýn', 'London', 'GB']]) {
    assert.equal(canonForInputCity(city), expected);
    assert.equal(guessCountryCodeFromCity(city), cc);
  }
  assert.ok(matchesCityIdentity('Hodonín', 'hodonin'));
  assert.ok(matchesCityIdentity('Praha 9', 'Prag'));
  for (const [a, b] of [['Kolín', 'Kolín nad Rýnem'], ['Hodonín', 'Hodonice'],
    ['Most', 'Mosty u Jablunkova'], ['Praha', 'Prachatice'], ['Brandýs nad Labem', 'Brandýs nad Labem-Stará Boleslav']]) {
    assert.equal(matchesCityIdentity(a, b), false);
  }
});

test('catalog covers both feeds, keeps full place names and separates same-name countries', () => {
  const items = buildEventCityCatalog([
    { events: ['Hodonín', 'Kyjov', 'Praha 9', 'Brandýs nad Labem-Stará Boleslav'].map(city => ({ location: { city, country: 'CZ' } })) },
    { marketCountryCode: 'CZ', events: ['Hodonín', 'Pardubice', 'Praha'].map(city => ({ location: { city } })) },
    { events: [{ location: { city: 'Hodonín', country: 'SK' } }] }
  ]);
  assert.equal(items.filter(city => city.countryCode === 'CZ').length, 5);
  assert.equal(items.filter(city => city.city === 'Hodonín').length, 2);
  assert.equal(eventCityCountryCode(items, 'hodonin'), '');
  assert.equal(eventCityCountryCode(items, 'kyjov'), 'CZ');
  assert.equal(eventCityCountryCode(items, 'Praha 9'), 'CZ');
  assert.equal(eventCitySuggestions(items, 'Ho', { countryCodes: ['CZ'] })[0].city, 'Hodonín');
  for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
    assert.equal(eventCitySuggestions(items, 'pardub', { locale })[0].countryCode, 'CZ');
    assert.equal(eventCitySuggestions(items, 'brandys', { locale })[0].city, 'Brandýs nad Labem-Stará Boleslav');
  }
});

test('build writes a small catalog with no purchase links, credentials or invented center coordinates', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'ajsee-city-catalog-'));
  try {
    await writeFile(path.join(dataDir, 'smsticket-events.json'), JSON.stringify({ events: [
      { location: { city: 'Hodonín', country: 'CZ', lat: 48.85, lon: 17.12 }, url: 'https://seller.test/?a_box=secret' }
    ] }));
    await writeFile(path.join(dataDir, 'colosseumticket-events.json'), JSON.stringify({ events: [
      { location: { city: 'Pardubice' }, affiliateUrl: 'https://seller.test/?a_box=secret' }
    ] }));
    await buildEventCities({ dataDir });
    const text = await readFile(path.join(dataDir, 'event-cities.json'), 'utf8');
    assert.equal(JSON.parse(text).items.length, 2);
    assert.doesNotMatch(text, /a_box|secret|https:|lat|lon/);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});
