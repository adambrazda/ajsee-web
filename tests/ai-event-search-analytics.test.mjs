import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAiSearchAnalyticsPayload,
  trackAiSearchOutcome
} from '../src/ai-search/analytics.js';

test(
  'AI search analytics emits only privacy-safe operational fields',
  () => {
    const payload =
      buildAiSearchAnalyticsPayload({
        outcome:
          'success',

        locale:
          'cs-CZ',

        pagePath:
          '/events?query=very-secret-value',

        durationMs:
          1234.4,

        httpStatus:
          200,

        clarificationRound:
          1,

        query:
          'private query',

        question:
          'private clarification',

        city:
          'Private City'
      });

    assert.deepEqual(
      payload,
      {
        event:
          'ai_event_search_result',

        source:
          'ai_event_search',

        page_path:
          '/events',

        locale:
          'cs',

        outcome:
          'success',

        duration_ms:
          1234,

        http_status:
          200,

        error_code:
          'none',

        clarification_round:
          1
      }
    );

    const serialized =
      JSON.stringify(
        payload
      );

    assert.doesNotMatch(
      serialized,
      /private query/i
    );

    assert.doesNotMatch(
      serialized,
      /private clarification/i
    );

    assert.doesNotMatch(
      serialized,
      /Private City/i
    );

    assert.doesNotMatch(
      serialized,
      /very-secret-value/i
    );
  }
);

test(
  'AI search analytics normalizes error metadata without storing free-form text',
  () => {
    const payload =
      buildAiSearchAnalyticsPayload({
        outcome:
          'error',

        locale:
          'xx',

        pagePath:
          '/something-user-controlled',

        durationMs:
          999999,

        httpStatus:
          503,

        errorCode:
          'AI_TIMEOUT !!!',

        clarificationRound:
          99
      });

    assert.equal(
      payload.locale,
      'unknown'
    );

    assert.equal(
      payload.page_path,
      '/'
    );

    assert.equal(
      payload.duration_ms,
      120000
    );

    assert.equal(
      payload.http_status,
      503
    );

    assert.equal(
      payload.error_code,
      'ai-timeout'
    );

    assert.equal(
      payload.clarification_round,
      10
    );
  }
);

test(
  'AI search analytics pushes one dataLayer event and exposes a smoke-test snapshot',
  () => {
    const target = {
      location: {
        pathname:
          '/events'
      }
    };

    const payload =
      trackAiSearchOutcome(
        {
          outcome:
            'clarification',

          locale:
            'en',

          durationMs:
            750,

          httpStatus:
            200,

          clarificationRound:
            1
        },
        target
      );

    assert.deepEqual(
      target.dataLayer,
      [
        payload
      ]
    );

    assert.equal(
      target.__ajsee
        .lastAiSearchEvent,
      payload
    );
  }
);


test(
  'AI search analytics keeps a smoke snapshot without enqueueing analytics',
  () => {
    const target = {
      location: {
        pathname:
          '/events'
      },

      dataLayer:
        []
    };

    const payload =
      trackAiSearchOutcome(
        {
          outcome:
            'success',

          locale:
            'cs',

          durationMs:
            321,

          httpStatus:
            200
        },
        target,
        {
          pushToDataLayer:
            false
        }
      );

    assert.equal(
      target.dataLayer.length,
      0
    );

    assert.deepEqual(
      target.__ajsee
        .lastAiSearchEvent,
      payload
    );
  }
);
