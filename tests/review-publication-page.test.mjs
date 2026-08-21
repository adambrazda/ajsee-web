import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicationIndex =
  await readFile(
    new URL(
      '../public/admin/publication/index.html',
      import.meta.url
    ),
    'utf8'
  );

test(
  'review publication admin page has the safe publication UI shell',
  () => {
    assert.match(
      publicationIndex,
      /<meta[^>]+name=["']robots["'][^>]+content=["']noindex/
    );

    assert.match(
      publicationIndex,
      /identity\.netlify\.com\/v1\/netlify-identity-widget\.js/
    );

    assert.match(
      publicationIndex,
      /href=["']\/admin\/["']/
    );

    assert.match(
      publicationIndex,
      /id=["']review-slug["']/
    );

    assert.match(
      publicationIndex,
      /id=["']publication-status["']/
    );

    assert.match(
      publicationIndex,
      /aria-live=["']polite["']/
    );

    assert.match(
      publicationIndex,
      /id=["']prepare-publication["']/
    );

    assert.match(
      publicationIndex,
      /Připravit publikaci/i
    );

    assert.match(
      publicationIndex,
      /src=["']\.\/publication\.js["']/
    );
  }
);
