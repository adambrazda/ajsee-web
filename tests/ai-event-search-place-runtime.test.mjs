import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGeoRadiusToApiFilters,
  formatCityRadiusLabel,
  getGeoPlaceMode,
  isCityRadiusPlace,
  isNearMePlace,
  readGeoPlaceFromSearchParams,
  shouldPreserveCityRadiusInput,
  syncPlaceSearchParams
} from '../src/event-place-runtime.js';

import {
  getActiveFilterDescriptors
} from '../src/events-filter-ux.js';

function cityRadiusFilters() {
  return {
    placeType:
      'cityRadius',

    city:
      'Praha',

    cityLabel:
      'Praha',

    cityCountryCode:
      'CZ',

    countryCode:
      'CZ',

    nearMeLat:
      50.0755,

    nearMeLon:
      14.4378,

    nearMeRadiusKm:
      50
  };
}

function nearMeFilters() {
  return {
    placeType:
      'nearMe',

    city:
      '',

    cityLabel:
      'V mém okolí',

    cityCountryCode:
      '',

    countryCode:
      'CZ',

    nearMeLat:
      48.8489,

    nearMeLon:
      17.1324,

    nearMeRadiusKm:
      30
  };
}

test(
  'distinguishes city radius from actual Near Me',
  () => {
    assert.equal(
      isCityRadiusPlace(
        cityRadiusFilters()
      ),
      true
    );

    assert.equal(
      isNearMePlace(
        cityRadiusFilters()
      ),
      false
    );

    assert.equal(
      isNearMePlace(
        nearMeFilters()
      ),
      true
    );
  }
);

test(
  'legacy coordinates without placeType remain Near Me',
  () => {
    assert.equal(
      getGeoPlaceMode({
        nearMeLat:
          50,

        nearMeLon:
          14
      }),
      'nearMe'
    );
  }
);

test(
  'formats city-radius UX label',
  () => {
    assert.equal(
      formatCityRadiusLabel(
        cityRadiusFilters()
      ),
      'Praha + 50 km'
    );
  }
);

test(
  'city-radius API query drops exact city but preserves semantic place mode',
  () => {
    const result =
      applyGeoRadiusToApiFilters(
        cityRadiusFilters()
      );

    assert.equal(
      result.placeType,
      'cityRadius'
    );

    assert.equal(
      result.city,
      ''
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
      result.radiusKm,
      50
    );
  }
);

test(
  'actual Near Me clears city country constraint',
  () => {
    const result =
      applyGeoRadiusToApiFilters({
        ...nearMeFilters(),

        cityCountryCode:
          'CZ'
      });

    assert.equal(
      result.placeType,
      'nearMe'
    );

    assert.equal(
      result.city,
      ''
    );

    assert.equal(
      result.cityCountryCode,
      ''
    );
  }
);

test(
  'unchanged city input preserves city-radius state',
  () => {
    assert.equal(
      shouldPreserveCityRadiusInput(
        cityRadiusFilters(),
        'Praha'
      ),
      true
    );

    assert.equal(
      shouldPreserveCityRadiusInput(
        cityRadiusFilters(),
        'Brno'
      ),
      false
    );
  }
);

test(
  'serializes city-radius URL without degrading to Near Me',
  () => {
    const params =
      new URLSearchParams();

    syncPlaceSearchParams(
      params,
      cityRadiusFilters()
    );

    assert.equal(
      params.get('placeType'),
      'cityRadius'
    );

    assert.equal(
      params.get('city'),
      'Praha'
    );

    assert.equal(
      params.get('cityCc'),
      'CZ'
    );

    assert.equal(
      params.get('lat'),
      '50.0755'
    );

    assert.equal(
      params.get('lon'),
      '14.4378'
    );

    assert.equal(
      params.get('radius'),
      '50'
    );
  }
);

test(
  'city-radius URL round-trips into the same semantic mode',
  () => {
    const params =
      new URLSearchParams(
        'city=Praha&cityCc=CZ&placeType=cityRadius&lat=50.0755&lon=14.4378&radius=50'
      );

    assert.deepEqual(
      readGeoPlaceFromSearchParams(
        params
      ),
      {
        mode:
          'cityRadius',

        city:
          'Praha',

        cityCc:
          'CZ',

        lat:
          50.0755,

        lon:
          14.4378,

        radiusKm:
          50
      }
    );
  }
);

test(
  'legacy lat/lon URL still hydrates as Near Me',
  () => {
    const params =
      new URLSearchParams(
        'lat=48.8489&lon=17.1324&radius=30'
      );

    assert.deepEqual(
      readGeoPlaceFromSearchParams(
        params
      ),
      {
        mode:
          'nearMe',

        city:
          '',

        cityCc:
          '',

        lat:
          48.8489,

        lon:
          17.1324,

        radiusKm:
          30
      }
    );
  }
);

test(
  'filter summary shows city radius rather than Near Me',
  () => {
    const descriptors =
      getActiveFilterDescriptors(
        {
          ...cityRadiusFilters(),

          category:
            'all',

          audience:
            '',

          dateFrom:
            '',

          dateTo:
            '',

          keyword:
            '',

          sort:
            'nearest'
        },
        {
          locale:
            'cs',

          labels: {
            nearMe:
              'V mém okolí'
          }
        }
      );

    const place =
      descriptors.find(
        item =>
          item.key ===
          'place'
      );

    assert.equal(
      place?.label,
      'Praha + 50 km'
    );
  }
);

test(
  'filter summary keeps real Near Me label for user geolocation',
  () => {
    const descriptors =
      getActiveFilterDescriptors(
        {
          ...nearMeFilters(),

          category:
            'all',

          audience:
            '',

          dateFrom:
            '',

          dateTo:
            '',

          keyword:
            '',

          sort:
            'nearest'
        },
        {
          locale:
            'cs',

          labels: {
            nearMe:
              'V mém okolí'
          }
        }
      );

    const place =
      descriptors.find(
        item =>
          item.key ===
          'place'
      );

    assert.equal(
      place?.label,
      'V mém okolí'
    );
  }
);