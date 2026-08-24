import {
  hasActivePriceFilter
} from './event-price.js';

const REQUIRED_CURRENCIES =
  Object.freeze([
    'EUR',
    'CZK',
    'GBP',
    'USD',
    'PLN',
    'HUF'
  ]);

const DEFAULT_ENDPOINT =
  '/api/fx-rates';

const DEFAULT_CACHE_TTL_MS =
  30 * 60 * 1000;

export function normalizeEventPriceRateSnapshot(
  payload = {}
) {
  if (
    payload?.ok !==
      true ||
    String(
      payload?.base ||
      ''
    ).toUpperCase() !==
      'EUR'
  ) {
    throw new Error(
      'invalid-fx-rate-payload'
    );
  }

  const rates =
    {};

  for (
    const currency
    of REQUIRED_CURRENCIES
  ) {
    const rate =
      Number(
        payload?.rates?.[
          currency
        ]
      );

    if (
      !Number.isFinite(
        rate
      ) ||
      rate <= 0
    ) {
      throw new Error(
        `invalid-fx-rate-${currency.toLowerCase()}`
      );
    }

    rates[currency] =
      rate;
  }

  return {
    base:
      'EUR',

    date:
      String(
        payload?.date ||
        ''
      ),

    rates,

    source:
      String(
        payload?.source ||
        'ECB'
      ),

    stale:
      payload?.stale ===
        true
  };
}

export function createEventPriceRatesClient({
  fetchImpl =
    globalThis.fetch,

  endpoint =
    DEFAULT_ENDPOINT,

  cacheTtlMs =
    DEFAULT_CACHE_TTL_MS,

  nowFn =
    () => Date.now()
} = {}) {
  let cachedSnapshot =
    null;

  let cachedAt =
    0;

  let inflight =
    null;

  async function loadFresh() {
    if (
      typeof fetchImpl !==
      'function'
    ) {
      throw new Error(
        'fx-fetch-unavailable'
      );
    }

    const response =
      await fetchImpl(
        endpoint,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/json'
          },

          cache:
            'default'
        }
      );

    if (
      !response ||
      !response.ok
    ) {
      throw new Error(
        `fx-rates-http-${response?.status || 0}`
      );
    }

    const payload =
      await response.json();

    const snapshot =
      normalizeEventPriceRateSnapshot(
        payload
      );

    const now =
      Number(
        nowFn()
      );

    cachedSnapshot =
      snapshot;

    cachedAt =
      Number.isFinite(now)
        ? now
        : Date.now();

    return snapshot;
  }

  async function getSnapshot({
    force =
      false
  } = {}) {
    const now =
      Number(
        nowFn()
      );

    const effectiveNow =
      Number.isFinite(now)
        ? now
        : Date.now();

    if (
      !force &&
      cachedSnapshot &&
      (
        effectiveNow -
        cachedAt
      ) < cacheTtlMs
    ) {
      return cachedSnapshot;
    }

    if (
      !force &&
      inflight
    ) {
      return inflight;
    }

    inflight =
      loadFresh();

    try {
      return await inflight;
    } finally {
      inflight =
        null;
    }
  }

  function clear() {
    cachedSnapshot =
      null;

    cachedAt =
      0;

    inflight =
      null;
  }

  return {
    getSnapshot,
    clear
  };
}

const defaultClient =
  createEventPriceRatesClient();

export async function getEventPriceRateSnapshot(
  options = {}
) {
  return defaultClient.getSnapshot(
    options
  );
}

export async function getEventPriceRates(
  options = {}
) {
  const snapshot =
    await getEventPriceRateSnapshot(
      options
    );

  return snapshot.rates;
}

export async function getRatesForPriceFilter(
  filters = {},
  options = {}
) {
  if (
    !hasActivePriceFilter(
      filters
    )
  ) {
    return null;
  }

  return getEventPriceRates(
    options
  );
}