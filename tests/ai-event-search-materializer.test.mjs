import test from 'node:test';
import assert from 'node:assert/strict';

import {
  materializeSearchPlan
} from '../src/ai-search/search-plan-materializer.js';

function regularCityPlan() {
  return {
    filters: {
      category:
        'concert',

      audience:
        'family',

      sort:
        'nearest',

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

      dateFrom:
        '2026-08-22',

      dateTo:
        '2026-08-23',

      keyword:
        '',

      nearMeLat:
        null,

      nearMeLon:
        null,

      nearMeRadiusKm:
        50
    },

    requirements:
      [],

    resolutions:
      [],

    unresolvedRequirements:
      [],

    unsupportedPreferences:
      [],

    needsClarification:
      false,

    readyForMaterialization:
      true
  };
}

function cityRadiusPlan() {
  const plan =
    regularCityPlan();

  plan.resolutions = [
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
  ];

  return plan;
}

function nearMePlan() {
  const plan =
    regularCityPlan();

  plan.filters.placeType =
    'nearMe';

  plan.filters.city =
    '';

  plan.filters.cityLabel =
    '';

  plan.filters.cityCountryCode =
    '';

  plan.resolutions = [
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
  ];

  return plan;
}

test(
  'materializes a regular city without geo context',
  () => {
    const result =
      materializeSearchPlan(
        regularCityPlan()
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.placeContext,
      {
        mode:
          'city',

        label:
          'Praha',

        countryCode:
          'CZ',

        lat:
          null,

        lon:
          null,

        radiusKm:
          null
      }
    );

    assert.deepEqual(
      result.urlIntent,
      {
        placeType:
          'city',

        city:
          'Praha',

        cityCc:
          'CZ'
      }
    );
  }
);

test(
  'materializes Prague nearby as city_radius and not Near Me',
  () => {
    const result =
      materializeSearchPlan(
        cityRadiusPlan()
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.placeContext,
      {
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
          50
      }
    );

    assert.equal(
      result.placeContext.mode,
      'city_radius'
    );

    assert.equal(
      result.filters.cityLabel,
      'Praha'
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
  'creates explicit city-radius URL intent',
  () => {
    const result =
      materializeSearchPlan(
        cityRadiusPlan()
      );

    assert.deepEqual(
      result.urlIntent,
      {
        placeType:
          'cityRadius',

        city:
          'Praha',

        cityCc:
          'CZ',

        lat:
          50.0755,

        lon:
          14.4378,

        radius:
          50
      }
    );
  }
);

test(
  'materializes actual Near Me separately',
  () => {
    const result =
      materializeSearchPlan(
        nearMePlan()
      );

    assert.deepEqual(
      result.placeContext,
      {
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
          30
      }
    );

    assert.deepEqual(
      result.urlIntent,
      {
        placeType:
          'nearMe',

        lat:
          48.8489,

        lon:
          17.1324,

        radius:
          30
      }
    );
  }
);

test(
  'blocks materialization while clarification is required',
  () => {
    const plan =
      cityRadiusPlan();

    plan.needsClarification =
      true;

    const result =
      materializeSearchPlan(
        plan
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.reason,
      'clarification_required'
    );

    assert.equal(
      result.readyToApply,
      false
    );
  }
);

test(
  'blocks materialization when requirements remain unresolved',
  () => {
    const plan =
      cityRadiusPlan();

    plan.resolutions =
      [];

    plan.unresolvedRequirements = [
      {
        type:
          'resolve_city_coordinates',

        error: {
          code:
            'CITY_NOT_FOUND'
        }
      }
    ];

    plan.readyForMaterialization =
      false;

    const result =
      materializeSearchPlan(
        plan
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.reason,
      'requirements_unresolved'
    );
  }
);

test(
  'does not mutate the resolved input plan',
  () => {
    const plan =
      cityRadiusPlan();

    const before =
      structuredClone(
        plan
      );

    materializeSearchPlan(
      plan
    );

    assert.deepEqual(
      plan,
      before
    );
  }
);