import test from 'node:test';

import assert from 'node:assert/strict';

import {
  readFile
} from 'node:fs/promises';

const htmlPath =
  new URL(
    '../public/comment-admin/index.html',
    import.meta.url
  );

const scriptPath =
  new URL(
    '../public/comment-admin/app.js',
    import.meta.url
  );

const stylePath =
  new URL(
    '../public/comment-admin/styles.css',
    import.meta.url
  );

const [
  html,
  script,
  styles
] =
  await Promise.all([
    readFile(
      htmlPath,
      'utf8'
    ),

    readFile(
      scriptPath,
      'utf8'
    ),

    readFile(
      stylePath,
      'utf8'
    )
  ]);

test(
  'admin page is private from search engines and loads Identity',
  () => {
    assert.match(
      html,
      /noindex,\s*nofollow,\s*noarchive/
    );

    assert.match(
      html,
      /netlify-identity-widget\.js/
    );

    assert.match(
      html,
      /\/comment-admin\/app\.js/
    );

    assert.match(
      html,
      /\/comment-admin\/styles\.css/
    );
  }
);

test(
  'admin API requests use ephemeral Identity JWT',
  () => {
    assert.match(
      script,
      /state\.user\.jwt\(\)/
    );

    assert.match(
      script,
      /Authorization/
    );

    assert.match(
      script,
      /Bearer \$\{token\}/
    );

    assert.doesNotMatch(
      script,
      /localStorage/
    );

    assert.doesNotMatch(
      script,
      /sessionStorage/
    );
  }
);

test(
  'user-provided comment content is rendered without innerHTML',
  () => {
    assert.match(
      script,
      /textContent/
    );

    assert.match(
      script,
      /replaceChildren/
    );

    assert.doesNotMatch(
      script,
      /\.innerHTML/
    );

    assert.doesNotMatch(
      script,
      /insertAdjacentHTML/
    );
  }
);

test(
  'moderation interface includes approve and reject actions',
  () => {
    assert.match(
      script,
      /moderateComment\(\s*comment,\s*'approve',\s*card\s*\)/
    );

    assert.match(
      script,
      /moderateComment\(\s*comment,\s*'reject',\s*card\s*\)/
    );

    assert.match(
      script,
      /comment\.status ===\s*'pending'/
    );

    assert.match(
      html,
      /data-comment-status="approved"/
    );

    assert.match(
      html,
      /data-comment-status="rejected"/
    );
  }
);

test(
  'admin interface contains accessibility and responsive styles',
  () => {
    assert.match(
      html,
      /aria-live="polite"/
    );

    assert.match(
      html,
      /role="tablist"/
    );

    assert.match(
      styles,
      /:focus-visible/
    );

    assert.match(
      styles,
      /prefers-reduced-motion/
    );

    assert.match(
      styles,
      /@media \(max-width: 760px\)/
    );
  }
);