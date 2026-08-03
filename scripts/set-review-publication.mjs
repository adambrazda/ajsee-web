import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  transitionReviewPublication
} from './review-publication-state.mjs';

const root = process.cwd();

const action = process.argv[2];
const slug = process.argv[3];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateSlug(value) {
  return (
    typeof value === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function runReviewTests() {
  const npmExecPath =
    process.env.npm_execpath;

  let command;
  let args;
  let useShell = false;

  if (npmExecPath) {
    command = process.execPath;
    args = [
      npmExecPath,
      'run',
      'reviews:test'
    ];
  }
  else {
    command =
      process.platform === 'win32'
        ? 'npm.cmd'
        : 'npm';

    args = [
      'run',
      'reviews:test'
    ];

    useShell =
      process.platform === 'win32';
  }

  return spawnSync(
    command,
    args,
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: useShell
    }
  );
}

if (
  action !== 'publish' &&
  action !== 'unpublish'
) {
  fail(
    'Usage: node scripts/set-review-publication.mjs <publish|unpublish> <review-slug>'
  );
}

if (!validateSlug(slug)) {
  fail(
    'Review slug is missing or invalid.'
  );
}

const reviewPath = path.join(
  root,
  'content',
  'reviews',
  'items',
  `${slug}.json`
);

if (!fs.existsSync(reviewPath)) {
  fail(
    `Review not found: ${reviewPath}`
  );
}

const originalSource =
  fs.readFileSync(
    reviewPath,
    'utf8'
  );

let currentReview;

try {
  currentReview =
    JSON.parse(originalSource);
}
catch (error) {
  fail(
    `Review JSON is invalid: ${error.message}`
  );
}

if (currentReview.slug !== slug) {
  fail(
    `File slug "${slug}" does not match review slug "${currentReview.slug}".`
  );
}

let nextReview;

try {
  nextReview =
    transitionReviewPublication(
      currentReview,
      action,
      new Date().toISOString()
    );
}
catch (error) {
  fail(error.message);
}

const lineEnding =
  originalSource.includes('\r\n')
    ? '\r\n'
    : '\n';

const nextSource =
  JSON.stringify(
    nextReview,
    null,
    2
  ).replace(/\n/g, lineEnding) +
  lineEnding;

if (nextSource === originalSource) {
  console.log(
    `Review "${slug}" already has the requested publication state.`
  );

  process.exit(0);
}

console.log('');
console.log('Publication state before change:');
console.log({
  status: currentReview.status,
  published: currentReview.published,
  publishedAt: currentReview.publishedAt
});

console.log('');
console.log('Publication state after change:');
console.log({
  status: nextReview.status,
  published: nextReview.published,
  publishedAt: nextReview.publishedAt
});

fs.writeFileSync(
  reviewPath,
  nextSource,
  'utf8'
);

console.log('');
console.log('Running AJSEE safety tests...');

const testResult =
  runReviewTests();

if (
  testResult.error ||
  testResult.status !== 0
) {
  fs.writeFileSync(
    reviewPath,
    originalSource,
    'utf8'
  );

  console.error('');
  console.error(
    'Safety tests failed. The original review file was restored.'
  );

  if (testResult.error) {
    console.error(
      testResult.error.message
    );
  }

  process.exit(1);
}

console.log('');
console.log(
  `Review "${slug}" was ${action === 'publish' ? 'published' : 'unpublished'} successfully.`
);

console.log(
  'The file is changed locally. Review the Git diff before committing.'
);