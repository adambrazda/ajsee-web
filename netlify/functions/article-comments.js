import {
  createHash,
  randomUUID
} from 'node:crypto';

import {
  getStore
} from '@netlify/blobs';

const BASE_STORE_NAME =
  'article-comments-v1';

const MAX_BODY_BYTES =
  16 * 1024;

const MIN_FORM_FILL_TIME_MS =
  3_000;

const MAX_FORM_AGE_MS =
  24 * 60 * 60 * 1_000;

const DEFAULT_LIMIT =
  50;

const MAX_LIMIT =
  100;

const SUPPORTED_LANGS =
  new Set([
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]);

const SUPPORTED_POST_TYPES =
  new Set([
    'blog',
    'review',
    'microguide'
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

function normalizeLanguage(
  value
) {
  const language =
    String(value || '')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

  if (
    !SUPPORTED_LANGS.has(language)
  ) {
    throw createHttpError(
      400,
      'invalid-language'
    );
  }

  return language;
}

function normalizePostType(
  value
) {
  const postType =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    !SUPPORTED_POST_TYPES.has(postType)
  ) {
    throw createHttpError(
      400,
      'invalid-post-type'
    );
  }

  return postType;
}

function normalizePostId(
  value
) {
  const postId =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    postId.length < 1 ||
    postId.length > 120 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      postId
    )
  ) {
    throw createHttpError(
      400,
      'invalid-post-id'
    );
  }

  return postId;
}

function normalizeName(
  value
) {
  const name =
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  if (
    name.length < 2 ||
    name.length > 80
  ) {
    throw createHttpError(
      422,
      'invalid-name'
    );
  }

  return name;
}

function normalizeEmail(
  value
) {
  const email =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    email.length < 5 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw createHttpError(
      422,
      'invalid-email'
    );
  }

  return email;
}

function normalizeComment(
  value
) {
  const comment =
    String(value || '')
      .replace(/\r\n?/g, '\n')
      .trim();

  if (
    comment.length < 3 ||
    comment.length > 2_000
  ) {
    throw createHttpError(
      422,
      'invalid-comment'
    );
  }

  return comment;
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

function sanitizeStoreSuffix(
  value
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function resolveCommentStoreName(
  request
) {
  let hostname = '';

  try {
    hostname =
      new URL(request.url)
        .hostname
        .toLowerCase();
  } catch {
    hostname = '';
  }

  const deployPreview =
    hostname.match(
      /^deploy-preview-(\d+)--/
    );

  if (deployPreview) {
    return (
      BASE_STORE_NAME +
      '-preview-' +
      deployPreview[1]
    );
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  ) {
    return (
      BASE_STORE_NAME +
      '-local'
    );
  }

  const context =
    sanitizeStoreSuffix(
      process.env.CONTEXT
    );

  if (
    context === 'deploy-preview'
  ) {
    const previewId =
      sanitizeStoreSuffix(
        process.env.REVIEW_ID ||
        process.env.DEPLOY_ID ||
        'unknown'
      );

    return (
      BASE_STORE_NAME +
      '-preview-' +
      previewId
    );
  }

  if (
    context === 'branch-deploy'
  ) {
    const branch =
      sanitizeStoreSuffix(
        process.env.BRANCH ||
        process.env.DEPLOY_ID ||
        'unknown'
      );

    return (
      BASE_STORE_NAME +
      '-branch-' +
      branch
    );
  }

  return BASE_STORE_NAME;
}

function verifyRequestOrigin(
  request
) {
  const origin =
    request.headers.get('origin');

  if (!origin) {
    return;
  }

  let requestOrigin = '';
  let submittedOrigin = '';

  try {
    requestOrigin =
      new URL(request.url).origin;

    submittedOrigin =
      new URL(origin).origin;
  } catch {
    throw createHttpError(
      403,
      'invalid-origin'
    );
  }

  if (
    submittedOrigin !==
    requestOrigin
  ) {
    throw createHttpError(
      403,
      'invalid-origin'
    );
  }
}

async function readJsonBody(
  request
) {
  const declaredLength =
    Number.parseInt(
      request.headers.get(
        'content-length'
      ) || '0',
      10
    );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
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

function validateFormTiming(
  startedAt,
  now
) {
  const started =
    Number(startedAt);

  if (
    !Number.isFinite(started)
  ) {
    throw createHttpError(
      422,
      'invalid-form-timing'
    );
  }

  const elapsed =
    now - started;

  if (
    elapsed < MIN_FORM_FILL_TIME_MS ||
    elapsed > MAX_FORM_AGE_MS
  ) {
    throw createHttpError(
      422,
      'invalid-form-timing'
    );
  }
}

function getClientFingerprint(
  request
) {
  const forwardedFor =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim() || '';

  const clientIp =
    request.headers.get(
      'x-nf-client-connection-ip'
    ) ||
    forwardedFor ||
    'unknown';

  const userAgent =
    request.headers.get(
      'user-agent'
    ) || '';

  const language =
    request.headers.get(
      'accept-language'
    ) || '';

  const salt =
    process.env.COMMENTS_HASH_SALT ||
    'ajsee-comments-v1';

  return createHash('sha256')
    .update(
      [
        salt,
        clientIp,
        userAgent,
        language
      ].join('|')
    )
    .digest('hex');
}

function buildCommentPrefix({
  status,
  postType,
  postId,
  language
}) {
  return [
    'comments',
    status,
    postType,
    postId,
    language,
    ''
  ].join('/');
}

function buildCommentKey(
  comment
) {
  const timestamp =
    comment.createdAt
      .replace(/\D/g, '');

  return (
    buildCommentPrefix({
      status:
        comment.status,

      postType:
        comment.postType,

      postId:
        comment.postId,

      language:
        comment.language
    }) +
    timestamp +
    '-' +
    comment.id
  );
}

function buildRateLimitKey({
  now,
  clientHash
}) {
  const date =
    new Date(now);

  const day =
    date
      .toISOString()
      .slice(0, 10);

  const minuteBucket =
    Math.floor(
      now / 60_000
    );

  return [
    'rate',
    day,
    clientHash,
    String(minuteBucket)
  ].join('/');
}

async function applyRateLimit({
  store,
  now,
  clientHash
}) {
  const key =
    buildRateLimitKey({
      now,
      clientHash
    });

  const existing =
    await store.getMetadata(key);

  if (existing) {
    throw createHttpError(
      429,
      'rate-limit-exceeded'
    );
  }

  const result =
    await store.setJSON(
      key,

      {
        createdAt:
          new Date(now)
            .toISOString()
      },

      {
        onlyIfNew: true,

        metadata: {
          type:
            'comment-rate-limit'
        }
      }
    );

  if (
    result &&
    result.modified === false
  ) {
    throw createHttpError(
      429,
      'rate-limit-exceeded'
    );
  }
}

async function listComments({
  store,
  status,
  postType,
  postId,
  language,
  limit
}) {
  const prefix =
    buildCommentPrefix({
      status,
      postType,
      postId,
      language
    });

  const result =
    await store.list({
      prefix,
      directories: false
    });

  const keys =
    (result?.blobs || [])
      .map((entry) =>
        entry.key
      )
      .filter(Boolean)
      .sort()
      .slice(-limit);

  const comments =
    await Promise.all(
      keys.map((key) =>
        store.get(
          key,
          {
            type: 'json'
          }
        )
      )
    );

  return comments
    .filter((comment) =>
      comment &&
      comment.status === status &&
      comment.postType === postType &&
      comment.postId === postId &&
      comment.language === language
    )
    .sort((first, second) =>
      new Date(first.createdAt) -
      new Date(second.createdAt)
    );
}

function toPublicComment(
  comment
) {
  return {
    id:
      comment.id,

    name:
      comment.name,

    comment:
      comment.comment,

    createdAt:
      comment.createdAt
  };
}

export function createArticleCommentsHandler({
  getStoreFn = getStore,
  nowFn = () => Date.now(),
  randomUUIDFn = randomUUID
} = {}) {
  return async function articleCommentsHandler(
    request
  ) {
    const method =
      String(
        request.method || 'GET'
      ).toUpperCase();

    if (method === 'OPTIONS') {
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
          status: 405,

          headers: {
            Allow:
              'GET, POST, OPTIONS'
          }
        }
      );
    }

    try {
      const store =
        getStoreFn({
          name:
            resolveCommentStoreName(
              request
            ),

          consistency:
            'strong'
        });

      if (method === 'GET') {
        const url =
          new URL(request.url);

        const postType =
          normalizePostType(
            url.searchParams.get(
              'postType'
            )
          );

        const postId =
          normalizePostId(
            url.searchParams.get(
              'postId'
            )
          );

        const language =
          normalizeLanguage(
            url.searchParams.get(
              'lang'
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
            status:
              'approved',
            postType,
            postId,
            language,
            limit
          });

        return jsonResponse({
          items:
            comments.map(
              toPublicComment
            ),

          count:
            comments.length
        });
      }

      verifyRequestOrigin(
        request
      );

      const body =
        await readJsonBody(
          request
        );

      const now =
        nowFn();

      validateFormTiming(
        body.startedAt,
        now
      );

      /*
       * Honeypot musí vrátit stejnou úspěšnou
       * odpověď jako reálné odeslání, ale nic
       * neukládá.
       */
      if (
        String(
          body.company || ''
        ).trim()
      ) {
        return jsonResponse(
          {
            ok: true,
            status: 'pending'
          },
          {
            status: 202
          }
        );
      }

      const postType =
        normalizePostType(
          body.postType
        );

      const postId =
        normalizePostId(
          body.postId
        );

      const language =
        normalizeLanguage(
          body.lang
        );

      const name =
        normalizeName(
          body.name
        );

      const email =
        normalizeEmail(
          body.email
        );

      const commentText =
        normalizeComment(
          body.comment
        );

      const clientHash =
        getClientFingerprint(
          request
        );

      await applyRateLimit({
        store,
        now,
        clientHash
      });

      const createdAt =
        new Date(now)
          .toISOString();

      const comment = {
        id:
          randomUUIDFn(),

        status:
          'pending',

        postType,
        postId,
        language,
        name,
        email,

        comment:
          commentText,

        createdAt,

        moderatedAt:
          null,

        moderatedBy:
          null
      };

      const key =
        buildCommentKey(
          comment
        );

      const result =
        await store.setJSON(
          key,
          comment,
          {
            onlyIfNew:
              true,

            metadata: {
              type:
                'article-comment',

              status:
                'pending',

              postType,
              postId,
              language
            }
          }
        );

      if (
        result &&
        result.modified === false
      ) {
        throw createHttpError(
          409,
          'comment-already-exists'
        );
      }

      return jsonResponse(
        {
          ok:
            true,

          id:
            comment.id,

          status:
            'pending'
        },
        {
          status:
            202
        }
      );
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
          : 'comments-api-error';

      if (status >= 500) {
        console.error(
          'Article comments API error:',
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
  createArticleCommentsHandler();