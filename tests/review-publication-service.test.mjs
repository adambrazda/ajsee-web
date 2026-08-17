import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createReviewPublicationService
} from '../netlify/functions/review-publication-service.js';

const OWNER =
  'adambrazda';

const REPO =
  'ajsee-web';

const SLUG =
  'notre-dame-de-paris-poland-2027';

const REVIEW_PATH =
  `content/reviews/items/${SLUG}.json`;

const BASE_SHA =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const FILE_SHA =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const NOW =
  '2026-08-17T09:00:00.000Z';

function createReview(
  overrides = {}
) {
  return {
    slug:
      SLUG,

    status:
      'approved',

    published:
      false,

    publishedAt:
      '',

    contentType:
      'preview',

    showTitle:
      'Notre-Dame de Paris',

    author:
      'Oya Canli',

    ...overrides
  };
}

function serializeReview(
  review
) {
  return (
    JSON.stringify(
      review,
      null,
      2
    ) +
    '\n'
  );
}

function createGitHubClient({
  review =
    createReview(),

  openPullRequest =
    null,

  openPublicationPullRequest =
    null
} = {}) {
  const calls = [];

  return {
    calls,

    async getBranchHead(
      args
    ) {
      calls.push({
        method:
          'getBranchHead',
        args
      });

      return {
        sha:
          BASE_SHA
      };
    },

    async getFile(
      args
    ) {
      calls.push({
        method:
          'getFile',
        args
      });

      return {
        sha:
          FILE_SHA,

        content:
          serializeReview(
            review
          )
      };
    },

    async findOpenPullRequest(
      args
    ) {
      calls.push({
        method:
          'findOpenPullRequest',
        args
      });

      return openPullRequest;
    },

    async findOpenPullRequestByHeadPrefix(
      args
    ) {
      calls.push({
        method:
          'findOpenPullRequestByHeadPrefix',
        args
      });

      return openPublicationPullRequest;
    },

    async createBranch(
      args
    ) {
      calls.push({
        method:
          'createBranch',
        args
      });

      return {
        branch:
          args.branch,

        sha:
          args.sha
      };
    },

    async updateFile(
      args
    ) {
      calls.push({
        method:
          'updateFile',
        args
      });

      return {
        commitSha:
          'cccccccccccccccccccccccccccccccccccccccc'
      };
    },

    async createPullRequest(
      args
    ) {
      calls.push({
        method:
          'createPullRequest',
        args
      });

      return {
        number:
          157,

        url:
          'https://github.com/adambrazda/ajsee-web/pull/157'
      };
    }
  };
}

function createService(
  githubClient
) {
  return createReviewPublicationService({
    githubClient,

    repository: {
      owner:
        OWNER,

      repo:
        REPO
    },

    baseBranch:
      'main',

    nowFn:
      () =>
        NOW
  });
}

test(
  'publication status is read from the current main branch review',
  async () => {
    const githubClient =
      createGitHubClient();

    const service =
      createService(
        githubClient
      );

    const result =
      await service.getStatus({
        slug:
          SLUG
      });

    assert.equal(
      result.slug,
      SLUG
    );

    assert.equal(
      result.state,
      'approved'
    );

    assert.equal(
      result.published,
      false
    );

    assert.equal(
      result.canPrepare,
      true
    );

    assert.equal(
      result.publication,
      null
    );

    const fileCall =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'getFile'
      );

    assert.equal(
      fileCall.args.path,
      REVIEW_PATH
    );

    assert.equal(
      fileCall.args.ref,
      'main'
    );
  }
);

test(
  'approved review is prepared on an isolated branch with publication-only state change',
  async () => {
    const githubClient =
      createGitHubClient();

    const service =
      createService(
        githubClient
      );

    const result =
      await service.preparePublication({
        slug:
          SLUG,

        user: {
          id:
            'admin-user-id',

          email:
            'admin@ajsee.cz'
        }
      });

    assert.equal(
      result.slug,
      SLUG
    );

    assert.equal(
      result.state,
      'preparing'
    );

    assert.equal(
      result.pullRequest.number,
      157
    );

    const expectedBranch =
      `admin/publish-${SLUG}-${BASE_SHA.slice(0, 12)}`;

    assert.equal(
      result.branch,
      expectedBranch
    );

    const branchCall =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'createBranch'
      );

    assert.deepEqual(
      branchCall.args,
      {
        owner:
          OWNER,

        repo:
          REPO,

        branch:
          expectedBranch,

        sha:
          BASE_SHA
      }
    );

    const updateCall =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'updateFile'
      );

    assert.equal(
      updateCall.args.path,
      REVIEW_PATH
    );

    assert.equal(
      updateCall.args.branch,
      expectedBranch
    );

    assert.equal(
      updateCall.args.sha,
      FILE_SHA
    );

    const updatedReview =
      JSON.parse(
        updateCall.args.content
      );

    assert.equal(
      updatedReview.status,
      'published'
    );

    assert.equal(
      updatedReview.published,
      true
    );

    assert.equal(
      updatedReview.publishedAt,
      NOW
    );

    assert.equal(
      updatedReview.showTitle,
      'Notre-Dame de Paris'
    );

    assert.equal(
      updatedReview.author,
      'Oya Canli'
    );

    const pullRequestCall =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'createPullRequest'
      );

    assert.equal(
      pullRequestCall.args.base,
      'main'
    );

    assert.equal(
      pullRequestCall.args.head,
      expectedBranch
    );
  }
);

test(
  'draft review cannot be prepared for publication',
  async () => {
    const githubClient =
      createGitHubClient({
        review:
          createReview({
            status:
              'draft'
          })
      });

    const service =
      createService(
        githubClient
      );

    await assert.rejects(
      () =>
        service.preparePublication({
          slug:
            SLUG,

          user: {
            email:
              'admin@ajsee.cz'
          }
        }),

      (error) => {
        assert.equal(
          error.status,
          409
        );

        assert.equal(
          error.code,
          'review-not-approved'
        );

        return true;
      }
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createBranch'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'updateFile'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createPullRequest'
      ),
      false
    );
  }
);

test(
  'already published review does not create another publication pull request',
  async () => {
    const githubClient =
      createGitHubClient({
        review:
          createReview({
            status:
              'published',

            published:
              true,

            publishedAt:
              '2026-08-17T07:25:35.119Z'
          })
      });

    const service =
      createService(
        githubClient
      );

    await assert.rejects(
      () =>
        service.preparePublication({
          slug:
            SLUG,

          user: {
            email:
              'admin@ajsee.cz'
          }
        }),

      (error) => {
        assert.equal(
          error.status,
          409
        );

        assert.equal(
          error.code,
          'review-already-published'
        );

        return true;
      }
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createBranch'
      ),
      false
    );
  }
);

test(
  'existing open publication pull request is reused instead of duplicated',
  async () => {
    const existingPullRequest = {
      number:
        157,

      url:
        'https://github.com/adambrazda/ajsee-web/pull/157'
    };

    const githubClient =
      createGitHubClient({
        openPullRequest:
          existingPullRequest
      });

    const service =
      createService(
        githubClient
      );

    const result =
      await service.preparePublication({
        slug:
          SLUG,

        user: {
          email:
            'admin@ajsee.cz'
        }
      });

    assert.equal(
      result.state,
      'preparing'
    );

    assert.equal(
      result.pullRequest.number,
      157
    );

    assert.equal(
      result.existing,
      true
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createBranch'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'updateFile'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createPullRequest'
      ),
      false
    );
  }
);

test(
  'review file slug mismatch blocks every GitHub write',
  async () => {
    const githubClient =
      createGitHubClient({
        review:
          createReview({
            slug:
              'different-review'
          })
      });

    const service =
      createService(
        githubClient
      );

    await assert.rejects(
      () =>
        service.preparePublication({
          slug:
            SLUG,

          user: {
            email:
              'admin@ajsee.cz'
          }
        }),

      (error) => {
        assert.equal(
          error.status,
          409
        );

        assert.equal(
          error.code,
          'review-data-mismatch'
        );

        return true;
      }
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createBranch'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'updateFile'
      ),
      false
    );
  }
);

test(
  'publication preparation reads the review from the exact main head snapshot',
  async () => {
    const githubClient =
      createGitHubClient();

    const service =
      createService(
        githubClient
      );

    await service.preparePublication({
      slug:
        SLUG,

      user: {
        email:
          'admin@ajsee.cz'
      }
    });

    const fileCall =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'getFile'
      );

    assert.equal(
      fileCall.args.ref,
      BASE_SHA
    );
  }
);


test(
  'existing open publication pull request is reused after main advances',
  async () => {
    const existingPullRequest = {
      number:
        158,

      url:
        'https://github.com/adambrazda/ajsee-web/pull/158'
    };

    const githubClient =
      createGitHubClient({
        openPublicationPullRequest:
          existingPullRequest
      });

    const service =
      createService(
        githubClient
      );

    const result =
      await service.preparePublication({
        slug:
          SLUG,

        user: {
          email:
            'admin@ajsee.cz'
        }
      });

    assert.equal(
      result.state,
      'preparing'
    );

    assert.equal(
      result.pullRequest.number,
      158
    );

    assert.equal(
      result.existing,
      true
    );

    const prefixLookup =
      githubClient.calls.find(
        (call) =>
          call.method ===
          'findOpenPullRequestByHeadPrefix'
      );

    assert.ok(
      prefixLookup
    );

    assert.equal(
      prefixLookup.args.base,
      'main'
    );

    assert.equal(
      prefixLookup.args.headPrefix,
      `admin/publish-${SLUG}-`
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createBranch'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'updateFile'
      ),
      false
    );

    assert.equal(
      githubClient.calls.some(
        (call) =>
          call.method ===
          'createPullRequest'
      ),
      false
    );
  }
);
