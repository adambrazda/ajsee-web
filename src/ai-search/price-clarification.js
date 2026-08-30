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
