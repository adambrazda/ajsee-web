import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createReviewPublicationGitHubClient
} from '../netlify/functions/review-publication-github.js';

const TOKEN =
  'test-token';

const OWNER =
  'adambrazda';

const REPO =
  'ajsee-web';

function jsonResponse(
  body,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'content-type':
          'application/json'
      }
    }
  );
}

function createFetchMock(
  handler
) {
  const calls = [];

  const fetchFn =
    async (
      input,
      init = {}
    ) => {
      const call = {
        url:
          String(input),
        init
      };

      calls.push(call);

      return handler(
        call,
        calls.length
      );
    };

  return {
    fetchFn,
    calls
  };
}

test(
  'getBranchHead reads the exact branch ref',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse({
            ref:
              'refs/heads/main',

            object: {
              sha:
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            }
          })
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const result =
      await client.getBranchHead({
        owner:
          OWNER,
        repo:
          REPO,
        branch:
          'main'
      });

    assert.equal(
      result.sha,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );

    assert.equal(
      calls.length,
      1
    );

    assert.match(
      calls[0].url,
      /\/repos\/adambrazda\/ajsee-web\/git\/ref\/heads\/main$/
    );

    assert.equal(
      calls[0].init.method,
      'GET'
    );

    assert.equal(
      calls[0].init.headers.Authorization,
      `Bearer ${TOKEN}`
    );
  }
);

test(
  'getFile reads review content from the requested snapshot ref',
  async () => {
    const source =
      JSON.stringify(
        {
          slug:
            'notre-dame-de-paris-poland-2027'
        },
        null,
        2
      ) + '\n';

    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse({
            type:
              'file',

            encoding:
              'base64',

            sha:
              'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',

            content:
              Buffer
                .from(
                  source,
                  'utf8'
                )
                .toString(
                  'base64'
                )
          })
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const result =
      await client.getFile({
        owner:
          OWNER,
        repo:
          REPO,
        path:
          'content/reviews/items/notre-dame-de-paris-poland-2027.json',
        ref:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      });

    assert.equal(
      result.sha,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );

    assert.equal(
      result.content,
      source
    );

    const url =
      new URL(
        calls[0].url
      );

    assert.equal(
      url.searchParams.get(
        'ref'
      ),
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
  }
);

test(
  'findOpenPullRequest filters by exact base and owner branch',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse([
            {
              number:
                157,

              html_url:
                'https://github.com/adambrazda/ajsee-web/pull/157'
            }
          ])
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const result =
      await client.findOpenPullRequest({
        owner:
          OWNER,
        repo:
          REPO,
        base:
          'main',
        head:
          'admin/publish-notre-dame-de-paris-poland-2027-aaaaaaaaaaaa'
      });

    assert.deepEqual(
      result,
      {
        number:
          157,

        url:
          'https://github.com/adambrazda/ajsee-web/pull/157'
      }
    );

    const url =
      new URL(
        calls[0].url
      );

    assert.equal(
      url.searchParams.get(
        'state'
      ),
      'open'
    );

    assert.equal(
      url.searchParams.get(
        'base'
      ),
      'main'
    );

    assert.equal(
      url.searchParams.get(
        'head'
      ),
      'adambrazda:admin/publish-notre-dame-de-paris-poland-2027-aaaaaaaaaaaa'
    );
  }
);

test(
  'createBranch creates an isolated Git reference',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse(
            {
              ref:
                'refs/heads/admin/publish-example-aaaaaaaaaaaa',

              object: {
                sha:
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
              }
            },
            201
          )
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    await client.createBranch({
      owner:
        OWNER,
      repo:
        REPO,
      branch:
        'admin/publish-example-aaaaaaaaaaaa',
      sha:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });

    assert.equal(
      calls[0].init.method,
      'POST'
    );

    assert.match(
      calls[0].url,
      /\/repos\/adambrazda\/ajsee-web\/git\/refs$/
    );

    const body =
      JSON.parse(
        calls[0].init.body
      );

    assert.deepEqual(
      body,
      {
        ref:
          'refs/heads/admin/publish-example-aaaaaaaaaaaa',

        sha:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }
    );
  }
);

test(
  'updateFile sends UTF-8 content as base64 to the isolated branch',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse({
            commit: {
              sha:
                'cccccccccccccccccccccccccccccccccccccccc'
            }
          })
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const source =
      '{\n  "status": "published"\n}\n';

    const result =
      await client.updateFile({
        owner:
          OWNER,
        repo:
          REPO,
        path:
          'content/reviews/items/example.json',
        branch:
          'admin/publish-example-aaaaaaaaaaaa',
        sha:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        content:
          source,
        message:
          'content: publish Example'
      });

    assert.equal(
      result.commitSha,
      'cccccccccccccccccccccccccccccccccccccccc'
    );

    assert.equal(
      calls[0].init.method,
      'PUT'
    );

    const body =
      JSON.parse(
        calls[0].init.body
      );

    assert.equal(
      body.branch,
      'admin/publish-example-aaaaaaaaaaaa'
    );

    assert.equal(
      body.sha,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );

    assert.equal(
      Buffer
        .from(
          body.content,
          'base64'
        )
        .toString(
          'utf8'
        ),
      source
    );
  }
);

test(
  'createPullRequest returns normalized PR data',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse(
            {
              number:
                157,

              html_url:
                'https://github.com/adambrazda/ajsee-web/pull/157'
            },
            201
          )
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const result =
      await client.createPullRequest({
        owner:
          OWNER,
        repo:
          REPO,
        title:
          'Publish Example preview',
        body:
          'Test body',
        base:
          'main',
        head:
          'admin/publish-example-aaaaaaaaaaaa'
      });

    assert.deepEqual(
      result,
      {
        number:
          157,

        url:
          'https://github.com/adambrazda/ajsee-web/pull/157'
      }
    );

    assert.equal(
      calls[0].init.method,
      'POST'
    );

    const requestBody =
      JSON.parse(
        calls[0].init.body
      );

    assert.equal(
      requestBody.base,
      'main'
    );

    assert.equal(
      requestBody.head,
      'admin/publish-example-aaaaaaaaaaaa'
    );
  }
);

test(
  'GitHub API errors fail closed without exposing the token',
  async () => {
    const {
      fetchFn
    } =
      createFetchMock(
        () =>
          jsonResponse(
            {
              message:
                'Bad credentials'
            },
            401
          )
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    await assert.rejects(
      () =>
        client.getBranchHead({
          owner:
            OWNER,
          repo:
            REPO,
          branch:
            'main'
        }),

      (error) => {
        assert.equal(
          error.status,
          502
        );

        assert.equal(
          error.code,
          'github-api-error'
        );

        assert.equal(
          String(
            error.message
          ).includes(
            TOKEN
          ),
          false
        );

        return true;
      }
    );
  }
);


test(
  'findOpenPullRequestByHeadPrefix finds an older publication branch in the same repository',
  async () => {
    const {
      fetchFn,
      calls
    } =
      createFetchMock(
        () =>
          jsonResponse([
            {
              number:
                156,

              html_url:
                'https://github.com/adambrazda/ajsee-web/pull/156',

              head: {
                ref:
                  'feature/unrelated-change',

                repo: {
                  full_name:
                    'adambrazda/ajsee-web'
                }
              }
            },
            {
              number:
                999,

              html_url:
                'https://github.com/someone/ajsee-web/pull/999',

              head: {
                ref:
                  'admin/publish-notre-dame-de-paris-poland-2027-oldmainsha',

                repo: {
                  full_name:
                    'someone/ajsee-web'
                }
              }
            },
            {
              number:
                158,

              html_url:
                'https://github.com/adambrazda/ajsee-web/pull/158',

              head: {
                ref:
                  'admin/publish-notre-dame-de-paris-poland-2027-previousmainsha',

                repo: {
                  full_name:
                    'adambrazda/ajsee-web'
                }
              }
            }
          ])
      );

    const client =
      createReviewPublicationGitHubClient({
        token:
          TOKEN,
        fetchFn
      });

    const result =
      await client
        .findOpenPullRequestByHeadPrefix({
          owner:
            OWNER,
          repo:
            REPO,
          base:
            'main',

          headPrefix:
            'admin/publish-notre-dame-de-paris-poland-2027-'
        });

    assert.deepEqual(
      result,
      {
        number:
          158,

        url:
          'https://github.com/adambrazda/ajsee-web/pull/158',

        head:
          'admin/publish-notre-dame-de-paris-poland-2027-previousmainsha'
      }
    );

    assert.equal(
      calls.length,
      1
    );

    const url =
      new URL(
        calls[0].url
      );

    assert.equal(
      url.searchParams.get(
        'state'
      ),
      'open'
    );

    assert.equal(
      url.searchParams.get(
        'base'
      ),
      'main'
    );

    assert.equal(
      url.searchParams.get(
        'head'
      ),
      null
    );

    assert.equal(
      url.searchParams.get(
        'per_page'
      ),
      '100'
    );
  }
);
