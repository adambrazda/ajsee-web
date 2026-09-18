import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAiSearchLearningTracker
} from '../src/ai-search/learning.js';

import {
  createAiSearchLearningHandler
} from '../netlify/functions/ai-search-learning.js';

function baseFilters() {
  return {
    category:
      'theatre',

    audience:
      'any',

    sort:
      'nearest',

    placeType:
      'city',

    city:
      'Praha',

    cityLabel:
      'Praha',

    cityCountryCode:
      'CZ',

    countryCode:
      'CZ',

    dateFrom:
      '',

    dateTo:
      '',

    keyword:
      '',

    maxPrice:
      null,

    priceCurrency:
      '',

    nearMeRadiusKm:
      null
  };
}

test(
  'feedback is consent-gated, sequenced, changeable and deduped',
  () => {
    const calls =
      [];

    let consent =
      true;

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => consent,

        cryptoImpl: {
          randomUUID:
            () =>
              'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        },

        fetchImpl:
          (
            url,
            options
          ) => {
            calls.push({
              url,

              body:
                JSON.parse(
                  options.body
                )
            });

            return Promise.resolve({
              ok:
                true
            });
          }
      });

    tracker.begin({
      locale:
        'cs',

      page:
        'home',

      filters:
        baseFilters()
    });

    assert.equal(
      calls.length,
      1
    );

    const helpful =
      tracker.feedback(
        'helpful'
      );

    assert.deepEqual(
      helpful,
      {
        schemaVersion:
          1,

        event:
          'search_feedback',

        searchId:
          'as_dddddddddddd4ddd8ddddddddddddddd',

        sequence:
          1,

        locale:
          'cs',

        page:
          'home',

        feedback:
          'helpful'
      }
    );

    assert.equal(
      calls.length,
      2
    );

    assert.equal(
      tracker.feedback(
        'helpful'
      ),
      null
    );

    assert.equal(
      calls.length,
      2
    );

    const changed =
      tracker.feedback(
        'not_helpful'
      );

    assert.equal(
      changed.sequence,
      2
    );

    assert.equal(
      changed.feedback,
      'not_helpful'
    );

    assert.equal(
      calls.length,
      3
    );

    assert.equal(
      tracker.feedback(
        'invalid'
      ),
      null
    );

    assert.equal(
      calls.length,
      3
    );

    const feedbackBodies =
      calls
        .map(
          item =>
            item.body
        )
        .filter(
          body =>
            body.event ===
            'search_feedback'
        );

    assert.deepEqual(
      feedbackBodies.map(
        body =>
          body.feedback
      ),
      [
        'helpful',
        'not_helpful'
      ]
    );

    for (
      const body
      of feedbackBodies
    ) {
      assert.deepEqual(
        Object.keys(
          body
        ).sort(),
        [
          'event',
          'feedback',
          'locale',
          'page',
          'schemaVersion',
          'searchId',
          'sequence'
        ].sort()
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            body,
            'filters'
          ),
        false
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            body,
            'eventRefHash'
          ),
        false
      );
    }

    consent =
      false;

    assert.equal(
      tracker.feedback(
        'helpful'
      ),
      null
    );

    assert.equal(
      calls.length,
      3
    );

    consent =
      true;

    assert.equal(
      tracker.feedback(
        'helpful'
      ),
      null
    );

    assert.equal(
      calls.length,
      3
    );
  }
);

test(
  'backend persists only the privacy-safe feedback contract',
  async () => {
    const writes =
      [];

    const handler =
      createAiSearchLearningHandler({
        nowProvider:
          () =>
            new Date(
              '2026-09-17T18:00:00.000Z'
            ),

        getStoreFn:
          () => ({
            setJSON:
              async (
                key,
                value
              ) => {
                writes.push({
                  key,
                  value
                });

                return {
                  modified:
                    true
                };
              }
          })
      });

    const response =
      await handler(
        new Request(
          'https://ajsee.cz/api/ai-search-learning',
          {
            method:
              'POST',

            headers: {
              Origin:
                'https://ajsee.cz',

              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                schemaVersion:
                  1,

                event:
                  'search_feedback',

                searchId:
                  'as_eeeeeeeeeeee4eee8eeeeeeeeeeeeeee',

                sequence:
                  1,

                locale:
                  'en',

                page:
                  'events',

                feedback:
                  'helpful'
              })
          }
        )
      );

    assert.equal(
      response.status,
      202
    );

    assert.equal(
      writes.length,
      1
    );

    assert.match(
      writes[0].key,
      /0001-search_feedback\.json$/
    );

    assert.equal(
      writes[0].value.event,
      'search_feedback'
    );

    assert.equal(
      writes[0].value.feedback,
      'helpful'
    );

    assert.equal(
      writes[0].value.sequence,
      1
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          writes[0].value,
          'filters'
        ),
      false
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          writes[0].value,
          'eventRefHash'
        ),
      false
    );
  }
);

test(
  'backend prevents feedback from crossing filter and behavior contracts',
  async () => {
    const handler =
      createAiSearchLearningHandler({
        getStoreFn:
          () => ({
            setJSON:
              async () => ({
                modified:
                  true
              })
          })
      });

    async function send(
      payload
    ) {
      const response =
        await handler(
          new Request(
            'https://ajsee.cz/api/ai-search-learning',
            {
              method:
                'POST',

              headers: {
                Origin:
                  'https://ajsee.cz',

                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          )
        );

      return {
        status:
          response.status,

        body:
          await response.json()
      };
    }

    const feedbackWithBehavior =
      await send({
        schemaVersion:
          1,

        event:
          'search_feedback',

        searchId:
          'as_ffffffffffff4fff8fffffffffffffff',

        sequence:
          1,

        locale:
          'cs',

        page:
          'home',

        feedback:
          'helpful',

        provider:
          'ticketmaster'
      });

    assert.equal(
      feedbackWithBehavior.status,
      400
    );

    assert.equal(
      feedbackWithBehavior.body.error,
      'unexpected-behavior-field'
    );

    const behaviorWithFeedback =
      await send({
        schemaVersion:
          1,

        event:
          'event_opened',

        searchId:
          'as_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa',

        sequence:
          1,

        locale:
          'cs',

        page:
          'home',

        eventRefHash:
          '',

        provider:
          'ticketmaster',

        resultPosition:
          1,

        placement:
          'event_card',

        feedback:
          'helpful'
      });

    assert.equal(
      behaviorWithFeedback.status,
      400
    );

    assert.equal(
      behaviorWithFeedback.body.error,
      'unexpected-feedback-field'
    );

    const filterWithFeedback =
      await send({
        schemaVersion:
          1,

        event:
          'filters_applied',

        searchId:
          'as_bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb',

        sequence:
          0,

        locale:
          'cs',

        page:
          'home',

        feedback:
          'helpful',

        filters: {
          category:
            'all',

          audience:
            'any',

          sort:
            'nearest',

          placeType:
            'none',

          cityPresent:
            false,

          cityCountryCode:
            '',

          countryCode:
            '',

          dateFrom:
            '',

          dateTo:
            '',

          keywordPresent:
            false,

          maxPrice:
            null,

          priceCurrency:
            '',

          nearMeRadiusKm:
            null
        }
      });

    assert.equal(
      filterWithFeedback.status,
      400
    );

    assert.equal(
      filterWithFeedback.body.error,
      'unexpected-feedback-field'
    );

    const invalidFeedback =
      await send({
        schemaVersion:
          1,

        event:
          'search_feedback',

        searchId:
          'as_cccccccccccc4ccc8ccccccccccccccc',

        sequence:
          1,

        locale:
          'cs',

        page:
          'events',

        feedback:
          'maybe'
      });

    assert.equal(
      invalidFeedback.status,
      400
    );

    assert.equal(
      invalidFeedback.body.error,
      'invalid-feedback'
    );
  }
);
