import {
  getUser,
  verifyRequestOrigin
} from '@netlify/identity';

import {
  createReviewPublicationGitHubClient
} from './review-publication-github.js';

import {
  createReviewPublicationService
} from './review-publication-service.js';

const MAX_BODY_BYTES =
  4 * 1024;

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

function normalizeReviewSlug(
  value
) {
  const slug =
    String(value || '')
      .trim();

  if (
    slug.length < 1 ||
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug
    )
  ) {
    throw createHttpError(
      422,
      'invalid-review-slug'
    );
  }

  return slug;
}

function normalizeAction(
  value
) {
  const action =
    String(value || '')
      .trim()
      .toLowerCase();

  if (action !== 'prepare') {
    throw createHttpError(
      422,
      'invalid-publication-action'
    );
  }

  return action;
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
  }
  catch {
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
  }
  catch {
    throw createHttpError(
      403,
      'invalid-origin'
    );
  }
}

const GITHUB_REPOSITORY = {
  owner:
    'adambrazda',

  repo:
    'ajsee-web'
};

const GITHUB_BASE_BRANCH =
  'main';

function createUnavailablePublicationService() {
  function unavailable() {
    throw createHttpError(
      503,
      'publication-service-unavailable'
    );
  }

  return {
    getStatus:
      unavailable,

    preparePublication:
      unavailable
  };
}

function createDefaultPublicationService({
  env,
  fetchFn
}) {
  const token =
    String(
      env?.AJSEE_GITHUB_TOKEN || ''
    )
      .trim();

  if (!token) {
    return createUnavailablePublicationService();
  }

  const githubClient =
    createReviewPublicationGitHubClient({
      token,
      fetchFn
    });

  return createReviewPublicationService({
    githubClient,

    repository:
      GITHUB_REPOSITORY,

    baseBranch:
      GITHUB_BASE_BRANCH
  });
}

export function createReviewPublicationAdminHandler({
  getUserFn =
    getUser,

  verifyRequestOriginFn =
    verifyRequestOrigin,

  publicationService =
    null,

  env =
    process.env,

  fetchFn =
    fetch
} = {}) {
  const resolvedPublicationService =
    publicationService ||
    createDefaultPublicationService({
      env,
      fetchFn
    });
  return async function reviewPublicationAdminHandler(
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
            'Content-Type, Authorization',

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

      if (method === 'GET') {
        const url =
          new URL(
            request.url
          );

        const slug =
          normalizeReviewSlug(
            url.searchParams.get(
              'slug'
            )
          );

        const result =
          await resolvedPublicationService
            .getStatus({
              slug,
              user
            });

        return jsonResponse(
          result
        );
      }

      assertRequestOrigin(
        request,
        verifyRequestOriginFn
      );

      const body =
        await readJsonBody(
          request
        );

      const action =
        normalizeAction(
          body.action
        );

      const slug =
        normalizeReviewSlug(
          body.slug
        );

      if (action === 'prepare') {
        const result =
          await resolvedPublicationService
            .preparePublication({
              slug,
              user
            });

        return jsonResponse(
          result,
          {
            status:
              201
          }
        );
      }

      throw createHttpError(
        422,
        'invalid-publication-action'
      );
    }
    catch (error) {
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
          : 'review-publication-admin-api-error';

      if (status >= 500) {
        console.error(
          'Review publication admin API error:',
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
  createReviewPublicationAdminHandler();
