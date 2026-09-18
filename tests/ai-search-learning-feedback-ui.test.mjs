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

const normalizedController =
  controller.replace(
    /\r\n/g,
    '\n'
  );

const learning =
  await readFile(
    new URL(
      '../src/ai-search/learning.js',
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
  'feedback UI is localized for all supported AI Search locales',
  () => {
    const expectedSourceSnippets = [
      "'Pomohlo v\\u00e1m toto vyhled\\u00e1v\\u00e1n\\u00ed?'",
      "'Did this search help you?'",
      "'Hat Ihnen diese Suche geholfen?'",
      "'Pomohlo v\\u00e1m toto vyh\\u013ead\\u00e1vanie?'",
      "'\\u00c1no'",
      "'Czy to wyszukiwanie by\\u0142o pomocne?'",
      "'Seg\\u00edtett ez a keres\\u00e9s?'"
    ];

    for (
      const expected
      of expectedSourceSnippets
    ) {
      assert.equal(
        normalizedController.includes(
          expected
        ),
        true,
        expected
      );
    }

    const feedbackStart =
      normalizedController.indexOf(
        'const FEEDBACK_COPY = {'
      );

    const feedbackEnd =
      normalizedController.indexOf(
        'let turnstileScriptPromise =',
        feedbackStart
      );

    const feedbackSource =
      normalizedController.slice(
        feedbackStart,
        feedbackEnd
      );

    assert.equal(
      /[^\x00-\x7F]/.test(
        feedbackSource
      ),
      false,
      'FEEDBACK_COPY source must stay ASCII-only to avoid Windows encoding corruption'
    );
  }
);

test(
  'feedback UI appears only after a successful applied search and is hidden for a new search',
  () => {
    assert.match(
      controller,
      /data-ai-search-feedback[\s\S]*?hidden/
    );

    assert.match(
      controller,
      /hideFeedback\(\);[\s\S]*?submit\.disabled\s*=\s*true;/
    );

    assert.match(
      controller,
      /state:\s*'success'[\s\S]*?showFeedback\(\s*locale\s*\)/
    );

    assert.match(
      controller,
      /resetClarificationFlow[\s\S]*?hideFeedback\(\);/
    );

    assert.match(
      controller,
      /!hasAnalyticsConsent\(\)[\s\S]*?hideFeedback\(\);/
    );
  }
);

test(
  'feedback buttons map only to the privacy-safe V1B2 values and remain changeable',
  () => {
    assert.match(
      controller,
      /data-ai-search-feedback-value="helpful"/
    );

    assert.match(
      controller,
      /data-ai-search-feedback-value="not_helpful"/
    );

    assert.match(
      controller,
      /aria-pressed="false"/
    );

    assert.match(
      controller,
      /recordAiSearchFeedback\(\s*value\s*\)/
    );

    assert.match(
      controller,
      /setFeedbackValue\(\s*value\s*\)/
    );

    assert.match(
      learning,
      /export function recordAiSearchFeedback\(/
    );

    assert.doesNotMatch(
      controller,
      /recordAiSearchFeedback\(\s*\{/
    );

    assert.doesNotMatch(
      controller,
      /recordAiSearchFeedback\(\s*query/
    );
  }
);

test(
  'feedback UI is compact, accessible and does not use important overrides',
  () => {
    assert.match(
      controller,
      /role="group"[\s\S]*?aria-labelledby="ai-event-search-feedback-question"/
    );

    assert.match(
      styles,
      /\.ai-event-search__feedback-button\s*\{/
    );

    assert.match(
      styles,
      /min-height:\s*32px;/
    );

    assert.match(
      styles,
      /\[aria-pressed="true"\]/
    );

    assert.match(
      styles,
      /prefers-reduced-motion/
    );

    assert.doesNotMatch(
      styles,
      /!important/
    );
  }
);
