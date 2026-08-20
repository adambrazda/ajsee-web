function finiteNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function requireGeoContext(
  placeContext
) {
  const lat =
    finiteNumber(
      placeContext?.lat
    );

  const lon =
    finiteNumber(
      placeContext?.lon
    );

  const radiusKm =
    finiteNumber(
      placeContext?.radiusKm
    );

  if (
    lat === null ||
    lon === null ||
    radiusKm === null
  ) {
    throw new TypeError(
      'AI place context requires valid coordinates and radius.'
    );
  }

  return {
    lat,
    lon,
    radiusKm
  };
}

export function materializedPlanToRuntimeFilters(
  materialized,
  {
    nearMeLabel = 'Near me'
  } = {}
) {
  if (
    !materialized ||
    typeof materialized !== 'object' ||
    !materialized.ok ||
    !materialized.readyToApply
  ) {
    throw new TypeError(
      'A ready materialized AI search plan is required.'
    );
  }

  const filters = {
    ...(materialized.filters || {})
  };

  const placeContext =
    materialized.placeContext ||
    {
      mode:
        'none'
    };

  if (
    placeContext.mode ===
    'city_radius'
  ) {
    const geo =
      requireGeoContext(
        placeContext
      );

    const label =
      String(
        placeContext.label ||
        filters.cityLabel ||
        filters.city ||
        ''
      ).trim();

    const countryCode =
      String(
        placeContext.countryCode ||
        filters.cityCountryCode ||
        filters.countryCode ||
        ''
      )
        .trim()
        .toUpperCase();

    return {
      ...filters,

      placeType:
        'cityRadius',

      city:
        label,

      cityLabel:
        label,

      cityCountryCode:
        countryCode,

      countryCode:
        countryCode ||
        filters.countryCode ||
        '',

      nearMeLat:
        geo.lat,

      nearMeLon:
        geo.lon,

      nearMeRadiusKm:
        geo.radiusKm
    };
  }

  if (
    placeContext.mode ===
    'near_me'
  ) {
    const geo =
      requireGeoContext(
        placeContext
      );

    return {
      ...filters,

      placeType:
        'nearMe',

      city:
        '',

      cityLabel:
        String(
          nearMeLabel ||
          'Near me'
        ).trim(),

      cityCountryCode:
        '',

      nearMeLat:
        geo.lat,

      nearMeLon:
        geo.lon,

      nearMeRadiusKm:
        geo.radiusKm
    };
  }

  return filters;
}
