import test from 'node:test';

import assert from 'node:assert/strict';

import {
  createArticleCommentsHandler,
  resolveCommentStoreName
} from '../netlify/functions/article-comments.js';

function createMemoryStore() {
  const values =
    new Map();

  const metadata =
    new Map();

  return {
    values,

    async get(
      key,
      options = {}
    ) {
      if (!values.has(key)) {
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
      if (!values.has(key)) {
        return null;
      }

      return {
        metadata:
          metadata.get(key) || {}
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

    async list({
      prefix = ''
    } = {}) {
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
            }))
      };
    }
  };
}

function createPostRequest(
  body,
  {
    hostname =
      'https://ajsee.cz',

    ip =
      '203.0.113.10'
  } = {}
) {
  return new Request(
    `${hostname}/api/article-comments`,
    {
      method:
        'POST',

      headers: {
        'content-type':
          'application/json',

        origin:
          hostname,

        'x-nf-client-connection-ip':
          ip,

        'user-agent':
          'AJSEE comments test',

        'accept-language':
          'cs'
      },

      body:
        JSON.stringify(body)
    }
  );
}

function createGetRequest(
  query,
  hostname =
    'https://ajsee.cz'
) {
  const url =
    new URL(
      '/api/article-comments',
      hostname
    );

  for (
    const [key, value] of
    Object.entries(query)
  ) {
    url.searchParams.set(
      key,
      value
    );
  }

  return new Request(
    url,
    {
      method:
        'GET'
    }
  );
}

function validCommentBody(
  now
) {
  return {
    postType:
      'review',

    postId:
      'jesus-christ-superstar-london-2026',

    lang:
      'cs',

    name:
      'Testovací čtenář',

    email:
      'reader@example.com',

    comment:
      'Výborná recenze.',

    company:
      '',

    startedAt:
      now - 5_000
  };
}

test(
  'new comment is stored as pending and is not public',
  async () => {
    const now =
      Date.UTC(
        2026,
        6,
        21,
        12,
        0,
        0
      );

    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store,

        nowFn:
          () => now,

        randomUUIDFn:
          () =>
            '11111111-1111-4111-8111-111111111111'
      });

    const postResponse =
      await handler(
        createPostRequest(
          validCommentBody(now)
        )
      );

    assert.equal(
      postResponse.status,
      202
    );

    assert.deepEqual(
      await postResponse.json(),
      {
        ok:
          true,

        id:
          '11111111-1111-4111-8111-111111111111',

        status:
          'pending'
      }
    );

    const pendingKey =
      [...store.values.keys()]
        .find((key) =>
          key.startsWith(
            'comments/pending/'
          )
        );

    assert.ok(
      pendingKey,
      'Pending comment must exist'
    );

    const getResponse =
      await handler(
        createGetRequest({
          postType:
            'review',

          postId:
            'jesus-christ-superstar-london-2026',

          lang:
            'cs'
        })
      );

    assert.equal(
      getResponse.status,
      200
    );

    assert.deepEqual(
      await getResponse.json(),
      {
        items: [],
        count: 0
      }
    );
  }
);

test(
  'approved comment is public without email address',
  async () => {
    const now =
      Date.UTC(
        2026,
        6,
        21,
        12,
        30,
        0
      );

    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store,

        nowFn:
          () => now,

        randomUUIDFn:
          () =>
            '22222222-2222-4222-8222-222222222222'
      });

    await handler(
      createPostRequest(
        validCommentBody(now)
      )
    );

    const pendingKey =
      [...store.values.keys()]
        .find((key) =>
          key.startsWith(
            'comments/pending/'
          )
        );

    const pending =
      structuredClone(
        store.values.get(
          pendingKey
        )
      );

    pending.status =
      'approved';

    pending.moderatedAt =
      new Date(
        now + 1_000
      ).toISOString();

    pending.moderatedBy =
      'admin@example.com';

    const approvedKey =
      pendingKey.replace(
        'comments/pending/',
        'comments/approved/'
      );

    await store.setJSON(
      approvedKey,
      pending
    );

    await store.delete(
      pendingKey
    );

    const response =
      await handler(
        createGetRequest({
          postType:
            'review',

          postId:
            'jesus-christ-superstar-london-2026',

          lang:
            'cs'
        })
      );

    const body =
      await response.json();

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.count,
      1
    );

    assert.equal(
      body.items[0].name,
      'Testovací čtenář'
    );

    assert.equal(
      body.items[0].comment,
      'Výborná recenze.'
    );

    assert.equal(
      Object.hasOwn(
        body.items[0],
        'email'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        body.items[0],
        'moderatedBy'
      ),
      false
    );
  }
);

test(
  'second submission in the same minute is rate limited',
  async () => {
    const now =
      Date.UTC(
        2026,
        6,
        21,
        13,
        0,
        0
      );

    const store =
      createMemoryStore();

    let uuidCounter = 0;

    const handler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store,

        nowFn:
          () => now,

        randomUUIDFn:
          () => {
            uuidCounter += 1;

            return (
              '33333333-3333-4333-8333-' +
              String(uuidCounter)
                .padStart(12, '0')
            );
          }
      });

    const first =
      await handler(
        createPostRequest(
          validCommentBody(now)
        )
      );

    const second =
      await handler(
        createPostRequest(
          {
            ...validCommentBody(now),

            comment:
              'Druhý komentář.'
          }
        )
      );

    assert.equal(
      first.status,
      202
    );

    assert.equal(
      second.status,
      429
    );

    assert.deepEqual(
      await second.json(),
      {
        error:
          'rate-limit-exceeded'
      }
    );
  }
);

test(
  'honeypot submission returns success but is not stored',
  async () => {
    const now =
      Date.UTC(
        2026,
        6,
        21,
        14,
        0,
        0
      );

    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store,

        nowFn:
          () => now
      });

    const response =
      await handler(
        createPostRequest({
          ...validCommentBody(now),

          company:
            'Spam company'
        })
      );

    assert.equal(
      response.status,
      202
    );

    const pendingKeys =
      [...store.values.keys()]
        .filter((key) =>
          key.startsWith(
            'comments/pending/'
          )
        );

    assert.equal(
      pendingKeys.length,
      0
    );
  }
);

test(
  'cross-origin submission is rejected',
  async () => {
    const now =
      Date.UTC(
        2026,
        6,
        21,
        15,
        0,
        0
      );

    const store =
      createMemoryStore();

    const handler =
      createArticleCommentsHandler({
        getStoreFn:
          () => store,

        nowFn:
          () => now
      });

    const request =
      createPostRequest(
        validCommentBody(now)
      );

    const hostileRequest =
      new Request(
        request.url,
        {
          method:
            'POST',

          headers: {
            'content-type':
              'application/json',

            origin:
              'https://example.com'
          },

          body:
            JSON.stringify(
              validCommentBody(now)
            )
        }
      );

    const response =
      await handler(
        hostileRequest
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
  }
);

test(
  'deploy preview uses isolated Blob store',
  () => {
    const request =
      new Request(
        'https://deploy-preview-42--ajsee.netlify.app/api/article-comments'
      );

    assert.equal(
      resolveCommentStoreName(
        request
      ),
      'article-comments-v1-preview-42'
    );
  }
);