import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchEvents,
  isSmsticketEventAvailable,
} from '../src/adapters/smsticket.js';

test('SMS Ticket keeps current and future event days', () => {
  const now = new Date('2026-07-31T12:00:00');

  assert.equal(
    isSmsticketEventAvailable(
      {
        date: '2026-07-31',
        bookingEndsAt: '2026-07-01T23:59:59',
      },
      now
    ),
    true
  );

  assert.equal(
    isSmsticketEventAvailable(
      {
        datetime: '2026-08-01T20:00:00',
        bookingEndsAt: '2026-06-30T23:59:59',
      },
      now
    ),
    true
  );
});

test('SMS Ticket keeps past series while booking is active', () => {
  const now = new Date('2026-07-31T12:00:00');

  assert.equal(
    isSmsticketEventAvailable(
      {
        date: '2026-05-01',
        bookingEndsAt: '2026-12-31T23:59:59',
      },
      now
    ),
    true
  );
});

test('SMS Ticket removes events only when both boundaries expired', () => {
  const now = new Date('2026-07-31T12:00:00');

  assert.equal(
    isSmsticketEventAvailable(
      {
        date: '2026-05-01',
        bookingEndsAt: '2026-05-01T23:59:59',
      },
      now
    ),
    false
  );

  assert.equal(
    isSmsticketEventAvailable({}, now),
    false
  );
});

test('SMS Ticket falls back to whichever valid boundary exists', () => {
  const now = new Date('2026-07-31T12:00:00');

  assert.equal(
    isSmsticketEventAvailable(
      { date: '2026-08-01' },
      now
    ),
    true
  );

  assert.equal(
    isSmsticketEventAvailable(
      {
        bookingEndsAt: '2026-08-01T23:59:59',
      },
      now
    ),
    true
  );

  assert.equal(
    isSmsticketEventAvailable(
      { datetime: '2026-07-30T20:00:00' },
      now
    ),
    false
  );
});

test('SMS Ticket adapter removes expired events without hiding future events', async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        events: [
          {
            id: 'expired-event',
            category: 'music',
            date: '2026-05-01',
            datetime: '2026-05-01T19:00:00',
            bookingEndsAt: '2026-05-01T18:00:00',
            title: { cs: 'Expired event' },
          },
          {
            id: 'active-series',
            category: 'music',
            date: '2026-05-01',
            datetime: '2026-05-01T19:00:00',
            bookingEndsAt: '2099-12-31T23:59:59',
            title: { cs: 'Active series' },
          },
          {
            id: 'future-event',
            category: 'arts',
            date: '2099-08-01',
            datetime: '2099-08-01T19:00:00',
            title: { cs: 'Future event' },
          },
          {
            id: 'future-event-old-booking',
            category: 'music',
            date: '2099-09-01',
            datetime: '2099-09-01T19:00:00',
            bookingEndsAt: '2026-06-30T23:59:59',
            title: {
              cs: 'Future event with old booking end',
            },
          },
        ],
      };
    },
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const results = await fetchEvents({
    filters: {
      category: 'all',
      page: 0,
      size: 50,
    },
  });

  assert.deepEqual(
    results.map((event) => event.id),
    [
      'active-series',
      'future-event',
      'future-event-old-booking',
    ]
  );
});
