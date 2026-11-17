import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  validateFilterIntent
} from './intent-schema.js';

import {
  getDatePresetRange
} from '../events-filter-ux.js';

import {
  normalizePriceFilterState
} from '../event-price.js';

const DEFAULT_COUNTRY_BY_LOCALE =
  Object.freeze({
    cs: 'CZ',
    en: 'CZ',
    de: 'DE',
    sk: 'SK',
    pl: 'PL',
    hu: 'HU'
  });

export function createDefaultEventFilters(
  locale = 'cs'
) {
  const normalizedLocale =
    String(
      locale ||
      'cs'
    )
      .trim()
      .toLowerCase()
      .slice(0, 2);

  return {
    category:
      'all',

    audience:
      '',

    sort:
      'nearest',

    placeType:
      '',

    city:
      '',

    cityLabel:
      '',

    cityCountryCode:
      '',

    dateFrom:
      '',

    dateTo:
      '',

    keyword:
      '',

    maxPrice:
      null,

    priceCurrency:
      '',

    countryCode:
      DEFAULT_COUNTRY_BY_LOCALE[
        normalizedLocale
      ] ||
      'CZ',

    nearMeLat:
      null,

    nearMeLon:
      null,

    nearMeRadiusKm:
      50
  };
}

function createInvalidIntentError(
  errors
) {
  const error =
    new TypeError(
      'Invalid AJSEE FilterIntent v1.'
    );

  error.code =
    'INVALID_FILTER_INTENT';

  error.validationErrors =
    errors;

  return error;
}

export function mapIntentToFilters(
  rawIntent,
  {
    now =
      new Date(),

    confidenceThreshold =
      DEFAULT_CONFIDENCE_THRESHOLD
  } = {}
) {
  const validation =
    validateFilterIntent(
      rawIntent,
      {
        confidenceThreshold
      }
    );

  if (!validation.ok) {
    throw createInvalidIntentError(
      validation.errors
    );
  }

  const {
    intent,
    needsClarification
  } = validation;

  const filters =
    createDefaultEventFilters(
      intent.locale
    );

  const requirements =
    [];

  filters.category =
    intent.category === 'all'
      ? 'all'
      : intent.category;

  filters.audience =
    intent.audience === 'family'
      ? 'family'
      : '';

  filters.searchMode = intent.searchMode;
  filters.keywordMatch = intent.keywordMatch;

  filters.sort =
    intent.sort;

  filters.keyword =
    String(
      intent.keyword ||
      ''
    ).trim();

  const unsupportedPreferences =
    [];

  for (
    const preference of
    intent.unsupportedPreferences
  ) {
    if (
      preference.type !==
        'max_price' ||
      filters.maxPrice !==
        null
    ) {
      unsupportedPreferences.push(
        preference
      );

      continue;
    }

    const normalizedPrice =
      normalizePriceFilterState({
        maxPrice:
          preference.value,

        priceCurrency:
          preference.currency
      });

    if (
      normalizedPrice.maxPrice ===
        null ||
      !normalizedPrice.priceCurrency
    ) {
      unsupportedPreferences.push(
        preference
      );

      continue;
    }

    filters.maxPrice =
      normalizedPrice.maxPrice;

    filters.priceCurrency =
      normalizedPrice.priceCurrency;
  }

  if (
    intent.place.type === 'country'
  ) {
    filters.placeType =
      'country';

    filters.countryCode =
      intent.place.countryCode;

    filters.city =
      '';

    filters.cityLabel =
      intent.place.label ||
      '';

    filters.cityCountryCode =
      '';
  }

  if (
    intent.place.type === 'city'
  ) {
    filters.placeType =
      'city';

    filters.city =
      intent.place.label;

    filters.cityLabel =
      intent.place.label;

    filters.cityCountryCode =
      intent.place.countryCode ||
      '';

    if (
      intent.place.countryCode
    ) {
      filters.countryCode =
        intent.place.countryCode;
    }

    if (
      intent.place.nearby
    ) {
      filters.nearMeRadiusKm =
        intent.place.radiusKm ??
        50;

      requirements.push({
        type:
          'resolve_city_coordinates',

        label:
          intent.place.label,

        countryCode:
          intent.place.countryCode ||
          '',

        radiusKm:
          filters.nearMeRadiusKm
      });
    }
  }

  if (
    intent.place.type === 'near_me'
  ) {
    filters.placeType =
      'nearMe';

    filters.city =
      '';

    filters.cityLabel =
      '';

    filters.cityCountryCode =
      '';

    filters.nearMeRadiusKm =
      intent.place.radiusKm ??
      50;

    requirements.push({
      type:
        'request_geolocation',

      radiusKm:
        filters.nearMeRadiusKm
    });
  }

  if (
    intent.date.type === 'preset'
  ) {
    const range =
      getDatePresetRange(
        intent.date.preset,
        now
      );

    filters.dateFrom =
      range.from;

    filters.dateTo =
      range.to;
  }

  if (
    intent.date.type === 'range'
  ) {
    filters.dateFrom =
      intent.date.from ||
      '';

    filters.dateTo =
      intent.date.to ||
      '';
  }

  return {
    version:
      1,

    intent,

    filters,

    requirements,

    unsupportedPreferences,

    needsClarification,

    readyToApply:
      !needsClarification &&
      requirements.length === 0
  };
}

export function selectCatalogueRefinementFilters({ intent, filters }) {
  const { confidence, clarification } = intent;
  const unresolved = new Set(clarification.required ? clarification.fields.map(field => field.split('.')[0]) : []);
  const confirmed = dimension =>
    !unresolved.has(dimension) &&
    (confidence[dimension] ?? confidence.overall) >= DEFAULT_CONFIDENCE_THRESHOLD;

  const selected = {};
  if (confirmed('category') && filters.category !== 'all') selected.category = filters.category;
  if (confirmed('audience') && filters.audience) selected.audience = filters.audience;
  if (confirmed('date') && (filters.dateFrom || filters.dateTo)) {
    Object.assign(selected, { dateFrom: filters.dateFrom, dateTo: filters.dateTo });
  }
  const priceUnresolved = ['unsupportedPreferences', 'price', 'max_price', 'priceCurrency', 'currency']
    .some(field => unresolved.has(field));
  if (!priceUnresolved && confidence.overall >= DEFAULT_CONFIDENCE_THRESHOLD && filters.maxPrice !== null && filters.priceCurrency) {
    Object.assign(selected, { maxPrice: filters.maxPrice, priceCurrency: filters.priceCurrency });
  }
  if (confirmed('place') && ['city', 'country'].includes(filters.placeType)) {
    const { placeType, city, cityLabel, cityCountryCode, countryCode } = filters;
    Object.assign(selected, { placeType, city, cityLabel, cityCountryCode, countryCode });
  }
  return selected;
}
