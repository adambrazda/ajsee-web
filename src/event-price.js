const SUPPORTED_PRICE_CURRENCIES =
  new Set([
    'CZK',
    'EUR',
    'GBP',
    'USD',
    'PLN',
    'HUF'
  ]);

const CURRENCY_ALIASES =
  new Map([
    ['KČ', 'CZK'],
    ['KC', 'CZK'],
    ['CZK', 'CZK'],
    ['€', 'EUR'],
    ['EUR', 'EUR'],
    ['£', 'GBP'],
    ['GBP', 'GBP'],
    ['$', 'USD'],
    ['USD', 'USD'],
    ['PLN', 'PLN'],
    ['ZŁ', 'PLN'],
    ['ZL', 'PLN'],
    ['HUF', 'HUF'],
    ['FT', 'HUF']
  ]);

function finiteNonNegativeNumber(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(number) &&
    number >= 0
      ? number
      : null;
}

export function normalizePriceCurrency(
  value
) {
  const raw =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!raw) {
    return '';
  }

  const alias =
    CURRENCY_ALIASES.get(raw) ||
    raw;

  return SUPPORTED_PRICE_CURRENCIES.has(
    alias
  )
    ? alias
    : '';
}

function currencyFromPriceText(
  value
) {
  const text =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!text) {
    return '';
  }

  const checks = [
    ['CZK', /\bCZK\b|KČ|KC/],
    ['EUR', /\bEUR\b|€/],
    ['GBP', /\bGBP\b|£/],
    ['USD', /\bUSD\b|\$/],
    ['PLN', /\bPLN\b|ZŁ|\bZL\b/],
    ['HUF', /\bHUF\b|\bFT\b/]
  ];

  for (const [
    currency,
    pattern
  ] of checks) {
    if (pattern.test(text)) {
      return currency;
    }
  }

  return '';
}

export function parsePriceAmount(
  value
) {
  if (
    typeof value === 'number'
  ) {
    return finiteNonNegativeNumber(
      value
    );
  }

  let text =
    String(value || '')
      .trim();

  if (!text) {
    return null;
  }

  text = text
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d.,\s]/g, '')
    .replace(/\s+/g, '');

  if (!text) {
    return null;
  }

  const lastComma =
    text.lastIndexOf(',');

  const lastDot =
    text.lastIndexOf('.');

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    const decimalSeparator =
      lastComma > lastDot
        ? ','
        : '.';

    const thousandsSeparator =
      decimalSeparator === ','
        ? '.'
        : ',';

    text =
      text
        .split(thousandsSeparator)
        .join('')
        .replace(
          decimalSeparator,
          '.'
        );
  } else if (
    lastComma >= 0
  ) {
    const decimalDigits =
      text.length -
      lastComma -
      1;

    text =
      decimalDigits === 3
        ? text.replace(/,/g, '')
        : text.replace(',', '.');
  } else if (
    lastDot >= 0
  ) {
    const decimalDigits =
      text.length -
      lastDot -
      1;

    if (decimalDigits === 3) {
      text =
        text.replace(/\./g, '');
    }
  }

  return finiteNonNegativeNumber(
    text
  );
}

export function normalizePriceOption(
  source = {}
) {
  const amount =
    parsePriceAmount(
      source.amount ??
      source.min ??
      source.priceFrom
    );

  const currency =
    normalizePriceCurrency(
      source.currency
    ) ||
    currencyFromPriceText(
      source.priceFrom
    );

  if (
    amount === null ||
    !currency
  ) {
    return null;
  }

  return {
    amount,
    currency
  };
}

function pushUniquePriceOption(
  target,
  seen,
  source
) {
  const option =
    normalizePriceOption(
      source
    );

  if (!option) {
    return;
  }

  const key =
    `${option.currency}:${option.amount}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  target.push(option);
}

export function getEventPriceOptions(
  event = {}
) {
  const options = [];
  const seen = new Set();

  if (
    Array.isArray(
      event.priceOptions
    )
  ) {
    for (
      const option of
      event.priceOptions
    ) {
      pushUniquePriceOption(
        options,
        seen,
        option
      );
    }
  }

  if (
    Array.isArray(
      event.ticketOptions
    )
  ) {
    for (
      const option of
      event.ticketOptions
    ) {
      pushUniquePriceOption(
        options,
        seen,
        option
      );
    }
  }

  if (
    event.price &&
    typeof event.price ===
      'object'
  ) {
    pushUniquePriceOption(
      options,
      seen,
      {
        amount:
          event.price.min,
        currency:
          event.price.currency
      }
    );
  }

  pushUniquePriceOption(
    options,
    seen,
    {
      priceFrom:
        event.priceFrom,
      currency:
        event.currency
    }
  );

  return options;
}

function normalizedFxRates(
  rates = {}
) {
  const normalized = {
    EUR:
      1
  };

  for (
    const [
      rawCurrency,
      rawRate
    ] of Object.entries(
      rates || {}
    )
  ) {
    const currency =
      normalizePriceCurrency(
        rawCurrency
      );

    const rate =
      Number(rawRate);

    if (
      currency &&
      Number.isFinite(rate) &&
      rate > 0
    ) {
      normalized[currency] =
        rate;
    }
  }

  return normalized;
}

/*
 * FX contract:
 * rates express how many units of each currency equal 1 EUR.
 *
 * Example:
 * {
 *   EUR: 1,
 *   CZK: 25,
 *   GBP: 0.85
 * }
 */
export function convertPrice(
  amount,
  fromCurrency,
  toCurrency,
  rates = {}
) {
  const numericAmount =
    finiteNonNegativeNumber(
      amount
    );

  const from =
    normalizePriceCurrency(
      fromCurrency
    );

  const to =
    normalizePriceCurrency(
      toCurrency
    );

  if (
    numericAmount === null ||
    !from ||
    !to
  ) {
    return null;
  }

  if (from === to) {
    return numericAmount;
  }

  const fx =
    normalizedFxRates(
      rates
    );

  const fromRate =
    Number(fx[from]);

  const toRate =
    Number(fx[to]);

  if (
    !Number.isFinite(fromRate) ||
    fromRate <= 0 ||
    !Number.isFinite(toRate) ||
    toRate <= 0
  ) {
    return null;
  }

  const amountInEur =
    numericAmount /
    fromRate;

  return amountInEur *
    toRate;
}

export function matchesEventMaxPrice(
  event,
  {
    maxPrice = null,
    priceCurrency = ''
  } = {},
  {
    rates = {}
  } = {}
) {
  const limit =
    finiteNonNegativeNumber(
      maxPrice
    );

  const currency =
    normalizePriceCurrency(
      priceCurrency
    );

  if (
    limit === null ||
    !currency
  ) {
    return true;
  }

  const options =
    getEventPriceOptions(
      event
    );

  if (!options.length) {
    return false;
  }

  return options.some(
    option => {
      const converted =
        convertPrice(
          option.amount,
          option.currency,
          currency,
          rates
        );

      return (
        converted !== null &&
        converted <= limit
      );
    }
  );
}

export function normalizePriceFilterState(
  filters = {}
) {
  const maxPrice =
    parsePriceAmount(
      filters?.maxPrice
    );

  const priceCurrency =
    normalizePriceCurrency(
      filters?.priceCurrency
    );

  if (
    maxPrice === null ||
    !priceCurrency
  ) {
    return {
      maxPrice:
        null,

      priceCurrency:
        ''
    };
  }

  return {
    maxPrice,
    priceCurrency
  };
}

export function hasActivePriceFilter(
  filters = {}
) {
  const normalized =
    normalizePriceFilterState(
      filters
    );

  return (
    normalized.maxPrice !== null &&
    Boolean(
      normalized.priceCurrency
    )
  );
}

export function readPriceFilterFromSearchParams(
  params
) {
  if (
    !params ||
    typeof params.get !== 'function'
  ) {
    return {
      maxPrice:
        null,

      priceCurrency:
        ''
    };
  }

  return normalizePriceFilterState({
    maxPrice:
      params.get(
        'priceMax'
      ),

    priceCurrency:
      params.get(
        'priceCurrency'
      )
  });
}

export function syncPriceFilterSearchParams(
  params,
  filters = {}
) {
  if (
    !params ||
    typeof params.set !== 'function' ||
    typeof params.delete !== 'function'
  ) {
    return params;
  }

  const normalized =
    normalizePriceFilterState(
      filters
    );

  if (
    normalized.maxPrice !== null &&
    normalized.priceCurrency
  ) {
    params.set(
      'priceMax',
      String(
        normalized.maxPrice
      )
    );

    params.set(
      'priceCurrency',
      normalized.priceCurrency
    );
  } else {
    params.delete(
      'priceMax'
    );

    params.delete(
      'priceCurrency'
    );
  }

  return params;
}
export function defaultPriceCurrencyForLocale(
  locale = 'en'
) {
  const language =
    String(
      locale ||
      'en'
    )
      .trim()
      .toLowerCase()
      .split('-')[0];

  const currencyByLanguage = {
    cs:
      'CZK',

    sk:
      'EUR',

    de:
      'EUR',

    pl:
      'PLN',

    hu:
      'HUF',

    en:
      'EUR'
  };

  return (
    currencyByLanguage[
      language
    ] ||
    'EUR'
  );
}

export function formatPriceFilterLabel(
  filters = {},
  locale = 'en'
) {
  const normalized =
    normalizePriceFilterState(
      filters
    );

  if (
    normalized.maxPrice ===
      null ||
    !normalized.priceCurrency
  ) {
    return '';
  }

  let amount =
    String(
      normalized.maxPrice
    );

  try {
    amount =
      new Intl.NumberFormat(
        locale ||
          'en',
        {
          maximumFractionDigits:
            2
        }
      ).format(
        normalized.maxPrice
      );
  } catch {
    /*
     * String fallback is sufficient.
     */
  }

  return `≤ ${amount} ${normalized.priceCurrency}`;
}

export {
  SUPPORTED_PRICE_CURRENCIES
};