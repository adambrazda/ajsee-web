export const FILTER_INTENT_VERSION = 1;

export const SUPPORTED_LOCALES = Object.freeze([
  'cs',
  'en',
  'de',
  'sk',
  'pl',
  'hu'
]);

export const SUPPORTED_COUNTRY_CODES = Object.freeze([
  'CZ',
  'SK',
  'PL',
  'HU',
  'DE',
  'AT',
  'CH',
  'GB',
  'IE',
  'FR',
  'NL',
  'BE',
  'IT',
  'ES',
  'DK',
  'SE',
  'FI',
  'NO'
]);

export const SUPPORTED_PLACE_TYPES = Object.freeze([
  'none',
  'city',
  'country',
  'near_me'
]);

export const SUPPORTED_DATE_TYPES = Object.freeze([
  'any',
  'preset',
  'range'
]);

export const SUPPORTED_DATE_PRESETS = Object.freeze([
  'today',
  'tomorrow',
  'thisWeek',
  'weekend'
]);

export const SUPPORTED_CATEGORIES = Object.freeze([
  'all',
  'concert',
  'festival',
  'theatre',
  'sport',
  'film'
]);

export const SUPPORTED_AUDIENCES = Object.freeze([
  'any',
  'family'
]);

export const SUPPORTED_SORTS = Object.freeze([
  'nearest',
  'latest'
]);

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.72;

const SUPPORTED_LOCALE_SET =
  new Set(SUPPORTED_LOCALES);

const SUPPORTED_COUNTRY_CODE_SET =
  new Set(SUPPORTED_COUNTRY_CODES);

const SUPPORTED_PLACE_TYPE_SET =
  new Set(SUPPORTED_PLACE_TYPES);

const SUPPORTED_DATE_TYPE_SET =
  new Set(SUPPORTED_DATE_TYPES);

const SUPPORTED_DATE_PRESET_SET =
  new Set(SUPPORTED_DATE_PRESETS);

const SUPPORTED_CATEGORY_SET =
  new Set(SUPPORTED_CATEGORIES);

const SUPPORTED_AUDIENCE_SET =
  new Set(SUPPORTED_AUDIENCES);

const SUPPORTED_SORT_SET =
  new Set(SUPPORTED_SORTS);

function asString(value, fallback = '') {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value).trim();
}

function asNullableNumber(value) {
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

function normalizeCountryCode(value) {
  return asString(value)
    .toUpperCase();
}

function normalizeConfidenceValue(
  value,
  fallback = null
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function isValidIsoDate(value) {
  const raw =
    asString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return false;
  }

  const [
    year,
    month,
    day
  ] = raw
    .split('-')
    .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function createEmptyFilterIntent(
  locale = 'cs'
) {
  const normalizedLocale =
    asString(locale, 'cs')
      .toLowerCase();

  return {
    version:
      FILTER_INTENT_VERSION,

    intent:
      'find_events',

    locale:
      SUPPORTED_LOCALE_SET.has(
        normalizedLocale
      )
        ? normalizedLocale
        : 'cs',

    place: {
      type:
        'none',

      label:
        '',

      countryCode:
        '',

      nearby:
        false,

      radiusKm:
        null
    },

    date: {
      type:
        'any',

      preset:
        '',

      from:
        '',

      to:
        ''
    },

    category:
      'all',

    audience:
      'any',

    keyword:
      '',

    sort:
      'nearest',

    unsupportedPreferences:
      [],

    confidence: {
      overall:
        1
    },

    clarification: {
      required:
        false,

      question:
        '',

      fields:
        []
    }
  };
}

export function normalizeFilterIntent(
  raw = {}
) {
  const source =
    raw &&
    typeof raw === 'object'
      ? raw
      : {};

  const placeSource =
    source.place &&
    typeof source.place === 'object'
      ? source.place
      : {};

  const dateSource =
    source.date &&
    typeof source.date === 'object'
      ? source.date
      : {};

  const confidenceSource =
    source.confidence &&
    typeof source.confidence === 'object'
      ? source.confidence
      : {};

  const clarificationSource =
    source.clarification &&
    typeof source.clarification === 'object'
      ? source.clarification
      : {};

  const unsupportedPreferences =
    Array.isArray(
      source.unsupportedPreferences
    )
      ? source.unsupportedPreferences
          .filter(
            item =>
              item &&
              typeof item === 'object'
          )
          .map(item => ({
            type:
              asString(item.type),

            value:
              item.value ??
              null,

            currency:
              asString(
                item.currency
              ).toUpperCase(),

            unit:
              asString(
                item.unit
              )
          }))
      : [];

  const confidence = {
    overall:
      normalizeConfidenceValue(
        confidenceSource.overall,
        1
      )
  };

  for (
    const key of [
      'place',
      'date',
      'category',
      'audience',
      'keyword'
    ]
  ) {
    const value =
      normalizeConfidenceValue(
        confidenceSource[key],
        null
      );

    if (value !== null) {
      confidence[key] =
        value;
    }
  }

  return {
    version:
      Number(
        source.version ??
        FILTER_INTENT_VERSION
      ),

    intent:
      asString(
        source.intent,
        'find_events'
      ),

    locale:
      asString(
        source.locale,
        'cs'
      ).toLowerCase(),

    place: {
      type:
        asString(
          placeSource.type,
          'none'
        ),

      label:
        asString(
          placeSource.label
        ),

      countryCode:
        normalizeCountryCode(
          placeSource.countryCode
        ),

      nearby:
        Boolean(
          placeSource.nearby
        ),

      radiusKm:
        asNullableNumber(
          placeSource.radiusKm
        )
    },

    date: {
      type:
        asString(
          dateSource.type,
          'any'
        ),

      preset:
        asString(
          dateSource.preset
        ),

      from:
        asString(
          dateSource.from
        ),

      to:
        asString(
          dateSource.to
        )
    },

    category:
      asString(
        source.category,
        'all'
      ),

    audience:
      asString(
        source.audience,
        'any'
      ),

    keyword:
      asString(
        source.keyword
      ),

    sort:
      asString(
        source.sort,
        'nearest'
      ),

    unsupportedPreferences,

    confidence,

    clarification: {
      required:
        Boolean(
          clarificationSource.required
        ),

      question:
        asString(
          clarificationSource.question
        ),

      fields:
        Array.isArray(
          clarificationSource.fields
        )
          ? clarificationSource.fields
              .map(value =>
                asString(value)
              )
              .filter(Boolean)
          : []
    }
  };
}

export function shouldClarifyIntent(
  intent,
  threshold =
    DEFAULT_CONFIDENCE_THRESHOLD
) {
  if (
    intent?.clarification?.required
  ) {
    return true;
  }

  const scores = [];

  if (
    Number.isFinite(
      intent?.confidence?.overall
    )
  ) {
    scores.push(
      intent.confidence.overall
    );
  }

  if (
    intent?.place?.type &&
    intent.place.type !== 'none' &&
    Number.isFinite(
      intent?.confidence?.place
    )
  ) {
    scores.push(
      intent.confidence.place
    );
  }

  if (
    intent?.date?.type &&
    intent.date.type !== 'any' &&
    Number.isFinite(
      intent?.confidence?.date
    )
  ) {
    scores.push(
      intent.confidence.date
    );
  }

  if (
    intent?.category &&
    intent.category !== 'all' &&
    Number.isFinite(
      intent?.confidence?.category
    )
  ) {
    scores.push(
      intent.confidence.category
    );
  }

  if (
    intent?.audience &&
    intent.audience !== 'any' &&
    Number.isFinite(
      intent?.confidence?.audience
    )
  ) {
    scores.push(
      intent.confidence.audience
    );
  }

  if (
    intent?.keyword &&
    Number.isFinite(
      intent?.confidence?.keyword
    )
  ) {
    scores.push(
      intent.confidence.keyword
    );
  }

  return scores.some(
    score =>
      score < threshold
  );
}

export function validateFilterIntent(
  raw,
  {
    confidenceThreshold =
      DEFAULT_CONFIDENCE_THRESHOLD
  } = {}
) {
  const intent =
    normalizeFilterIntent(raw);

  const errors =
    [];

  const addError = (
    path,
    code,
    message
  ) => {
    errors.push({
      path,
      code,
      message
    });
  };

  if (
    intent.version !==
    FILTER_INTENT_VERSION
  ) {
    addError(
      'version',
      'unsupported_version',
      `Expected FilterIntent version ${FILTER_INTENT_VERSION}.`
    );
  }

  if (
    intent.intent !==
    'find_events'
  ) {
    addError(
      'intent',
      'unsupported_intent',
      'Only find_events is supported in FilterIntent v1.'
    );
  }

  if (
    !SUPPORTED_LOCALE_SET.has(
      intent.locale
    )
  ) {
    addError(
      'locale',
      'unsupported_locale',
      `Unsupported locale: ${intent.locale}`
    );
  }

  if (
    !SUPPORTED_PLACE_TYPE_SET.has(
      intent.place.type
    )
  ) {
    addError(
      'place.type',
      'unsupported_place_type',
      `Unsupported place type: ${intent.place.type}`
    );
  }

  if (
    intent.place.type === 'city' &&
    !intent.place.label
  ) {
    addError(
      'place.label',
      'city_label_required',
      'A city intent requires a city label.'
    );
  }

  if (
    intent.place.type === 'country' &&
    !intent.place.countryCode
  ) {
    addError(
      'place.countryCode',
      'country_code_required',
      'A country intent requires a country code.'
    );
  }

  if (
    intent.place.countryCode &&
    !SUPPORTED_COUNTRY_CODE_SET.has(
      intent.place.countryCode
    )
  ) {
    addError(
      'place.countryCode',
      'unsupported_country',
      `Unsupported country code: ${intent.place.countryCode}`
    );
  }

  if (
    intent.place.nearby &&
    intent.place.type !== 'city'
  ) {
    addError(
      'place.nearby',
      'nearby_requires_city',
      'The nearby flag is supported only for a city place.'
    );
  }

  if (
    intent.place.radiusKm !== null &&
    (
      intent.place.radiusKm < 10 ||
      intent.place.radiusKm > 300
    )
  ) {
    addError(
      'place.radiusKm',
      'invalid_radius',
      'Radius must be between 10 and 300 km.'
    );
  }

  if (
    !SUPPORTED_DATE_TYPE_SET.has(
      intent.date.type
    )
  ) {
    addError(
      'date.type',
      'unsupported_date_type',
      `Unsupported date type: ${intent.date.type}`
    );
  }

  if (
    intent.date.type === 'preset' &&
    !SUPPORTED_DATE_PRESET_SET.has(
      intent.date.preset
    )
  ) {
    addError(
      'date.preset',
      'unsupported_date_preset',
      `Unsupported date preset: ${intent.date.preset}`
    );
  }

  if (
    intent.date.type === 'range'
  ) {
    if (
      !intent.date.from &&
      !intent.date.to
    ) {
      addError(
        'date',
        'range_required',
        'A date range requires from and/or to.'
      );
    }

    if (
      intent.date.from &&
      !isValidIsoDate(
        intent.date.from
      )
    ) {
      addError(
        'date.from',
        'invalid_iso_date',
        `Invalid ISO date: ${intent.date.from}`
      );
    }

    if (
      intent.date.to &&
      !isValidIsoDate(
        intent.date.to
      )
    ) {
      addError(
        'date.to',
        'invalid_iso_date',
        `Invalid ISO date: ${intent.date.to}`
      );
    }

    if (
      intent.date.from &&
      intent.date.to &&
      isValidIsoDate(
        intent.date.from
      ) &&
      isValidIsoDate(
        intent.date.to
      ) &&
      intent.date.from >
        intent.date.to
    ) {
      addError(
        'date',
        'reversed_date_range',
        'Date from cannot be after date to.'
      );
    }
  }

  if (
    !SUPPORTED_CATEGORY_SET.has(
      intent.category
    )
  ) {
    addError(
      'category',
      'unsupported_category',
      `Unsupported category: ${intent.category}`
    );
  }

  if (
    !SUPPORTED_AUDIENCE_SET.has(
      intent.audience
    )
  ) {
    addError(
      'audience',
      'unsupported_audience',
      `Unsupported audience: ${intent.audience}`
    );
  }

  if (
    !SUPPORTED_SORT_SET.has(
      intent.sort
    )
  ) {
    addError(
      'sort',
      'unsupported_sort',
      `Unsupported sort: ${intent.sort}`
    );
  }

  if (
    intent.keyword.length >
    160
  ) {
    addError(
      'keyword',
      'keyword_too_long',
      'Keyword must be at most 160 characters.'
    );
  }

  for (
    const [
      key,
      value
    ] of Object.entries(
      intent.confidence
    )
  ) {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      addError(
        `confidence.${key}`,
        'invalid_confidence',
        'Confidence values must be between 0 and 1.'
      );
    }
  }

  if (
    intent.clarification.required &&
    !intent.clarification.question
  ) {
    addError(
      'clarification.question',
      'clarification_question_required',
      'A required clarification needs a user-facing question.'
    );
  }

  for (
    let index = 0;
    index <
    intent.unsupportedPreferences.length;
    index++
  ) {
    if (
      !intent
        .unsupportedPreferences[index]
        .type
    ) {
      addError(
        `unsupportedPreferences.${index}.type`,
        'unsupported_preference_type_required',
        'Unsupported preferences require a type.'
      );
    }
  }

  return {
    ok:
      errors.length === 0,

    errors,

    intent,

    needsClarification:
      errors.length === 0 &&
      shouldClarifyIntent(
        intent,
        confidenceThreshold
      )
  };
}