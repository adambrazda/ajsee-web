import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateFilterIntent
} from '../src/ai-search/intent-schema.js';

import {
  mapIntentToFilters
} from '../src/ai-search/intent-to-filters.js';

import {
  materializeSearchPlan
} from '../src/ai-search/search-plan-materializer.js';

import {
  materializedPlanToRuntimeFilters
} from '../src/ai-search/runtime-filter-state.js';

import {
  syncPriceFilterSearchParams
} from '../src/event-price.js';

const FIXED_NOW =
  new Date(
    '2026-08-17T12:00:00'
  );

function baseIntent(
  overrides = {}
) {
  return {
    version:
      1,

    intent:
      'find_events',

    locale:
      'cs',

    place: {
      type:
        'none',

      label:
        '',

      countryCode:
        '',

      nearby:
        false,

      radiusKm:
        null,

      ...(overrides.place || {})
    },

    date: {
      type:
        'any',

      preset:
        '',

      from:
        '',

      to:
        '',

      ...(overrides.date || {})
    },

    category:
      overrides.category ??
      'all',

    audience:
      overrides.audience ??
      'any',

    keyword:
      overrides.keyword ??
      '',

    sort:
      overrides.sort ??
      'nearest',

    unsupportedPreferences:
      overrides.unsupportedPreferences ??
      [],

    confidence: {
      overall:
        0.99,

      place:
        0.99,

      date:
        0.99,

      category:
        0.99,

      audience:
        0.99,

      ...(overrides.confidence || {})
    },

    clarification: {
      required:
        false,

      question:
        '',

      fields:
        [],

      ...(overrides.clarification || {})
    },

    ...Object.fromEntries(
      Object.entries(overrides)
        .filter(
          ([key]) =>
            ![
              'place',
              'date',
              'category',
              'audience',
              'keyword',
              'sort',
              'unsupportedPreferences',
              'confidence',
              'clarification'
            ].includes(key)
        )
    )
  };
}

test(
  'maps weekend + family + concert + Prague nearby',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          place: {
            type:
              'city',

            label:
              'Praha',

            countryCode:
              'CZ',

            nearby:
              true,

            radiusKm:
              50
          },

          date: {
            type:
              'preset',

            preset:
              'weekend'
          },

          category:
            'concert',

          audience:
            'family'
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.category,
      'concert'
    );

    assert.equal(
      result.filters.audience,
      'family'
    );

    assert.equal(
      result.filters.city,
      'Praha'
    );

    assert.equal(
      result.filters.cityCountryCode,
      'CZ'
    );

    assert.equal(
      result.filters.dateFrom,
      '2026-08-22'
    );

    assert.equal(
      result.filters.dateTo,
      '2026-08-23'
    );

    assert.equal(
      result.requirements.length,
      1
    );

    assert.deepEqual(
      result.requirements[0],
      {
        type:
          'resolve_city_coordinates',

        label:
          'Praha',

        countryCode:
          'CZ',

        radiusKm:
          50
      }
    );

    assert.equal(
      result.readyToApply,
      false
    );
  }
);

test(
  'maps a regular city search without additional resolution',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          place: {
            type:
              'city',

            label:
              'Brno',

            countryCode:
              'CZ'
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.placeType,
      'city'
    );

    assert.equal(
      result.filters.city,
      'Brno'
    );

    assert.equal(
      result.filters.cityCountryCode,
      'CZ'
    );

    assert.equal(
      result.requirements.length,
      0
    );

    assert.equal(
      result.readyToApply,
      true
    );
  }
);

test(
  'maps country search',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          place: {
            type:
              'country',

            label:
              'Německo',

            countryCode:
              'DE'
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.placeType,
      'country'
    );

    assert.equal(
      result.filters.countryCode,
      'DE'
    );

    assert.equal(
      result.filters.city,
      ''
    );
  }
);

test(
  'near me requires browser geolocation',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          place: {
            type:
              'near_me',

            radiusKm:
              30
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.deepEqual(
      result.requirements,
      [
        {
          type:
            'request_geolocation',

          radiusKm:
            30
        }
      ]
    );

    assert.equal(
      result.filters.nearMeRadiusKm,
      30
    );

    assert.equal(
      result.readyToApply,
      false
    );
  }
);

test(
  'maps an exact day as an explicit date range',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          date: {
            type:
              'range',

            from:
              '2026-08-22',

            to:
              '2026-08-22'
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.dateFrom,
      '2026-08-22'
    );

    assert.equal(
      result.filters.dateTo,
      '2026-08-22'
    );
  }
);

test(
  'maps max-price preference into the canonical price filter',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          category:
            'concert',

          unsupportedPreferences: [
            {
              type:
                'max_price',

              value:
                500,

              currency:
                'CZK'
            }
          ]
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.category,
      'concert'
    );

    assert.equal(
      result.filters.maxPrice,
      500
    );

    assert.equal(
      result.filters.priceCurrency,
      'CZK'
    );

    assert.deepEqual(
      result.unsupportedPreferences,
      []
    );
  }
);


test(
  'keeps invalid max-price preference unsupported',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          unsupportedPreferences: [
            {
              type:
                'max_price',

              value:
                -1,

              currency:
                'CZK'
            }
          ]
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.maxPrice,
      null
    );

    assert.equal(
      result.filters.priceCurrency,
      ''
    );

    assert.deepEqual(
      result.unsupportedPreferences,
      [
        {
          type:
            'max_price',

          value:
            -1,

          currency:
            'CZK',

          unit:
            ''
        }
      ]
    );
  }
);


test(
  'maps max-price while preserving other unsupported preferences',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          unsupportedPreferences: [
            {
              type:
                'max_price',

              value:
                1000,

              currency:
                'CZK'
            },
            {
              type:
                'seat_preference',

              value:
                'front'
            }
          ]
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.filters.maxPrice,
      1000
    );

    assert.equal(
      result.filters.priceCurrency,
      'CZK'
    );

    assert.deepEqual(
      result.unsupportedPreferences,
      [
        {
          type:
            'seat_preference',

          value:
            'front',

          currency:
            '',

          unit:
            ''
        }
      ]
    );
  }
);

test(
  'AI max-price survives the complete canonical filter pipeline',
  () => {
    const mapped =
      mapIntentToFilters(
        baseIntent({
          unsupportedPreferences: [
            {
              type:
                'max_price',

              value:
                1000,

              currency:
                'CZK'
            }
          ]
        }),
        {
          now:
            FIXED_NOW
        }
      );

    const materialized =
      materializeSearchPlan(
        mapped
      );

    assert.equal(
      materialized.ok,
      true
    );

    assert.equal(
      materialized.readyToApply,
      true
    );

    const runtimeFilters =
      materializedPlanToRuntimeFilters(
        materialized
      );

    assert.equal(
      runtimeFilters.maxPrice,
      1000
    );

    assert.equal(
      runtimeFilters.priceCurrency,
      'CZK'
    );

    const params =
      new URLSearchParams();

    syncPriceFilterSearchParams(
      params,
      runtimeFilters
    );

    assert.equal(
      params.get('priceMax'),
      '1000'
    );

    assert.equal(
      params.get('priceCurrency'),
      'CZK'
    );

    assert.deepEqual(
      materialized.unsupportedPreferences,
      []
    );
  }
);


test(
  'rejects unsupported categories instead of silently guessing',
  () => {
    const validation =
      validateFilterIntent(
        baseIntent({
          category:
            'nightlife'
        })
      );

    assert.equal(
      validation.ok,
      false
    );

    assert.equal(
      validation.errors.some(
        error =>
          error.code ===
          'unsupported_category'
      ),
      true
    );
  }
);

test(
  'low confidence requests clarification',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          place: {
            type:
              'city',

            label:
              'London',

            countryCode:
              'GB'
          },

          confidence: {
            overall:
              0.95,

            place:
              0.45
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.readyToApply,
      false
    );
  }
);

test(
  'explicit clarification blocks automatic filter application',
  () => {
    const result =
      mapIntentToFilters(
        baseIntent({
          clarification: {
            required:
              true,

            question:
              'Myslíte Londýn ve Velké Británii?',

            fields:
              ['place']
          }
        }),
        {
          now:
            FIXED_NOW
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.readyToApply,
      false
    );
  }
);

test(
  'rejects invalid radius instead of silently changing user intent',
  () => {
    const validation =
      validateFilterIntent(
        baseIntent({
          place: {
            type:
              'city',

            label:
              'Praha',

            countryCode:
              'CZ',

            nearby:
              true,

            radiusKm:
              500
          }
        })
      );

    assert.equal(
      validation.ok,
      false
    );

    assert.equal(
      validation.errors.some(
        error =>
          error.code ===
          'invalid_radius'
      ),
      true
    );
  }
);