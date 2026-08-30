import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readFile
} from 'node:fs/promises';


const controller =
  await readFile(
    new URL(
      '../src/ai-search/ui-controller.js',
      import.meta.url
    ),
    'utf8'
  );

const styles =
  await readFile(
    new URL(
      '../src/styles/partials/_ai-event-search.scss',
      import.meta.url
    ),
    'utf8'
  );


test(
  'clarification UI exposes accessible yes and edit actions',
  () => {
    assert.match(
      controller,
      /data-ai-search-clarification-actions/
    );

    assert.match(
      controller,
      /data-ai-search-clarification-yes/
    );

    assert.match(
      controller,
      /data-ai-search-clarification-edit/
    );

    assert.match(
      controller,
      /role="group"/
    );

    assert.match(
      controller,
      /clarificationActions\.setAttribute\([\s\S]*?'aria-label'/
    );
  }
);


test(
  'clarification continuation preserves context and is limited to two rounds',
  () => {
    assert.match(
      controller,
      /let pendingClarification\s*=\s*null/
    );

    assert.match(
      controller,
      /clarificationContext:\s*requestClarificationContext/
    );

    assert.match(
      controller,
      /MAX_CLARIFICATION_ROUNDS/
    );

    assert.match(
      controller,
      /requestClarificationContext[\s\S]*?\.round[\s\S]*?>=[\s\S]*?MAX_CLARIFICATION_ROUNDS/
    );

    assert.match(
      controller,
      /originalQuery:[\s\S]*?previousIntent:/
    );
  }
);


test(
  'clarification UI supports direct typing and localized quick confirmation',
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
      assert.match(
        controller,
        new RegExp(
          String.raw`\b${locale}:\s*\{`
        )
      );
    }

    assert.match(
      controller,
      /affirmativeReply/
    );

    assert.match(
      controller,
      /void runSearch\(\s*reply\s*\)/
    );

    assert.match(
      controller,
      /clarificationEdit[\s\S]*?input\.focus\(\)/
    );
  }
);


test(
  'clarification context resets on form clear and language change',
  () => {
    assert.match(
      controller,
      /form\.addEventListener\(\s*'reset'/
    );

    assert.match(
      controller,
      /data-quick-filter="clear"/
    );

    assert.match(
      controller,
      /handleLanguageChange[\s\S]*?resetClarificationFlow\(\)/
    );
  }
);


test(
  'clarification actions keep keyboard focus and reduced-motion support',
  () => {
    assert.match(
      styles,
      /\.ai-event-search__clarification-action:focus-visible/
    );

    assert.match(
      styles,
      /min-height:\s*44px/
    );

    assert.match(
      styles,
      /prefers-reduced-motion:[\s\S]*?ai-event-search__clarification-action/
    );
    const forbiddenPriority =
      new RegExp(
        '!' +
        'im' +
        'portant'
      );

    assert.doesNotMatch(
      styles,
      forbiddenPriority
    );
  }
);


test(
  'completed clarification clears transient reply text',
  () => {
    assert.match(
      controller,
      /requestClarificationContext[\s\S]*?clearPendingClarification\(\);[\s\S]*?if\s*\(\s*requestClarificationContext\s*\)[\s\S]*?input\.value\s*=\s*''/
    );

    assert.doesNotMatch(
      controller,
      /input\.value\s*=\s*reply;[\s\S]{0,120}?void runSearch\(\s*reply\s*\)/
    );
  }
);


test(
  'global quick-filter clear resets clarification outside the AI form',
  () => {
    assert.match(
      controller,
      /const handleGlobalClear/
    );

    assert.match(
      controller,
      /globalThis\.addEventListener\(\s*'click',\s*handleGlobalClear\s*\)/
    );

    assert.match(
      controller,
      /handleGlobalClear[\s\S]*?\[data-quick-filter="clear"\][\s\S]*?resetClarificationFlow\(\)/
    );

    assert.match(
      controller,
      /resetClarificationFlow[\s\S]*?input\.value\s*=\s*''/
    );
  }
);
