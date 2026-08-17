import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestCities
} from '../src/city/suggestClient.js';

import {
  createSuggestCitiesResolver,
  resolveCityFromSuggestions
} from '../src/ai-search/city-resolver-adapter.js';

test(
  'remote city result enriches local fallback with coordinates',
  async () => {
    const previousFetch =
      globalThis.fetch;

    suggestCities.__cache?.clear?.();

    globalThis.fetch =
      async () => ({
        ok:
          true,

        json:
          async () => ({
            items: [
              {
                city:
                  'Praha',

                countryCode:
                  'CZ',

                lat:
                  50.0755,

                lon:
                  14.4378,

                score:
                  500
              }
            ]
          })
      });

    try {
      const items =
        await suggestCities({
          locale:
            'cs',

          keyword:
            'Praha',

          countryCodes: [
            'CZ'
          ]
        });

      const prague =
        items.find(
          item =>
            item.type ===
              'city' &&
            item.countryCode ===
              'CZ'
        );

      assert.equal(
        prague?.city,
        'Praha'
      );

      assert.equal(
        prague?.lat,
        50.0755
      );

      assert.equal(
        prague?.lon,
        14.4378
      );
    } finally {
      globalThis.fetch =
        previousFetch;

      suggestCities.__cache?.clear?.();
    }
  }
);

test(
  'resolver matches localized and canonical forms',
  async () => {
    const result =
      await resolveCityFromSuggestions({
        label:
          'Praha',

        countryCode:
          'CZ',

        locale:
          'cs',

        suggestFn:
          async () => [
            {
              type:
                'city',

              city:
                'Prague',

              countryCode:
                'CZ',

              lat:
                50.0755,

              lon:
                14.4378,

              score:
                100
            }
          ]
      });

    assert.equal(
      result?.countryCode,
      'CZ'
    );

    assert.equal(
      result?.lat,
      50.0755
    );

    assert.equal(
      result?.lon,
      14.4378
    );
  }
);

test(
  'resolver rejects candidates from the wrong country',
  async () => {
    const result =
      await resolveCityFromSuggestions({
        label:
          'London',

        countryCode:
          'GB',

        suggestFn:
          async () => [
            {
              type:
                'city',

              city:
                'London',

              countryCode:
                'CA',

              lat:
                42.9849,

              lon:
                -81.2453
            }
          ]
      });

    assert.equal(
      result,
      null
    );
  }
);

test(
  'resolver does not invent coordinates when suggestions lack them',
  async () => {
    const result =
      await resolveCityFromSuggestions({
        label:
          'Praha',

        countryCode:
          'CZ',

        suggestFn:
          async () => [
            {
              type:
                'city',

              city:
                'Praha',

              countryCode:
                'CZ'
            }
          ]
      });

    assert.equal(
      result,
      null
    );
  }
);

test(
  'resolver refuses ambiguous same-name cities with different coordinates',
  async () => {
    const result =
      await resolveCityFromSuggestions({
        label:
          'Springfield',

        countryCode:
          'US',

        countryCodes: [
          'US'
        ],

        suggestFn:
          async () => [
            {
              type:
                'city',

              city:
                'Springfield',

              countryCode:
                'US',

              lat:
                39.7817,

              lon:
                -89.6501,

              score:
                100
            },
            {
              type:
                'city',

              city:
                'Springfield',

              countryCode:
                'US',

              lat:
                44.0462,

              lon:
                -123.0220,

              score:
                90
            }
          ]
      });

    assert.equal(
      result,
      null
    );
  }
);

test(
  'resolver factory passes locale and requested country scope',
  async () => {
    let received =
      null;

    const resolver =
      createSuggestCitiesResolver({
        locale:
          'de',

        suggestFn:
          async options => {
            received =
              options;

            return [
              {
                type:
                  'city',

                city:
                  'Berlin',

                countryCode:
                  'DE',

                lat:
                  52.52,

                lon:
                  13.405
              }
            ];
          }
      });

    const result =
      await resolver({
        label:
          'Berlin',

        countryCode:
          'DE'
      });

    assert.equal(
      received?.locale,
      'de'
    );

    assert.deepEqual(
      received?.countryCodes,
      [
        'DE'
      ]
    );

    assert.equal(
      result?.countryCode,
      'DE'
    );
  }
);