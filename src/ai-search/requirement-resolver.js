function asFiniteNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizeCoordinates(
  value = {}
) {
  const lat =
    asFiniteNumber(
      value.lat ??
      value.latitude
    );

  const lon =
    asFiniteNumber(
      value.lon ??
      value.lng ??
      value.longitude
    );

  if (
    lat === null ||
    lon === null
  ) {
    return null;
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return {
    lat,
    lon
  };
}

function createResolutionError(
  code,
  message,
  details = {}
) {
  const error =
    new Error(message);

  error.code =
    code;

  error.details =
    details;

  return error;
}

async function resolveCityCoordinates(
  requirement,
  {
    resolveCity
  }
) {
  if (
    typeof resolveCity !==
    'function'
  ) {
    throw createResolutionError(
      'CITY_RESOLVER_UNAVAILABLE',
      'City coordinate resolver is not available.',
      {
        requirement
      }
    );
  }

  const result =
    await resolveCity({
      label:
        requirement.label,

      countryCode:
        requirement.countryCode ||
        ''
    });

  if (!result) {
    throw createResolutionError(
      'CITY_NOT_FOUND',
      'The requested city could not be resolved.',
      {
        requirement
      }
    );
  }

  const coordinates =
    normalizeCoordinates(
      result
    );

  if (!coordinates) {
    throw createResolutionError(
      'CITY_COORDINATES_UNAVAILABLE',
      'The requested city was found but has no usable coordinates.',
      {
        requirement,
        result
      }
    );
  }

  const requestedCountryCode =
    String(
      requirement.countryCode ||
      ''
    )
      .trim()
      .toUpperCase();

  const resolvedCountryCode =
    String(
      result.countryCode ||
      result.country ||
      requestedCountryCode ||
      ''
    )
      .trim()
      .toUpperCase();

  if (
    requestedCountryCode &&
    resolvedCountryCode &&
    requestedCountryCode !==
      resolvedCountryCode
  ) {
    throw createResolutionError(
      'CITY_COUNTRY_MISMATCH',
      'The resolved city belongs to a different country.',
      {
        requirement,
        result
      }
    );
  }

  return {
    type:
      'city_coordinates',

    placeMode:
      'city_radius',

    label:
      String(
        result.city ||
        result.label ||
        result.name ||
        requirement.label ||
        ''
      ).trim(),

    countryCode:
      resolvedCountryCode,

    lat:
      coordinates.lat,

    lon:
      coordinates.lon,

    radiusKm:
      Number(
        requirement.radiusKm ||
        50
      )
  };
}

async function resolveUserGeolocation(
  requirement,
  {
    getGeolocation
  }
) {
  if (
    typeof getGeolocation !==
    'function'
  ) {
    throw createResolutionError(
      'GEOLOCATION_UNAVAILABLE',
      'User geolocation is not available.',
      {
        requirement
      }
    );
  }

  const result =
    await getGeolocation();

  const coordinates =
    normalizeCoordinates(
      result
    );

  if (!coordinates) {
    throw createResolutionError(
      'INVALID_GEOLOCATION',
      'User geolocation did not return usable coordinates.',
      {
        requirement,
        result
      }
    );
  }

  return {
    type:
      'user_geolocation',

    placeMode:
      'near_me',

    lat:
      coordinates.lat,

    lon:
      coordinates.lon,

    radiusKm:
      Number(
        requirement.radiusKm ||
        50
      )
  };
}

export async function resolveIntentRequirements(
  plan,
  {
    resolveCity,
    getGeolocation
  } = {}
) {
  if (
    !plan ||
    typeof plan !== 'object'
  ) {
    throw new TypeError(
      'A mapped AI search plan is required.'
    );
  }

  const requirements =
    Array.isArray(
      plan.requirements
    )
      ? plan.requirements
      : [];

  if (
    plan.needsClarification
  ) {
    return {
      ...plan,

      resolutions:
        [],

      unresolvedRequirements:
        requirements,

      readyForMaterialization:
        false
    };
  }

  const resolutions =
    [];

  const unresolvedRequirements =
    [];

  for (
    const requirement of requirements
  ) {
    try {
      if (
        requirement.type ===
        'resolve_city_coordinates'
      ) {
        resolutions.push(
          await resolveCityCoordinates(
            requirement,
            {
              resolveCity
            }
          )
        );

        continue;
      }

      if (
        requirement.type ===
        'request_geolocation'
      ) {
        resolutions.push(
          await resolveUserGeolocation(
            requirement,
            {
              getGeolocation
            }
          )
        );

        continue;
      }

      unresolvedRequirements.push({
        ...requirement,

        error: {
          code:
            'UNSUPPORTED_REQUIREMENT',

          message:
            `Unsupported requirement: ${requirement.type}`
        }
      });
    } catch (error) {
      unresolvedRequirements.push({
        ...requirement,

        error: {
          code:
            error?.code ||
            'REQUIREMENT_RESOLUTION_FAILED',

          message:
            error?.message ||
            'Requirement resolution failed.'
        }
      });
    }
  }

  return {
    ...plan,

    resolutions,

    unresolvedRequirements,

    readyForMaterialization:
      !plan.needsClarification &&
      unresolvedRequirements.length === 0
  };
}