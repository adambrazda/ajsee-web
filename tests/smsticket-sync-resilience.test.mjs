import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchSmsticketXml,
  isRetryableSmsticketStatus,
  refreshSmsticketFallbackPayload
} from '../src/smsticket-sync-resilience.js';

test(
  'SMS Ticket retry policy only retries transient HTTP failures',
  () => {
    assert.equal(
      isRetryableSmsticketStatus(
        408
      ),
      true
    );

    assert.equal(
      isRetryableSmsticketStatus(
        429
      ),
      true
    );

    assert.equal(
      isRetryableSmsticketStatus(
        500
      ),
      true
    );

    assert.equal(
      isRetryableSmsticketStatus(
        503
      ),
      true
    );

    assert.equal(
      isRetryableSmsticketStatus(
        400
      ),
      false
    );

    assert.equal(
      isRetryableSmsticketStatus(
        401
      ),
      false
    );

    assert.equal(
      isRetryableSmsticketStatus(
        403
      ),
      false
    );

    assert.equal(
      isRetryableSmsticketStatus(
        404
      ),
      false
    );
  }
);

test(
  'SMS Ticket fetch retries one transient network failure',
  async () => {
    let calls =
      0;

    const retries =
      [];

    const xml =
      await fetchSmsticketXml(
        'https://example.test/events',
        {
          timeoutMs:
            1000,

          maxAttempts:
            2,

          retryDelayMs:
            0,

          onRetry(
            detail
          ) {
            retries.push(
              detail
            );
          },

          async fetchImpl() {
            calls +=
              1;

            if (
              calls ===
              1
            ) {
              throw new TypeError(
                'fetch failed'
              );
            }

            return {
              ok:
                true,

              status:
                200,

              async text() {
                return (
                  '<events />'
                );
              }
            };
          }
        }
      );

    assert.equal(
      xml,
      '<events />'
    );

    assert.equal(
      calls,
      2
    );

    assert.equal(
      retries.length,
      1
    );
  }
);

test(
  'SMS Ticket fetch does not retry a non-transient 404',
  async () => {
    let calls =
      0;

    await assert.rejects(
      () =>
        fetchSmsticketXml(
          'https://example.test/events',
          {
            timeoutMs:
              1000,

            maxAttempts:
              2,

            retryDelayMs:
              0,

            async fetchImpl() {
              calls +=
                1;

              return {
                ok:
                  false,

                status:
                  404,

                async text() {
                  return '';
                }
              };
            }
          }
        ),
      /smsticket API returned 404/
    );

    assert.equal(
      calls,
      1
    );
  }
);

test(
  'fallback payload reapplies current image analysis to cached normalized events',
  () => {
    const image =
      'https://www.smsticket.cz/cdn/events/2026/70466/320-test.jpg';

    const payload =
      {
        source:
          'smsticket',

        sourceUrl:
          'https://www.smsticket.cz/api/public/v1.1/events',

        syncedAt:
          '2026-09-01T10:00:00.000Z',

        count:
          1,

        events: [
          {
            id:
              'smsticket-70466',

            sourceId:
              '70466',

            image,

            imagePresentation: {
              fit:
                'contain',

              x:
                50,

              y:
                50,

              source:
                'rules',

              version:
                1
            }
          }
        ]
      };

    const cache =
      {
        version:
          1,

        provider:
          'smsticket',

        assets: {
          [image]: {
            version:
              1,

            source:
              'vision',

            contentType:
              'person',

            confidence:
              0.95,

            cropSafe:
              true,

            x:
              51,

            y:
              53
          }
        }
      };

    const refreshed =
      refreshSmsticketFallbackPayload(
        payload,
        cache,
        '2026-09-05T08:00:00.000Z'
      );

    assert.equal(
      refreshed.syncedAt,
      '2026-09-01T10:00:00.000Z'
    );

    assert.equal(
      refreshed.fallbackRefreshedAt,
      '2026-09-05T08:00:00.000Z'
    );

    assert.equal(
      refreshed.count,
      1
    );

    assert.deepEqual(
      refreshed.events[0]
        .imagePresentation,
      {
        fit:
          'cover',

        x:
          51,

        y:
          53,

        surface:
          'neutral',

        contentType:
          'person',

        cropSafe:
          true,

        confidence:
          0.95,

        source:
          'vision',

        version:
          2
      }
    );
  }
);

test(
  'fallback payload removes stale presentation when current cache has no decision',
  () => {
    const refreshed =
      refreshSmsticketFallbackPayload(
        {
          source:
            'smsticket',

          syncedAt:
            '2026-09-01T10:00:00.000Z',

          count:
            1,

          events: [
            {
              id:
                'smsticket-1',

              image:
                'https://www.smsticket.cz/unknown.jpg',

              imagePresentation: {
                fit:
                  'cover',

                x:
                  20,

                y:
                  20,

                source:
                  'vision',

                version:
                  2
              }
            }
          ]
        },
        {
          version:
            1,

          provider:
            'smsticket',

          assets:
            {}
        },
        '2026-09-05T08:00:00.000Z'
      );

    assert.equal(
      Object.hasOwn(
        refreshed.events[0],
        'imagePresentation'
      ),
      false
    );
  }
);
