import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  assertReviewPublicationInvariant,
  transitionReviewPublication
} from '../scripts/review-publication-state.mjs';

const root = process.cwd();

function createApprovedReview() {
  return {
    slug: 'example-review',
    status: 'approved',
    published: false,
    publishedAt: ''
  };
}

test(
  'publish action updates all publication fields together',
  () => {
    const result =
      transitionReviewPublication(
        createApprovedReview(),
        'publish',
        '2026-08-03T10:00:00.000Z'
      );

    assert.equal(
      result.status,
      'published'
    );

    assert.equal(
      result.published,
      true
    );

    assert.equal(
      result.publishedAt,
      '2026-08-03T10:00:00.000Z'
    );

    assertReviewPublicationInvariant(
      result
    );
  }
);

test(
  'unpublish action clears all publication fields together',
  () => {
    const result =
      transitionReviewPublication(
        {
          slug: 'example-review',
          status: 'published',
          published: true,
          publishedAt:
            '2026-08-03T10:00:00.000Z'
        },
        'unpublish'
      );

    assert.equal(
      result.status,
      'approved'
    );

    assert.equal(
      result.published,
      false
    );

    assert.equal(
      result.publishedAt,
      ''
    );

    assertReviewPublicationInvariant(
      result
    );
  }
);

test(
  'publish action rejects reviews that are not approved',
  () => {
    assert.throws(
      () => {
        transitionReviewPublication(
          {
            slug: 'example-review',
            status: 'draft',
            published: false,
            publishedAt: ''
          },
          'publish',
          '2026-08-03T10:00:00.000Z'
        );
      },
      /cannot be published from status "draft"/
    );
  }
);

test(
  'publication invariant rejects independently enabled published flag',
  () => {
    assert.throws(
      () => {
        assertReviewPublicationInvariant({
          slug: 'example-review',
          status: 'approved',
          published: true,
          publishedAt:
            '2026-08-03T10:00:00.000Z'
        });
      },
      /must have status "published"/
    );
  }
);

test(
  'publication invariant rejects published status without publication flag',
  () => {
    assert.throws(
      () => {
        assertReviewPublicationInvariant({
          slug: 'example-review',
          status: 'published',
          published: false,
          publishedAt: ''
        });
      },
      /cannot have status "published"/
    );
  }
);

test(
  'main CMS keeps technical publication fields hidden',
  () => {
    const configPath = path.join(
      root,
      'public',
      'admin',
      'config.yml'
    );

    const config =
      fs.readFileSync(
        configPath,
        'utf8'
      );

    const collectionStart =
      config.indexOf(
        '  - name: "reviews"'
      );

    assert.notEqual(
      collectionStart,
      -1,
      'Reviews collection was not found.'
    );

    const reviewsCollection =
      config.slice(collectionStart);

    assert.match(
      reviewsCollection,
      /name:\s*"status"\s*\r?\n\s+widget:\s*"hidden"/
    );

    assert.match(
      reviewsCollection,
      /name:\s*"published"\s*\r?\n\s+widget:\s*"hidden"/
    );

    assert.match(
      reviewsCollection,
      /name:\s*"publishedAt"\s*\r?\n\s+widget:\s*"hidden"/
    );

    assert.doesNotMatch(
      reviewsCollection,
      /label:\s*"Published",\s*value:\s*"published"/
    );
  }
);

test(
  'package exposes safe publish and unpublish commands',
  () => {
    const packagePath = path.join(
      root,
      'package.json'
    );

    const packageJson =
      JSON.parse(
        fs.readFileSync(
          packagePath,
          'utf8'
        )
      );

    assert.equal(
      packageJson.scripts[
        'reviews:publish'
      ],
      'node scripts/set-review-publication.mjs publish'
    );

    assert.equal(
      packageJson.scripts[
        'reviews:unpublish'
      ],
      'node scripts/set-review-publication.mjs unpublish'
    );
  }
);