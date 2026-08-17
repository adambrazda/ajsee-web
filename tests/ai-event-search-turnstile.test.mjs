import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAiEventSearchHandler
} from '../netlify/functions/ai-event-search.js';

function makeRequest(
  {
    turnstileToken =
      'turnstile-test-token'
  } = {}
) {
  return new Request(
    'https://ajsee.example/api/ai-event-search',
    {
      method:
        'POST',

      headers: {
        'content-type':
          'application/json'
      },

      body:
        JSON.stringify({
          query:
            'koncert v Praze',

          locale:
            'cs',

          now:
            '2026-08-17T11:00:00+02:00',

          ...(turnstileToken === null
            ? {}
            : {
                turnstileToken
              })
        })
    }
  );
}

async function bodyJson(
  response
) {
  return JSON.parse(
    await response.text()
  );
}

test(
  'fails closed when Turnstile secret is not configured',
  async () => {
    let externalCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-openai-key'
        },

        fetchImpl:
          async () => {
            externalCalls++;

            throw new Error(
              'must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      503
    );

    assert.equal(
      body.code,
      'security-not-configured'
    );

    assert.equal(
      body.retryable,
      false
    );

    assert.equal(
      externalCalls,
      0
    );
  }
);

test(
  'rejects missing Turnstile token before any external request',
  async () => {
    let externalCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret',

          OPENAI_API_KEY:
            'test-openai-key'
        },

        fetchImpl:
          async () => {
            externalCalls++;

            throw new Error(
              'must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest({
          turnstileToken:
            null
        })
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      403
    );

    assert.equal(
      body.code,
      'human-verification-failed'
    );

    assert.equal(
      externalCalls,
      0
    );
  }
);

test(
  'rejected Turnstile token never reaches OpenAI',
  async () => {
    let openAiCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret',

          OPENAI_API_KEY:
            'test-openai-key'
        },

        verifyTurnstileImpl:
          async () => ({
            ok:
              false,

            code:
              'rejected',

            retryable:
              false
          }),

        fetchImpl:
          async () => {
            openAiCalls++;

            throw new Error(
              'OpenAI must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      403
    );

    assert.equal(
      body.code,
      'human-verification-failed'
    );

    assert.equal(
      openAiCalls,
      0
    );
  }
);

test(
  'temporary Turnstile failure never reaches OpenAI',
  async () => {
    let openAiCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret',

          OPENAI_API_KEY:
            'test-openai-key'
        },

        verifyTurnstileImpl:
          async () => ({
            ok:
              false,

            code:
              'network-error',

            retryable:
              true
          }),

        fetchImpl:
          async () => {
            openAiCalls++;

            throw new Error(
              'OpenAI must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      503
    );

    assert.equal(
      body.code,
      'human-verification-unavailable'
    );

    assert.equal(
      body.retryable,
      true
    );

    assert.equal(
      openAiCalls,
      0
    );
  }
);

test(
  'unexpected Turnstile verifier exception fails closed',
  async () => {
    let openAiCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret',

          OPENAI_API_KEY:
            'test-openai-key'
        },

        verifyTurnstileImpl:
          async () => {
            throw new Error(
              'unexpected verifier failure'
            );
          },

        fetchImpl:
          async () => {
            openAiCalls++;

            throw new Error(
              'OpenAI must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      503
    );

    assert.equal(
      body.code,
      'human-verification-unavailable'
    );

    assert.equal(
      openAiCalls,
      0
    );
  }
);

test(
  'successful Turnstile validation happens before OpenAI configuration check',
  async () => {
    let captured =
      null;

    let openAiCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret'
        },

        verifyTurnstileImpl:
          async options => {
            captured =
              options;

            return {
              ok:
                true
            };
          },

        fetchImpl:
          async () => {
            openAiCalls++;

            throw new Error(
              'OpenAI must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      503
    );

    assert.equal(
      body.code,
      'ai-not-configured'
    );

    assert.equal(
      openAiCalls,
      0
    );

    assert.equal(
      captured.token,
      'turnstile-test-token'
    );

    assert.equal(
      captured.secretKey,
      'test-secret'
    );

    assert.equal(
      captured.expectedAction,
      'ai_event_search'
    );

    assert.equal(
      captured.expectedHostname,
      'ajsee.example'
    );
  }
);

test(
  'successful Turnstile validation unlocks OpenAI request',
  async () => {
    let openAiCalls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          TURNSTILE_SECRET_KEY:
            'test-secret',

          OPENAI_API_KEY:
            'test-openai-key'
        },

        verifyTurnstileImpl:
          async () => ({
            ok:
              true
          }),

        fetchImpl:
          async () => {
            openAiCalls++;

            return new Response(
              '{}',
              {
                status:
                  429
              }
            );
          }
      });

    const response =
      await handler(
        makeRequest()
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      openAiCalls,
      1
    );

    assert.equal(
      response.status,
      503
    );

    assert.equal(
      body.code,
      'ai-rate-limited'
    );
  }
);