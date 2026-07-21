import {
  getStore
} from '@netlify/blobs';

import {
  getUser,
  verifyRequestOrigin
} from '@netlify/identity';

import {
  resolveCommentStoreName
} from './article-comments.js';

const MAX_BODY_BYTES =
  8 * 1024;

const DEFAULT_LIMIT =
  100;

const MAX_LIMIT =
  250;

const COMMENT_STATUSES =
  new Set([
    'pending',
    'approved',
    'rejected'
  ]);

const MODERATION_ACTIONS =
  new Map([
    [
      'approve',
      'approved'
    ],
    [
      'reject',
      'rejected'
    ]
  ]);

const RESPONSE_HEADERS = {
  'Content-Type':
    'application/json; charset=utf-8',

  'Cache-Control':
    'no-store',

  'X-Content-Type-Options':
    'nosniff'
};

function createHttpError(
  status,
  code
) {
  const error =
    new Error(code);

  error.status =
    status;

  error.code =
    code;

  return error;
}

function jsonResponse(
  body,
  {
    status = 200,
    headers = {}
  } = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...RESPONSE_HEADERS,
        ...headers
      }
    }
  );
}

function emptyResponse(
  status,
  headers = {}
) {
  return new Response(
    null,
    {
      status,

      headers: {
        ...RESPONSE_HEADERS,
        ...headers
      }
    }
  );
}

function normalizeStatus(
  value
) {
  const status =
    String(
      value || 'pending'
    )
      .trim()
      .toLowerCase();

  if (
    !COMMENT_STATUSES.has(status)
  ) {
    throw createHttpError(
      400,
      'invalid-comment-status'
    );
  }

  return status;
}

function normalizeLimit(
  value
) {
  const parsed =
    Number.parseInt(
      String(value || ''),
      10
    );

  if (
    !Number.isFinite(parsed)
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(1, parsed)
  );
}

function normalizeAction(
  value
) {
  const action =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    !MODERATION_ACTIONS.has(action)
  ) {
    throw createHttpError(
      422,
      'invalid-moderation-action'
    );
  }

  return action;
}

function parsePendingCommentKey(
  value
) {
  const key =
    String(value || '')
      .trim();

  if (
    key.length < 1 ||
    key.length > 600
  ) {
    throw createHttpError(
      422,
      'invalid-comment-key'
    );
  }

  const match =
    key.match(
      /^comments\/pending\/(blog|review|microguide)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(cs|en|de|sk|pl|hu)\/(\d{14,20})-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
    );

  if (!match) {
    throw createHttpError(
      422,
      'invalid-comment-key'
    );
  }

  return {
    key,

    postType:
      match[1].toLowerCase(),

    postId:
      match[2].toLowerCase(),

    language:
      match[3].toLowerCase(),

    id:
      match[5].toLowerCase()
  };
}

function buildDestinationKey(
  sourceKey,
  destinationStatus
) {
  return sourceKey.replace(
    /^comments\/pending\//,
    `comments/${destinationStatus}/`
  );
}

async function readJsonBody(
  request
) {
  const contentLength =
    Number.parseInt(
      request.headers.get(
        'content-length'
      ) || '0',
      10
    );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    throw createHttpError(
      413,
      'request-body-too-large'
    );
  }

  const raw =
    await request.text();

  if (
    Buffer.byteLength(
      raw,
      'utf8'
    ) > MAX_BODY_BYTES
  ) {
    throw createHttpError(
      413,
      'request-body-too-large'
    );
  }

  try {
    const parsed =
      JSON.parse(raw || '{}');

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        'Expected object'
      );
    }

    return parsed;
  } catch {
    throw createHttpError(
      400,
      'invalid-json'
    );
  }
}

async function requireAdmin(
  getUserFn
) {
  const user =
    await getUserFn();

  if (!user) {
    throw createHttpError(
      401,
      'unauthorized'
    );
  }

  const roles =
    Array.isArray(user.roles)
      ? user.roles
          .map((role) =>
            String(role)
              .trim()
              .toLowerCase()
          )
      : [];

  if (
    !roles.includes('admin')
  ) {
    throw createHttpError(
      403,
      'forbidden'
    );
  }

  return user;
}

function assertRequestOrigin(
  request,
  verifyRequestOriginFn
) {
  try {
    verifyRequestOriginFn(
      request
    );
  } catch {
    throw createHttpError(
      403,
      'invalid-origin'
    );
  }
}

async function listBlobKeys(
  store,
  prefix
) {
  const keys = [];

  const pages =
    store.list({
      prefix,
      directories:
        false,
      paginate:
        true
    });

  for await (
    const page of pages
  ) {
    for (
      const entry of
      page?.blobs || []
    ) {
      if (entry?.key) {
        keys.push(
          entry.key
        );
      }
    }
  }

  return keys;
}

function isValidStoredComment(
  comment,
  key,
  expectedStatus
) {
  if (
    !comment ||
    typeof comment !== 'object'
  ) {
    return false;
  }

  if (
    comment.status !==
    expectedStatus
  ) {
    return false;
  }

  const expectedPrefix = [
    'comments',
    expectedStatus,
    comment.postType,
    comment.postId,
    comment.language,
    ''
  ].join('/');

  return key.startsWith(
    expectedPrefix
  );
}

function toAdminComment(
  comment,
  key
) {
  return {
    key,

    id:
      comment.id,

    status:
      comment.status,

    postType:
      comment.postType,

    postId:
      comment.postId,

    language:
      comment.language,

    name:
      comment.name,

    email:
      comment.email,

    comment:
      comment.comment,

    createdAt:
      comment.createdAt,

    moderatedAt:
      comment.moderatedAt || null,

    moderatedBy:
      comment.moderatedBy || null
  };
}

async function listComments({
  store,
  status,
  limit
}) {
  const prefix =
    `comments/${status}/`;

  const keys =
    await listBlobKeys(
      store,
      prefix
    );

  const storedComments =
    await Promise.all(
      keys.map(
        async (key) => ({
          key,

          comment:
            await store.get(
              key,
              {
                type:
                  'json'
              }
            )
        })
      )
    );

  return storedComments
    .filter((entry) =>
      isValidStoredComment(
        entry.comment,
        entry.key,
        status
      )
    )
    .sort((first, second) =>
      new Date(
        second.comment.createdAt
      ) -
      new Date(
        first.comment.createdAt
      )
    )
    .slice(0, limit)
    .map((entry) =>
      toAdminComment(
        entry.comment,
        entry.key
      )
    );
}

function validateStoredComment(
  comment,
  parsedKey
) {
  if (
    !comment ||
    typeof comment !== 'object'
  ) {
    throw createHttpError(
      404,
      'comment-not-found'
    );
  }

  if (
    comment.status !== 'pending' ||
    comment.id !== parsedKey.id ||
    comment.postType !==
      parsedKey.postType ||
    comment.postId !==
      parsedKey.postId ||
    comment.language !==
      parsedKey.language
  ) {
    throw createHttpError(
      409,
      'comment-data-mismatch'
    );
  }
}

async function moderateComment({
  store,
  key,
  action,
  user,
  now
}) {
  const parsedKey =
    parsePendingCommentKey(
      key
    );

  const existing =
    await store.get(
      parsedKey.key,
      {
        type:
          'json'
      }
    );

  validateStoredComment(
    existing,
    parsedKey
  );

  const destinationStatus =
    MODERATION_ACTIONS.get(
      action
    );

  const destinationKey =
    buildDestinationKey(
      parsedKey.key,
      destinationStatus
    );

  const moderatedBy =
    String(
      user.email ||
      user.id ||
      'admin'
    )
      .trim()
      .slice(0, 254);

  const updatedComment = {
    ...existing,

    status:
      destinationStatus,

    moderatedAt:
      new Date(now)
        .toISOString(),

    moderatedBy
  };

  const result =
    await store.setJSON(
      destinationKey,
      updatedComment,
      {
        onlyIfNew:
          true,

        metadata: {
          type:
            'article-comment',

          status:
            destinationStatus,

          postType:
            updatedComment.postType,

          postId:
            updatedComment.postId,

          language:
            updatedComment.language
        }
      }
    );

  if (
    result &&
    result.modified === false
  ) {
    throw createHttpError(
      409,
      'moderation-conflict'
    );
  }

  await store.delete(
    parsedKey.key
  );

  return toAdminComment(
    updatedComment,
    destinationKey
  );
}

export function createArticleCommentsAdminHandler({
  getStoreFn =
    getStore,

  getUserFn =
    getUser,

  verifyRequestOriginFn =
    verifyRequestOrigin,

  nowFn =
    () => Date.now()
} = {}) {
  return async function articleCommentsAdminHandler(
    request
  ) {
    const method =
      String(
        request.method || 'GET'
      ).toUpperCase();

    if (
      method === 'OPTIONS'
    ) {
      return emptyResponse(
        204,
        {
          'Access-Control-Allow-Methods':
            'GET, POST, OPTIONS',

          'Access-Control-Allow-Headers':
            'Content-Type',

          Allow:
            'GET, POST, OPTIONS'
        }
      );
    }

    if (
      method !== 'GET' &&
      method !== 'POST'
    ) {
      return jsonResponse(
        {
          error:
            'method-not-allowed'
        },
        {
          status:
            405,

          headers: {
            Allow:
              'GET, POST, OPTIONS'
          }
        }
      );
    }

    try {
      const user =
        await requireAdmin(
          getUserFn
        );

      if (
        method === 'POST'
      ) {
        assertRequestOrigin(
          request,
          verifyRequestOriginFn
        );
      }

      const store =
        getStoreFn({
          name:
            resolveCommentStoreName(
              request
            ),

          consistency:
            'strong'
        });

      if (
        method === 'GET'
      ) {
        const url =
          new URL(
            request.url
          );

        const status =
          normalizeStatus(
            url.searchParams.get(
              'status'
            )
          );

        const limit =
          normalizeLimit(
            url.searchParams.get(
              'limit'
            )
          );

        const comments =
          await listComments({
            store,
            status,
            limit
          });

        return jsonResponse({
          items:
            comments,

          count:
            comments.length,

          status,

          user: {
            id:
              user.id || null,

            email:
              user.email || null
          }
        });
      }

      const body =
        await readJsonBody(
          request
        );

      const action =
        normalizeAction(
          body.action
        );

      const comment =
        await moderateComment({
          store,

          key:
            body.key,

          action,
          user,

          now:
            nowFn()
        });

      return jsonResponse({
        ok:
          true,

        action,

        comment
      });
    } catch (error) {
      const status =
        Number.isInteger(
          error?.status
        )
          ? error.status
          : 500;

      const code =
        typeof error?.code ===
        'string'
          ? error.code
          : 'comments-admin-api-error';

      if (
        status >= 500
      ) {
        console.error(
          'Article comments admin API error:',
          error
        );
      }

      return jsonResponse(
        {
          error:
            code
        },
        {
          status
        }
      );
    }
  };
}

export default
  createArticleCommentsAdminHandler();