const ECB_DAILY_RATES_URL =
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

const SUPPORTED_CURRENCIES =
  Object.freeze([
    'EUR',
    'CZK',
    'GBP',
    'USD',
    'PLN',
    'HUF'
  ]);

const FRESH_TTL_MS =
  6 * 60 * 60 * 1000;

const STALE_TTL_MS =
  7 * 24 * 60 * 60 * 1000;

const RESPONSE_HEADERS = {
  'Content-Type':
    'application/json; charset=utf-8',

  'Cache-Control':
    'public, max-age=900, stale-while-revalidate=86400',

  'X-Content-Type-Options':
    'nosniff',

  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Methods':
    'GET, OPTIONS',

  'Access-Control-Allow-Headers':
    'Accept'
};

function jsonResponse(
  body,
  {
    status = 200,
    headers = {}
  } = {}
) {
  return new Response(
    JSON.stringify(body),
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

export function parseEcbDailyRates(
  xml = ''
) {
  const source =
    String(
      xml ||
      ''
    );

  const dateMatch =
    source.match(
      /\btime=['"](\d{4}-\d{2}-\d{2})['"]/
    );

  if (!dateMatch) {
    throw new Error(
      'ecb-rate-date-missing'
    );
  }

  const rates = {
    EUR:
      1
  };

  const ratePattern =
    /<Cube\b[^>]*\bcurrency=['"]([A-Z]{3})['"][^>]*\brate=['"]([0-9]+(?:\.[0-9]+)?)['"][^>]*\/?>/g;

  let match;

  while (
    (
      match =
        ratePattern.exec(
          source
        )
    ) !== null
  ) {
    const currency =
      String(
        match[1] ||
        ''
      )
        .trim()
        .toUpperCase();

    if (
      !SUPPORTED_CURRENCIES.includes(
        currency
      )
    ) {
      continue;
    }

    const rate =
      Number(
        match[2]
      );

    if (
      Number.isFinite(
        rate
      ) &&
      rate > 0
    ) {
      rates[currency] =
        rate;
    }
  }

  for (
    const currency
    of SUPPORTED_CURRENCIES
  ) {
    const rate =
      Number(
        rates[currency]
      );

    if (
      !Number.isFinite(
        rate
      ) ||
      rate <= 0
    ) {
      throw new Error(
        `ecb-rate-missing-${currency.toLowerCase()}`
      );
    }
  }

  return {
    base:
      'EUR',

    date:
      dateMatch[1],

    rates
  };
}

export function createFxRatesHandler({
  fetchImpl =
    globalThis.fetch,

  nowFn =
    () => Date.now()
} = {}) {
  let cache =
    null;

  async function fetchFreshRates() {
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
        ECB_DAILY_RATES_URL,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/xml, text/xml;q=0.9, */*;q=0.1'
          }
        }
      );

    if (
      !response ||
      !response.ok
    ) {
      throw new Error(
        `ecb-upstream-${response?.status || 0}`
      );
    }

    const xml =
      await response.text();

    const parsed =
      parseEcbDailyRates(
        xml
      );

    const now =
      Number(
        nowFn()
      );

    cache = {
      fetchedAt:
        Number.isFinite(now)
          ? now
          : Date.now(),

      snapshot:
        parsed
    };

    return {
      ...parsed,

      stale:
        false
    };
  }

  return async function fxRatesHandler(
    request
  ) {
    const method =
      String(
        request?.method ||
        'GET'
      ).toUpperCase();

    if (
      method ===
      'OPTIONS'
    ) {
      return emptyResponse(
        204,
        {
          Allow:
            'GET, OPTIONS'
        }
      );
    }

    if (
      method !==
      'GET'
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            'method-not-allowed'
        },
        {
          status:
            405,

          headers: {
            Allow:
              'GET, OPTIONS'
          }
        }
      );
    }

    const now =
      Number(
        nowFn()
      );

    const effectiveNow =
      Number.isFinite(now)
        ? now
        : Date.now();

    if (
      cache &&
      (
        effectiveNow -
        cache.fetchedAt
      ) < FRESH_TTL_MS
    ) {
      return jsonResponse({
        ok:
          true,

        ...cache.snapshot,

        source:
          'ECB',

        stale:
          false
      });
    }

    try {
      const snapshot =
        await fetchFreshRates();

      return jsonResponse({
        ok:
          true,

        ...snapshot,

        source:
          'ECB'
      });
    } catch (error) {
      if (
        cache &&
        (
          effectiveNow -
          cache.fetchedAt
        ) < STALE_TTL_MS
      ) {
        return jsonResponse(
          {
            ok:
              true,

            ...cache.snapshot,

            source:
              'ECB',

            stale:
              true
          },
          {
            headers: {
              'X-AJSEE-FX-Stale':
                '1'
            }
          }
        );
      }

      return jsonResponse(
        {
          ok:
            false,

          code:
            'fx-rates-unavailable'
        },
        {
          status:
            503,

          headers: {
            'Cache-Control':
              'no-store'
          }
        }
      );
    }
  };
}

const handler =
  createFxRatesHandler();

export default handler;

export const config = {
  path:
    '/api/fx-rates'
};