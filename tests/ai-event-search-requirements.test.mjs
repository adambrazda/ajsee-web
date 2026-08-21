import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveIntentRequirements
} from '../src/ai-search/requirement-resolver.js';

function cityRadiusPlan() {
  return {
    version:
      1,

    filters: {
      placeType:
        'city',

      city:
        'Praha',

      cityLabel:
        'Praha',

      cityCountryCode:
        'CZ',

      nearMeLat:
        null,

      nearMeLon:
        null,

      nearMeRadiusKm:
        50
    },

    requirements: [
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
    ],

    unsupportedPreferences:
      [],

    needsClarification:
      false,

    readyToApply:
      false
  };
}

function nearMePlan() {
  return {
    version:
      1,

    filters: {
      placeType:
        'nearMe',

      city:
        '',

      cityLabel:
        '',

      cityCountryCode:
        '',

      nearMeLat:
        null,

      nearMeLon:
        null,

      nearMeRadiusKm:
        30
    },

    requirements: [
      {
        type:
          'request_geolocation',

        radiusKm:
          30
      }
    ],

    unsupportedPreferences:
      [],

    needsClarification:
      false,

    readyToApply:
      false
  };
}

test(
  'resolves city-radius coordinates without pretending they are Near Me',
  async () => {
    const result =
      await resolveIntentRequirements(
        cityRadiusPlan(),
        {
          resolveCity:
            async ({
              label,
              countryCode
            }) => {
              assert.equal(
                label,
                'Praha'
              );

              assert.equal(
                countryCode,
                'CZ'
              );

              return {
                city:
                  'Praha',

                countryCode:
                  'CZ',

                lat:
                  50.0755,

                lon:
                  14.4378
              };
            }
        }
      );

    assert.equal(
      result.resolutions.length,
      1
    );

    assert.deepEqual(
      result.resolutions[0],
      {
        type:
          'city_coordinates',

        placeMode:
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
          50
      }
    );

    assert.equal(
      result.unresolvedRequirements.length,
      0
    );

    assert.equal(
      result.readyForMaterialization,
      true
    );

    assert.equal(
      result.filters.nearMeLat,
      null
    );

    assert.equal(
      result.filters.nearMeLon,
      null
    );
  }
);

test(
  'resolves actual Near Me as a separate place mode',
  async () => {
    const result =
      await resolveIntentRequirements(
        nearMePlan(),
        {
          getGeolocation:
            async () => ({
              latitude:
                48.8489,

              longitude:
                17.1324
            })
        }
      );

    assert.deepEqual(
      result.resolutions,
      [
        {
          type:
            'user_geolocation',

          placeMode:
            'near_me',

          lat:
            48.8489,

          lon:
            17.1324,

          radiusKm:
            30
        }
      ]
    );

    assert.equal(
      result.readyForMaterialization,
      true
    );
  }
);

test(
  'rejects city result from the wrong country',
  async () => {
    const result =
      await resolveIntentRequirements(
        cityRadiusPlan(),
        {
          resolveCity:
            async () => ({
              city:
                'Prague',

              countryCode:
                'US',

              lat:
                41.3098,

              lon:
                -96.4417
            })
        }
      );

    assert.equal(
      result.resolutions.length,
      0
    );

    assert.equal(
      result.unresolvedRequirements.length,
      1
    );

    assert.equal(
      result
        .unresolvedRequirements[0]
        .error.code,
      'CITY_COUNTRY_MISMATCH'
    );

    assert.equal(
      result.readyForMaterialization,
      false
    );
  }
);

test(
  'does not fabricate coordinates when city resolver has no result',
  async () => {
    const result =
      await resolveIntentRequirements(
        cityRadiusPlan(),
        {
          resolveCity:
            async () =>
              null
        }
      );

    assert.equal(
      result.resolutions.length,
      0
    );

    assert.equal(
      result
        .unresolvedRequirements[0]
        .error.code,
      'CITY_NOT_FOUND'
    );

    assert.equal(
      result.readyForMaterialization,
      false
    );
  }
);

test(
  'rejects invalid browser geolocation',
  async () => {
    const result =
      await resolveIntentRequirements(
        nearMePlan(),
        {
          getGeolocation:
            async () => ({
              lat:
                500,

              lon:
                500
            })
        }
      );

    assert.equal(
      result.resolutions.length,
      0
    );

    assert.equal(
      result
        .unresolvedRequirements[0]
        .error.code,
      'INVALID_GEOLOCATION'
    );
  }
);

test(
  'does not resolve requirements while clarification is required',
  async () => {
    let cityResolverCalled =
      false;

    const plan =
      cityRadiusPlan();

    plan.needsClarification =
      true;

    const result =
      await resolveIntentRequirements(
        plan,
        {
          resolveCity:
            async () => {
              cityResolverCalled =
                true;

              return {
                lat:
                  50,

                lon:
                  14
              };
            }
        }
      );

    assert.equal(
      cityResolverCalled,
      false
    );

    assert.equal(
      result.resolutions.length,
      0
    );

    assert.equal(
      result.unresolvedRequirements.length,
      1
    );

    assert.equal(
      result.readyForMaterialization,
      false
    );
  }
);

test(
  'reports unknown requirements instead of silently ignoring them',
  async () => {
    const plan =
      cityRadiusPlan();

    plan.requirements = [
      {
        type:
          'unknown_future_requirement'
      }
    ];

    const result =
      await resolveIntentRequirements(
        plan
      );

    assert.equal(
      result.unresolvedRequirements.length,
      1
    );

    assert.equal(
      result
        .unresolvedRequirements[0]
        .error.code,
      'UNSUPPORTED_REQUIREMENT'
    );

    assert.equal(
      result.readyForMaterialization,
      false
    );
  }
);