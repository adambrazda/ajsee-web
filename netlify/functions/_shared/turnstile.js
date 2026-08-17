const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const MAX_TOKEN_CHARS =
  2_048;

const DEFAULT_TIMEOUT_MS =
  5_000;

const MIN_TIMEOUT_MS =
  1_000;

const MAX_TIMEOUT_MS =
  10_000;

function resolveTimeoutMs(
  value
) {
  const requested =
    Number(
      value
    );

  if (
    !Number.isFinite(
      requested
    )
  ) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.max(
    MIN_TIMEOUT_MS,
    Math.min(
      MAX_TIMEOUT_MS,
      requested
    )
  );
}

function failure(
  code,
  {
    retryable = false
  } = {}
) {
  return {
    ok:
      false,

    code,

    retryable
  };
}

export async function verifyTurnstileToken({
  token,
  secretKey,
  expectedAction = '',
  expectedHostname = '',
  fetchImpl = globalThis.fetch,
  timeoutMs =
    DEFAULT_TIMEOUT_MS
} = {}) {
  const secret =
    String(
      secretKey ||
      ''
    ).trim();

  if (!secret) {
    return failure(
      'not-configured'
    );
  }

  const normalizedToken =
    typeof token ===
      'string'
      ? token.trim()
      : '';

  if (
    !normalizedToken ||
    normalizedToken.length >
      MAX_TOKEN_CHARS
  ) {
    return failure(
      'invalid-token'
    );
  }

  if (
    typeof fetchImpl !==
    'function'
  ) {
    return failure(
      'fetch-unavailable',
      {
        retryable:
          true
      }
    );
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      resolveTimeoutMs(
        timeoutMs
      )
    );

  let upstream =
    null;

  try {
    upstream =
      await fetchImpl(
        TURNSTILE_SITEVERIFY_URL,
        {
          method:
            'POST',

          signal:
            controller.signal,

          headers: {
            'Content-Type':
              'application/json',

            Accept:
              'application/json'
          },

          body:
            JSON.stringify({
              secret,
              response:
                normalizedToken
            })
        }
      );
  } catch (error) {
    if (
      controller.signal.aborted ||
      error?.name ===
        'AbortError'
    ) {
      return failure(
        'timeout',
        {
          retryable:
            true
        }
      );
    }

    return failure(
      'network-error',
      {
        retryable:
          true
      }
    );
  } finally {
    clearTimeout(
      timer
    );
  }

  if (
    !upstream ||
    !upstream.ok
  ) {
    return failure(
      'upstream-unavailable',
      {
        retryable:
          true
      }
    );
  }

  let data =
    null;

  try {
    data =
      await upstream.json();
  } catch {
    return failure(
      'invalid-response',
      {
        retryable:
          true
      }
    );
  }

  if (
    !data ||
    typeof data !==
      'object' ||
    Array.isArray(
      data
    )
  ) {
    return failure(
      'invalid-response',
      {
        retryable:
          true
      }
    );
  }

  if (
    data.success !==
    true
  ) {
    return failure(
      'rejected'
    );
  }

  const action =
    String(
      data.action ||
      ''
    ).trim();

  if (
    expectedAction &&
    action !==
      expectedAction
  ) {
    return failure(
      'context-mismatch'
    );
  }

  const hostname =
    String(
      data.hostname ||
      ''
    )
      .trim()
      .toLowerCase();

  const requiredHostname =
    String(
      expectedHostname ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    requiredHostname &&
    hostname !==
      requiredHostname
  ) {
    return failure(
      'context-mismatch'
    );
  }

  return {
    ok:
      true
  };
}