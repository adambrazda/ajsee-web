import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildAiSearchLearningFilterSummary,
  createAiSearchLearningTracker,
  diffAiSearchLearningFilters
} from '../src/ai-search/learning.js';

import {
  createAiSearchLearningHandler
} from '../netlify/functions/ai-search-learning.js';

function baseFilters() {
  return {
    category: 'theatre',
    audience: '',
    sort: 'nearest',
    placeType: 'city',
    city: 'Praha',
    cityLabel: 'Praha',
    cityCountryCode: 'CZ',
    countryCode: 'CZ',
    dateFrom: '2026-09-19',
    dateTo: '2026-09-20',
    keyword: 'Phantom of the Opera',
    maxPrice: 1000,
    priceCurrency: 'CZK',
    nearMeRadiusKm: 50
  };
}

test(
  'learning filter summary never exposes city or keyword text',
  () => {
    const summary =
      buildAiSearchLearningFilterSummary(
        baseFilters()
      );

    assert.equal(
      summary.cityPresent,
      true
    );

    assert.equal(
      summary.keywordPresent,
      true
    );

    assert.equal(
      summary.cityCountryCode,
      'CZ'
    );

    assert.equal(
      summary.maxPrice,
      1000
    );

    const serialized =
      JSON.stringify(
        summary
      );

    assert.doesNotMatch(
      serialized,
      /Praha/i
    );

    assert.doesNotMatch(
      serialized,
      /Phantom/i
    );
  }
);

test(
  'runtime Near Me and city-radius values are canonicalized without coordinates',
  () => {
    const nearMe =
      buildAiSearchLearningFilterSummary({
        ...baseFilters(),

        placeType:
          'nearMe',

        city:
          '',

        cityLabel:
          'Near me',

        cityCountryCode:
          '',

        nearMeLat:
          49.123456,

        nearMeLon:
          16.654321,

        nearMeRadiusKm:
          35
      });

    assert.equal(
      nearMe.placeType,
      'near_me'
    );

    assert.equal(
      nearMe.nearMeRadiusKm,
      35
    );

    const cityRadius =
      buildAiSearchLearningFilterSummary({
        ...baseFilters(),

        placeType:
          'cityRadius',

        nearMeLat:
          50.123456,

        nearMeLon:
          14.654321,

        nearMeRadiusKm:
          50
      });

    assert.equal(
      cityRadius.placeType,
      'city_radius'
    );

    assert.equal(
      cityRadius.nearMeRadiusKm,
      50
    );

    const serialized =
      JSON.stringify({
        nearMe,
        cityRadius
      });

    assert.doesNotMatch(
      serialized,
      /nearMeLat/
    );

    assert.doesNotMatch(
      serialized,
      /nearMeLon/
    );

    assert.doesNotMatch(
      serialized,
      /49\.123456/
    );

    assert.doesNotMatch(
      serialized,
      /16\.654321/
    );
  }
);

test(
  'filter diff groups privacy-sensitive place changes into place',
  () => {
    const previous =
      baseFilters();

    const current = {
      ...previous,
      city: 'Brno',
      cityLabel: 'Brno',
      maxPrice: 1200
    };

    assert.deepEqual(
      diffAiSearchLearningFilters(
        previous,
        current
      ),
      [
        'place',
        'price'
      ]
    );
  }
);

test(
  'tracker does nothing without analytics consent',
  () => {
    const calls =
      [];

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => false,

        fetchImpl:
          (...args) => {
            calls.push(args);
            return Promise.resolve({
              ok: true
            });
          }
      });

    const searchId =
      tracker.begin({
        locale: 'cs',
        page: 'events',
        filters: baseFilters()
      });

    assert.equal(
      searchId,
      null
    );

    assert.equal(
      calls.length,
      0
    );
  }
);

test(
  'tracker emits sanitized applied and correction events',
  () => {
    const calls =
      [];

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => true,

        cryptoImpl: {
          randomUUID:
            () =>
              '123e4567-e89b-12d3-a456-426614174000'
        },

        fetchImpl:
          (url, options) => {
            calls.push({
              url,
              options,
              body:
                JSON.parse(
                  options.body
                )
            });

            return Promise.resolve({
              ok: true
            });
          }
      });

    const searchId =
      tracker.begin({
        locale: 'cs',
        page: 'events',
        filters: baseFilters()
      });

    assert.equal(
      searchId,
      'as_123e4567e89b12d3a456426614174000'
    );

    assert.equal(
      calls.length,
      1
    );

    assert.equal(
      calls[0].url,
      '/api/ai-search-learning'
    );

    assert.equal(
      calls[0].body.event,
      'filters_applied'
    );

    assert.equal(
      calls[0].body.sequence,
      0
    );

    assert.equal(
      calls[0].body.filters.cityPresent,
      true
    );

    assert.equal(
      calls[0].body.filters.keywordPresent,
      true
    );

    assert.deepEqual(
      tracker.record(
        baseFilters()
      ),
      []
    );

    assert.equal(
      calls.length,
      1
    );

    const corrected = {
      ...baseFilters(),
      city: 'Brno',
      cityLabel: 'Brno',
      maxPrice: 1200
    };

    assert.deepEqual(
      tracker.record(
        corrected
      ),
      [
        'place',
        'price'
      ]
    );

    assert.equal(
      calls.length,
      2
    );

    assert.equal(
      calls[1].body.event,
      'filters_corrected'
    );

    assert.equal(
      calls[1].body.sequence,
      1
    );

    assert.deepEqual(
      calls[1].body.correctedFields,
      [
        'place',
        'price'
      ]
    );

    assert.equal(
      calls[1].body.filters.maxPrice,
      1200
    );

    const serialized =
      JSON.stringify(
        calls.map(
          call => call.body
        )
      );

    assert.doesNotMatch(
      serialized,
      /Praha/i
    );

    assert.doesNotMatch(
      serialized,
      /Brno/i
    );

    assert.doesNotMatch(
      serialized,
      /Phantom/i
    );

    tracker.reset();

    tracker.record({
      ...corrected,
      category: 'concert'
    });

    assert.equal(
      calls.length,
      2
    );
  }
);


test(
  'learning tracker and backend do not create false corrections across rerender, language change, or second AI search',
  async () => {
    const writes =
      [];

    const getStoreFn =
      options => ({
        setJSON:
          async (
            key,
            value,
            writeOptions
          ) => {
            writes.push({
              options,
              key,
              value,
              writeOptions
            });

            return {
              modified:
                true
            };
          }
      });

    const handler =
      createAiSearchLearningHandler({
        getStoreFn,

        nowProvider:
          () =>
            new Date(
              '2026-09-17T11:00:00.000Z'
            )
      });

    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    ];

    let idIndex =
      0;

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => true,

        cryptoImpl: {
          randomUUID:
            () =>
              ids[
                idIndex++
              ]
        },

        fetchImpl:
          (
            url,
            options = {}
          ) => {
            const request =
              new Request(
                new URL(
                  url,
                  'https://ajsee.cz'
                ),
                {
                  method:
                    options.method ||
                    'GET',

                  headers: {
                    ...(
                      options.headers ||
                      {}
                    ),

                    Origin:
                      'https://ajsee.cz'
                  },

                  body:
                    options.body
                }
              );

            return handler(
              request
            );
          }
      });

    const flush =
      () =>
        new Promise(
          resolve =>
            setImmediate(
              resolve
            )
        );

    const first =
      baseFilters();

    const firstId =
      tracker.begin({
        locale:
          'cs',

        page:
          'events',

        filters:
          first
      });

    await flush();
    await flush();

    assert.equal(
      writes.length,
      1
    );

    /*
     * Ordinary rerender:
     * identical filter state must not
     * create filters_corrected.
     */
    assert.deepEqual(
      tracker.record({
        ...first
      }),
      []
    );

    await flush();

    assert.equal(
      writes.length,
      1
    );

    /*
     * Language changes are outside the
     * filter snapshot. If the filters
     * themselves stay identical, no
     * correction may be emitted.
     */
    assert.deepEqual(
      tracker.record({
        ...first
      }),
      []
    );

    await flush();

    assert.equal(
      writes.length,
      1
    );

    /*
     * A second AI search must replace
     * the first learning session rather
     * than becoming a manual correction.
     */
    const second = {
      ...first,
      city:
        'Brno',
      cityLabel:
        'Brno'
    };

    const secondId =
      tracker.begin({
        locale:
          'en',

        page:
          'events',

        filters:
          second
      });

    await flush();
    await flush();

    assert.notEqual(
      firstId,
      secondId
    );

    assert.equal(
      writes.length,
      2
    );

    assert.deepEqual(
      writes.map(
        item =>
          item.value.event
      ),
      [
        'filters_applied',
        'filters_applied'
      ]
    );

    assert.equal(
      writes[1].value
        .searchId,
      secondId
    );

    assert.equal(
      writes[1].value
        .locale,
      'en'
    );

    /*
     * Rendering the second AI result
     * itself must still be silent.
     */
    assert.deepEqual(
      tracker.record({
        ...second
      }),
      []
    );

    await flush();

    assert.equal(
      writes.length,
      2
    );

    /*
     * A real manual correction after
     * the second search must belong to
     * the second search session.
     */
    const manualCorrection = {
      ...second,
      category:
        'concert'
    };

    assert.deepEqual(
      tracker.record(
        manualCorrection
      ),
      [
        'category'
      ]
    );

    await flush();
    await flush();

    assert.equal(
      writes.length,
      3
    );

    assert.equal(
      writes[2].value.event,
      'filters_corrected'
    );

    assert.equal(
      writes[2].value
        .searchId,
      secondId
    );

    assert.equal(
      writes[2].value
        .sequence,
      1
    );

    assert.deepEqual(
      writes[2].value
        .correctedFields,
      [
        'category'
      ]
    );

    const serialized =
      JSON.stringify(
        writes.map(
          item =>
            item.value
        )
      );

    assert.doesNotMatch(
      serialized,
      /Praha/i
    );

    assert.doesNotMatch(
      serialized,
      /Brno/i
    );

    assert.doesNotMatch(
      serialized,
      /Phantom/i
    );
  }
);

test(
  'revoking analytics consent terminates an active learning session',
  async () => {
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
              '33333333-3333-4333-8333-333333333333'
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

    consent =
      false;

    assert.deepEqual(
      tracker.record({
        ...baseFilters(),
        category:
          'concert'
      }),
      []
    );

    assert.equal(
      calls.length,
      1
    );

    consent =
      true;

    tracker.record({
      ...baseFilters(),
      category:
        'festival'
    });

    assert.equal(
      calls.length,
      1
    );
  }
);

test(
  'home and events entrypoints preserve required learning hook order',
  () => {
    for (
      const file
      of [
        'src/home-entry.js',
        'src/events-entry.js'
      ]
    ) {
      const source =
        fs.readFileSync(
          file,
          'utf8'
        );

      const applyStart =
        source.indexOf(
          'async function applyAiEventSearchIntent(intent)'
        );

      assert.notEqual(
        applyStart,
        -1,
        file + ': apply function missing'
      );

      const resetIndex =
        source.indexOf(
          'resetAiSearchLearningSession();',
          applyStart
        );

      const mappedIndex =
        source.indexOf(
          'const mapped =',
          applyStart
        );

      const renderIndex =
        source.indexOf(
          'await renderAndSync({',
          applyStart
        );

      const beginIndex =
        source.indexOf(
          'beginAiSearchLearningSession({',
          applyStart
        );

      assert.ok(
        resetIndex >
          applyStart,
        file +
          ': reset must be inside AI apply'
      );

      assert.ok(
        resetIndex <
          mappedIndex,
        file +
          ': reset must occur before AI mapping'
      );

      assert.ok(
        renderIndex >
          mappedIndex,
        file +
          ': render must follow AI mapping'
      );

      assert.ok(
        beginIndex >
          renderIndex,
        file +
          ': learning session must begin after AI render'
      );

      const recordCount =
        (
          source.match(
            /recordAiSearchFilterState\(/g
          ) ||
          []
        ).length;

      assert.equal(
        recordCount,
        2,
        file +
          ': expected exactly two render tracking hooks'
      );
    }
  }
);


test(
  'behavior signals are consent-gated, sequenced and never expose raw event identity',
  async () => {
    const calls =
      [];

    const rawHashes =
      [];

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => true,

        cryptoImpl: {
          randomUUID:
            () =>
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          subtle: {
            digest:
              async (
                algorithm,
                bytes
              ) => {
                rawHashes.push(
                  new TextDecoder()
                    .decode(
                      bytes
                    )
                );

                assert.equal(
                  algorithm,
                  'SHA-256'
                );

                return Uint8Array.from(
                  {
                    length:
                      32
                  },
                  (_, index) =>
                    index
                ).buffer;
              }
          }
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
        'events',

      filters:
        baseFilters()
    });

    const opened =
      await tracker.eventOpened({
        eventRef:
          'ticketmaster-secret-event-123',

        provider:
          'ticketmaster',

        resultPosition:
          3,

        placement:
          'event_card'
      });

    assert.equal(
      opened.event,
      'event_opened'
    );

    assert.equal(
      opened.sequence,
      1
    );

    assert.equal(
      opened.eventRefHash,
      'ev_000102030405060708090a0b0c0d0e0f'
    );

    const clickout =
      await tracker.partnerClickout({
        eventRef:
          'ticketmaster-secret-event-123',

        provider:
          'ticketmaster',

        resultPosition:
          3,

        placement:
          'event_modal'
      });

    assert.equal(
      clickout.event,
      'partner_clickout'
    );

    assert.equal(
      clickout.sequence,
      2
    );

    assert.equal(
      calls.length,
      3
    );

    assert.deepEqual(
      rawHashes,
      [
        'ticketmaster-secret-event-123',
        'ticketmaster-secret-event-123'
      ]
    );

    const behaviorBodies =
      calls
        .map(
          item =>
            item.body
        )
        .filter(
          body =>
            body.event !==
            'filters_applied'
        );

    assert.equal(
      behaviorBodies.length,
      2
    );

    const allowedKeys = [
      'schemaVersion',
      'event',
      'searchId',
      'sequence',
      'locale',
      'page',
      'eventRefHash',
      'provider',
      'resultPosition',
      'placement'
    ].sort();

    for (
      const body
      of behaviorBodies
    ) {
      assert.deepEqual(
        Object.keys(
          body
        ).sort(),
        allowedKeys
      );
    }

    const serialized =
      JSON.stringify(
        behaviorBodies
      );

    assert.doesNotMatch(
      serialized,
      /ticketmaster-secret-event-123/
    );

    for (
      const forbiddenKey
      of [
        'eventTitle',
        'event_name',
        'eventName',
        'city',
        'eventCity',
        'outboundUrl',
        'outbound_url',
        'destination_url',
        'page_location',
        'clicked_href'
      ]
    ) {
      assert.equal(
        behaviorBodies.some(
          body =>
            Object.prototype
              .hasOwnProperty
              .call(
                body,
                forbiddenKey
              )
        ),
        false,
        'Forbidden behavior key: ' +
          forbiddenKey
      );
    }
  }
);

test(
  'behavior signals reject invalid position, dedupe exact repeats and stop after consent revocation',
  async () => {
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
              'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

          subtle: {
            digest:
              async () =>
                new Uint8Array(
                  32
                ).buffer
          }
        },

        fetchImpl:
          (
            url,
            options
          ) => {
            calls.push(
              JSON.parse(
                options.body
              )
            );

            return Promise.resolve({
              ok:
                true
            });
          }
      });

    tracker.begin({
      locale:
        'en',

      page:
        'home',

      filters:
        baseFilters()
    });

    assert.equal(
      await tracker.eventOpened({
        eventRef:
          'abc123',

        provider:
          'ticketmaster',

        resultPosition:
          0,

        placement:
          'event_card'
      }),
      null
    );

    const first =
      await tracker.eventOpened({
        eventRef:
          'abc123',

        provider:
          'ticketmaster',

        resultPosition:
          1,

        placement:
          'event_card'
      });

    assert.equal(
      first.sequence,
      1
    );

    assert.equal(
      await tracker.eventOpened({
        eventRef:
          'abc123',

        provider:
          'ticketmaster',

        resultPosition:
          1,

        placement:
          'event_card'
      }),
      null
    );

    assert.equal(
      calls.length,
      2
    );

    consent =
      false;

    assert.equal(
      await tracker.partnerClickout({
        eventRef:
          'abc123',

        provider:
          'ticketmaster',

        resultPosition:
          1,

        placement:
          'event_card'
      }),
      null
    );

    assert.equal(
      calls.length,
      2
    );
  }
);


test(
  'concurrent behavior signals preserve interaction sequence and dedupe before hashing',
  async () => {
    const calls =
      [];

    const digestResolvers =
      [];

    let digestCallCount =
      0;

    const tracker =
      createAiSearchLearningTracker({
        consentProvider:
          () => true,

        cryptoImpl: {
          randomUUID:
            () =>
              'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

          subtle: {
            digest:
              async () => {
                const digestIndex =
                  digestCallCount++;

                return new Promise(
                  resolve => {
                    digestResolvers.push(
                      () => {
                        const bytes =
                          new Uint8Array(
                            32
                          );

                        bytes.fill(
                          digestIndex + 1
                        );

                        resolve(
                          bytes.buffer
                        );
                      }
                    );
                  }
                );
              }
          }
        },

        fetchImpl:
          (
            url,
            options
          ) => {
            calls.push(
              JSON.parse(
                options.body
              )
            );

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
        'events',

      filters:
        baseFilters()
    });

    const openedPromise =
      tracker.eventOpened({
        eventRef:
          'event-real-123',

        provider:
          'ticketmaster',

        resultPosition:
          2,

        placement:
          'event_card'
      });

    /*
     * Exact duplicate arrives while the first SHA-256
     * is still pending. It must be rejected immediately.
     */
    const duplicatePromise =
      tracker.eventOpened({
        eventRef:
          'event-real-123',

        provider:
          'ticketmaster',

        resultPosition:
          2,

        placement:
          'event_card'
      });

    const clickoutPromise =
      tracker.partnerClickout({
        eventRef:
          'event-real-123',

        provider:
          'ticketmaster',

        resultPosition:
          2,

        placement:
          'event_modal'
      });

    assert.equal(
      digestResolvers.length,
      2
    );

    assert.equal(
      await duplicatePromise,
      null
    );

    /*
     * Complete the second interaction first.
     * Its reserved sequence must still remain 2.
     */
    digestResolvers[1]();

    const clickout =
      await clickoutPromise;

    assert.equal(
      clickout.sequence,
      2
    );

    digestResolvers[0]();

    const opened =
      await openedPromise;

    assert.equal(
      opened.sequence,
      1
    );

    assert.equal(
      digestCallCount,
      2
    );

    const behaviorCalls =
      calls.filter(
        payload =>
          payload.event ===
            'event_opened' ||
          payload.event ===
            'partner_clickout'
      );

    assert.equal(
      behaviorCalls.length,
      2
    );

    const openedCall =
      behaviorCalls.find(
        payload =>
          payload.event ===
          'event_opened'
      );

    const clickoutCall =
      behaviorCalls.find(
        payload =>
          payload.event ===
          'partner_clickout'
      );

    assert.equal(
      openedCall.sequence,
      1
    );

    assert.equal(
      clickoutCall.sequence,
      2
    );
  }
);
