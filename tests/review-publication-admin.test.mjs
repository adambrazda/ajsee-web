import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createReviewPublicationAdminHandler
} from '../netlify/functions/review-publication-admin.js';

function adminUser() {
  return {
    id: 'admin-user-id',
    email: 'admin@ajsee.cz',
    roles: ['admin']
  };
}

function createGetRequest(
  slug = 'notre-dame-de-paris-poland-2027'
) {
  const url = new URL(
    'https://ajsee.cz/api/review-publication-admin'
  );

  url.searchParams.set(
    'slug',
    slug
  );

  return new Request(url, {
    method: 'GET'
  });
}

function createPostRequest(
  body,
  origin = 'https://ajsee.cz'
) {
  return new Request(
    'https://ajsee.cz/api/review-publication-admin',
    {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
        origin
      },

      body: JSON.stringify(body)
    }
  );
}

function createPublicationService() {
  const calls = [];

  return {
    calls,

    async getStatus({
      slug
    }) {
      calls.push({
        method: 'getStatus',
        slug
      });

      return {
        slug,
        state: 'approved',
        published: false,
        canPrepare: true,
        publication: null
      };
    },

    async preparePublication({
      slug,
      user
    }) {
      calls.push({
        method: 'preparePublication',
        slug,
        user
      });

      return {
        slug,
        state: 'preparing',
        branch:
          'admin/publish-notre-dame-de-paris-poland-2027-abcdef1',

        pullRequest: {
          number: 157,
          url:
            'https://github.com/adambrazda/ajsee-web/pull/157'
        }
      };
    }
  };
}

test(
  'unauthenticated publication-admin request is rejected',
  async () => {
    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () => null,

        publicationService:
          createPublicationService()
      });

    const response =
      await handler(
        createGetRequest()
      );

    assert.equal(
      response.status,
      401
    );

    assert.deepEqual(
      await response.json(),
      {
        error: 'unauthorized'
      }
    );
  }
);

test(
  'authenticated user without admin role is forbidden',
  async () => {
    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () => ({
            id: 'editor-user-id',
            email: 'editor@ajsee.cz',
            roles: ['editor']
          }),

        publicationService:
          createPublicationService()
      });

    const response =
      await handler(
        createGetRequest()
      );

    assert.equal(
      response.status,
      403
    );

    assert.deepEqual(
      await response.json(),
      {
        error: 'forbidden'
      }
    );
  }
);

test(
  'state-changing publication request with invalid origin is rejected',
  async () => {
    const service =
      createPublicationService();

    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () =>
            adminUser(),

        verifyRequestOriginFn:
          () => {
            throw new Error(
              'Origin mismatch'
            );
          },

        publicationService:
          service
      });

    const response =
      await handler(
        createPostRequest(
          {
            action: 'prepare',
            slug:
              'notre-dame-de-paris-poland-2027'
          },
          'https://example.com'
        )
      );

    assert.equal(
      response.status,
      403
    );

    assert.deepEqual(
      await response.json(),
      {
        error: 'invalid-origin'
      }
    );

    assert.equal(
      service.calls.length,
      0
    );
  }
);

test(
  'invalid review slug is rejected before publication service is called',
  async () => {
    const service =
      createPublicationService();

    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () =>
            adminUser(),

        verifyRequestOriginFn:
          () => undefined,

        publicationService:
          service
      });

    const response =
      await handler(
        createPostRequest({
          action: 'prepare',
          slug: '../main'
        })
      );

    assert.equal(
      response.status,
      422
    );

    assert.deepEqual(
      await response.json(),
      {
        error: 'invalid-review-slug'
      }
    );

    assert.equal(
      service.calls.length,
      0
    );
  }
);

test(
  'admin can read publication state',
  async () => {
    const service =
      createPublicationService();

    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () =>
            adminUser(),

        publicationService:
          service
      });

    const response =
      await handler(
        createGetRequest()
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.slug,
      'notre-dame-de-paris-poland-2027'
    );

    assert.equal(
      body.state,
      'approved'
    );

    assert.equal(
      body.canPrepare,
      true
    );

    assert.equal(
      service.calls.length,
      1
    );
  }
);

test(
  'admin can request safe publication preparation',
  async () => {
    const service =
      createPublicationService();

    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () =>
            adminUser(),

        verifyRequestOriginFn:
          () => undefined,

        publicationService:
          service
      });

    const response =
      await handler(
        createPostRequest({
          action: 'prepare',
          slug:
            'notre-dame-de-paris-poland-2027'
        })
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      201
    );

    assert.equal(
      body.slug,
      'notre-dame-de-paris-poland-2027'
    );

    assert.equal(
      body.state,
      'preparing'
    );

    assert.equal(
      body.pullRequest.number,
      157
    );

    assert.equal(
      service.calls.length,
      1
    );

    assert.equal(
      service.calls[0].method,
      'preparePublication'
    );

    assert.equal(
      service.calls[0].user.email,
      'admin@ajsee.cz'
    );
  }
);

test(
  'default publication runtime uses server-side GitHub token without exposing it',
  async () => {
    const token =
      'server-only-test-token';

    const review = {
      slug:
        'notre-dame-de-paris-poland-2027',

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
        'Oya Canli'
    };

    const fetchCalls = [];

    const fetchFn =
      async (
        input,
        init = {}
      ) => {
        fetchCalls.push({
          url:
            String(input),

          init
        });

        return new Response(
          JSON.stringify({
            type:
              'file',

            encoding:
              'base64',

            sha:
              'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',

            content:
              Buffer
                .from(
                  JSON.stringify(
                    review,
                    null,
                    2
                  ) + '\n',
                  'utf8'
                )
                .toString(
                  'base64'
                )
          }),
          {
            status:
              200,

            headers: {
              'content-type':
                'application/json'
            }
          }
        );
      };

    const handler =
      createReviewPublicationAdminHandler({
        getUserFn:
          async () =>
            adminUser(),

        env: {
          AJSEE_GITHUB_TOKEN:
            token
        },

        fetchFn
      });

    const response =
      await handler(
        createGetRequest()
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.slug,
      'notre-dame-de-paris-poland-2027'
    );

    assert.equal(
      body.state,
      'approved'
    );

    assert.equal(
      body.canPrepare,
      true
    );

    assert.equal(
      fetchCalls.length,
      1
    );

    assert.equal(
      fetchCalls[0].init.headers.Authorization,
      `Bearer ${token}`
    );

    assert.equal(
      JSON.stringify(body).includes(
        token
      ),
      false
    );
  }
);
