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

        search_source:
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

test('AI outcome uses one direct GA4 event after explicit consent', () => {
  const commands = [];
  const target = {
    location: new URL('https://ajsee.cz/events?q=private&lat=12&lon=34&utm_source=instagram'),
    localStorage: { getItem: () => JSON.stringify({ analytics: true }) },
    gtag: (...args) => commands.push(args)
  };
  const payload = trackAiSearchOutcome({ outcome: 'clarification', locale: 'en' }, target);
  assert.equal(commands.length, 1);
  assert.equal(commands[0][1], 'ai_event_search_result');
  assert.equal(commands[0][2].search_source, 'ai_event_search');
  assert.equal(commands[0][2].page_location, 'https://ajsee.cz/events?utm_source=instagram');
  assert.equal(commands[0][2].page_path, '/events');
  assert.equal(Object.hasOwn(commands[0][2], 'source'), false);
  assert.equal(target.dataLayer, undefined);
  assert.equal(target.__ajsee.lastAiSearchEvent, payload);
});

test('AI outcome cannot enqueue events without consent or when disabled', () => {
  const commands = [];
  const target = {
    location: new URL('https://ajsee.cz/events'),
    localStorage: { getItem: () => JSON.stringify({ analytics: false }) },
    gtag: (...args) => commands.push(args)
  };
  const payload = trackAiSearchOutcome({ outcome: 'success', locale: 'cs' }, target);
  assert.equal(commands.length, 0);
  assert.equal(target.dataLayer, undefined);
  assert.equal(target.__ajsee.lastAiSearchEvent, payload);
  target.localStorage.getItem = () => JSON.stringify({ analytics: true });
  trackAiSearchOutcome({ outcome: 'success' }, target, { pushToDataLayer: false });
  assert.equal(commands.length, 0);
});
