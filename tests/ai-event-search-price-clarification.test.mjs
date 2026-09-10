import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPriceCurrencyClarification
} from '../src/ai-search/price-clarification.js';


function intentWithPrice(
  value,
  {
    currency = '',
    clarification = {
      required:
        false,

      question:
        '',

      fields:
        []
    }
  } = {}
) {
  return {
    unsupportedPreferences: [
      {
        type:
          'max_price',

        value,

        currency,

        unit:
          ''
      }
    ],

    clarification
  };
}


test(
  'null max price never becomes a currency clarification',
  () => {
    const result =
      applyPriceCurrencyClarification(
        intentWithPrice(
          null
        ),
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.needsClarification,
      false
    );

    assert.equal(
      result.intent
        .clarification
        .required,
      false
    );

    assert.doesNotMatch(
      result.intent
        .clarification
        .question,
      /null/i
    );
  }
);


test(
  'missing concrete price preserves model clarification',
  () => {
    const question =
      'Jaká maximální cena je pro vás ještě přijatelná?';

    const result =
      applyPriceCurrencyClarification(
        intentWithPrice(
          null,
          {
            clarification: {
              required:
                true,

              question,

              fields: [
                'unsupportedPreferences'
              ]
            }
          }
        ),
        {
          locale:
            'cs',

          needsClarification:
            true
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.intent
        .clarification
        .question,
      question
    );
  }
);


for (
  const invalidValue of
  [
    '',
    '   ',
    'not-a-number'
  ]
) {
  test(
    `invalid max price ${JSON.stringify(invalidValue)} does not create currency clarification`,
    () => {
      const result =
        applyPriceCurrencyClarification(
          intentWithPrice(
            invalidValue
          ),
          {
            locale:
              'cs'
          }
        );

      assert.equal(
        result.needsClarification,
        false
      );

      assert.equal(
        result.intent
          .clarification
          .required,
        false
      );
    }
  );
}


test(
  'zero remains a valid free-event maximum price',
  () => {
    const result =
      applyPriceCurrencyClarification(
        intentWithPrice(
          0
        ),
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.intent
        .clarification
        .question,
      'Myslíte maximální cenu 0 CZK?'
    );
  }
);


test(
  'concrete max price still requests missing locale currency',
  () => {
    const result =
      applyPriceCurrencyClarification(
        intentWithPrice(
          100
        ),
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.intent
        .clarification
        .question,
      'Myslíte maximální cenu 100 CZK?'
    );
  }
);


test(
  'negative max price requests confirmation instead of being silently unsupported',
  () => {
    const result =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.intent
        .clarification
        .required,
      true
    );

    assert.equal(
      result.intent
        .clarification
        .question,
      'Myslíte maximální cenu 100 CZK?'
    );

    assert.equal(
      result.intent
        .unsupportedPreferences[0]
        .value,
      -100
    );
  }
);


test(
  'affirmative negative-price clarification applies positive amount',
  () => {
    const first =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs'
        }
      );

    const confirmed =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs',

          reply:
            'ano',

          clarificationContext: {
            previousIntent:
              first.intent
          },

          needsClarification:
            false
        }
      );

    assert.equal(
      confirmed.needsClarification,
      false
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences[0]
        .value,
      100
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences[0]
        .currency,
      'CZK'
    );
  }
);


test(
  'corrective reply keeps newly supplied positive max price',
  () => {
    const first =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs'
        }
      );

    const corrected =
      applyPriceCurrencyClarification(
        intentWithPrice(
          500,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs',

          reply:
            'ne, do 500 Kč',

          clarificationContext: {
            previousIntent:
              first.intent
          },

          needsClarification:
            false
        }
      );

    assert.equal(
      corrected.needsClarification,
      false
    );

    assert.equal(
      corrected.intent
        .unsupportedPreferences[0]
        .value,
      500
    );

    assert.equal(
      corrected.intent
        .unsupportedPreferences[0]
        .currency,
      'CZK'
    );
  }
);

test(
  'affirmative negative-price clarification restores price when continuation omits max_price',
  () => {
    const first =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs'
        }
      );

    const continuationIntent = {
      unsupportedPreferences:
        [],

      clarification: {
        required:
          false,

        question:
          '',

        fields:
          []
      }
    };

    const confirmed =
      applyPriceCurrencyClarification(
        continuationIntent,
        {
          locale:
            'cs',

          reply:
            'ano',

          clarificationContext: {
            previousIntent:
              first.intent
          },

          needsClarification:
            false
        }
      );

    assert.equal(
      confirmed.needsClarification,
      false
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences
        .length,
      1
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences[0]
        .type,
      'max_price'
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences[0]
        .value,
      100
    );

    assert.equal(
      confirmed.intent
        .unsupportedPreferences[0]
        .currency,
      'CZK'
    );
  }
);

test(
  'affirmative reply with an explicit price correction keeps the corrected amount',
  () => {
    const first =
      applyPriceCurrencyClarification(
        intentWithPrice(
          -100,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs'
        }
      );

    const corrected =
      applyPriceCurrencyClarification(
        intentWithPrice(
          500,
          {
            currency:
              'CZK'
          }
        ),
        {
          locale:
            'cs',

          reply:
            'ano, ale do 500 Kč',

          clarificationContext: {
            previousIntent:
              first.intent
          },

          needsClarification:
            false
        }
      );

    assert.equal(
      corrected.needsClarification,
      false
    );

    assert.equal(
      corrected.intent
        .unsupportedPreferences[0]
        .value,
      500
    );

    assert.equal(
      corrected.intent
        .unsupportedPreferences[0]
        .currency,
      'CZK'
    );
  }
);