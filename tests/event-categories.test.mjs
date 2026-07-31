import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchEvents,
  normalizeSmsticketCategory,
  normalizeSmsticketEventCategory,
} from '../src/adapters/smsticket.js';

test('SMS Ticket raw categories normalize to AJSEE values', () => {
  assert.equal(normalizeSmsticketCategory('music'), 'concert');
  assert.equal(normalizeSmsticketCategory('concert'), 'concert');

  assert.equal(normalizeSmsticketCategory('arts'), 'theatre');
  assert.equal(normalizeSmsticketCategory('theatre'), 'theatre');

  assert.equal(normalizeSmsticketCategory('sports'), 'sport');
  assert.equal(normalizeSmsticketCategory('sport'), 'sport');

  assert.equal(normalizeSmsticketCategory('festival'), 'festival');
  assert.equal(normalizeSmsticketCategory('family'), 'family');
  assert.equal(normalizeSmsticketCategory('other'), 'other');
  assert.equal(normalizeSmsticketCategory(''), 'other');
});

test('SMS Ticket festival metadata has priority over raw music category', () => {
  assert.equal(
    normalizeSmsticketEventCategory({
      category: 'music',
      title: { cs: 'Letn? hudebn? festival 2026' },
      categories: ['Hudba'],
      types: ['Koncert'],
    }),
    'festival'
  );

  assert.equal(
    normalizeSmsticketEventCategory({
      category: 'music',
      title: { cs: 'Samostatn? koncert' },
      categories: ['Hudba'],
      types: ['Koncert'],
    }),
    'concert'
  );
});

test('SMS Ticket adapter filters and returns canonical categories', async (t) => {
  const originalFetch = globalThis.fetch;

  const fixtureEvents = [
    {
      id: 'sms-concert',
      category: 'music',
      date: '2099-08-01',
      datetime: '2099-08-01T18:00:00',
      title: { cs: 'Samostatn? koncert' },
      categories: ['Hudba'],
      genres: ['Pop'],
      types: ['Koncert'],
    },
    {
      id: 'sms-festival',
      category: 'music',
      date: '2099-08-02',
      datetime: '2099-08-02T18:00:00',
      title: { cs: 'Letn? festival' },
      categories: ['Hudba'],
      genres: ['Rock'],
      types: ['Festival'],
    },
    {
      id: 'sms-theatre',
      category: 'arts',
      date: '2099-08-03',
      datetime: '2099-08-03T18:00:00',
      title: { cs: 'Divadeln? p?edstaven?' },
      categories: ['Divadlo'],
      types: ['P?edstaven?'],
    },
    {
      id: 'sms-sport',
      category: 'sports',
      date: '2099-08-04',
      datetime: '2099-08-04T18:00:00',
      title: { cs: 'Sportovn? utk?n?' },
      categories: ['Sport'],
      types: ['Z?pas'],
    },
    {
      id: 'sms-family',
      category: 'family',
      date: '2099-08-05',
      datetime: '2099-08-05T18:00:00',
      title: { cs: 'Rodinn? akce' },
      categories: ['D?ti'],
      types: ['Rodinn? akce'],
    },
  ];

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { events: fixtureEvents };
    },
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const expectations = [
    ['concert', 'sms-concert'],
    ['festival', 'sms-festival'],
    ['theatre', 'sms-theatre'],
    ['sport', 'sms-sport'],
  ];

  for (const [category, expectedId] of expectations) {
    const results = await fetchEvents({
      filters: {
        category,
        page: 0,
        size: 50,
      },
    });

    assert.deepEqual(
      results.map((event) => ({
        id: event.id,
        category: event.category,
      })),
      [
        {
          id: expectedId,
          category,
        },
      ]
    );
  }

  const allResults = await fetchEvents({
    filters: {
      category: 'all',
      page: 0,
      size: 50,
    },
  });

  assert.deepEqual(
    allResults.map((event) => ({
      id: event.id,
      category: event.category,
    })),
    [
      { id: 'sms-concert', category: 'concert' },
      { id: 'sms-festival', category: 'festival' },
      { id: 'sms-theatre', category: 'theatre' },
      { id: 'sms-sport', category: 'sport' },
      { id: 'sms-family', category: 'family' },
    ]
  );
});
