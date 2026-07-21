import test from 'node:test';

import assert from 'node:assert/strict';

import {
  createArticleCommentsAdminHandler
} from '../netlify/functions/article-comments-admin.js';

import {
  createArticleCommentsHandler
} from '../netlify/functions/article-comments.js';

function createMemoryStore() {
  const values =
    new Map();

  const metadata =
    new Map();

  function buildPage(
    prefix = ''
  ) {
    return {
      blobs:
        [...values.keys()]
          .filter((key) =>
            key.startsWith(
              prefix
            )
          )
          .sort()
          .map((key) => ({
            key
          })),

      directories:
        []
    };
  }

  return {
    values,

    async get(
      key,
      options = {}
    ) {
      if (
        !values.has(key)
      ) {
        return null;
      }

      const value =
        structuredClone(
          values.get(key)
        );

      if (
        options.type === 'json'
      ) {
        return value;
      }

      return JSON.stringify(
        value
      );
    },

    async getMetadata(
      key
    ) {
      if (
        !values.has(key)
      ) {
        return null;
      }

      return {
        metadata:
          structuredClone(
            metadata.get(key) || {}
          )
      };
    },

    async setJSON(
      key,
      value,
      options = {}
    ) {
      if (
        options.onlyIfNew &&
        values.has(key)
      ) {
        return {
          modified:
            false
        };
      }

      values.set(
        key,
        structuredClone(value)
      );

      metadata.set(
        key,
        structuredClone(
          options.metadata || {}
        )
      );

      return {
        modified:
          true
      };
    },

    async delete(
      key
    ) {
      values.delete(key);
      metadata.delete(key);
    },

    list(
      options = {}
    ) {
      const page =
        buildPage(
          options.prefix || ''
        );

      if (
        options.paginate
      ) {
        return {
          async *[
            Symbol.asyncIterator
          ]() {
            yield page;
          }
        };
      }

      return Promise.resolve(
        page
      );
    }
  };
}

function createPendingComment(
  overrides = {}
) {
  return {
    id:
      '11111111-1111-4111-8111-111111111111',

    status:
      'pending',

    postType:
      'review',

    postId:
      'jesus-christ-superstar-london-2026',

    language:
      'cs',

    name:
      'Testovací čtenář',

    email:
      'reader@example.com',

    comment:
      'Výborná recenze.',

    createdAt:
      '2026-07-21T12:00:00.000Z',

    moderatedAt:
      null,

    moderatedBy:
      null,

    ...overrides
  };
}

function buildPendingKey(
  comment
) {
  const timestamp =
    comment.createdAt
      .replace(/\D/g, '');

  return [
    'comments',
    'pending',
    comment.postType,
    comment.postId,
    comment.language,
    `${timestamp}-${comment.id}`
  ].join('/');
}

async function seedPendingComment(
  store,
  overrides = {}
) {
  const comment =
    createPendingComment(
      overrides
    );

  const key =
    buildPendingKey(
      comment
    );

  await store.setJSON(
    key,
    comment,
    {
      metadata: {
        type:
          'article-comment',

        status:
          'pending'
      }
    }
  );

  return {
    key,
    comment
  };
}

function createAdminGetRequest(
  status =
    'pending'
) {
  const url =
    new URL(
      'https://ajsee.cz/api/article-comments-admin'
    );

  url.searchParams.set(
    'status',
    status
  );

  return new Request(
    url,
    {
      method:
        'GET'
    }
  );
}

function createAdminPostRequest(
  body,
  origin =
    'https://ajsee.cz'
) {
  return new Request(
    'https://ajsee.cz/api/article-comments-admin',
    {
      method:
        'POST',

      headers: {
        'content-type':
          'application/json',

        origin
      },

      body:
        JSON.stringify(body)
    }
  );
}

function adminUser() {
  return {
    id:
      'admin-user-id',

    email:
      'admin@ajsee.cz',

    roles:
      [
        'admin'
      ]
  };
}

function createSuccessfulHandler(
  store,
  now =
    Date.UTC(
      2026,
      6,
      21,
      14,
      0,
      0
    )
) {
  return createArticleCommentsAdminHandler({
    getStoreFn:
      () => store,

    getUserFn:
      async () =>
        adminUser(),

    verifyRequestOriginFn:
      () => undefined,

    nowFn:
      () => now
  });
}

test(
  'unauthenticated request is rejected',
  async () => {
    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsAdminHandler({
        getStoreFn:
          () => store,

        getUserFn:
          async () =>
            null
      });

    const response =
      await handler(
        createAdminGetRequest()
      );

    assert.equal(
      response.status,
      401
    );

    assert.deepEqual(
      await response.json(),
      {
        error:
          'unauthorized'
      }
    );
  }
);

test(
  'authenticated user without admin role is forbidden',
  async () => {
    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsAdminHandler({
        getStoreFn:
          () => store,

        getUserFn:
          async () => ({
            id:
              'editor-user',

            email:
              'editor@ajsee.cz',

            roles:
              [
                'editor'
              ]
          })
      });

    const response =
      await handler(
        createAdminGetRequest()
      );

    assert.equal(
      response.status,
      403
    );

    assert.deepEqual(
      await response.json(),
      {
        error:
          'forbidden'
      }
    );
  }
);

test(
  'admin can list pending comments including private email',
  async () => {
    const store =
      createMemoryStore();

    await seedPendingComment(
      store
    );

    const handler =
      createSuccessfulHandler(
        store
      );

    const response =
      await handler(
        createAdminGetRequest()
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.status,
      'pending'
    );

    assert.equal(
      body.count,
      1
    );

    assert.equal(
      body.items[0].email,
      'reader@example.com'
    );

    assert.equal(
      body.items[0].status,
      'pending'
    );

    assert.equal(
      body.user.email,
      'admin@ajsee.cz'
    );
  }
);

test(
  'admin approval moves comment to approved and makes it public',
  async () => {
    const store =
      createMemoryStore();

    const {
      key
    } =
      await seedPendingComment(
        store
      );

    const adminHandler =
      createSuccessfulHandler(
        store
      );

    const response =
      await adminHandler(
        createAdminPostRequest({
          key,
          action:
            'approve'
        })
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.ok,
      true
    );

    assert.equal(
      body.comment.status,
      'approved'
    );

    assert.equal(
      body.comment.moderatedBy,
      'admin@ajsee.cz'
    );

    assert.equal(
      store.values.has(key),
      false
    );

    const approvedKey =
      key.replace(
        'comments/pending/',
        'comments/approved/'
      );

    assert.equal(
      store.values.has(
        approvedKey
      ),
      true
    );

    const publicHandler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store
      });

    const publicUrl =
      new URL(
        'https://ajsee.cz/api/article-comments'
      );

    publicUrl.searchParams.set(
      'postType',
      'review'
    );

    publicUrl.searchParams.set(
      'postId',
      'jesus-christ-superstar-london-2026'
    );

    publicUrl.searchParams.set(
      'lang',
      'cs'
    );

    const publicResponse =
      await publicHandler(
        new Request(
          publicUrl
        )
      );

    const publicBody =
      await publicResponse.json();

    assert.equal(
      publicResponse.status,
      200
    );

    assert.equal(
      publicBody.count,
      1
    );

    assert.equal(
      publicBody.items[0].comment,
      'Výborná recenze.'
    );

    assert.equal(
      Object.hasOwn(
        publicBody.items[0],
        'email'
      ),
      false
    );
  }
);

test(
  'admin rejection moves comment to rejected and keeps it private',
  async () => {
    const store =
      createMemoryStore();

    const {
      key
    } =
      await seedPendingComment(
        store
      );

    const adminHandler =
      createSuccessfulHandler(
        store
      );

    const response =
      await adminHandler(
        createAdminPostRequest({
          key,
          action:
            'reject'
        })
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.comment.status,
      'rejected'
    );

    const rejectedKey =
      key.replace(
        'comments/pending/',
        'comments/rejected/'
      );

    assert.equal(
      store.values.has(
        rejectedKey
      ),
      true
    );

    const publicHandler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store
      });

    const publicUrl =
      new URL(
        'https://ajsee.cz/api/article-comments'
      );

    publicUrl.searchParams.set(
      'postType',
      'review'
    );

    publicUrl.searchParams.set(
      'postId',
      'jesus-christ-superstar-london-2026'
    );

    publicUrl.searchParams.set(
      'lang',
      'cs'
    );

    const publicResponse =
      await publicHandler(
        new Request(
          publicUrl
        )
      );

    const publicBody =
      await publicResponse.json();

    assert.equal(
      publicBody.count,
      0
    );
  }
);

test(
  'state-changing request with invalid origin is rejected',
  async () => {
    const store =
      createMemoryStore();

    const {
      key
    } =
      await seedPendingComment(
        store
      );

    const handler =
      createArticleCommentsAdminHandler({
        getStoreFn:
          () => store,

        getUserFn:
          async () =>
            adminUser(),

        verifyRequestOriginFn:
          () => {
            throw new Error(
              'Origin mismatch'
            );
          }
      });

    const response =
      await handler(
        createAdminPostRequest(
          {
            key,
            action:
              'approve'
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
        error:
          'invalid-origin'
      }
    );

    assert.equal(
      store.values.has(key),
      true
    );
  }
);