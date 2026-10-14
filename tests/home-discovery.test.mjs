import test from 'node:test';
import assert from 'node:assert/strict';
import { isHomeDiscovery, selectHomeDiscoveryEvents } from '../src/home-discovery.js';

test('only the unfiltered homepage uses discovery presentation', () => {
  const defaults = { category: 'all', countryCode: 'CZ', maxPrice: null, nearMeLat: null, nearMeLon: null };
  assert.equal(isHomeDiscovery(defaults), true);
  for (const active of [{ city: 'Hodonín' }, { placeType: 'country', countryCode: 'FR' },
    { category: 'sport' }, { dateFrom: '2099-10-18' }, { audience: 'family' },
    { maxPrice: 0 }, { keyword: 'Hamlet' }, { searchMode: 'discovery' }, { nearMeLat: 0 }]) {
    assert.equal(isHomeDiscovery({ ...defaults, ...active }), false, JSON.stringify(active));
  }
});

test('discovery folds repeated time slots while preserving event objects and seller links', () => {
  const events = [
    { id: 'a-1', title: 'Muzeum', venue: 'Muzeum', city: 'Praha', tickets: 'https://example.test/a?a_box=keep' },
    { id: 'a-2', title: 'MUZEUM', venue: 'Muzeum', city: 'Praha', tickets: 'https://example.test/a?a_box=keep' },
    { id: 'b', title: 'Koncert', venue: 'Klub', city: 'Brno', tickets: 'https://example.test/b?irclickid=keep' },
    { id: 'c', title: 'Muzeum', venue: 'Jiné muzeum', city: 'Brno', tickets: 'https://example.test/c' }
  ];
  const selected = selectHomeDiscoveryEvents(events, 3);
  assert.deepEqual(selected.map(e => e.id), ['a-1', 'b', 'c']);
  assert.equal(selected[0], events[0]);
  assert.equal(selected[1].tickets, events[2].tickets);
  assert.equal(events.length, 4);
});

test('discovery handles localized titles, empty inventory and the card limit', () => {
  assert.deepEqual(selectHomeDiscoveryEvents([]), []);
  const events = Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: { cs: 'Akce ' + i }, city: { name: 'Praha' } }));
  assert.equal(selectHomeDiscoveryEvents(events).length, 6);
});
