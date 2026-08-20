import assert from 'node:assert/strict';
import test from 'node:test';

import {
  materializedPlanToRuntimeFilters
} from '../src/ai-search/runtime-filter-state.js';

test(
  'city radius becomes explicit cityRadius runtime state and not Near Me',
  () => {
    const result =
      materializedPlanToRuntimeFilters({
        ok:
          true,

        readyToApply:
          true,

        filters: {
          category:
            'concert',

          placeType:
            'city',

          city:
            'Praha',

          cityLabel:
            'Praha',

          cityCountryCode:
            'CZ',

          countryCode:
            'CZ',

          nearMeLat:
            null,

          nearMeLon:
            null,

          nearMeRadiusKm:
            30
        },

        placeContext: {
          mode:
            'city_radius',

          label:
            'Praha',

          countryCode:
            'CZ',

          lat:
            50.0755,

          lon:
            14.4378,

          radiusKm:
            30
        }
      });

    assert.equal(
      result.placeType,
      'cityRadius'
    );

    assert.equal(
      result.city,
      'Praha'
    );

    assert.equal(
      result.cityLabel,
      'Praha'
    );

    assert.equal(
      result.cityCountryCode,
      'CZ'
    );

    assert.equal(
      result.nearMeLat,
      50.0755
    );

    assert.equal(
      result.nearMeLon,
      14.4378
    );

    assert.equal(
      result.nearMeRadiusKm,
      30
    );

    assert.notEqual(
      result.placeType,
      'nearMe'
    );
  }
);

test(
  'Near Me becomes explicit nearMe runtime state with localized label',
  () => {
    const result =
      materializedPlanToRuntimeFilters(
        {
          ok:
            true,

          readyToApply:
            true,

          filters: {
            category:
              'concert',

            placeType:
              'nearMe',

            city:
              '',

            cityLabel:
              '',

            cityCountryCode:
              '',

            countryCode:
              'CZ',

            nearMeLat:
              null,

            nearMeLon:
              null,

            nearMeRadiusKm:
              50
          },

          placeContext: {
            mode:
              'near_me',

            label:
              '',

            countryCode:
              '',

            lat:
              48.8489,

            lon:
              17.1324,

            radiusKm:
              50
          }
        },
        {
          nearMeLabel:
            'V mém okolí'
        }
      );

    assert.equal(
      result.placeType,
      'nearMe'
    );

    assert.equal(
      result.city,
      ''
    );

    assert.equal(
      result.cityLabel,
      'V mém okolí'
    );

    assert.equal(
      result.cityCountryCode,
      ''
    );

    assert.equal(
      result.nearMeLat,
      48.8489
    );

    assert.equal(
      result.nearMeLon,
      17.1324
    );

    assert.equal(
      result.nearMeRadiusKm,
      50
    );
  }
);
