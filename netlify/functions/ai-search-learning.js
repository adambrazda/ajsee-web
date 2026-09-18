import {
  getStore
} from '@netlify/blobs';

import {
  SUPPORTED_AUDIENCES,
  SUPPORTED_CATEGORIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LOCALES,
  SUPPORTED_SORTS
} from '../../src/ai-search/intent-schema.js';

const STORE_NAME =
  'ai-search-learning-v1';

const SCHEMA_VERSION =
  1;

const MAX_BODY_BYTES =
  4096;

const SUPPORTED_EVENTS =
  new Set([
    'filters_applied',
    'filters_corrected',
    'event_opened',
    'partner_clickout',
    'search_feedback'
  ]);

const BEHAVIOR_EVENTS =
  new Set([
    'event_opened',
    'partner_clickout'
  ]);

const SUPPORTED_FEEDBACK_VALUES =
  new Set([
    'helpful',
    'not_helpful'
  ]);

const SUPPORTED_BEHAVIOR_PROVIDERS =
  new Set([
    'ticketmaster',
    'smsticket',
    'colosseumticket',
    'unknown'
  ]);

const SUPPORTED_BEHAVIOR_PLACEMENTS =
  new Set([
    'event_card',
    'event_modal'
  ]);

const SUPPORTED_PAGES =
  new Set([
    'home',
    'events'
  ]);

const SUPPORTED_CORRECTION_FIELDS =
  new Set([
    'category',
    'audience',
    'sort',
    'place',
    'date',
    'keyword',
    'price'
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

const TOP_LEVEL_KEYS =
  new Set([
    'schemaVersion',
    'event',
    'searchId',
    'sequence',
    'locale',
    'page',
    'filters',
    'correctedFields',
    'eventRefHash',
    'provider',
    'resultPosition',
    'placement',
    'feedback'
  ]);

const FILTER_KEYS =
  new Set([
    'category',
    'audience',
    'sort',
    'placeType',
    'cityPresent',
    'cityCountryCode',
    'countryCode',
    'dateFrom',
    'dateTo',
    'keywordPresent',
    'maxPrice',
    'priceCurrency',
    'nearMeRadiusKm'
  ]);

const RESPONSE_HEADERS = {
  'Content-Type':
    'application/json; charset=utf-8',

  'Cache-Control':
    'no-store',

  'X-Content-Type-Options':
    'nosniff'
};

function jsonResponse(
  body,
  {
    status = 200,
    headers = {}
  } = {}
) {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,
      headers: {
        ...RESPONSE_HEADERS,
        ...headers
      }
    }
  );
}

function emptyResponse(
  status = 204,
  headers = {}
) {
  return new Response(
    null,
    {
      status,
      headers: {
        ...RESPONSE_HEADERS,
        ...headers
      }
    }
  );
}

function createHttpError(
  status,
  code
) {
  const error =
    new Error(
      code
    );

  error.status =
    status;

  error.code =
    code;

  return error;
}

function isPlainObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value
    )
  );
}

function assertExactKeys(
  value,
  allowed,
  label
) {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw createHttpError(
      400,
      'invalid-' + label
    );
  }

  for (
    const key
    of Object.keys(
      value
    )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw createHttpError(
        400,
        'unexpected-' +
          label +
          '-field'
      );
    }
  }
}

function isSameOriginRequest(
  request
) {
  const origin =
    String(
      request.headers.get(
        'origin'
      ) ||
      ''
    ).trim();

  if (!origin) {
    return true;
  }

  try {
    return (
      new URL(
        origin
      ).origin ===
      new URL(
        request.url
      ).origin
    );
  } catch {
    return false;
  }
}

function resolveStoreName(
  request
) {
  let hostname =
    '';

  try {
    hostname =
      new URL(
        request.url
      ).hostname
        .trim()
        .toLowerCase();
  } catch {
    return STORE_NAME;
  }

  const deployPreview =
    hostname.match(
      /^deploy-preview-(\d+)--/
    );

  if (deployPreview) {
    return (
      STORE_NAME +
      '-preview-' +
      deployPreview[1]
    );
  }

  const agentPreview =
    hostname.match(
      /^agent-([a-z0-9-]+)--/
    );

  if (agentPreview) {
    return (
      STORE_NAME +
      '-agent-' +
      agentPreview[1]
        .slice(
          0,
          48
        )
    );
  }

  return STORE_NAME;
}

function normalizeSearchId(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    !/^as_[a-f0-9]{32}$/.test(
      normalized
    )
  ) {
    throw createHttpError(
      400,
      'invalid-search-id'
    );
  }

  return normalized;
}

function normalizeInteger(
  value,
  {
    min,
    max,
    code
  }
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value < min ||
    value > max
  ) {
    throw createHttpError(
      400,
      code
    );
  }

  return value;
}

function normalizeEnum(
  value,
  allowed,
  code
) {
  const normalized =
    String(value || '')
      .trim();

  if (
    !allowed.has(
      normalized
    )
  ) {
    throw createHttpError(
      400,
      code
    );
  }

  return normalized;
}

function normalizeCountryCode(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!normalized) {
    return '';
  }

  if (
    !SUPPORTED_COUNTRY_CODE_SET
      .has(
        normalized
      )
  ) {
    throw createHttpError(
      400,
      'invalid-country-code'
    );
  }

  return normalized;
}

function normalizeCurrency(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!normalized) {
    return '';
  }

  if (
    !/^[A-Z]{3}$/.test(
      normalized
    )
  ) {
    throw createHttpError(
      400,
      'invalid-currency'
    );
  }

  return normalized;
}

function normalizeDate(
  value
) {
  const normalized =
    String(value || '')
      .trim();

  if (!normalized) {
    return '';
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throw createHttpError(
      400,
      'invalid-date'
    );
  }

  const parsed =
    new Date(
      normalized +
      'T00:00:00.000Z'
    );

  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed
      .toISOString()
      .slice(
        0,
        10
      ) !==
      normalized
  ) {
    throw createHttpError(
      400,
      'invalid-date'
    );
  }

  return normalized;
}

function normalizeNullableNumber(
  value,
  {
    min,
    max,
    code
  }
) {
  if (
    value ===
    null
  ) {
    return null;
  }

  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < min ||
    value > max
  ) {
    throw createHttpError(
      400,
      code
    );
  }

  return value;
}

function normalizeBoolean(
  value,
  code
) {
  if (
    typeof value !==
    'boolean'
  ) {
    throw createHttpError(
      400,
      code
    );
  }

  return value;
}

function normalizeFilters(
  value
) {
  assertExactKeys(
    value,
    FILTER_KEYS,
    'filters'
  );

  for (
    const requiredKey
    of FILTER_KEYS
  ) {
    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          value,
          requiredKey
        )
    ) {
      throw createHttpError(
        400,
        'missing-filter-field'
      );
    }
  }

  return {
    category:
      normalizeEnum(
        value.category,
        SUPPORTED_CATEGORY_SET,
        'invalid-category'
      ),

    audience:
      normalizeEnum(
        value.audience,
        SUPPORTED_AUDIENCE_SET,
        'invalid-audience'
      ),

    sort:
      normalizeEnum(
        value.sort,
        SUPPORTED_SORT_SET,
        'invalid-sort'
      ),

    placeType:
      normalizeEnum(
        value.placeType,
        SUPPORTED_PLACE_TYPE_SET,
        'invalid-place-type'
      ),

    cityPresent:
      normalizeBoolean(
        value.cityPresent,
        'invalid-city-present'
      ),

    cityCountryCode:
      normalizeCountryCode(
        value.cityCountryCode
      ),

    countryCode:
      normalizeCountryCode(
        value.countryCode
      ),

    dateFrom:
      normalizeDate(
        value.dateFrom
      ),

    dateTo:
      normalizeDate(
        value.dateTo
      ),

    keywordPresent:
      normalizeBoolean(
        value.keywordPresent,
        'invalid-keyword-present'
      ),

    maxPrice:
      normalizeNullableNumber(
        value.maxPrice,
        {
          min:
            0,
          max:
            1_000_000,
          code:
            'invalid-max-price'
        }
      ),

    priceCurrency:
      normalizeCurrency(
        value.priceCurrency
      ),

    nearMeRadiusKm:
      normalizeNullableNumber(
        value.nearMeRadiusKm,
        {
          min:
            0,
          max:
            500,
          code:
            'invalid-near-me-radius'
        }
      )
  };
}

function normalizeCorrectedFields(
  value
) {
  if (
    !Array.isArray(
      value
    ) ||
    value.length <
      1 ||
    value.length >
      SUPPORTED_CORRECTION_FIELDS.size
  ) {
    throw createHttpError(
      400,
      'invalid-corrected-fields'
    );
  }

  const normalized =
    [];

  for (
    const field
    of value
  ) {
    const candidate =
      String(field || '')
        .trim();

    if (
      !SUPPORTED_CORRECTION_FIELDS
        .has(
          candidate
        ) ||
      normalized.includes(
        candidate
      )
    ) {
      throw createHttpError(
        400,
        'invalid-corrected-fields'
      );
    }

    normalized.push(
      candidate
    );
  }

  return normalized;
}

async function readJsonBody(
  request
) {
  const contentType =
    String(
      request.headers.get(
        'content-type'
      ) ||
      ''
    )
      .toLowerCase();

  if (
    !contentType.startsWith(
      'application/json'
    )
  ) {
    throw createHttpError(
      415,
      'unsupported-media-type'
    );
  }

  const text =
    await request.text();

  if (
    Buffer.byteLength(
      text,
      'utf8'
    ) >
    MAX_BODY_BYTES
  ) {
    throw createHttpError(
      413,
      'request-body-too-large'
    );
  }

  let value;

  try {
    value =
      JSON.parse(
        text
      );
  } catch {
    throw createHttpError(
      400,
      'invalid-json-body'
    );
  }

  if (
    !isPlainObject(
      value
    )
  ) {
    throw createHttpError(
      400,
      'invalid-json-body'
    );
  }

  return value;
}

function normalizeEventRefHash(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  if (!normalized) {
    return '';
  }

  if (
    !/^ev_[a-f0-9]{32}$/.test(
      normalized
    )
  ) {
    throw createHttpError(
      400,
      'invalid-event-ref-hash'
    );
  }

  return normalized;
}

function hasOwn(
  value,
  key
) {
  return Object.prototype
    .hasOwnProperty
    .call(
      value,
      key
    );
}

function assertNoBehaviorFields(
  value
) {
  for (
    const key
    of [
      'eventRefHash',
      'provider',
      'resultPosition',
      'placement'
    ]
  ) {
    if (
      hasOwn(
        value,
        key
      )
    ) {
      throw createHttpError(
        400,
        'unexpected-behavior-field'
      );
    }
  }
}

function assertNoFeedbackField(
  value
) {
  if (
    hasOwn(
      value,
      'feedback'
    )
  ) {
    throw createHttpError(
      400,
      'unexpected-feedback-field'
    );
  }
}

function normalizePayload(
  value
) {
  assertExactKeys(
    value,
    TOP_LEVEL_KEYS,
    'payload'
  );

  const schemaVersion =
    normalizeInteger(
      value.schemaVersion,
      {
        min:
          SCHEMA_VERSION,
        max:
          SCHEMA_VERSION,
        code:
          'invalid-schema-version'
      }
    );

  const event =
    normalizeEnum(
      value.event,
      SUPPORTED_EVENTS,
      'invalid-event'
    );

  const searchId =
    normalizeSearchId(
      value.searchId
    );

  const sequence =
    normalizeInteger(
      value.sequence,
      {
        min:
          0,
        max:
          1000,
        code:
          'invalid-sequence'
      }
    );

  const locale =
    normalizeEnum(
      value.locale,
      SUPPORTED_LOCALE_SET,
      'invalid-locale'
    );

  const page =
    normalizeEnum(
      value.page,
      SUPPORTED_PAGES,
      'invalid-page'
    );

  if (
    BEHAVIOR_EVENTS.has(
      event
    )
  ) {
    if (
      sequence <
      1
    ) {
      throw createHttpError(
        400,
        'invalid-behavior-sequence'
      );
    }

    if (
      hasOwn(
        value,
        'filters'
      ) ||
      hasOwn(
        value,
        'correctedFields'
      )
    ) {
      throw createHttpError(
        400,
        'unexpected-filter-field'
      );
    }

    assertNoFeedbackField(
      value
    );

    for (
      const key
      of [
        'eventRefHash',
        'provider',
        'resultPosition',
        'placement'
      ]
    ) {
      if (
        !hasOwn(
          value,
          key
        )
      ) {
        throw createHttpError(
          400,
          'missing-behavior-field'
        );
      }
    }

    return {
      schemaVersion,
      event,
      searchId,
      sequence,
      locale,
      page,

      eventRefHash:
        normalizeEventRefHash(
          value.eventRefHash
        ),

      provider:
        normalizeEnum(
          value.provider,
          SUPPORTED_BEHAVIOR_PROVIDERS,
          'invalid-behavior-provider'
        ),

      resultPosition:
        normalizeInteger(
          value.resultPosition,
          {
            min:
              1,
            max:
              1000,
            code:
              'invalid-result-position'
          }
        ),

      placement:
        normalizeEnum(
          value.placement,
          SUPPORTED_BEHAVIOR_PLACEMENTS,
          'invalid-behavior-placement'
        )
    };
  }

  if (
    event ===
    'search_feedback'
  ) {
    if (
      sequence <
      1
    ) {
      throw createHttpError(
        400,
        'invalid-feedback-sequence'
      );
    }

    if (
      hasOwn(
        value,
        'filters'
      ) ||
      hasOwn(
        value,
        'correctedFields'
      )
    ) {
      throw createHttpError(
        400,
        'unexpected-filter-field'
      );
    }

    assertNoBehaviorFields(
      value
    );

    if (
      !hasOwn(
        value,
        'feedback'
      )
    ) {
      throw createHttpError(
        400,
        'missing-feedback-field'
      );
    }

    return {
      schemaVersion,
      event,
      searchId,
      sequence,
      locale,
      page,

      feedback:
        normalizeEnum(
          value.feedback,
          SUPPORTED_FEEDBACK_VALUES,
          'invalid-feedback'
        )
    };
  }

  assertNoBehaviorFields(
    value
  );

  assertNoFeedbackField(
    value
  );

  const filters =
    normalizeFilters(
      value.filters
    );

  if (
    event ===
    'filters_applied'
  ) {
    if (
      sequence !==
      0
    ) {
      throw createHttpError(
        400,
        'invalid-applied-sequence'
      );
    }

    if (
      hasOwn(
        value,
        'correctedFields'
      )
    ) {
      throw createHttpError(
        400,
        'unexpected-corrected-fields'
      );
    }

    return {
      schemaVersion,
      event,
      searchId,
      sequence,
      locale,
      page,
      filters
    };
  }

  if (
    sequence <
    1
  ) {
    throw createHttpError(
      400,
      'invalid-correction-sequence'
    );
  }

  return {
    schemaVersion,
    event,
    searchId,
    sequence,
    locale,
    page,
    filters,

    correctedFields:
      normalizeCorrectedFields(
        value.correctedFields
      )
  };
}

function buildStoreKey(
  payload,
  createdAt
) {
  const date =
    createdAt
      .slice(
        0,
        10
      );

  const sequence =
    String(
      payload.sequence
    )
      .padStart(
        4,
        '0'
      );

  return [
    'sessions',
    date,
    payload.searchId,
    sequence +
      '-' +
      payload.event +
      '.json'
  ].join('/');
}

export function createAiSearchLearningHandler({
  getStoreFn =
    getStore,

  nowProvider =
    () => new Date()
} = {}) {
  return async function aiSearchLearningHandler(
    request
  ) {
    if (
      !isSameOriginRequest(
        request
      )
    ) {
      return jsonResponse(
        {
          error:
            'origin-not-allowed'
        },
        {
          status:
            403
        }
      );
    }

    const method =
      String(
        request.method ||
        'GET'
      )
        .trim()
        .toUpperCase();

    if (
      method ===
      'OPTIONS'
    ) {
      return emptyResponse(
        204,
        {
          Allow:
            'POST, OPTIONS'
        }
      );
    }

    if (
      method !==
      'POST'
    ) {
      return jsonResponse(
        {
          error:
            'method-not-allowed'
        },
        {
          status:
            405,

          headers: {
            Allow:
              'POST, OPTIONS'
          }
        }
      );
    }

    try {
      const rawPayload =
        await readJsonBody(
          request
        );

      const payload =
        normalizePayload(
          rawPayload
        );

      const createdAt =
        nowProvider()
          .toISOString();

      const store =
        getStoreFn({
          name:
            resolveStoreName(
              request
            ),

          consistency:
            'strong'
        });

      const key =
        buildStoreKey(
          payload,
          createdAt
        );

      const record = {
        ...payload,
        createdAt
      };

      const result =
        await store.setJSON(
          key,
          record,
          {
            onlyIfNew:
              true,

            metadata: {
              schemaVersion:
                String(
                  SCHEMA_VERSION
                ),

              event:
                payload.event,

              locale:
                payload.locale,

              page:
                payload.page,

              createdAt
            }
          }
        );

      return jsonResponse(
        {
          accepted:
            true,

          modified:
            Boolean(
              result?.modified
            )
        },
        {
          status:
            202
        }
      );
    } catch (error) {
      const status =
        Number(
          error?.status
        ) ||
        503;

      const code =
        String(
          error?.code ||
          'ai-search-learning-unavailable'
        );

      if (
        status >=
        500
      ) {
        console.error(
          '[ai-search-learning]',
          error
        );
      }

      return jsonResponse(
        {
          error:
            code
        },
        {
          status
        }
      );
    }
  };
}

const handler =
  createAiSearchLearningHandler();

export default handler;

export const config = {
  path:
    '/api/ai-search-learning',

  rateLimit: {
    action:
      'rate_limit',

    windowLimit:
      60,

    windowSize:
      60,

    aggregateBy: [
      'ip',
      'domain'
    ]
  }
};
