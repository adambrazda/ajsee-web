import {
  CITY_SUGGEST_SCOPE,
  suggestCities
} from '../city/suggestClient.js';

import {
  canonForInputCity
} from '../city/canonical.js';

function normalizeCountryCode(
  value
) {
  return String(
    value ||
    ''
  )
    .trim()
    .toUpperCase();
}

function foldText(
  value
) {
  return String(
    value ||
    ''
  )
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    );
}

function cityIdentity(
  value
) {
  const raw =
    String(
      value ||
      ''
    ).trim();

  if (!raw) {
    return '';
  }

  let canonical =
    '';

  try {
    canonical =
      canonForInputCity(
        raw
      ) ||
      '';
  } catch {
    canonical =
      '';
  }

  return foldText(
    canonical ||
    raw
  );
}

function isCountrySuggestion(
  item = {}
) {
  const type =
    String(
      item.type ||
      item.kind ||
      ''
    )
      .trim()
      .toLowerCase();

  return (
    type === 'country' ||
    type === 'country-only' ||
    item.isCountry === true
  );
}

function validCoordinates(
  item = {}
) {
  return (
    Number.isFinite(
      Number(item.lat)
    ) &&
    Number.isFinite(
      Number(item.lon)
    )
  );
}

function coordinateKey(
  item = {}
) {
  const lat =
    Number(item.lat);

  const lon =
    Number(item.lon);

  return (
    `${lat.toFixed(5)},` +
    `${lon.toFixed(5)}`
  );
}

function candidateScore(
  item = {},
  requestedLabel = ''
) {
  let score =
    Number(item.score) || 0;

  if (
    cityIdentity(
      item.city ||
      item.label ||
      item.name
    ) ===
    cityIdentity(
      requestedLabel
    )
  ) {
    score +=
      100000;
  }

  if (
    foldText(
      item.city ||
      item.label ||
      item.name
    ) ===
    foldText(
      requestedLabel
    )
  ) {
    score +=
      10000;
  }

  return score;
}

export async function resolveCityFromSuggestions({
  label = '',
  countryCode = '',
  locale = 'cs',
  countryCodes = CITY_SUGGEST_SCOPE,
  suggestFn = suggestCities
} = {}) {
  const requestedLabel =
    String(
      label ||
      ''
    ).trim();

  if (
    requestedLabel.length <
    2
  ) {
    return null;
  }

  const requestedCountryCode =
    normalizeCountryCode(
      countryCode
    );

  const effectiveCountryCodes =
    requestedCountryCode
      ? [
          requestedCountryCode
        ]
      : countryCodes;

  const suggestions =
    await suggestFn({
      locale,
      keyword:
        requestedLabel,

      size:
        25,

      countryCodes:
        effectiveCountryCodes
    });

  if (
    !Array.isArray(
      suggestions
    )
  ) {
    return null;
  }

  const candidates =
    suggestions
      .filter(
        item =>
          item &&
          !isCountrySuggestion(
            item
          )
      )
      .filter(
        item => {
          const cc =
            normalizeCountryCode(
              item.countryCode ||
              item.country
            );

          return (
            !requestedCountryCode ||
            cc ===
              requestedCountryCode
          );
        }
      )
      .filter(
        validCoordinates
      );

  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  const requestedIdentity =
    cityIdentity(
      requestedLabel
    );

  const identityMatches =
    candidates.filter(
      item =>
        cityIdentity(
          item.city ||
          item.label ||
          item.name
        ) ===
        requestedIdentity
    );

  let pool =
    identityMatches.length
      ? identityMatches
      : candidates;

  /*
   * Never guess between multiple different places when
   * the supplied label does not identify one uniquely.
   */
  if (
    pool.length > 1
  ) {
    const coordinateKeys =
      new Set(
        pool.map(
          coordinateKey
        )
      );

    if (
      coordinateKeys.size >
      1
    ) {
      return null;
    }
  }

  /*
   * A non-exact fallback is acceptable only if there is
   * one unambiguous coordinate candidate.
   */
  if (
    identityMatches.length ===
      0 &&
    pool.length !==
      1
  ) {
    return null;
  }

  pool =
    [...pool].sort(
      (a, b) =>
        candidateScore(
          b,
          requestedLabel
        ) -
        candidateScore(
          a,
          requestedLabel
        )
    );

  const selected =
    pool[0];

  if (!selected) {
    return null;
  }

  return {
    city:
      String(
        selected.city ||
        selected.label ||
        selected.name ||
        requestedLabel
      ).trim(),

    label:
      String(
        selected.city ||
        selected.label ||
        selected.name ||
        requestedLabel
      ).trim(),

    countryCode:
      normalizeCountryCode(
        selected.countryCode ||
        selected.country ||
        requestedCountryCode
      ),

    lat:
      Number(
        selected.lat
      ),

    lon:
      Number(
        selected.lon
      ),

    source:
      String(
        selected.source ||
        ''
      )
  };
}

export function createSuggestCitiesResolver({
  locale = 'cs',
  countryCodes = CITY_SUGGEST_SCOPE,
  suggestFn = suggestCities
} = {}) {
  return async ({
    label = '',
    countryCode = ''
  } = {}) =>
    resolveCityFromSuggestions({
      label,
      countryCode,
      locale,
      countryCodes,
      suggestFn
    });
}