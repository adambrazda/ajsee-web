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
