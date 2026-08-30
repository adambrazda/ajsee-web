import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapTicketmasterEvent
} from '../src/adapters/ticketmaster.js';

function ticketmasterEvent(
  overrides = {}
) {
  return {
    id: 'tm-price-test',
    name: 'Test event',
    url: 'https://www.ticketmaster.co.uk/event/test',

    dates: {
      start: {
        dateTime: '2026-10-01T19:00:00Z'
      }
    },

    classifications: [],

    _embedded: {
      venues: [
        {
          name: 'Test Venue',

          city: {
            name: 'London'
          },

          country: {
            countryCode: 'GB'
          },

          location: {
            latitude: '51.5074',
            longitude: '-0.1278'
          }
        }
      ]
    },

    ...overrides
  };
}

test(
  'preserves Ticketmaster minimum price and currency',
  () => {
    const mapped =
      mapTicketmasterEvent(
        ticketmasterEvent({
          priceRanges: [
            {
              type: 'standard',
              min: 28.5,
              max: 120,
              currency: 'GBP'
            }
          ]
        }),
        'en'
      );

    assert.equal(
      mapped.priceFrom,
      28.5
    );

    assert.equal(
      mapped.currency,
      'GBP'
    );

    assert.deepEqual(
      mapped.priceOptions,
      [
        {
          amount: 28.5,
          currency: 'GBP'
        }
      ]
    );
  }
);

test(
  'normalizes Ticketmaster currency to uppercase',
  () => {
    const mapped =
      mapTicketmasterEvent(
        ticketmasterEvent({
          priceRanges: [
            {
              min: 35,
              currency: 'eur'
            }
          ]
        }),
        'en'
      );

    assert.equal(
      mapped.currency,
      'EUR'
    );

    assert.deepEqual(
      mapped.priceOptions,
      [
        {
          amount: 35,
          currency: 'EUR'
        }
      ]
    );
  }
);

test(
  'does not invent currency metadata when Ticketmaster omits currency',
  () => {
    const mapped =
      mapTicketmasterEvent(
        ticketmasterEvent({
          priceRanges: [
            {
              min: 30
            }
          ]
        }),
        'en'
      );

    assert.equal(
      mapped.priceFrom,
      30
    );

    assert.equal(
      Object.hasOwn(mapped, 'currency'),
      false
    );

    assert.equal(
      Object.hasOwn(mapped, 'priceOptions'),
      false
    );
  }
);

test(
  'preserves zero as a valid free-event minimum price',
  () => {
    const mapped =
      mapTicketmasterEvent(
        ticketmasterEvent({
          priceRanges: [
            {
              min: 0,
              currency: 'CZK'
            }
          ]
        }),
        'en'
      );

    assert.equal(
      mapped.priceFrom,
      0
    );

    assert.deepEqual(
      mapped.priceOptions,
      [
        {
          amount: 0,
          currency: 'CZK'
        }
      ]
    );
  }
);