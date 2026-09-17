import test from 'node:test';
import assert from 'node:assert/strict';

import {
  config,
  createAiSearchLearningHandler
} from '../netlify/functions/ai-search-learning.js';

function validFilters() {
  return {
    category:
      'theatre',

    audience:
      'any',

    sort:
      'nearest',

    placeType:
      'city',

    cityPresent:
      true,

    cityCountryCode:
      'CZ',

    countryCode:
      'CZ',

    dateFrom:
      '2026-09-19',

    dateTo:
      '2026-09-20',

    keywordPresent:
      true,

    maxPrice:
      1000,

    priceCurrency:
      'CZK',

    nearMeRadiusKm:
      null
  };
}

function validAppliedPayload() {
  return {
    schemaVersion:
      1,

    event:
      'filters_applied',

    searchId:
      'as_123e4567e89b12d3a456426614174000',

    sequence:
      0,

    locale:
      'cs',

    page:
      'events',

    filters:
      validFilters()
  };
}

function createStoreHarness({
  modified = true
} = {}) {
  const calls =
    [];

  const getStoreFn =
    options => ({
      setJSON:
        async (
          key,
          value,
          writeOptions
        ) => {
          calls.push({
            options,
            key,
            value,
            writeOptions
          });

          return {
            modified
          };
        }
    });

  return {
    calls,
    getStoreFn
  };
}

function createRequest(
  body,
  {
    method =
      'POST',

    url =
      'https://deploy-preview-200--ajsee-demo.netlify.app/api/ai-search-learning',

    origin =
      'https://deploy-preview-200--ajsee-demo.netlify.app',

    contentType =
      'application/json'
  } = {}
) {
  const headers =
    {};

  if (origin !== null) {
    headers.Origin =
      origin;
  }

  if (contentType !== null) {
    headers['Content-Type'] =
      contentType;
  }

  return new Request(
    url,
    {
      method,
      headers,

      ...(
        method ===
          'POST'
          ? {
              body:
                typeof body ===
                  'string'
                  ? body
                  : JSON.stringify(
                      body
                    )
            }
          : {}
      )
    }
  );
}

test(
  'valid applied event writes sanitized preview-isolated record',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn,

        nowProvider:
          () =>
            new Date(
              '2026-09-17T10:15:30.000Z'
            )
      });

    const response =
      await handler(
        createRequest(
          validAppliedPayload()
        )
      );

    assert.equal(
      response.status,
      202
    );

    assert.equal(
      calls.length,
      1
    );

    assert.deepEqual(
      calls[0].options,
      {
        name:
          'ai-search-learning-v1-preview-200',

        consistency:
          'strong'
      }
    );

    assert.equal(
      calls[0].key,
      'sessions/2026-09-17/' +
        'as_123e4567e89b12d3a456426614174000/' +
        '0000-filters_applied.json'
    );

    assert.equal(
      calls[0].value.event,
      'filters_applied'
    );

    assert.equal(
      calls[0].value.filters
        .cityPresent,
      true
    );

    assert.equal(
      calls[0].value.filters
        .keywordPresent,
      true
    );

    assert.equal(
      calls[0].value.createdAt,
      '2026-09-17T10:15:30.000Z'
    );

    const serialized =
      JSON.stringify(
        calls[0].value
      );

    assert.doesNotMatch(
      serialized,
      /Praha/i
    );

    assert.doesNotMatch(
      serialized,
      /Phantom/i
    );

    assert.equal(
      calls[0].writeOptions
        .onlyIfNew,
      true
    );
  }
);

test(
  'valid correction event persists only structured correction fields',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn,

        nowProvider:
          () =>
            new Date(
              '2026-09-17T10:20:00.000Z'
            )
      });

    const payload = {
      ...validAppliedPayload(),

      event:
        'filters_corrected',

      sequence:
        1,

      correctedFields: [
        'place',
        'price'
      ]
    };

    const response =
      await handler(
        createRequest(
          payload
        )
      );

    assert.equal(
      response.status,
      202
    );

    assert.deepEqual(
      calls[0].value
        .correctedFields,
      [
        'place',
        'price'
      ]
    );

    assert.equal(
      calls[0].key,
      'sessions/2026-09-17/' +
        payload.searchId +
        '/0001-filters_corrected.json'
    );
  }
);

test(
  'canonical Near Me and city-radius place types are accepted',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn
      });

    for (
      const placeType
      of [
        'near_me',
        'city_radius'
      ]
    ) {
      const payload =
        validAppliedPayload();

      payload.searchId =
        placeType ===
          'near_me'
          ? 'as_11111111111111111111111111111111'
          : 'as_22222222222222222222222222222222';

      payload.filters = {
        ...payload.filters,

        placeType,

        nearMeRadiusKm:
          50
      };

      const response =
        await handler(
          createRequest(
            payload
          )
        );

      assert.equal(
        response.status,
        202
      );
    }

    assert.equal(
      calls.length,
      2
    );

    assert.equal(
      calls[0].value.filters
        .placeType,
      'near_me'
    );

    assert.equal(
      calls[1].value.filters
        .placeType,
      'city_radius'
    );
  }
);

test(
  'unknown top-level fields are rejected before storage',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn
      });

    const payload = {
      ...validAppliedPayload(),

      rawText:
        'muzikál v Praze'
    };

    const response =
      await handler(
        createRequest(
          payload
        )
      );

    assert.equal(
      response.status,
      400
    );

    assert.deepEqual(
      await response.json(),
      {
        error:
          'unexpected-payload-field'
      }
    );

    assert.equal(
      calls.length,
      0
    );
  }
);

test(
  'unknown filter fields cannot smuggle location text into storage',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn
      });

    const payload =
      validAppliedPayload();

    payload.filters = {
      ...payload.filters,

      cityText:
        'Praha'
    };

    const response =
      await handler(
        createRequest(
          payload
        )
      );

    assert.equal(
      response.status,
      400
    );

    assert.equal(
      calls.length,
      0
    );
  }
);

test(
  'foreign browser origin is rejected without storage',
  async () => {
    const {
      calls,
      getStoreFn
    } =
      createStoreHarness();

    const handler =
      createAiSearchLearningHandler({
        getStoreFn
      });

    const response =
      await handler(
        createRequest(
          validAppliedPayload(),
          {
            origin:
              'https://example.com'
          }
        )
      );

    assert.equal(
      response.status,
      403
    );

    assert.equal(
      response.headers.get(
        'access-control-allow-origin'
      ),
      null
    );

    assert.equal(
      calls.length,
      0
    );
  }
);

test(
  'OPTIONS works only after same-origin validation',
  async () => {
    const handler =
      createAiSearchLearningHandler({
        getStoreFn:
          () => {
            throw new Error(
              'Store must not be used.'
            );
          }
      });

    const allowed =
      await handler(
        createRequest(
          null,
          {
            method:
              'OPTIONS',

            contentType:
              null
          }
        )
      );

    assert.equal(
      allowed.status,
      204
    );

    const blocked =
      await handler(
        createRequest(
          null,
          {
            method:
              'OPTIONS',

            origin:
              'https://example.com',

            contentType:
              null
          }
        )
      );

    assert.equal(
      blocked.status,
      403
    );
  }
);

test(
  'non-JSON POST is rejected',
  async () => {
    const handler =
      createAiSearchLearningHandler({
        getStoreFn:
          () => {
            throw new Error(
              'Store must not be used.'
            );
          }
      });

    const response =
      await handler(
        createRequest(
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
  'duplicate write remains accepted but reports not modified',
  async () => {
    const {
      getStoreFn
    } =
      createStoreHarness({
        modified:
          false
      });

    const handler =
      createAiSearchLearningHandler({
        getStoreFn
      });

    const response =
      await handler(
        createRequest(
          validAppliedPayload()
        )
      );

    assert.equal(
      response.status,
      202
    );

    assert.deepEqual(
      await response.json(),
      {
        accepted:
          true,

        modified:
          false
      }
    );
  }
);

test(
  'function config exposes bounded rate limit',
  () => {
    assert.equal(
      config.path,
      '/api/ai-search-learning'
    );

    assert.equal(
      config.rateLimit.windowLimit,
      60
    );

    assert.equal(
      config.rateLimit.windowSize,
      60
    );

    assert.deepEqual(
      config.rateLimit.aggregateBy,
      [
        'ip',
        'domain'
      ]
    );
  }
);
