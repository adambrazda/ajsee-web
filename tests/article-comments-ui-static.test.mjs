import assert
  from 'node:assert/strict';

import {
  readFile
} from 'node:fs/promises';

import test
  from 'node:test';

const sourceUrl =
  new URL(
    '../src/article-comments.js',
    import.meta.url
  );

const source =
  await readFile(
    sourceUrl,
    'utf8'
  );

test(
  'public comments component uses the moderated API',
  () => {
    assert.match(
      source,
      /['"]\/api\/article-comments['"]/
    );

    assert.match(
      source,
      /method:\s*['"]GET['"]/
    );

    assert.match(
      source,
      /method:\s*['"]POST['"]/
    );

    assert.match(
      source,
      /url\.searchParams\.set\(\s*['"]postType['"]/
    );

    assert.match(
      source,
      /url\.searchParams\.set\(\s*['"]postId['"]/
    );

    assert.match(
      source,
      /url\.searchParams\.set\(\s*['"]lang['"]/
    );
  }
);

test(
  'submission matches the public API contract',
  () => {
    for (
      const field of [
        'postType',
        'postId',
        'lang',
        'name',
        'email',
        'comment',
        'company',
        'startedAt'
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          '\\b' +
          field +
          '\\b'
        )
      );
    }

    assert.doesNotMatch(
      source,
      /name:\s*['"]website['"]/
    );
  }
);

test(
  'user content is rendered with safe DOM APIs',
  () => {
    assert.match(
      source,
      /\.textContent\s*=/
    );

    assert.match(
      source,
      /\.replaceChildren\(/
    );

    assert.doesNotMatch(
      source,
      /\.innerHTML\b/
    );

    assert.doesNotMatch(
      source,
      /insertAdjacentHTML/
    );

    assert.doesNotMatch(
      source,
      /\.outerHTML\b/
    );
  }
);

test(
  'component includes loading error empty and moderation states',
  () => {
    assert.match(
      source,
      /renderLoading/
    );

    assert.match(
      source,
      /renderEmpty/
    );

    assert.match(
      source,
      /renderError/
    );

    assert.match(
      source,
      /published after approval/
    );

    assert.match(
      source,
      /rate-limit-exceeded/
    );

    assert.match(
      source,
      /invalid-form-timing/
    );
  }
);

test(
  'component supports all AJSEE languages',
  () => {
    for (
      const language of [
        'cs',
        'en',
        'de',
        'sk',
        'pl',
        'hu'
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          '\\b' +
          language +
          ':\\s*\\{'
        )
      );
    }
  }
);

test(
  'component exposes accessible form and live regions',
  () => {
    assert.match(
      source,
      /aria-live/
    );

    assert.match(
      source,
      /aria-busy/
    );

    assert.match(
      source,
      /aria-describedby/
    );

    assert.match(
      source,
      /form\.reportValidity\(\)/
    );

    assert.match(
      source,
      /submitButton\.disabled/
    );

    assert.match(
      source,
      /nameInput\.focus\(\)/
    );
  }
);

test(
  'component initializes only explicit article comment roots',
  () => {
    assert.match(
      source,
      /\[data-article-comments\]/
    );

    assert.match(
      source,
      /root\.dataset\.postType/
    );

    assert.match(
      source,
      /root\.dataset\.postId/
    );

    assert.match(
      source,
      /root\.dataset\.lang/
    );

    assert.match(
      source,
      /articleCommentsInitialized/
    );
  }
);

test(
  'component does not persist private form data in browser storage',
  () => {
    assert.doesNotMatch(
      source,
      /localStorage/
    );

    assert.doesNotMatch(
      source,
      /sessionStorage/
    );

    assert.doesNotMatch(
      source,
      /indexedDB/
    );
  }
);
