import {
  SUPPORTED_AUDIENCES,
  SUPPORTED_CATEGORIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LOCALES,
  SUPPORTED_SORTS
} from './intent-schema.js';

import {
  hasAnalyticsConsent
} from '../utils/consent.js';

const LEARNING_ENDPOINT =
  '/api/ai-search-learning';

const SCHEMA_VERSION =
  1;

const SUPPORTED_PAGE_SET =
  new Set([
    'home',
    'events'
  ]);

const SUPPORTED_LOCALE_SET =
  new Set(
    SUPPORTED_LOCALES
  );

const SUPPORTED_CATEGORY_SET =
  new Set(
    SUPPORTED_CATEGORIES
  );

const SUPPORTED_AUDIENCE_SET =
  new Set(
    SUPPORTED_AUDIENCES
  );

const SUPPORTED_PLACE_TYPE_SET =
  new Set([
    'none',
    'city',
    'country',
    'near_me',
    'city_radius'
  ]);

const SUPPORTED_SORT_SET =
  new Set(
    SUPPORTED_SORTS
  );

const SUPPORTED_COUNTRY_CODE_SET =
  new Set(
    SUPPORTED_COUNTRY_CODES
  );

const CORRECTION_FIELDS =
  Object.freeze([
    'category',
    'audience',
    'sort',
    'place',
    'date',
    'keyword',
    'price'
  ]);

function normalizeEnum(
  value,
  allowed,
  fallback
) {
  const normalized =
    String(value || '')
      .trim();

  return allowed.has(
    normalized
  )
    ? normalized
    : fallback;
}

function normalizeLocale(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

  return SUPPORTED_LOCALE_SET.has(
    normalized
  )
    ? normalized
    : 'cs';
}

function normalizePage(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  return SUPPORTED_PAGE_SET.has(
    normalized
  )
    ? normalized
    : 'events';
}

function normalizePlaceType(
  value
) {
  const raw =
    String(value || '')
      .trim();

  const aliases = {
    nearMe:
      'near_me',

    cityRadius:
      'city_radius'
  };

  const normalized =
    aliases[raw] ||
    raw;

  return SUPPORTED_PLACE_TYPE_SET.has(
    normalized
  )
    ? normalized
    : 'none';
}

function normalizeCountryCode(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toUpperCase();

  return SUPPORTED_COUNTRY_CODE_SET.has(
    normalized
  )
    ? normalized
    : '';
}

function normalizeCurrency(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toUpperCase();

  return /^[A-Z]{3}$/.test(
    normalized
  )
    ? normalized
    : '';
}

function normalizeDate(
  value
) {
  const normalized =
    String(value || '')
      .trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(
    normalized
  )
    ? normalized
    : '';
}

function normalizeLocalText(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLocaleLowerCase();
}

function normalizeNumber(
  value,
  {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    decimals = 2
  } = {}
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return null;
  }

  const bounded =
    Math.max(
      min,
      Math.min(
        max,
        numeric
      )
    );

  const factor =
    10 ** decimals;

  return (
    Math.round(
      bounded * factor
    ) /
    factor
  );
}

function normalizeFilterSnapshot(
  filters = {}
) {
  const category =
    normalizeEnum(
      filters.category,
      SUPPORTED_CATEGORY_SET,
      'all'
    );

  const audience =
    normalizeEnum(
      filters.audience || 'any',
      SUPPORTED_AUDIENCE_SET,
      'any'
    );

  const sort =
    normalizeEnum(
      filters.sort,
      SUPPORTED_SORT_SET,
      'nearest'
    );

  const placeType =
    normalizePlaceType(
      filters.placeType
    );

  return {
    category,
    audience,
    sort,

    placeType,

    /*
     * Exact city and keyword values exist only
     * in this in-memory browser snapshot.
     *
     * They are used to detect whether the user
     * changed a field, but they are never included
     * in the server payload.
     */
    city:
      normalizeLocalText(
        filters.city ||
        filters.cityLabel
      ),

    cityCountryCode:
      normalizeCountryCode(
        filters.cityCountryCode
      ),

    countryCode:
      normalizeCountryCode(
        filters.countryCode
      ),

    dateFrom:
      normalizeDate(
        filters.dateFrom
      ),

    dateTo:
      normalizeDate(
        filters.dateTo
      ),

    keyword:
      normalizeLocalText(
        filters.keyword
      ),

    maxPrice:
      normalizeNumber(
        filters.maxPrice,
        {
          min: 0,
          max: 1_000_000
        }
      ),

    priceCurrency:
      normalizeCurrency(
        filters.priceCurrency
      ),

    nearMeRadiusKm:
      normalizeNumber(
        filters.nearMeRadiusKm,
        {
          min: 0,
          max: 500,
          decimals: 1
        }
      )
  };
}

function safeSummaryFromSnapshot(
  snapshot
) {
  return {
    category:
      snapshot.category,

    audience:
      snapshot.audience,

    sort:
      snapshot.sort,

    placeType:
      snapshot.placeType,

    cityPresent:
      Boolean(
        snapshot.city
      ),

    cityCountryCode:
      snapshot.cityCountryCode,

    countryCode:
      snapshot.countryCode,

    dateFrom:
      snapshot.dateFrom,

    dateTo:
      snapshot.dateTo,

    keywordPresent:
      Boolean(
        snapshot.keyword
      ),

    maxPrice:
      snapshot.maxPrice,

    priceCurrency:
      snapshot.priceCurrency,

    nearMeRadiusKm:
      (
        snapshot.placeType ===
          'near_me' ||
        snapshot.placeType ===
          'city_radius'
      )
        ? snapshot.nearMeRadiusKm
        : null
  };
}

export function buildAiSearchLearningFilterSummary(
  filters = {}
) {
  return safeSummaryFromSnapshot(
    normalizeFilterSnapshot(
      filters
    )
  );
}

function diffSnapshots(
  previous,
  current
) {
  const changed =
    [];

  if (
    previous.category !==
    current.category
  ) {
    changed.push(
      'category'
    );
  }

  if (
    previous.audience !==
    current.audience
  ) {
    changed.push(
      'audience'
    );
  }

  if (
    previous.sort !==
    current.sort
  ) {
    changed.push(
      'sort'
    );
  }

  if (
    previous.placeType !==
      current.placeType ||
    previous.city !==
      current.city ||
    previous.cityCountryCode !==
      current.cityCountryCode ||
    previous.countryCode !==
      current.countryCode ||
    previous.nearMeRadiusKm !==
      current.nearMeRadiusKm
  ) {
    changed.push(
      'place'
    );
  }

  if (
    previous.dateFrom !==
      current.dateFrom ||
    previous.dateTo !==
      current.dateTo
  ) {
    changed.push(
      'date'
    );
  }

  if (
    previous.keyword !==
    current.keyword
  ) {
    changed.push(
      'keyword'
    );
  }

  if (
    previous.maxPrice !==
      current.maxPrice ||
    previous.priceCurrency !==
      current.priceCurrency
  ) {
    changed.push(
      'price'
    );
  }

  return CORRECTION_FIELDS
    .filter(
      field =>
        changed.includes(
          field
        )
    );
}

export function diffAiSearchLearningFilters(
  previousFilters = {},
  currentFilters = {}
) {
  return diffSnapshots(
    normalizeFilterSnapshot(
      previousFilters
    ),
    normalizeFilterSnapshot(
      currentFilters
    )
  );
}

function createSearchId(
  cryptoImpl = globalThis.crypto
) {
  try {
    if (
      typeof cryptoImpl
        ?.randomUUID ===
      'function'
    ) {
      const uuid =
        cryptoImpl
          .randomUUID()
          .replace(
            /-/g,
            ''
          )
          .toLowerCase();

      if (
        /^[a-f0-9]{32}$/.test(
          uuid
        )
      ) {
        return (
          'as_' +
          uuid
        );
      }
    }

    if (
      typeof cryptoImpl
        ?.getRandomValues ===
      'function'
    ) {
      const bytes =
        new Uint8Array(
          16
        );

      cryptoImpl
        .getRandomValues(
          bytes
        );

      return (
        'as_' +
        Array.from(
          bytes,
          value =>
            value
              .toString(16)
              .padStart(2, '0')
        ).join('')
      );
    }
  } catch {
    /* noop */
  }

  let fallback =
    '';

  while (
    fallback.length <
    32
  ) {
    fallback +=
      Math.floor(
        Math.random() *
        0x100000000
      )
        .toString(16)
        .padStart(8, '0');
  }

  return (
    'as_' +
    fallback.slice(
      0,
      32
    )
  );
}

export function createAiSearchLearningTracker({
  fetchImpl =
    globalThis.fetch,

  consentProvider =
    hasAnalyticsConsent,

  cryptoImpl =
    globalThis.crypto,

  endpoint =
    LEARNING_ENDPOINT
} = {}) {
  let session =
    null;

  function hasConsent() {
    try {
      return Boolean(
        consentProvider()
      );
    } catch {
      return false;
    }
  }

  function postEvent(
    payload
  ) {
    if (
      typeof fetchImpl !==
      'function'
    ) {
      return;
    }

    try {
      const request =
        fetchImpl(
          endpoint,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            credentials:
              'same-origin',

            keepalive:
              true,

            body:
              JSON.stringify(
                payload
              )
          }
        );

      Promise
        .resolve(
          request
        )
        .catch(
          () => {}
        );
    } catch {
      /* Learning telemetry must never block search. */
    }
  }

  function reset() {
    session =
      null;
  }

  function begin({
    locale = 'cs',
    page = 'events',
    filters = {}
  } = {}) {
    reset();

    if (
      !hasConsent()
    ) {
      return null;
    }

    const normalizedLocale =
      normalizeLocale(
        locale
      );

    const normalizedPage =
      normalizePage(
        page
      );

    const snapshot =
      normalizeFilterSnapshot(
        filters
      );

    const searchId =
      createSearchId(
        cryptoImpl
      );

    session = {
      searchId,
      locale:
        normalizedLocale,
      page:
        normalizedPage,
      sequence:
        0,
      snapshot
    };

    postEvent({
      schemaVersion:
        SCHEMA_VERSION,

      event:
        'filters_applied',

      searchId,

      sequence:
        0,

      locale:
        normalizedLocale,

      page:
        normalizedPage,

      filters:
        safeSummaryFromSnapshot(
          snapshot
        )
    });

    return searchId;
  }

  function record(
    filters = {}
  ) {
    if (!session) {
      return [];
    }

    if (
      !hasConsent()
    ) {
      reset();
      return [];
    }

    const nextSnapshot =
      normalizeFilterSnapshot(
        filters
      );

    const correctedFields =
      diffSnapshots(
        session.snapshot,
        nextSnapshot
      );

    session.snapshot =
      nextSnapshot;

    if (
      correctedFields.length ===
      0
    ) {
      return [];
    }

    session.sequence +=
      1;

    postEvent({
      schemaVersion:
        SCHEMA_VERSION,

      event:
        'filters_corrected',

      searchId:
        session.searchId,

      sequence:
        session.sequence,

      locale:
        session.locale,

      page:
        session.page,

      correctedFields,

      filters:
        safeSummaryFromSnapshot(
          nextSnapshot
        )
    });

    return correctedFields;
  }

  return {
    begin,
    record,
    reset
  };
}

const defaultTracker =
  createAiSearchLearningTracker();

export function beginAiSearchLearningSession(
  context = {}
) {
  return defaultTracker.begin(
    context
  );
}

export function recordAiSearchFilterState(
  filters = {}
) {
  return defaultTracker.record(
    filters
  );
}

export function resetAiSearchLearningSession() {
  defaultTracker.reset();
}
