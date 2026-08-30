import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveFilterDescriptors,
  getEmptyStateRecommendation
} from '../src/events-filter-ux.js';

test(
  'active max-price filter exposes one removable price descriptor',
  () => {
    const descriptors =
      getActiveFilterDescriptors(
        {
          maxPrice:
            1000,

          priceCurrency:
            'CZK'
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      descriptors.length,
      1
    );

    assert.equal(
      descriptors[0].key,
      'price'
    );

    assert.match(
      descriptors[0].label,
      /^≤ /
    );

    assert.match(
      descriptors[0].label,
      /CZK$/
    );
  }
);

test(
  'inactive or incomplete price state does not create a descriptor',
  () => {
    assert.deepEqual(
      getActiveFilterDescriptors(
        {
          maxPrice:
            1000,

          priceCurrency:
            ''
        }
      ),
      []
    );

    assert.deepEqual(
      getActiveFilterDescriptors(
        {
          maxPrice:
            null,

          priceCurrency:
            'CZK'
        }
      ),
      []
    );
  }
);

test(
  'price is recommended first when an empty result can be relaxed',
  () => {
    const recommendation =
      getEmptyStateRecommendation(
        {
          maxPrice:
            1000,

          priceCurrency:
            'CZK',

          keyword:
            'Hamilton'
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      recommendation?.key,
      'price'
    );
  }
);

test(
  'localized descriptor formats the amount through Intl',
  () => {
    const descriptor =
      getActiveFilterDescriptors(
        {
          maxPrice:
            1234.5,

          priceCurrency:
            'EUR'
        },
        {
          locale:
            'en'
        }
      ).find(
        item =>
          item.key ===
          'price'
      );

    assert.ok(
      descriptor
    );

    assert.match(
      descriptor.label,
      /^≤ /
    );

    assert.match(
      descriptor.label,
      /EUR$/
    );
  }
);
