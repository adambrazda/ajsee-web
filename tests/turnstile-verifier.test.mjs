import test from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyTurnstileToken
} from '../netlify/functions/_shared/turnstile.js';

function siteverifyResponse({
  success = true,
  action = 'ai_event_search',
  hostname = 'ajsee.cz',
  metadata
} = {}) {
  return new Response(
    JSON.stringify({
      success,
      action,
      hostname,

      ...(metadata === undefined
        ? {}
        : {
            metadata
          }),

      'error-codes':
        success
          ? []
          : [
              'invalid-input-response'
            ]
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
}

test(
  'requires a server-side Turnstile secret',
  async () => {
    let called =
      false;

    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        fetchImpl:
          async () => {
            called =
              true;

            throw new Error(
              'must not run'
            );
          }
      });

    assert.deepEqual(
      result,
      {
        ok:
          false,

        code:
          'not-configured',

        retryable:
          false
      }
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'rejects missing token before Siteverify',
  async () => {
    let called =
      false;

    const result =
      await verifyTurnstileToken({
        token:
          '',

        secretKey:
          'test-secret',

        fetchImpl:
          async () => {
            called =
              true;

            throw new Error(
              'must not run'
            );
          }
      });

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.code,
      'invalid-token'
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'rejects tokens longer than Cloudflare maximum',
  async () => {
    let called =
      false;

    const result =
      await verifyTurnstileToken({
        token:
          'x'.repeat(
            2_049
          ),

        secretKey:
          'test-secret',

        fetchImpl:
          async () => {
            called =
              true;

            throw new Error(
              'must not run'
            );
          }
      });

    assert.equal(
      result.code,
      'invalid-token'
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'validates token through Cloudflare Siteverify',
  async () => {
    let capturedUrl =
      '';

    let capturedOptions =
      null;

    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        expectedAction:
          'ai_event_search',

        expectedHostname:
          'ajsee.cz',

        fetchImpl:
          async (
            url,
            options
          ) => {
            capturedUrl =
              url;

            capturedOptions =
              options;

            return siteverifyResponse();
          }
      });

    assert.deepEqual(
      result,
      {
        ok:
          true
      }
    );

    assert.equal(
      capturedUrl,
      'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    );

    assert.equal(
      capturedOptions.method,
      'POST'
    );

    assert.equal(
      capturedOptions.headers[
        'Content-Type'
      ],
      'application/json'
    );

    const payload =
      JSON.parse(
        capturedOptions.body
      );

    assert.deepEqual(
      payload,
      {
        secret:
          'server-secret',

        response:
          'valid-token'
      }
    );
  }
);

test(
  'rejects failed Siteverify validation',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'bad-token',

        secretKey:
          'server-secret',

        fetchImpl:
          async () =>
            siteverifyResponse({
              success:
                false
            })
      });

    assert.deepEqual(
      result,
      {
        ok:
          false,

        code:
          'rejected',

        retryable:
          false
      }
    );
  }
);

test(
  'rejects mismatched Turnstile action',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        expectedAction:
          'ai_event_search',

        fetchImpl:
          async () =>
            siteverifyResponse({
              action:
                'another_action'
            })
      });

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.code,
      'context-mismatch'
    );
  }
);

test(
  'rejects mismatched Turnstile hostname',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        expectedHostname:
          'ajsee.cz',

        fetchImpl:
          async () =>
            siteverifyResponse({
              hostname:
                'evil.example'
            })
      });

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.code,
      'context-mismatch'
    );
  }
);

test(
  'maps Siteverify network failure to retryable failure',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        fetchImpl:
          async () => {
            throw new Error(
              'offline'
            );
          }
      });

    assert.deepEqual(
      result,
      {
        ok:
          false,

        code:
          'network-error',

        retryable:
          true
      }
    );
  }
);

test(
  'rejects malformed Siteverify response',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        fetchImpl:
          async () =>
            new Response(
              'not-json',
              {
                status:
                  200
              }
            )
      });

    assert.deepEqual(
      result,
      {
        ok:
          false,

        code:
          'invalid-response',

        retryable:
          true
      }
    );
  }
);

test(
  'maps Siteverify upstream failure to retryable failure',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'server-secret',

        fetchImpl:
          async () =>
            new Response(
              null,
              {
                status:
                  503
              }
            )
      });

    assert.deepEqual(
      result,
      {
        ok:
          false,

        code:
          'upstream-unavailable',

        retryable:
          true
      }
    );
  }
);
test(
  'accepts an explicit Cloudflare testing-key response when required',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'XXXX.DUMMY.TOKEN.XXXX',

        secretKey:
          'test-secret',

        requireTestingKeyResponse:
          true,

        fetchImpl:
          async () =>
            siteverifyResponse({
              action:
                '',

              hostname:
                'example.com',

              metadata: {
                result_with_testing_key:
                  true
              }
            })
      });

    assert.deepEqual(
      result,
      {
        ok:
          true
      }
    );
  }
);

test(
  'rejects an ordinary success response in testing-key mode',
  async () => {
    const result =
      await verifyTurnstileToken({
        token:
          'valid-token',

        secretKey:
          'test-secret',

        requireTestingKeyResponse:
          true,

        fetchImpl:
          async () =>
            siteverifyResponse()
      });

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.code,
      'context-mismatch'
    );
  }
);