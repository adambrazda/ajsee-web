import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adminIndex =
  await readFile(
    new URL(
      '../public/admin/index.html',
      import.meta.url
    ),
    'utf8'
  );

test(
  'Decap CMS uses a custom mount and links to review publication admin',
  () => {
    assert.match(
      adminIndex,
      /id=["']nc-root["']/
    );

    assert.match(
      adminIndex,
      /href=["']\/admin\/publication\/["']/
    );

    assert.match(
      adminIndex,
      /Publikace recenz/i
    );
  }
);
