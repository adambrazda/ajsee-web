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

function normalizeBehaviorProvider(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  return SUPPORTED_BEHAVIOR_PROVIDERS
    .has(
      normalized
    )
    ? normalized
    : 'unknown';
}

function normalizeBehaviorPlacement(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  return SUPPORTED_BEHAVIOR_PLACEMENTS
    .has(
      normalized
    )
    ? normalized
    : 'event_card';
}

function normalizeResultPosition(
  value
) {
  const numeric =
    Number(value);

  if (
    !Number.isInteger(
      numeric
    ) ||
    numeric < 1 ||
    numeric > 1000
  ) {
    return null;
  }

  return numeric;
}

function normalizeEventRef(
  value
) {
  const normalized =
    String(value || '')
      .trim();

  if (
    !normalized ||
    normalized.length > 512 ||
    /^event-\d+$/i.test(
      normalized
    )
  ) {
    return '';
  }

  return normalized;
}

async function createEventRefHash(
  value,
  cryptoImpl =
    globalThis.crypto
) {
  const normalized =
    normalizeEventRef(
      value
    );

  if (!normalized) {
    return '';
  }

  try {
    const subtle =
      cryptoImpl?.subtle;

    const Encoder =
      globalThis.TextEncoder;

    if (
      typeof subtle?.digest !==
        'function' ||
      typeof Encoder !==
        'function'
    ) {
      return '';
    }

    const bytes =
      new Encoder()
        .encode(
          normalized
        );

    const digest =
      new Uint8Array(
        await subtle.digest(
          'SHA-256',
          bytes
        )
      );

    return (
      'ev_' +
      Array.from(
        digest.slice(
          0,
          16
        ),
        byte =>
          byte
            .toString(16)
            .padStart(2, '0')
      ).join('')
    );
  } catch {
    return '';
  }
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
      snapshot,

      behaviorSignals:
        new Set(),

      feedbackValue:
        ''
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

  async function recordBehavior(
    event,
    {
      eventRef = '',
      provider = '',
      resultPosition = null,
      placement = 'event_card'
    } = {}
  ) {
    if (
      !session ||
      !BEHAVIOR_EVENTS.has(
        event
      )
    ) {
      return null;
    }

    if (
      !hasConsent()
    ) {
      reset();
      return null;
    }

    const normalizedPosition =
      normalizeResultPosition(
        resultPosition
      );

    if (
      normalizedPosition ===
      null
    ) {
      return null;
    }

    const activeSearchId =
      session.searchId;

    const normalizedProvider =
      normalizeBehaviorProvider(
        provider
      );

    const normalizedPlacement =
      normalizeBehaviorPlacement(
        placement
      );

    /*
     * Raw event identity is allowed only inside this
     * ephemeral browser-memory comparison key.
     * It is never serialized or sent to the endpoint.
     */
    const normalizedEventRef =
      normalizeEventRef(
        eventRef
      );

    /*
     * Dedupe must happen synchronously, before SHA-256.
     * Otherwise two near-simultaneous browser events
     * could both enter the async hashing stage.
     */
    const dedupeKey = [
      event,
      normalizedProvider,
      normalizedPosition,
      normalizedPlacement,
      normalizedEventRef
    ].join('|');

    if (
      session.behaviorSignals
        .has(
          dedupeKey
        )
    ) {
      return null;
    }

    session.behaviorSignals
      .add(
        dedupeKey
      );

    /*
     * Reserve the sequence synchronously at interaction
     * time. Network/hash completion order must not change
     * the semantic funnel order.
     */
    session.sequence +=
      1;

    const reservedSequence =
      session.sequence;

    const eventRefHash =
      await createEventRefHash(
        normalizedEventRef,
        cryptoImpl
      );

    /*
     * Hashing is asynchronous. A new AI search or consent
     * change may happen while it is running. Never attach
     * the finished interaction to a stale session.
     */
    if (
      !session ||
      session.searchId !==
        activeSearchId ||
      !hasConsent()
    ) {
      return null;
    }

    const payload = {
      schemaVersion:
        SCHEMA_VERSION,

      event,

      searchId:
        session.searchId,

      sequence:
        reservedSequence,

      locale:
        session.locale,

      page:
        session.page,

      eventRefHash,

      provider:
        normalizedProvider,

      resultPosition:
        normalizedPosition,

      placement:
        normalizedPlacement
    };

    postEvent(
      payload
    );

    return payload;
  }

  function feedback(
    value
  ) {
    if (!session) {
      return null;
    }

    if (
      !hasConsent()
    ) {
      reset();
      return null;
    }

    const normalized =
      String(value || '')
        .trim()
        .toLowerCase();

    if (
      !SUPPORTED_FEEDBACK_VALUES
        .has(
          normalized
        )
    ) {
      return null;
    }

    if (
      session.feedbackValue ===
      normalized
    ) {
      return null;
    }

    session.feedbackValue =
      normalized;

    session.sequence +=
      1;

    const payload = {
      schemaVersion:
        SCHEMA_VERSION,

      event:
        'search_feedback',

      searchId:
        session.searchId,

      sequence:
        session.sequence,

      locale:
        session.locale,

      page:
        session.page,

      feedback:
        normalized
    };

    postEvent(
      payload
    );

    return payload;
  }

  function eventOpened(
    context = {}
  ) {
    return recordBehavior(
      'event_opened',
      context
    );
  }

  function partnerClickout(
    context = {}
  ) {
    return recordBehavior(
      'partner_clickout',
      context
    );
  }

  return {
    begin,
    record,
    feedback,
    eventOpened,
    partnerClickout,
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

export function recordAiSearchEventOpened(
  context = {}
) {
  return defaultTracker.eventOpened(
    context
  );
}

export function recordAiSearchPartnerClickout(
  context = {}
) {
  return defaultTracker.partnerClickout(
    context
  );
}

export function recordAiSearchFeedback(
  value
) {
  return defaultTracker.feedback(
    value
  );
}

export function resetAiSearchLearningSession() {
  defaultTracker.reset();
}
