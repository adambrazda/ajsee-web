import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readFile
} from 'node:fs/promises';

import {
  MAX_CLARIFICATION_ROUNDS,
  buildClarificationInput,
  normalizeClarificationContext
} from '../src/ai-search/clarification-context.js';


function previousIntent(
  locale = 'cs'
) {
  return {
    version:
      '1',

    locale,

    category:
      'concert',

    clarification: {
      required:
        true,

      question:
        'Myslíte maximální cenu 100 Kč?',

      fields: [
        'unsupportedPreferences'
      ]
    }
  };
}


test(
  'normal AI input remains unchanged without clarification context',
  () => {
    assert.equal(
      buildClarificationInput({
        query:
          'koncert v Praze'
      }),
      'koncert v Praze'
    );
  }
);


test(
  'valid clarification context is normalized and serialized as a continuation',
  () => {
    const result =
      normalizeClarificationContext(
        {
          originalQuery:
            'Hledám koncert v Praze, cena max -100 Kč',

          question:
            'Myslíte maximální cenu 100 Kč?',

          round:
            1,

          previousIntent:
            previousIntent()
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.value.round,
      1
    );

    const input =
      buildClarificationInput({
        query:
          'ano',

        context:
          result.value
      });

    const [
      marker,
      payloadJson
    ] =
      input.split(
        '\n'
      );

    assert.equal(
      marker,
      'AJSEE_CLARIFICATION_REPLY_V1'
    );

    const payload =
      JSON.parse(
        payloadJson
      );

    assert.equal(
      payload.mode,
      'clarification_reply'
    );

    assert.equal(
      payload.reply,
      'ano'
    );

    assert.equal(
      payload.originalQuery,
      'Hledám koncert v Praze, cena max -100 Kč'
    );

    assert.equal(
      payload.clarificationQuestion,
      'Myslíte maximální cenu 100 Kč?'
    );

    assert.equal(
      payload.previousIntent.category,
      'concert'
    );
  }
);


test(
  'clarification context rejects cross-locale or excessive rounds',
  () => {
    const wrongLocale =
      normalizeClarificationContext(
        {
          originalQuery:
            'concert in Prague',

          question:
            'Did you mean 100 CZK?',

          round:
            1,

          previousIntent:
            previousIntent(
              'en'
            )
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      wrongLocale.ok,
      false
    );

    const tooManyRounds =
      normalizeClarificationContext(
        {
          originalQuery:
            'koncert v Praze',

          question:
            'Upřesníte cenu?',

          round:
            MAX_CLARIFICATION_ROUNDS +
            1,

          previousIntent:
            previousIntent()
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      tooManyRounds.ok,
      false
    );
  }
);


test(
  'clarification context requires a prior clarification intent',
  () => {
    const intent =
      previousIntent();

    intent.clarification.required =
      false;

    const result =
      normalizeClarificationContext(
        {
          originalQuery:
            'koncert v Praze',

          question:
            'Upřesníte cenu?',

          round:
            1,

          previousIntent:
            intent
        },
        {
          locale:
            'cs'
        }
      );

    assert.equal(
      result.ok,
      false
    );
  }
);


test(
  'AI function validates and forwards clarification context without changing normal requests',
  async () => {
    const backend =
      await readFile(
        new URL(
          '../netlify/functions/ai-event-search.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.match(
      backend,
      /normalizeClarificationContext\(/
    );

    assert.match(
      backend,
      /invalid-clarification-context/
    );

    assert.match(
      backend,
      /buildClarificationInput\(\{[\s\S]*?query,[\s\S]*?clarificationContext/
    );

    assert.match(
      backend,
      /AJSEE_CLARIFICATION_REPLY_V1/
    );
  }
);
