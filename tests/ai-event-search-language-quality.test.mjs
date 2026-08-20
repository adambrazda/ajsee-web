import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildParserInstructions
} from '../netlify/functions/ai-event-search.js';

test(
  'clarification instructions require locale-quality language',
  () => {
    const instructions =
      buildParserInstructions({
        locale:
          'cs',

        now:
          '2026-08-18T12:00:00.000Z'
      });

    assert.match(
      instructions,
      /natural, idiomatic, concise, and grammatically correct/
    );

    assert.match(
      instructions,
      /Do not mechanically copy punctuation or awkward syntax/
    );

    assert.match(
      instructions,
      /simple alternatives joined by "nebo"/
    );

    assert.match(
      instructions,
      /Máte zájem o koncerty v Praze nebo v Brně\?/
    );

    assert.doesNotMatch(
      instructions,
      /Praze, nebo v Brně/
    );
  }
);

test(
  'clarification language-quality rule applies to every supported locale',
  () => {
    for (
      const locale of [
        'cs',
        'en',
        'de',
        'sk',
        'pl',
        'hu'
      ]
    ) {
      const instructions =
        buildParserInstructions({
          locale,

          now:
            '2026-08-18T12:00:00.000Z'
        });

      assert.match(
        instructions,
        new RegExp(
          `clarification\\.question must be written for the user in locale ${locale}`
        )
      );

      assert.match(
        instructions,
        /grammatically correct in the requested locale/
      );
    }
  }
);