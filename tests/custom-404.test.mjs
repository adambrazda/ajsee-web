import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(
  new URL(
    '../public/404.html',
    import.meta.url
  ),
  'utf8'
);

test(
  'custom 404 page is semantic and excluded from search indexing',
  () => {
    assert.match(
      html,
      /<main\b/
    );

    assert.match(
      html,
      /<h1\b/
    );

    assert.match(
      html,
      /name="robots"\s+content="noindex, follow"/
    );

    assert.match(
      html,
      /class="skip-link"/
    );

    assert.match(
      html,
      /prefers-reduced-motion/
    );

    assert.match(
      html,
      /:focus-visible/
    );
  }
);

test(
  'custom 404 page supports all AJSEE languages',
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
        html,
        new RegExp(
          `${language}:\\s*\\{`
        )
      );
    }

    assert.match(
      html,
      /document\.documentElement\.lang/
    );

    assert.match(
      html,
      /data-i18n/
    );
  }
);

test(
  'custom 404 page provides safe recovery actions',
  () => {
    assert.match(
      html,
      /data-home-link/
    );

    assert.match(
      html,
      /data-events-link/
    );

    assert.match(
      html,
      /data-contact-link/
    );

    assert.match(
      html,
      /href="\/events\/"/
    );

    assert.doesNotMatch(
      html,
      /target="_blank"/
    );
  }
);

test(
  'custom 404 page does not load third-party resources',
  () => {
    assert.doesNotMatch(
      html,
      /https?:\/\/(?!ajsee\.cz)/
    );

    assert.doesNotMatch(
      html,
      /<iframe\b/i
    );
  }
);
