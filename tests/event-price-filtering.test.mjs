import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterEventPriceBatch
} from '../src/event-price-filtering.js';

const rates = {
  EUR:
    1,

  CZK:
    25,

  GBP:
    0.85,

  USD:
    1.1,

  PLN:
    4.3,

  HUF:
    390
};

test(
  'returns the original event list when max-price filter is inactive',
  () => {
    const events = [
      {
        id:
          'one'
      }
    ];

    assert.equal(
      filterEventPriceBatch(
        events,
        {}
      ),
      events
    );
  }
);

test(
  'filters mixed-currency events against one maximum price',
  () => {
    const events = [
      {
        id:
          'czk-pass',

        priceFrom:
          900,

        currency:
          'CZK'
      },
      {
        id:
          'gbp-fail',

        priceFrom:
          50,

        currency:
          'GBP'
      },
      {
        id:
          'mixed-pass',

        ticketOptions: [
          {
            priceFrom:
              '50 GBP',

            currency:
              'GBP'
          },
          {
            priceFrom:
              '950 CZK',

            currency:
              'CZK'
          }
        ]
      },
      {
        id:
          'unknown'
      }
    ];

    const filtered =
      filterEventPriceBatch(
        events,
        {
          maxPrice:
            1000,

          priceCurrency:
            'CZK'
        },
        rates
      );

    assert.deepEqual(
      filtered.map(
        event =>
          event.id
      ),
      [
        'czk-pass',
        'mixed-pass'
      ]
    );
  }
);

test(
  'still compares same-currency prices when FX rates are temporarily unavailable',
  () => {
    const events = [
      {
        id:
          'same',

        priceFrom:
          999,

        currency:
          'CZK'
      },
      {
        id:
          'foreign',

        priceFrom:
          20,

        currency:
          'EUR'
      }
    ];

    const filtered =
      filterEventPriceBatch(
        events,
        {
          maxPrice:
            1000,

          priceCurrency:
            'CZK'
        },
        {}
      );

    assert.deepEqual(
      filtered.map(
        event =>
          event.id
      ),
      [
        'same'
      ]
    );
  }
);