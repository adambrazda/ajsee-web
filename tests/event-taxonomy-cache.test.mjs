import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventTaxonomyCache } from '../src/event-taxonomy-cache.js';

test('static classification runs once per source object without caching filters or dynamic event fields', () => {
  let calls = 0;
  const normalize = createEventTaxonomyCache(event => {
    calls++;
    return { domains: ['music'], eventTypes: ['concert'], genres: [], audiences: [],
      source: { provider: 'smsticket', rawCategory: event.category, rawTypes: ['Koncert'] } };
  });
  const source = Object.freeze({ id: 'same-id', category: 'music' });
  const first = normalize({ ...source, time: '19:00' }, source);
  first.taxonomy.eventTypes.push('Changed');
  first.taxonomy.source.rawTypes.push('Changed');
  first.category = 'Changed';
  const next = normalize({ ...source, time: '20:00' }, source);
  assert.equal(calls, 1);
  assert.equal(next.time, '20:00');
  assert.equal(next.category, 'concert');
  assert.deepEqual(next.taxonomy.eventTypes, ['concert']);
  assert.deepEqual(next.taxonomy.source.rawTypes, ['Koncert']);
  normalize({ ...source });
  assert.equal(calls, 2, 'a refreshed event with the same ID gets a new classification');
});
