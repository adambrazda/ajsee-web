import test from 'node:test';
import assert from 'node:assert/strict';

import {
  convertPrice,
  getEventPriceOptions,
  hasActivePriceFilter,
  matchesEventMaxPrice,
  normalizePriceCurrency,
  normalizePriceFilterState,
  parsePriceAmount,
  readPriceFilterFromSearchParams,
  syncPriceFilterSearchParams
} from '../src/event-price.js';

test(
  'normalizes supported currency aliases',
  () => {
    assert.equal(
      normalizePriceCurrency('CZK'),
      'CZK'
    );

    assert.equal(
      normalizePriceCurrency('Kč'),
      'CZK'
    );

    assert.equal(
      normalizePriceCurrency('€'),
      'EUR'
    );

    assert.equal(
      normalizePriceCurrency('£'),
      'GBP'
    );
  }
);

test(
  'parses common provider price formats',
  () => {
    assert.equal(
      parsePriceAmount('390 CZK'),
      390
    );

    assert.equal(
      parsePriceAmount('1 000 Kč'),
      1000
    );

    assert.equal(
      parsePriceAmount('25 EUR'),
      25
    );

    assert.equal(
      parsePriceAmount('£28'),
      28
    );

    assert.equal(
      parsePriceAmount('1.234,50 EUR'),
      1234.5
    );
  }
);

test(
  'collects and deduplicates multiple ticket price options',
  () => {
    const options =
      getEventPriceOptions({
        priceFrom:
          '750 CZK',
        currency:
          'CZK',
        ticketOptions: [
          {
            priceFrom:
              '750 CZK',
            currency:
              'CZK'
          },
          {
            priceFrom:
              '25 EUR',
            currency:
              'EUR'
          }
        ]
      });

    assert.deepEqual(
      options,
      [
        {
          amount:
            750,
          currency:
            'CZK'
        },
        {
          amount:
            25,
          currency:
            'EUR'
        }
      ]
    );
  }
);

test(
  'converts currencies through EUR reference rates',
  () => {
    const converted =
      convertPrice(
        28,
        'GBP',
        'CZK',
        {
          EUR:
            1,
          GBP:
            0.85,
          CZK:
            25
        }
      );

    assert.ok(
      converted !== null
    );

    assert.ok(
      Math.abs(
        converted -
        823.5294117647059
      ) < 0.000001
    );
  }
);

test(
  'passes when any ticket option satisfies the max-price limit',
  () => {
    const event = {
      ticketOptions: [
        {
          priceFrom:
            '45 EUR',
          currency:
            'EUR'
        },
        {
          priceFrom:
            '750 CZK',
          currency:
            'CZK'
        }
      ]
    };

    assert.equal(
      matchesEventMaxPrice(
        event,
        {
          maxPrice:
            800,
          priceCurrency:
            'CZK'
        },
        {
          rates: {
            EUR:
              1,
            CZK:
              25
          }
        }
      ),
      true
    );
  }
);

test(
  'rejects an event when all known ticket prices exceed the limit',
  () => {
    const event = {
      ticketOptions: [
        {
          priceFrom:
            '45 EUR',
          currency:
            'EUR'
        },
        {
          priceFrom:
            '1250 CZK',
          currency:
            'CZK'
        }
      ]
    };

    assert.equal(
      matchesEventMaxPrice(
        event,
        {
          maxPrice:
            1000,
          priceCurrency:
            'CZK'
        },
        {
          rates: {
            EUR:
              1,
            CZK:
              25
          }
        }
      ),
      false
    );
  }
);

test(
  'rejects events with unknown price when a price limit is active',
  () => {
    assert.equal(
      matchesEventMaxPrice(
        {
          title:
            'Unknown price'
        },
        {
          maxPrice:
            1000,
          priceCurrency:
            'CZK'
        },
        {
          rates: {
            EUR:
              1,
            CZK:
              25
          }
        }
      ),
      false
    );
  }
);

test(
  'does not filter by price when no valid limit is active',
  () => {
    assert.equal(
      matchesEventMaxPrice(
        {},
        {
          maxPrice:
            null,
          priceCurrency:
            ''
        }
      ),
      true
    );
  }
);

test(
  'supports zero as a valid price limit for free events',
  () => {
    assert.equal(
      matchesEventMaxPrice(
        {
          priceFrom:
            0,
          currency:
            'CZK'
        },
        {
          maxPrice:
            0,
          priceCurrency:
            'CZK'
        }
      ),
      true
    );
  }
);
test(
  'normalizes canonical max-price filter state',
  () => {
    assert.deepEqual(
      normalizePriceFilterState({
        maxPrice:
          '1 000',

        priceCurrency:
          'czk'
      }),
      {
        maxPrice:
          1000,

        priceCurrency:
          'CZK'
      }
    );

    assert.equal(
      hasActivePriceFilter({
        maxPrice:
          1000,

        priceCurrency:
          'CZK'
      }),
      true
    );
  }
);

test(
  'requires both amount and supported currency for active price filter',
  () => {
    assert.deepEqual(
      normalizePriceFilterState({
        maxPrice:
          1000,

        priceCurrency:
          ''
      }),
      {
        maxPrice:
          null,

        priceCurrency:
          ''
      }
    );

    assert.deepEqual(
      normalizePriceFilterState({
        maxPrice:
          1000,

        priceCurrency:
          'XYZ'
      }),
      {
        maxPrice:
          null,

        priceCurrency:
          ''
      }
    );
  }
);

test(
  'reads and writes canonical max-price URL state',
  () => {
    const params =
      new URLSearchParams(
        'q=concert&priceMax=1000&priceCurrency=czk'
      );

    assert.deepEqual(
      readPriceFilterFromSearchParams(
        params
      ),
      {
        maxPrice:
          1000,

        priceCurrency:
          'CZK'
      }
    );

    syncPriceFilterSearchParams(
      params,
      {
        maxPrice:
          50,

        priceCurrency:
          'GBP'
      }
    );

    assert.equal(
      params.get(
        'priceMax'
      ),
      '50'
    );

    assert.equal(
      params.get(
        'priceCurrency'
      ),
      'GBP'
    );

    assert.equal(
      params.get(
        'q'
      ),
      'concert'
    );

    syncPriceFilterSearchParams(
      params,
      {
        maxPrice:
          null,

        priceCurrency:
          ''
      }
    );

    assert.equal(
      params.has(
        'priceMax'
      ),
      false
    );

    assert.equal(
      params.has(
        'priceCurrency'
      ),
      false
    );

    assert.equal(
      params.get(
        'q'
      ),
      'concert'
    );
  }
);

test(
  'supports zero as an active canonical price limit',
  () => {
    assert.deepEqual(
      normalizePriceFilterState({
        maxPrice:
          0,

        priceCurrency:
          'CZK'
      }),
      {
        maxPrice:
          0,

        priceCurrency:
          'CZK'
      }
    );

    assert.equal(
      hasActivePriceFilter({
        maxPrice:
          0,

        priceCurrency:
          'CZK'
      }),
      true
    );
  }
);