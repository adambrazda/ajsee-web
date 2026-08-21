import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const netlifyToml =
  await readFile(
    new URL(
      '../netlify.toml',
      import.meta.url
    ),
    'utf8'
  );

test(
  'review publication admin API has an explicit Netlify rewrite',
  () => {
    assert.match(
      netlifyToml,
      /\[\[redirects\]\][\s\S]*?from\s*=\s*"\/api\/review-publication-admin"[\s\S]*?to\s*=\s*"\/\.netlify\/functions\/review-publication-admin"[\s\S]*?status\s*=\s*200/
    );
  }
);
