function asString(value) {
  return String(
    value ??
    ''
  ).trim();
}

function asFiniteNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function copyFilters(filters = {}) {
  return {
    ...filters
  };
}

function getResolutions(plan) {
  return Array.isArray(
    plan?.resolutions
  )
    ? plan.resolutions
    : [];
}

function getUnresolvedRequirements(plan) {
  return Array.isArray(
    plan?.unresolvedRequirements
  )
    ? plan.unresolvedRequirements
    : [];
}

function findResolution(
  plan,
  placeMode
) {
  return getResolutions(plan)
    .find(
      resolution =>
        resolution?.placeMode ===
        placeMode
    ) ||
    null;
}

function defaultPlaceContext(
  filters
) {
  const placeType =
    asString(
      filters?.placeType
    );

  if (
    placeType === 'country'
  ) {
    return {
      mode:
        'country',

      label:
        asString(
          filters?.cityLabel
        ),

      countryCode:
        asString(
          filters?.countryCode
        ).toUpperCase(),

      lat:
        null,

      lon:
        null,

      radiusKm:
        null
    };
  }

  if (
    placeType === 'city'
  ) {
    return {
      mode:
        'city',

      label:
        asString(
          filters?.cityLabel ||
          filters?.city
        ),

      countryCode:
        asString(
          filters?.cityCountryCode ||
          filters?.countryCode
        ).toUpperCase(),

      lat:
        null,

      lon:
        null,

      radiusKm:
        null
    };
  }

  return {
    mode:
      'none',

    label:
      '',

    countryCode:
      '',

    lat:
      null,

    lon:
      null,

    radiusKm:
      null
  };
}

function buildCityRadiusContext(
  filters,
  resolution
) {
  const lat =
    asFiniteNumber(
      resolution?.lat
    );

  const lon =
    asFiniteNumber(
      resolution?.lon
    );

  const radiusKm =
    asFiniteNumber(
      resolution?.radiusKm
    );

  if (
    lat === null ||
    lon === null ||
    radiusKm === null
  ) {
    throw new TypeError(
      'Resolved city-radius search requires valid coordinates and radius.'
    );
  }

  return {
    mode:
      'city_radius',

    label:
      asString(
        resolution?.label ||
        filters?.cityLabel ||
        filters?.city
      ),

    countryCode:
      asString(
        resolution?.countryCode ||
        filters?.cityCountryCode ||
        filters?.countryCode
      ).toUpperCase(),

    lat,
    lon,
    radiusKm
  };
}

function buildNearMeContext(
  resolution
) {
  const lat =
    asFiniteNumber(
      resolution?.lat
    );

  const lon =
    asFiniteNumber(
      resolution?.lon
    );

  const radiusKm =
    asFiniteNumber(
      resolution?.radiusKm
    );

  if (
    lat === null ||
    lon === null ||
    radiusKm === null
  ) {
    throw new TypeError(
      'Resolved Near Me search requires valid coordinates and radius.'
    );
  }

  return {
    mode:
      'near_me',

    label:
      '',

    countryCode:
      '',

    lat,
    lon,
    radiusKm
  };
}

function buildUrlIntent(
  placeContext
) {
  if (
    placeContext.mode ===
    'city_radius'
  ) {
    return {
      placeType:
        'cityRadius',

      city:
        placeContext.label,

      cityCc:
        placeContext.countryCode,

      lat:
        placeContext.lat,

      lon:
        placeContext.lon,

      radius:
        placeContext.radiusKm
    };
  }

  if (
    placeContext.mode ===
    'near_me'
  ) {
    return {
      placeType:
        'nearMe',

      lat:
        placeContext.lat,

      lon:
        placeContext.lon,

      radius:
        placeContext.radiusKm
    };
  }

  if (
    placeContext.mode ===
    'city'
  ) {
    return {
      placeType:
        'city',

      city:
        placeContext.label,

      cityCc:
        placeContext.countryCode
    };
  }

  if (
    placeContext.mode ===
    'country'
  ) {
    return {
      placeType:
        'country',

      country:
        placeContext.countryCode
    };
  }

  return {
    placeType:
      ''
  };
}

function blockedResult(
  plan,
  reason
) {
  return {
    ok:
      false,

    status:
      'blocked',

    reason,

    filters:
      copyFilters(
        plan?.filters
      ),

    placeContext:
      null,

    urlIntent:
      null,

    unsupportedPreferences:
      Array.isArray(
        plan?.unsupportedPreferences
      )
        ? [
            ...plan
              .unsupportedPreferences
          ]
        : [],

    readyToApply:
      false
  };
}

export function materializeSearchPlan(
  plan
) {
  if (
    !plan ||
    typeof plan !== 'object'
  ) {
    throw new TypeError(
      'A resolved AJSEE AI search plan is required.'
    );
  }

  if (
    plan.needsClarification
  ) {
    return blockedResult(
      plan,
      'clarification_required'
    );
  }

  const unresolved =
    getUnresolvedRequirements(
      plan
    );

  if (
    unresolved.length > 0
  ) {
    return blockedResult(
      plan,
      'requirements_unresolved'
    );
  }

  if (
    plan.readyForMaterialization ===
    false
  ) {
    return blockedResult(
      plan,
      'not_ready_for_materialization'
    );
  }

  const filters =
    copyFilters(
      plan.filters
    );

  let placeContext =
    defaultPlaceContext(
      filters
    );

  const cityRadiusResolution =
    findResolution(
      plan,
      'city_radius'
    );

  const nearMeResolution =
    findResolution(
      plan,
      'near_me'
    );

  if (
    cityRadiusResolution &&
    nearMeResolution
  ) {
    throw new TypeError(
      'A search plan cannot contain both city-radius and Near Me resolutions.'
    );
  }

  if (
    cityRadiusResolution
  ) {
    placeContext =
      buildCityRadiusContext(
        filters,
        cityRadiusResolution
      );

    /*
     * Important:
     * Do NOT map city-radius coordinates to legacy
     * nearMeLat/nearMeLon here.
     *
     * Runtime integration will receive an explicit
     * city_radius place mode so that the UI can keep
     * showing "Praha + 50 km" instead of "Near me".
     */
  }

  if (
    nearMeResolution
  ) {
    placeContext =
      buildNearMeContext(
        nearMeResolution
      );
  }

  return {
    ok:
      true,

    status:
      'ready',

    reason:
      '',

    filters,

    placeContext,

    urlIntent:
      buildUrlIntent(
        placeContext
      ),

    unsupportedPreferences:
      Array.isArray(
        plan.unsupportedPreferences
      )
        ? [
            ...plan
              .unsupportedPreferences
          ]
        : [],

    readyToApply:
      true
  };
}