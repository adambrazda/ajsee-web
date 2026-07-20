import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'review-engagement-v1';
const MAX_BODY_BYTES = 4096;

const ALLOWED_ACTIONS = new Set([
  'qualified_read',
  'like',
  'unlike'
]);

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function jsonResponse(
  statusCode,
  body,
  extraHeaders = {}
) {
  return {
    statusCode,
    headers: {
      ...RESPONSE_HEADERS,
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function emptyResponse(statusCode, headers = {}) {
  return {
    statusCode,
    headers: {
      ...RESPONSE_HEADERS,
      ...headers
    },
    body: ''
  };
}

function createHttpError(statusCode, code) {
  const error = new Error(code);
  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function normalizeSlug(value = '') {
  const slug = String(value)
    .trim()
    .toLowerCase();

  if (
    slug.length < 3 ||
    slug.length > 120 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    throw createHttpError(
      400,
      'invalid-review-slug'
    );
  }

  return slug;
}

function normalizeVisitorId(
  value = '',
  { optional = false } = {}
) {
  const visitorId = String(value).trim();

  if (!visitorId && optional) {
    return '';
  }

  if (
    visitorId.length < 16 ||
    visitorId.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(visitorId)
  ) {
    throw createHttpError(
      400,
      'invalid-visitor-id'
    );
  }

  return visitorId;
}

function getVisitorHash(visitorId) {
  const salt =
    process.env.REVIEW_ENGAGEMENT_SALT ||
    process.env.NETLIFY_SITE_ID ||
    'ajsee-review-engagement-v1';

  return createHash('sha256')
    .update(`${salt}:${visitorId}`)
    .digest('hex');
}

function getRequestBody(event) {
  const rawBody = event?.body || '';

  if (!rawBody) {
    return {};
  }

  const decoded = event.isBase64Encoded
    ? Buffer.from(rawBody, 'base64').toString('utf8')
    : rawBody;

  if (
    Buffer.byteLength(decoded, 'utf8') >
    MAX_BODY_BYTES
  ) {
    throw createHttpError(
      413,
      'request-body-too-large'
    );
  }

  try {
    const value = JSON.parse(decoded);

    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new Error(
        'Body must be a JSON object.'
      );
    }

    return value;
  } catch {
    throw createHttpError(
      400,
      'invalid-json-body'
    );
  }
}

function getKeys(slug, visitorHash) {
  return {
    likePrefix: `likes/${slug}/`,
    readPrefix: `reads/${slug}/`,
    likeKey: visitorHash
      ? `likes/${slug}/${visitorHash}`
      : '',
    readKey: visitorHash
      ? `reads/${slug}/${visitorHash}`
      : ''
  };
}

async function readEngagementState(
  store,
  slug,
  visitorHash = ''
) {
  const {
    likePrefix,
    readPrefix,
    likeKey
  } = getKeys(slug, visitorHash);

  const [
    likesResult,
    readsResult,
    visitorLike
  ] = await Promise.all([
    store.list({
      prefix: likePrefix,
      directories: false
    }),

    store.list({
      prefix: readPrefix,
      directories: false
    }),

    visitorHash
      ? store.getMetadata(likeKey)
      : Promise.resolve(null)
  ]);

  return {
    slug,
    likes: Array.isArray(likesResult?.blobs)
      ? likesResult.blobs.length
      : 0,

    qualifiedReads:
      Array.isArray(readsResult?.blobs)
        ? readsResult.blobs.length
        : 0,

    likedByVisitor: Boolean(visitorLike)
  };
}

async function writeEngagementAction({
  store,
  slug,
  visitorHash,
  action
}) {
  const {
    likeKey,
    readKey
  } = getKeys(slug, visitorHash);

  const createdAt = new Date().toISOString();

  if (action === 'qualified_read') {
    const result = await store.setJSON(
      readKey,
      { createdAt },
      {
        onlyIfNew: true,
        metadata: {
          type: 'qualified_read',
          slug,
          createdAt
        }
      }
    );

    return Boolean(result?.modified);
  }

  if (action === 'like') {
    const result = await store.setJSON(
      likeKey,
      { createdAt },
      {
        onlyIfNew: true,
        metadata: {
          type: 'like',
          slug,
          createdAt
        }
      }
    );

    return Boolean(result?.modified);
  }

  if (action === 'unlike') {
    const existing = await store.getMetadata(
      likeKey
    );

    if (!existing) {
      return false;
    }

    await store.delete(likeKey);

    return true;
  }

  throw createHttpError(
    400,
    'invalid-action'
  );
}

export function createReviewEngagementHandler({
  getStoreFn = getStore
} = {}) {
  return async function reviewEngagementHandler(
    event = {}
  ) {
    const method = String(
      event.httpMethod || 'GET'
    ).toUpperCase();

    if (method === 'OPTIONS') {
      return emptyResponse(204, {
        'Access-Control-Allow-Methods':
          'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type',
        Allow: 'GET, POST, OPTIONS'
      });
    }

    if (
      method !== 'GET' &&
      method !== 'POST'
    ) {
      return jsonResponse(
        405,
        {
          error: 'method-not-allowed'
        },
        {
          Allow: 'GET, POST, OPTIONS'
        }
      );
    }

    try {
      const store = getStoreFn({
        name: STORE_NAME,
        consistency: 'strong'
      });

      if (method === 'GET') {
        const query =
          event.queryStringParameters || {};

        const slug = normalizeSlug(
          query.slug || ''
        );

        const visitorId = normalizeVisitorId(
          query.visitorId || '',
          { optional: true }
        );

        const visitorHash = visitorId
          ? getVisitorHash(visitorId)
          : '';

        const state =
          await readEngagementState(
            store,
            slug,
            visitorHash
          );

        return jsonResponse(200, state);
      }

      const body = getRequestBody(event);

      const slug = normalizeSlug(
        body.slug || ''
      );

      const visitorId = normalizeVisitorId(
        body.visitorId || ''
      );

      const action = String(
        body.action || ''
      ).trim();

      if (!ALLOWED_ACTIONS.has(action)) {
        throw createHttpError(
          400,
          'invalid-action'
        );
      }

      const visitorHash =
        getVisitorHash(visitorId);

      const modified =
        await writeEngagementAction({
          store,
          slug,
          visitorHash,
          action
        });

      const state =
        await readEngagementState(
          store,
          slug,
          visitorHash
        );

      return jsonResponse(200, {
        ...state,
        action,
        modified
      });
    } catch (error) {
      const statusCode =
        Number(error?.statusCode) || 503;

      const code =
        error?.code ||
        'review-engagement-unavailable';

      if (statusCode >= 500) {
        console.error(
          '[review-engagement]',
          error
        );
      }

      return jsonResponse(statusCode, {
        error: code
      });
    }
  };
}

export const handler =
  createReviewEngagementHandler();
