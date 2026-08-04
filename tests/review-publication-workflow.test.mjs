import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

    assert.match(
      reviewsCollection,
      /publish:\s*false/
    );

    assert.match(
      reviewsCollection,
      /delete:\s*false/
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

test(
  'main admin exposes Oya submissions as a safe internal inbox',
  () => {
    const mainConfig =
      fs.readFileSync(
        path.join(
          root,
          'public',
          'admin',
          'config.yml'
        ),
        'utf8'
      );

    const contributorConfig =
      fs.readFileSync(
        path.join(
          root,
          'public',
          'review-admin',
          'config.yml'
        ),
        'utf8'
      );

    function extractCollection(
      config,
      collectionName
    ) {
      const marker =
        `  - name: "${collectionName}"`;

      const start =
        config.indexOf(marker);

      assert.notEqual(
        start,
        -1,
        `Collection ${collectionName} was not found.`
      );

      const next =
        config.indexOf(
          '\n  - name: "',
          start + marker.length
        );

      return (
        next === -1
          ? config.slice(start)
          : config.slice(start, next)
      );
    }

    const mainInbox =
      extractCollection(
        mainConfig,
        'review_submissions'
      );

    const contributorInbox =
      extractCollection(
        contributorConfig,
        'review_submissions'
      );

    assert.equal(
      (
        mainConfig.match(
          /  - name: "review_submissions"/g
        ) || []
      ).length,
      1
    );

    assert.match(
      mainInbox,
      /label:\s*"Incoming review submissions"/
    );

    assert.match(
      mainInbox,
      /folder:\s*"content\/reviews\/submissions"/
    );

    assert.match(
      mainInbox,
      /create:\s*false/
    );

    assert.match(
      mainInbox,
      /publish:\s*true/
    );

    assert.match(
      mainInbox,
      /delete:\s*false/
    );

    assert.match(
      mainInbox,
      /filter:\s*\r?\n\s+field:\s*"status"\s*\r?\n\s+value:\s*"ready_for_adam_review"/
    );

    assert.match(
      mainInbox,
      /does not publish the review on the public website/
    );

    assert.match(
      contributorInbox,
      /create:\s*true/
    );

    assert.match(
      contributorInbox,
      /publish:\s*false/
    );

    assert.match(
      contributorInbox,
      /delete:\s*false/
    );

    const mainFields =
      mainInbox.slice(
        mainInbox.indexOf(
          '    fields:'
        )
      );

    const contributorFields =
      contributorInbox.slice(
        contributorInbox.indexOf(
          '    fields:'
        )
      );

    assert.equal(
      mainFields,
      contributorFields,
      'Adam and Oya must use the same submission data schema.'
    );
  }
);

test(
  'package exposes the review promotion command',
  () => {
    const packageJson =
      JSON.parse(
        fs.readFileSync(
          path.join(
            root,
            'package.json'
          ),
          'utf8'
        )
      );

    assert.equal(
      packageJson.scripts[
        'reviews:promote'
      ],
      'node scripts/promote-review-submission.mjs'
    );
  }
);

test(
  'promotion creates an internal review and archives the source submission',
  () => {
    const tempRoot =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'ajsee-review-promotion-'
        )
      );

    try {
      const submissionsDirectory =
        path.join(
          tempRoot,
          'content',
          'reviews',
          'submissions'
        );

      const itemsDirectory =
        path.join(
          tempRoot,
          'content',
          'reviews',
          'items'
        );

      fs.mkdirSync(
        submissionsDirectory,
        {
          recursive: true
        }
      );

      fs.mkdirSync(
        itemsDirectory,
        {
          recursive: true
        }
      );

      const submissionPath =
        path.join(
          submissionsDirectory,
          'sweeney-todd.json'
        );

      fs.writeFileSync(
        submissionPath,

        JSON.stringify(
          {
            slug:
              'sweeney-todd',

            contentType:
              'preview',

            eventDate:
              '2026-09-24T19:00:00+02:00',

            status:
              'ready_for_adam_review',

            showTitle:
              'Sweeney Todd',

            venue:
              'Prague State Opera',

            submittedAt:
              '2026-08-03T09:15:00Z',

            author:
              'Oya Canli',

            photos: {
              cover: '',
              coverAlt: '',
              gallery: []
            },

            english: {
              title:
                'Sweeney Todd: Musical Theatre\'s Darkest Barber',

              body:
                'Test review body.'
            }
          },
          null,
          2
        ) + '\n',

        'utf8'
      );

      const result =
        spawnSync(
          process.execPath,

          [
            path.join(
              root,
              'scripts',
              'promote-review-submission.mjs'
            ),

            'sweeney-todd',
            'sweeney-todd-prague-2026'
          ],

          {
            cwd:
              tempRoot,

            encoding:
              'utf8'
          }
        );

      assert.equal(
        result.status,
        0,
        result.stderr || result.stdout
      );

      const promotedSubmission =
        JSON.parse(
          fs.readFileSync(
            submissionPath,
            'utf8'
          )
        );

      const review =
        JSON.parse(
          fs.readFileSync(
            path.join(
              itemsDirectory,
              'sweeney-todd-prague-2026.json'
            ),
            'utf8'
          )
        );

      assert.equal(
        promotedSubmission.status,
        'promoted'
      );

      assert.equal(
        promotedSubmission.promotedReviewSlug,
        'sweeney-todd-prague-2026'
      );

      assert.ok(
        Number.isFinite(
          Date.parse(
            promotedSubmission.promotedAt
          )
        )
      );

      assert.equal(
        review.slug,
        'sweeney-todd-prague-2026'
      );

      assert.equal(
        review.status,
        'approved'
      );

      assert.equal(
        review.published,
        false
      );

      assert.equal(
        review.publishedAt,
        ''
      );

      assert.equal(
        review.contentType,
        'preview'
      );

      assert.equal(
        review.eventDate,
        '2026-09-24T19:00:00+02:00'
      );

      assert.match(
        review.internalNotes,
        /Promoted from review submission: sweeney-todd/
      );
    }
    finally {
      fs.rmSync(
        tempRoot,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'main CMS distinguishes reviews from theatre previews',
  () => {
    const config =
      fs.readFileSync(
        path.join(
          root,
          'public',
          'admin',
          'config.yml'
        ),
        'utf8'
      );

    const reviewsStart =
      config.indexOf(
        '  - name: "reviews"'
      );

    const submissionsStart =
      config.indexOf(
        '  - name: "review_submissions"',
        reviewsStart
      );

    assert.notEqual(
      reviewsStart,
      -1
    );

    const reviewsCollection =
      config.slice(
        reviewsStart,
        submissionsStart
      );

    assert.match(
      reviewsCollection,
      /name: "contentType"[\s\S]*value: "review"[\s\S]*value: "preview"/
    );

    assert.match(
      reviewsCollection,
      /name: "eventDate"/
    );

    assert.match(
      reviewsCollection,
      /Leave empty for theatre previews/
    );
  }
);
