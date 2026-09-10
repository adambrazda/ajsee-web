import {
  defaultPriceCurrencyForLocale
} from '../event-price.js';


const QUESTION_COPY = {
  cs: ({ amount, currency }) =>
    `Myslíte maximální cenu ${amount} ${currency}?`,

  en: ({ amount, currency }) =>
    `Do you mean a maximum price of ${amount} ${currency}?`,

  de: ({ amount, currency }) =>
    `Meinen Sie einen Höchstpreis von ${amount} ${currency}?`,

  sk: ({ amount, currency }) =>
    `Myslíte maximálnu cenu ${amount} ${currency}?`,

  pl: ({ amount, currency }) =>
    `Czy chodzi o maksymalną cenę ${amount} ${currency}?`,

  hu: ({ amount, currency }) =>
    `A maximális ár ${amount} ${currency}?`
};


const AFFIRMATIVE_PATTERN = {
  cs:
    /^(?:ano)\b/iu,

  en:
    /^(?:yes)\b/iu,

  de:
    /^(?:ja)\b/iu,

  sk:
    /^(?:áno|ano)\b/iu,

  pl:
    /^(?:tak)\b/iu,

  hu:
    /^(?:igen)\b/iu
};


function normalizedLocale(
  locale
) {
  const value =
    String(
      locale ||
      ''
    )
      .trim()
      .toLowerCase()
      .slice(
        0,
        2
      );

  return QUESTION_COPY[value]
    ? value
    : 'cs';
}


function cloneIntent(
  intent
) {
  return structuredClone(
    intent
  );
}


function maxPriceWithoutCurrency(
  intent
) {
  const preferences =
    Array.isArray(
      intent
        ?.unsupportedPreferences
    )
      ? intent
          .unsupportedPreferences
      : [];

  return preferences.find(
    preference => {
      if (
        preference?.type !==
          'max_price'
      ) {
        return false;
      }

      const rawValue =
        preference.value;

      if (
        rawValue === null ||
        rawValue === undefined ||
        (
          typeof rawValue ===
            'string' &&
          !rawValue.trim()
        )
      ) {
        return false;
      }

      const value =
        Number(
          rawValue
        );

      const currency =
        String(
          preference.currency ||
          ''
        ).trim();

      return (
        Number.isFinite(value) &&
        value >= 0 &&
        !currency
      );
    }
  ) ||
    null;
}


function negativeMaxPrice(
  intent
) {
  const preferences =
    Array.isArray(
      intent
        ?.unsupportedPreferences
    )
      ? intent
          .unsupportedPreferences
      : [];

  return preferences.find(
    preference => {
      if (
        preference?.type !==
          'max_price'
      ) {
        return false;
      }

      const value =
        Number(
          preference.value
        );

      return (
        Number.isFinite(value) &&
        value < 0
      );
    }
  ) ||
    null;
}


function confirmationWasForNegativePrice(
  clarificationContext
) {
  if (
    clarificationContext
      ?.previousIntent
      ?.clarification
      ?.required !== true
  ) {
    return null;
  }

  return negativeMaxPrice(
    clarificationContext
      .previousIntent
  );
}


function confirmationWasForMissingPriceCurrency(
  clarificationContext
) {
  if (
    !clarificationContext ||
    clarificationContext
      ?.previousIntent
      ?.clarification
      ?.required !== true
  ) {
    return false;
  }

  return Boolean(
    maxPriceWithoutCurrency(
      clarificationContext
        .previousIntent
    )
  );
}


function affirmativeReply(
  reply,
  locale
) {
  const normalized =
    String(
      reply ||
      ''
    )
      .trim();

  const pattern =
    AFFIRMATIVE_PATTERN[
      normalizedLocale(
        locale
      )
    ];

  return pattern.test(
    normalized
  );
}


function questionForPrice({
  locale,
  amount,
  currency
}) {
  const normalized =
    normalizedLocale(
      locale
    );

  return QUESTION_COPY[
    normalized
  ]({
    amount:
      String(
        amount
      ),

    currency
  });
}


export function applyPriceCurrencyClarification(
  intent,
  {
    locale,
    reply = '',
    clarificationContext = null,
    needsClarification = false
  } = {}
) {
  if (
    !intent ||
    typeof intent !==
      'object'
  ) {
    return {
      intent,

      needsClarification:
        Boolean(
          needsClarification
        )
    };
  }

  const result =
    cloneIntent(
      intent
    );

  const previousNegativePrice =
    confirmationWasForNegativePrice(
      clarificationContext
    );

  let currentPrice =
    result
      .unsupportedPreferences
      ?.find(
        preference =>
          preference?.type ===
            'max_price'
      );

  const rawCurrentPriceValue =
    currentPrice?.value;

  const currentPriceValue =
    Number(
      rawCurrentPriceValue
    );

  const hasValidCurrentPrice =
    rawCurrentPriceValue !== null &&
    rawCurrentPriceValue !== undefined &&
    !(
      typeof rawCurrentPriceValue ===
        'string' &&
      !rawCurrentPriceValue.trim()
    ) &&
    Number.isFinite(
      currentPriceValue
    ) &&
    currentPriceValue >= 0;

  if (
    previousNegativePrice &&
    affirmativeReply(
      reply,
      locale
    ) &&
    !hasValidCurrentPrice
  ) {

    const amount =
      Math.abs(
        Number(
          previousNegativePrice
            .value
        )
      );

    const currency =
      String(
        previousNegativePrice
          .currency ||
        ''
      ).trim() ||
      defaultPriceCurrencyForLocale(
        locale
      );

    if (!currentPrice) {
      if (
        !Array.isArray(
          result.unsupportedPreferences
        )
      ) {
        result.unsupportedPreferences =
          [];
      }

      currentPrice = {
        ...structuredClone(
          previousNegativePrice
        )
      };

      result.unsupportedPreferences.push(
        currentPrice
      );
    }

    currentPrice.value =
      amount;

    currentPrice.currency =
      currency;

    return {
      intent:
        result,

      needsClarification:
        Boolean(
          needsClarification
        )
    };
  }

  const negativePrice =
    negativeMaxPrice(
      result
    );

  if (negativePrice) {
    result.clarification = {
      required:
        true,

      question:
        questionForPrice({
          locale,

          amount:
            Math.abs(
              Number(
                negativePrice.value
              )
            ),

          currency:
            String(
              negativePrice.currency ||
              ''
            ).trim() ||
            defaultPriceCurrencyForLocale(
              locale
            )
        }),

      fields: [
        'unsupportedPreferences'
      ]
    };

    return {
      intent:
        result,

      needsClarification:
        true
    };
  }

  const missingPrice =
    maxPriceWithoutCurrency(
      result
    );

  if (!missingPrice) {
    return {
      intent:
        result,

      needsClarification:
        Boolean(
          needsClarification
        )
    };
  }

  const defaultCurrency =
    defaultPriceCurrencyForLocale(
      locale
    );

  /*
   * A short affirmative reply confirms the currency
   * proposed by the previous server-side clarification.
   *
   * Preserve any new clarification returned by the model;
   * only resolve the missing price currency itself.
   */
  if (
    confirmationWasForMissingPriceCurrency(
      clarificationContext
    ) &&
    affirmativeReply(
      reply,
      locale
    )
  ) {
    missingPrice.currency =
      defaultCurrency;

    return {
      intent:
        result,

      needsClarification:
        Boolean(
          needsClarification
        )
    };
  }

  /*
   * Never silently guess a currency.
   * The locale currency is only proposed to the user.
   */
  result.clarification = {
    required:
      true,

    question:
      questionForPrice({
        locale,

        amount:
          missingPrice.value,

        currency:
          defaultCurrency
      }),

    fields: [
      'unsupportedPreferences'
    ]
  };

  return {
    intent:
      result,

    needsClarification:
      true
  };
}
