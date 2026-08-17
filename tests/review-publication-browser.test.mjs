import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script =
  await readFile(
    new URL(
      '../public/admin/publication/publication.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'publication admin uses ephemeral Identity JWT for status requests',
  () => {
    assert.match(
      script,
      /netlifyIdentity/
    );

    assert.match(
      script,
      /\.jwt\s*\(\s*\)/
    );

    assert.match(
      script,
      /\/api\/review-publication-admin/
    );

    assert.match(
      script,
      /Authorization/
    );

    assert.match(
      script,
      /Bearer/
    );

    assert.match(
      script,
      /method\s*:\s*["']GET["']/
    );
  }
);

test(
  'publication admin does not persist authentication or inject API content as HTML',
  () => {
    assert.doesNotMatch(
      script,
      /localStorage/
    );

    assert.doesNotMatch(
      script,
      /sessionStorage/
    );

    assert.doesNotMatch(
      script,
      /\.innerHTML/
    );

    assert.doesNotMatch(
      script,
      /insertAdjacentHTML/
    );

    assert.match(
      script,
      /\.textContent/
    );
  }
);

test(
  'publication preparation remains fail-closed before POST wiring',
  () => {
    assert.match(
      script,
      /prepareButton\.disabled\s*=\s*true/
    );

    assert.doesNotMatch(
      script,
      /method\s*:\s*["']POST["']/
    );
  }
);
