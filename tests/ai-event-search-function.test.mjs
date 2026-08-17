import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFilterIntentJsonSchema,
  createAiEventSearchHandler as createProductionAiEventSearchHandler,
  extractResponseOutput
} from '../netlify/functions/ai-event-search.js';

const allowTurnstile =
  async () => ({
    ok:
      true
  });

function createAiEventSearchHandler(
  options = {}
) {
  return createProductionAiEventSearchHandler({
    verifyTurnstileImpl:
      allowTurnstile,

    ...options
  });
}

function makeRequest(
  body,
  {
    method = 'POST',
    contentType = 'application/json'
  } = {}
) {
  const options = {
    method,

    headers: {
      'content-type':
        contentType
    }
  };

  if (
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    options.body =
      typeof body === 'string'
        ? body
        : JSON.stringify(body);
  }

  return new Request(
    'https://ajsee.example/api/ai-event-search',
    options
  );
}

async function bodyJson(
  response
) {
  const text =
    await response.text();

  return text
    ? JSON.parse(text)
    : null;
}

function validIntent(
  locale = 'cs'
) {
  return {
    version:
      1,

    intent:
      'find_events',

    locale,

    place: {
      type:
        'city',

      label:
        'Praha',

      countryCode:
        'CZ',

      nearby:
        true,

      radiusKm:
        50
    },

    date: {
      type:
        'preset',

      preset:
        'weekend',

      from:
        '',

      to:
        ''
    },

    category:
      'concert',

    audience:
      'family',

    keyword:
      '',

    sort:
      'nearest',

    unsupportedPreferences:
      [],

    confidence: {
      overall:
        0.97,

      place:
        0.99,

      date:
        0.98,

      category:
        0.98,

      audience:
        0.99,

      keyword:
        null
    },

    clarification: {
      required:
        false,

      question:
        '',

      fields:
        []
    }
  };
}

function modelResponse(
  value
) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type:
            'reasoning'
        },
        {
          type:
            'message',

          content: [
            {
              type:
                'output_text',

              text:
                typeof value ===
                  'string'
                  ? value
                  : JSON.stringify(
                      value
                    )
            }
          ]
        }
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
  'structured output schema is strict and pinned to request locale',
  () => {
    const schema =
      buildFilterIntentJsonSchema(
        'sk'
      );

    assert.equal(
      schema.additionalProperties,
      false
    );

    assert.deepEqual(
      schema.properties.locale.enum,
      [
        'sk'
      ]
    );

    assert.equal(
      schema.properties.place
        .additionalProperties,
      false
    );

    assert.equal(
      schema.properties.clarification
        .additionalProperties,
      false
    );
  }
);

test(
  'OPTIONS returns empty CORS response without calling OpenAI',
  async () => {
    let called =
      false;

    const handler =
      createAiEventSearchHandler({
        env: {},

        fetchImpl:
          async () => {
            called =
              true;

            throw new Error(
              'must not run'
            );
          }
      });

    const response =
      await handler(
        makeRequest(
          null,
          {
            method:
              'OPTIONS'
          }
        )
      );

    assert.equal(
      response.status,
      204
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'rejects non-POST requests',
  async () => {
    const handler =
      createAiEventSearchHandler();

    const response =
      await handler(
        makeRequest(
          null,
          {
            method:
              'GET'
          }
        )
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      405
    );

    assert.equal(
      body.code,
      'method-not-allowed'
    );
  }
);

test(
  'requires application/json',
  async () => {
    const handler =
      createAiEventSearchHandler();

    const response =
      await handler(
        makeRequest(
          'hello',
          {
            contentType:
              'text/plain'
          }
        )
      );

    assert.equal(
      response.status,
      415
    );
  }
);

test(
  'rejects oversized request bodies before model invocation',
  async () => {
    let called =
      false;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () => {
            called =
              true;

            return modelResponse(
              validIntent()
            );
          }
      });

    const response =
      await handler(
        makeRequest({
          query:
            'x'.repeat(
              5_000
            ),

          locale:
            'cs'
        })
      );

    assert.equal(
      response.status,
      413
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'rejects invalid JSON',
  async () => {
    const handler =
      createAiEventSearchHandler();

    const response =
      await handler(
        makeRequest(
          '{"query":'
        )
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      400
    );

    assert.equal(
      body.code,
      'invalid-json'
    );
  }
);

test(
  'validates locale and query before model invocation',
  async () => {
    let calls =
      0;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () => {
            calls++;

            return modelResponse(
              validIntent()
            );
          }
      });

    const badLocale =
      await handler(
        makeRequest({
          query:
            'koncert',

          locale:
            'xx'
        })
      );

    const badQuery =
      await handler(
        makeRequest({
          query:
            ' ',

          locale:
            'cs'
        })
      );

    assert.equal(
      badLocale.status,
      400
    );

    assert.equal(
      badQuery.status,
      400
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  'requires server-side OpenAI API key',
  async () => {
    let called =
      false;

    const handler =
      createAiEventSearchHandler({
        env: {},

        fetchImpl:
          async () => {
            called =
              true;

            return modelResponse(
              validIntent()
            );
          }
      });

    const response =
      await handler(
        makeRequest({
          query:
            'Koncert v Praze',

          locale:
            'cs'
        })
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
      called,
      false
    );
  }
);

test(
  'sends a stateless strict Responses API request and validates FilterIntent',
  async () => {
    let capturedUrl =
      '';

    let capturedOptions =
      null;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'secret-test-key',

          OPENAI_AI_SEARCH_MODEL:
            'gpt-test-model'
        },

        nowProvider:
          () =>
            new Date(
              '2026-08-17T07:30:00.000Z'
            ),

        fetchImpl:
          async (
            url,
            options
          ) => {
            capturedUrl =
              url;

            capturedOptions =
              options;

            return modelResponse(
              validIntent(
                'cs'
              )
            );
          }
      });

    const rawQuery =
      'chci o víkendu s rodinou vyrazit na koncert v Praze a okolí';

    const response =
      await handler(
        makeRequest({
          query:
            rawQuery,

          locale:
            'cs',

          now:
            '2026-08-17T09:30:00+02:00'
        })
      );

    const body =
      await bodyJson(
        response
      );

    const upstreamBody =
      JSON.parse(
        capturedOptions.body
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.ok,
      true
    );

    assert.equal(
      body.intent.place.type,
      'city'
    );

    assert.equal(
      body.intent.place.nearby,
      true
    );

    assert.equal(
      capturedUrl,
      'https://api.openai.com/v1/responses'
    );

    assert.equal(
      capturedOptions.headers.Authorization,
      'Bearer secret-test-key'
    );

    assert.equal(
      upstreamBody.model,
      'gpt-test-model'
    );

    assert.equal(
      upstreamBody.store,
      false
    );

    assert.equal(
      upstreamBody.reasoning.effort,
      'low'
    );

    assert.equal(
      upstreamBody.input,
      rawQuery
    );

    assert.equal(
      upstreamBody.text.format.type,
      'json_schema'
    );

    assert.equal(
      upstreamBody.text.format.strict,
      true
    );

    assert.deepEqual(
      upstreamBody.text.format.schema
        .properties.locale.enum,
      [
        'cs'
      ]
    );
  }
);

test(
  'extracts structured output across response output items',
  () => {
    const expected =
      JSON.stringify(
        validIntent()
      );

    const midpoint =
      Math.floor(
        expected.length /
        2
      );

    const extracted =
      extractResponseOutput({
        output: [
          {
            type:
              'reasoning'
          },
          {
            type:
              'message',

            content: [
              {
                type:
                  'output_text',

                text:
                  expected.slice(
                    0,
                    midpoint
                  )
              }
            ]
          },
          {
            type:
              'message',

            content: [
              {
                type:
                  'output_text',

                text:
                  expected.slice(
                    midpoint
                  )
              }
            ]
          }
        ]
      });

    assert.equal(
      extracted.refused,
      false
    );

    assert.equal(
      extracted.text,
      expected
    );
  }
);

test(
  'preserves valid low-confidence intent as clarification instead of failing',
  async () => {
    const intent =
      validIntent();

    intent.confidence.overall =
      0.5;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            modelResponse(
              intent
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'něco v okolí možná Praha',

          locale:
            'cs'
        })
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.ok,
      true
    );

    assert.equal(
      body.needsClarification,
      true
    );
  }
);

test(
  'maps OpenAI rate limit to temporary service failure',
  async () => {
    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            new Response(
              '{}',
              {
                status:
                  429
              }
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'koncert Praha',

          locale:
            'cs'
        })
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
      'ai-rate-limited'
    );

    assert.equal(
      body.retryable,
      true
    );
  }
);

test(
  'aborts slow OpenAI requests',
  async () => {
    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key',

          OPENAI_AI_SEARCH_TIMEOUT_MS:
            '2000'
        },

        fetchImpl:
          async (
            _url,
            options
          ) =>
            new Promise(
              (
                _resolve,
                reject
              ) => {
                options.signal
                  .addEventListener(
                    'abort',
                    () => {
                      const error =
                        new Error(
                          'aborted'
                        );

                      error.name =
                        'AbortError';

                      reject(
                        error
                      );
                    },
                    {
                      once:
                        true
                    }
                  );
              }
            )
      });

    const started =
      Date.now();

    const response =
      await handler(
        makeRequest({
          query:
            'koncert Praha',

          locale:
            'cs'
        })
      );

    const elapsed =
      Date.now() -
      started;

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      504
    );

    assert.equal(
      body.code,
      'ai-timeout'
    );

    assert.ok(
      elapsed >=
      1_500
    );

    assert.ok(
      elapsed <
      5_000
    );
  }
);

test(
  'handles model refusal without exposing refusal text',
  async () => {
    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                output: [
                  {
                    type:
                      'message',

                    content: [
                      {
                        type:
                          'refusal',

                        refusal:
                          'private refusal text'
                      }
                    ]
                  }
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
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'koncert Praha',

          locale:
            'cs'
        })
      );

    const text =
      await response.text();

    assert.equal(
      response.status,
      422
    );

    assert.match(
      text,
      /ai-refused/
    );

    assert.doesNotMatch(
      text,
      /private refusal text/
    );
  }
);

test(
  'rejects malformed structured output',
  async () => {
    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            modelResponse(
              '{not-json'
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'koncert Praha',

          locale:
            'cs'
        })
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      502
    );

    assert.equal(
      body.code,
      'ai-invalid-json-output'
    );
  }
);

test(
  'rejects schema-shaped output that violates local FilterIntent validation',
  async () => {
    const intent =
      validIntent();

    intent.place.radiusKm =
      5;

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            modelResponse(
              intent
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'do 5 km od Prahy',

          locale:
            'cs'
        })
      );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      response.status,
      502
    );

    assert.equal(
      body.code,
      'ai-invalid-intent'
    );
  }
);