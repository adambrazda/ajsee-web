import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFilterIntentJsonSchema,
  createAiEventSearchHandler as createProductionAiEventSearchHandler,
  extractResponseOutput
} from '../netlify/functions/ai-event-search.js';
import { createEmptyFilterIntent } from '../src/ai-search/intent-schema.js';

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
    contentType = 'application/json',
    url =
      'https://deploy-preview-175--ajsee-demo.netlify.app/api/ai-event-search',
    origin = ''
  } = {}
) {
  const options = {
    method,

    headers: {
      'content-type':
        contentType
    }
  };

  if (origin) {
    options.headers.origin =
      origin;
  }

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
    url,
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
  'OPTIONS returns empty response without permissive CORS or calling OpenAI',
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
      response.headers.get(
        'access-control-allow-origin'
      ),
      null
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'rejects cross-origin browser requests before protected work',
  async () => {
    let called =
      false;

    const handler =
      createAiEventSearchHandler({
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
          {
            query:
              'concert'
          },
          {
            origin:
              'https://example.invalid'
          }
        )
      );

    assert.equal(
      response.status,
      403
    );

    assert.deepEqual(
      await bodyJson(
        response
      ),
      {
        ok:
          false,

        code:
          'origin-not-allowed',

        retryable:
          false
      }
    );

    assert.equal(
      response.headers.get(
        'access-control-allow-origin'
      ),
      null
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
  'production host fails closed until server activation is explicit',
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
        makeRequest(
          {
            query:
              'koncert',

            locale:
              'cs'
          },
          {
            url:
              'https://ajsee.cz/api/ai-event-search'
          }
        )
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
      'ai-disabled'
    );

    assert.equal(
      body.retryable,
      false
    );

    assert.equal(
      called,
      false
    );
  }
);

test(
  'unknown hosts stay disabled even when the production flag is enabled',
  async () => {
    let called =
      false;

    const handler =
      createAiEventSearchHandler({
        env: {
          AI_SEARCH_ENABLED:
            'true',

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
        makeRequest(
          {
            query:
              'koncert',

            locale:
              'cs'
          },
          {
            url:
              'https://ajsee-demo.netlify.app/api/ai-event-search'
          }
        )
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
      'ai-disabled'
    );

    assert.equal(
      called,
      false
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
              40_000
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
  'accepts a bounded clarification request larger than the former 4 KB limit',
  async () => {
    const previousIntent =
      validIntent();

    previousIntent.clarification = {
      required:
        true,

      fields: [
        'place'
      ],

      question:
        'Clarify place?'
    };

    previousIntent.auditPadding =
      'x'.repeat(
        11_480
      );

    const requestBody = {
      query:
        '漢'.repeat(
          800
        ),

      locale:
        'cs',

      now:
        '2026-09-05T11:41:00+02:00',

      turnstileToken:
        't'.repeat(
          2_048
        ),

      clarificationContext: {
        originalQuery:
          '漢'.repeat(
            800
          ),

        question:
          '漢'.repeat(
            500
          ),

        round:
          1,

        previousIntent
      }
    };

    const requestBytes =
      new TextEncoder()
        .encode(
          JSON.stringify(
            requestBody
          )
        )
        .byteLength;

    assert.ok(
      requestBytes >
        20_480
    );

    assert.ok(
      requestBytes <
        32_768
    );

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            modelResponse(
              validIntent()
            )
      });

    const response =
      await handler(
        makeRequest(
          requestBody
        )
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
            'jazzový koncert v Praze',

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
            'jazzový koncert v Praze',

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
            'jazzový koncert v Praze',

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
            'jazzový koncert v Praze',

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
            'jazzový koncert v Praze',

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

test(
  'server forces missing max-price currency into clarification',
  async () => {
    const intent =
      validIntent();

    intent.unsupportedPreferences = [
      {
        type:
          'max_price',

        value:
          100,

        currency:
          '',

        unit:
          ''
      }
    ];

    intent.clarification = {
      required:
        false,

      question:
        '',

      fields:
        []
    };

    intent.confidence.overall =
      0.88;

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
            'Najdi mi akce do 100',

          locale:
            'cs',

          turnstileToken:
            'test-token'
        })
      );

    assert.equal(
      response.status,
      200
    );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      body.ok,
      true
    );

    assert.equal(
      body.needsClarification,
      true
    );

    assert.equal(
      body.intent
        .clarification
        .required,
      true
    );

    assert.equal(
      body.intent
        .clarification
        .question,
      'Myslíte maximální cenu 100 CZK?'
    );

    assert.deepEqual(
      body.intent
        .clarification
        .fields,
      [
        'unsupportedPreferences'
      ]
    );

    assert.equal(
      body.intent
        .unsupportedPreferences[0]
        .currency,
      ''
    );
  }
);


test(
  'affirmative price clarification confirms locale currency deterministically',
  async () => {
    const modelIntent =
      validIntent();

    modelIntent.unsupportedPreferences = [
      {
        type:
          'max_price',

        value:
          100,

        currency:
          '',

        unit:
          ''
      }
    ];

    modelIntent.clarification = {
      required:
        false,

      question:
        '',

      fields:
        []
    };

    const previousIntent =
      structuredClone(
        modelIntent
      );

    previousIntent.clarification = {
      required:
        true,

      question:
        'Myslíte maximální cenu 100 CZK?',

      fields: [
        'unsupportedPreferences'
      ]
    };

    const handler =
      createAiEventSearchHandler({
        env: {
          OPENAI_API_KEY:
            'test-key'
        },

        fetchImpl:
          async () =>
            modelResponse(
              modelIntent
            )
      });

    const response =
      await handler(
        makeRequest({
          query:
            'ano',

          locale:
            'cs',

          turnstileToken:
            'test-token',

          clarificationContext: {
            originalQuery:
              'Najdi mi akce do 100',

            question:
              'Myslíte maximální cenu 100 CZK?',

            round:
              1,

            previousIntent
          }
        })
      );

    assert.equal(
      response.status,
      200
    );

    const body =
      await bodyJson(
        response
      );

    assert.equal(
      body.ok,
      true
    );

    assert.equal(
      body.needsClarification,
      false
    );

    assert.equal(
      body.intent
        .clarification
        .required,
      false
    );

    assert.equal(
      body.intent
        .unsupportedPreferences[0]
        .currency,
      'CZK'
    );
  }
);

test('explicit homepage search is resolved after verification without an AI clarification', async () => {
  let verified = false;
  const handler = createAiEventSearchHandler({
    env: {},
    verifyTurnstileImpl: async ({ token }) => {
      assert.equal(token, 'test-token');
      verified = true;
      return { ok: true };
    },
    fetchImpl: async () => assert.fail('Complete explicit query must not call the model')
  });

  const response = await handler(makeRequest({
    query: 'koncert v Ostravě příští měsíc do 800 Kč',
    locale: 'cs',
    now: '2026-11-17T20:05:00+01:00',
    turnstileToken: 'test-token'
  }));
  assert.equal(verified, true);
  assert.equal(response.status, 200);
  const { intent, needsClarification } = await bodyJson(response);
  assert.equal(needsClarification, false);
  assert.equal(intent.category, 'concert');
  assert.equal(intent.place.label, 'Ostrava');
  assert.deepEqual(intent.date, { type: 'range', preset: '', from: '2026-12-01', to: '2026-12-31' });
  assert.deepEqual(intent.unsupportedPreferences, [{ type: 'max_price', value: 800, currency: 'CZK', unit: '' }]);
});

test('explicit queries still require a verified request', async () => {
  const handler = createAiEventSearchHandler({
    env: { OPENAI_API_KEY: 'test-key' },
    verifyTurnstileImpl: async () => ({ ok: false, code: 'verification-failed' }),
    fetchImpl: async () => assert.fail('Unverified requests must not call the model')
  });
  const response = await handler(makeRequest({
    query: 'koncert v Ostravě příští měsíc do 800 Kč',
    locale: 'cs',
    now: '2026-11-17T20:05:00+01:00',
    turnstileToken: 'test-token'
  }));
  assert.equal((await bodyJson(response)).ok, false);
});

test('explicit currency corrects the model while preserving independent clarification', async () => {
  const intent = validIntent();
  intent.unsupportedPreferences = [{ type: 'max_price', value: 800, currency: '', unit: '' }];
  intent.clarification = {
    required: true,
    question: 'Myslíte maximální cenu 800 CZK?',
    fields: ['unsupportedPreferences']
  };
  const handler = createAiEventSearchHandler({
    env: { OPENAI_API_KEY: 'test-key' },
    fetchImpl: async () => modelResponse(intent)
  });

  const request = query => makeRequest({
    query, locale: 'cs', now: '2026-11-17T20:05:00+01:00', turnstileToken: 'test-token'
  });
  const resolved = await bodyJson(await handler(request('jazzový koncert v Praze příští měsíc do 800 Kč')));
  assert.equal(resolved.intent.unsupportedPreferences[0].currency, 'CZK');
  assert.equal(resolved.needsClarification, false);
  assert.deepEqual(resolved.intent.clarification, { required: false, question: '', fields: [] });

  intent.clarification = { required: true, question: 'Myslíte Prahu, nebo Brno?', fields: ['place'] };
  const unresolved = await bodyJson(await handler(request('jazzový koncert v Praze nebo Brně do 800 Kč')));
  assert.equal(unresolved.intent.unsupportedPreferences[0].currency, 'CZK');
  assert.equal(unresolved.needsClarification, true);
  assert.equal(unresolved.intent.clarification.question, intent.clarification.question);
});

test('an open-ended request returns guidance without a model call', async () => {
  const handler = createAiEventSearchHandler({
    env: {},
    fetchImpl: async () => assert.fail('No model call is needed for an open-ended request')
  });
  const response = await handler(makeRequest({
    query: 'Nevím, co hledám', locale: 'cs', turnstileToken: 'test-token'
  }));
  const result = await bodyJson(response);
  assert.equal(response.status, 200);
  assert.equal(result.needsDetails, true);
  assert.equal(result.needsClarification, false);
  assert.equal(result.intent.keyword, '');
});

test('a model response that only changes sort order returns guidance', async () => {
  const handler = createAiEventSearchHandler({
    env: { OPENAI_API_KEY: 'test-key' },
    fetchImpl: async () => modelResponse({
      ...createEmptyFilterIntent('cs'), sort: 'relevance', searchMode: 'discovery', keywordMatch: 'soft'
    })
  });
  const response = await handler(makeRequest({
    query: 'Rád bych se nějak zabavil', locale: 'cs', turnstileToken: 'test-token'
  }));
  const result = await bodyJson(response);
  assert.equal(result.ok, true);
  assert.equal(result.needsDetails, true);
});

test('the endpoint normalizes a city left misspelled by the model while preserving a genre', async () => {
  const intent = validIntent();
  intent.place = { type: 'city', label: 'Ostrvae', countryCode: 'CZ', nearby: false, radiusKm: null };
  intent.keyword = 'jazz';
  const handler = createAiEventSearchHandler({
    env: { OPENAI_API_KEY: 'test-key' },
    fetchImpl: async () => modelResponse(intent)
  });
  const response = await handler(makeRequest({
    query: 'jazzový koncert v Ostrvae', locale: 'cs', turnstileToken: 'test-token'
  }));
  const result = await bodyJson(response);
  assert.equal(result.intent.place.label, 'Ostrava');
  assert.equal(result.intent.keyword, 'jazz');
  assert.equal(result.needsDetails, undefined);
});

test('a catalogue city absent from the short alias list can be searched exactly', async () => {
  const handler = createAiEventSearchHandler({
    env: {},
    loadCityCatalog: async () => [{ city: 'Břeclav', countryCode: 'CZ', aliases: ['Breclav'] }],
    fetchImpl: async () => assert.fail('The city is a known catalogue location')
  });
  const response = await handler(makeRequest({
    query: 'akce v Breclavi', locale: 'cs', turnstileToken: 'test-token'
  }));
  const result = await bodyJson(response);
  assert.equal(result.ok, true);
  assert.equal(result.intent.place.label, 'Břeclav');
  assert.equal(result.needsDetails, undefined);
});
