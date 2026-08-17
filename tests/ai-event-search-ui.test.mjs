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

const homeEntry =
  await readFile(
    new URL(
      '../src/home-entry.js',
      import.meta.url
    ),
    'utf8'
  );

const eventsEntry =
  await readFile(
    new URL(
      '../src/events-entry.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'AI search UI is fail-closed to AJSEE deploy previews',
  () => {
    assert.match(
      controller,
      /deploy-preview-\\d\+--ajsee-demo\\\.netlify\\\.app/
    );

    assert.match(
      controller,
      /1x00000000000000000000AA/
    );

    assert.doesNotMatch(
      controller,
      /TURNSTILE_SECRET_KEY/
    );

    assert.doesNotMatch(
      controller,
      /OPENAI_API_KEY/
    );
  }
);

test(
  'AI search UI sends protected POST contract without injecting API HTML',
  () => {
    assert.match(
      controller,
      /\/api\/ai-event-search/
    );

    assert.match(
      controller,
      /method:\s*'POST'/
    );

    assert.match(
      controller,
      /turnstileToken/
    );

    assert.match(
      controller,
      /action:\s*TURNSTILE_ACTION/
    );

    assert.match(
      controller,
      /ai_event_search/
    );

    assert.match(
      controller,
      /execution:\s*'execute'/
    );

    assert.match(
      controller,
      /appearance:\s*'interaction-only'/
    );

    assert.match(
      controller,
      /status\.textContent/
    );
  }
);

test(
  'homepage and events page initialize the shared AI search controller',
  () => {
    for (
      const source of [
        homeEntry,
        eventsEntry
      ]
    ) {
      assert.match(
        source,
        /from '\.\/ai-search\/ui-controller\.js'/
      );

      assert.match(
        source,
        /initAiEventSearch\(\{/
      );

      assert.match(
        source,
        /getLocale:\s*\(\)\s*=>\s*currentLang/
      );
    }
  }
);