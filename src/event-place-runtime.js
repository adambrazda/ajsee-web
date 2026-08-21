export const PLACE_TYPE_CITY =
  'city';

export const PLACE_TYPE_CITY_RADIUS =
  'cityRadius';

export const PLACE_TYPE_NEAR_ME =
  'nearMe';

export const PLACE_TYPE_COUNTRY =
  'country';

function normalizedPlaceType(value) {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}

function finiteCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

export function clampPlaceRadius(
  value,
  fallback = 50
) {
  const number =
    Number(value);

  const resolved =
    Number.isFinite(number)
      ? number
      : fallback;

  return Math.max(
    10,
    Math.min(
      300,
      resolved
    )
  );
}

export function hasGeoCoordinates(
  filters = {}
) {
  const lat =
    finiteCoordinate(
      filters.nearMeLat ??
      filters.lat ??
      filters.latitude
    );

  const lon =
    finiteCoordinate(
      filters.nearMeLon ??
      filters.lon ??
      filters.lng ??
      filters.longitude
    );

  if (
    lat === null ||
    lon === null
  ) {
    return false;
  }

  return (
    Math.abs(lat) +
    Math.abs(lon)
  ) > 0.001;
}

export function getGeoPlaceMode(
  filters = {}
) {
  if (
    !hasGeoCoordinates(filters)
  ) {
    return '';
  }

  const type =
    normalizedPlaceType(
      filters.placeType
    );

  if (
    type ===
    PLACE_TYPE_CITY_RADIUS.toLowerCase()
  ) {
    return PLACE_TYPE_CITY_RADIUS;
  }

  if (
    type ===
    PLACE_TYPE_NEAR_ME.toLowerCase()
  ) {
    return PLACE_TYPE_NEAR_ME;
  }

  /*
   * Backwards compatibility:
   * legacy AJSEE URLs used lat/lon without
   * an explicit placeType and always meant Near Me.
   */
  return PLACE_TYPE_NEAR_ME;
}

export function isCityRadiusPlace(
  filters = {}
) {
  return (
    getGeoPlaceMode(filters) ===
    PLACE_TYPE_CITY_RADIUS
  );
}

export function isNearMePlace(
  filters = {}
) {
  return (
    getGeoPlaceMode(filters) ===
    PLACE_TYPE_NEAR_ME
  );
}

export function formatCityRadiusLabel(
  filters = {}
) {
  const label =
    String(
      filters.cityLabel ||
      filters.city ||
      ''
    ).trim();

  if (!label) {
    return '';
  }

  const radius =
    clampPlaceRadius(
      filters.nearMeRadiusKm ??
      filters.radiusKm ??
      filters.radius ??
      50
    );

  return `${label} + ${radius} km`;
}

function comparablePlaceValue(
  value
) {
  return String(
    value ||
    ''
  )
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');
}

export function shouldPreserveCityRadiusInput(
  filters = {},
  rawInput = ''
) {
  if (
    !isCityRadiusPlace(filters)
  ) {
    return false;
  }

  const current =
    comparablePlaceValue(
      filters.cityLabel ||
      filters.city
    );

  const incoming =
    comparablePlaceValue(
      rawInput
    );

  return Boolean(
    current &&
    incoming &&
    current === incoming
  );
}

export function applyGeoRadiusToApiFilters(
  input = {}
) {
  const api = {
    ...input
  };

  const mode =
    getGeoPlaceMode(api);

  if (!mode) {
    if (
      !hasGeoCoordinates(api)
    ) {
      delete api.nearMeLat;
      delete api.nearMeLon;
    }

    return api;
  }

  const lat =
    Number(
      api.nearMeLat ??
      api.lat ??
      api.latitude
    );

  const lon =
    Number(
      api.nearMeLon ??
      api.lon ??
      api.lng ??
      api.longitude
    );

  const radius =
    clampPlaceRadius(
      api.nearMeRadiusKm ??
      api.radiusKm ??
      api.radius ??
      50
    );

  Object.assign(
    api,
    {
      placeType:
        mode,

      /*
       * Geo-radius queries must not also run
       * the exact city filter in eventsApi.
       */
      city:
        '',

      nearMe:
        1,

      nearMeLat:
        lat,

      nearMeLon:
        lon,

      nearMeRadiusKm:
        radius,

      lat,
      lon,
      latitude:
        lat,

      longitude:
        lon,

      latlon:
        `${lat},${lon}`,

      latlong:
        `${lat},${lon}`,

      geoPoint:
        `${lat},${lon}`,

      radiusKm:
        radius,

      radius,

      unit:
        'km'
    }
  );

  if (
    mode ===
    PLACE_TYPE_NEAR_ME
  ) {
    api.cityCountryCode =
      '';
  }

  return api;
}

function clearPlaceParams(
  params
) {
  [
    'city',
    'cityCc',
    'cityCountryCode',
    'country',
    'countryCode',
    'placeType',
    'nearMeLat',
    'nearMeLon',
    'lat',
    'lon',
    'lng',
    'radius'
  ].forEach(
    key =>
      params.delete(key)
  );
}

export function syncPlaceSearchParams(
  params,
  filters = {}
) {
  clearPlaceParams(params);

  const mode =
    getGeoPlaceMode(filters);

  if (
    mode ===
    PLACE_TYPE_CITY_RADIUS
  ) {
    const city =
      String(
        filters.city ||
        filters.cityLabel ||
        ''
      ).trim();

    const cc =
      String(
        filters.cityCountryCode ||
        filters.countryCode ||
        ''
      )
        .trim()
        .toUpperCase();

    if (city) {
      params.set(
        'city',
        city
      );
    }

    if (cc) {
      params.set(
        'cityCc',
        cc
      );
    }

    params.set(
      'placeType',
      PLACE_TYPE_CITY_RADIUS
    );

    params.set(
      'lat',
      String(
        filters.nearMeLat
      )
    );

    params.set(
      'lon',
      String(
        filters.nearMeLon
      )
    );

    params.set(
      'radius',
      String(
        clampPlaceRadius(
          filters.nearMeRadiusKm
        )
      )
    );

    return params;
  }

  if (
    mode ===
    PLACE_TYPE_NEAR_ME
  ) {
    params.set(
      'placeType',
      PLACE_TYPE_NEAR_ME
    );

    params.set(
      'lat',
      String(
        filters.nearMeLat
      )
    );

    params.set(
      'lon',
      String(
        filters.nearMeLon
      )
    );

    params.set(
      'radius',
      String(
        clampPlaceRadius(
          filters.nearMeRadiusKm
        )
      )
    );

    return params;
  }

  if (
    filters.placeType ===
    PLACE_TYPE_COUNTRY
  ) {
    const cc =
      String(
        filters.countryCode ||
        ''
      )
        .trim()
        .toUpperCase();

    if (cc) {
      params.set(
        'country',
        cc
      );
    }

    return params;
  }

  const city =
    String(
      filters.city ||
      ''
    ).trim();

  const cityCc =
    String(
      filters.cityCountryCode ||
      ''
    )
      .trim()
      .toUpperCase();

  if (city) {
    params.set(
      'city',
      city
    );
  }

  if (
    city &&
    cityCc
  ) {
    params.set(
      'cityCc',
      cityCc
    );
  }

  return params;
}

export function readGeoPlaceFromSearchParams(
  params
) {
  const type =
    normalizedPlaceType(
      params.get(
        'placeType'
      )
    );

  const lat =
    finiteCoordinate(
      params.get('lat') ??
      params.get('nearMeLat')
    );

  const lon =
    finiteCoordinate(
      params.get('lon') ??
      params.get('lng') ??
      params.get('nearMeLon')
    );

  const validCoordinates =
    lat !== null &&
    lon !== null &&
    (
      Math.abs(lat) +
      Math.abs(lon)
    ) > 0.001;

  if (
    type ===
    PLACE_TYPE_CITY_RADIUS.toLowerCase()
  ) {
    const city =
      String(
        params.get('city') ||
        ''
      ).trim();

    if (
      !city ||
      !validCoordinates
    ) {
      return null;
    }

    return {
      mode:
        PLACE_TYPE_CITY_RADIUS,

      city,

      cityCc:
        String(
          params.get('cityCc') ||
          ''
        )
          .trim()
          .toUpperCase(),

      lat,
      lon,

      radiusKm:
        clampPlaceRadius(
          params.get('radius')
        )
    };
  }

  if (
    validCoordinates
  ) {
    return {
      mode:
        PLACE_TYPE_NEAR_ME,

      city:
        '',

      cityCc:
        '',

      lat,
      lon,

      radiusKm:
        clampPlaceRadius(
          params.get('radius')
        )
    };
  }

  return null;
}
