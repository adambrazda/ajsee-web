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

const runtimeConfig =
  await readFile(
    new URL(
      '../src/ai-search/runtime-config.js',
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
  'AI search UI is fail-closed unless preview or explicit production config enables it',
  () => {
    assert.match(
      runtimeConfig,
      /deploy-preview-\\d\+--ajsee-demo\\.netlify\\.app/
    );

    assert.match(
      runtimeConfig,
      /1x00000000000000000000AA/
    );

    assert.match(
      controller,
      /VITE_AI_SEARCH_ENABLED/
    );

    assert.match(
      controller,
      /VITE_TURNSTILE_SITE_KEY/
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

test(
  'AI search materializes intent into existing event filter runtime',
  () => {
    for (
      const source of [
        homeEntry,
        eventsEntry
      ]
    ) {
      assert.match(
        source,
        /from '\.\/ai-search\/intent-to-filters\.js'/
      );

      assert.match(
        source,
        /from '\.\/ai-search\/requirement-resolver\.js'/
      );

      assert.match(
        source,
        /from '\.\/ai-search\/search-plan-materializer\.js'/
      );

      assert.match(
        source,
        /async function applyAiEventSearchIntent\(intent\)/
      );

      assert.match(
        source,
        /currentFilters\s*=\s*materializedPlanToRuntimeFilters\(/s
      );

      assert.match(
        source,
        /await renderAndSync\(\{\s*resetPage:\s*true\s*\}\)/s
      );

      assert.match(
        source,
        /onIntent:\s*applyAiEventSearchIntent/
      );
    }

    assert.match(
      controller,
      /const APPLY_COPY\s*=/
    );

    assert.match(
      controller,
      /let applicationResult\s*=/
    );

    assert.match(
      controller,
      /unsupportedPreferences\.length > 0/
    );
  }
);

test(
  'AI search resolves city radius and Near Me requirements in both page runtimes',
  () => {
    for (
      const source of [
        homeEntry,
        eventsEntry
      ]
    ) {
      assert.match(
        source,
        /from '\.\/ai-search\/city-resolver-adapter\.js'/
      );

      assert.match(
        source,
        /from '\.\/ai-search\/runtime-filter-state\.js'/
      );

      assert.match(
        source,
        /createSuggestCitiesResolver\(\{[\s\S]*?locale:\s*currentLang/
      );

      assert.match(
        source,
        /getGeolocation:\s*getAiSearchGeolocation/
      );

      assert.match(
        source,
        /materializedPlanToRuntimeFilters\(/
      );
    }

    assert.match(
      homeEntry,
      /syncQuickFilterButtons\(\);/
    );

    assert.match(
      eventsEntry,
      /function syncQuickNearMeButton\(\)[\s\S]*?isNearMePlace\([\s\S]*?currentFilters/
    );

    assert.match(
      eventsEntry,
      /async function renderAndSync\([\s\S]*?normalizeDates\(\);[\s\S]*?syncQuickNearMeButton\(\);[\s\S]*?syncURLFromFilters\(\);/
    );
  }
);
