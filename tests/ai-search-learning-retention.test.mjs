import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEARNING_RETENTION_DAYS,
  LEARNING_RETENTION_DELETE_CONCURRENCY,
  config,
  createAiSearchLearningRetentionHandler,
  createAiSearchLearningRetentionRunner,
  getLearningRetentionCutoffDate
} from '../netlify/functions/ai-search-learning-retention.js';

test(
  'retention policy is 90 days and scheduled daily',
  () => {
    assert.equal(
      LEARNING_RETENTION_DAYS,
      90
    );

    assert.equal(
      LEARNING_RETENTION_DELETE_CONCURRENCY,
      20
    );

    assert.equal(
      config.schedule,
      '@daily'
    );

    assert.equal(
      getLearningRetentionCutoffDate(
        new Date(
          '2026-09-17T15:00:00.000Z'
        )
      ),
      '2026-06-19'
    );
  }
);

test(
  'retention deletes only expired learning partitions across production and preview stores',
  async () => {
    const deleted =
      [];

    const openedStores =
      [];

    const storeData = {
      'ai-search-learning-v1': [
        'sessions/2026-06-18/as_old/0000-filters_applied.json',
        'sessions/2026-06-19/as_boundary/0000-filters_applied.json',
        'sessions/2026-09-17/as_new/0000-filters_applied.json'
      ],

      'ai-search-learning-v1-preview-186': [
        'sessions/2026-05-01/as_preview_old/0000-filters_applied.json',
        'sessions/2026-09-17/as_preview_new/0000-filters_applied.json'
      ],

      'unrelated-store': [
        'sessions/2020-01-01/nope.json'
      ]
    };

    const listStoresFn =
      async () => ({
        stores:
          Object.keys(
            storeData
          )
      });

    const getStoreFn =
      ({
        name,
        consistency
      }) => {
        openedStores.push({
          name,
          consistency
        });

        return {
          async list({
            directories =
              false,

            prefix =
              ''
          } = {}) {
            const keys =
              storeData[name] ||
              [];

            if (directories) {
              const dirs =
                [
                  ...new Set(
                    keys
                      .filter(
                        key =>
                          key.startsWith(
                            prefix
                          )
                      )
                      .map(
                        key => {
                          const rest =
                            key.slice(
                              prefix.length
                            );

                          const first =
                            rest.split(
                              '/'
                            )[0];

                          return (
                            prefix +
                            first +
                            '/'
                          );
                        }
                      )
                  )
                ];

              return {
                blobs:
                  [],
                directories:
                  dirs
              };
            }

            return {
              blobs:
                keys
                  .filter(
                    key =>
                      key.startsWith(
                        prefix
                      )
                  )
                  .map(
                    key => ({
                      key,
                      etag:
                        '"test"'
                    })
                  ),

              directories:
                []
            };
          },

          async delete(
            key
          ) {
            deleted.push({
              name,
              key
            });
          }
        };
      };

    const handler =
      createAiSearchLearningRetentionRunner({
        listStoresFn,
        getStoreFn,

        nowProvider:
          () =>
            new Date(
              '2026-09-17T15:00:00.000Z'
            )
      });

    const result =
      await handler();

    assert.deepEqual(
      openedStores,
      [
        {
          name:
            'ai-search-learning-v1',
          consistency:
            'strong'
        },
        {
          name:
            'ai-search-learning-v1-preview-186',
          consistency:
            'strong'
        }
      ]
    );

    assert.deepEqual(
      deleted,
      [
        {
          name:
            'ai-search-learning-v1',
          key:
            'sessions/2026-06-18/as_old/0000-filters_applied.json'
        },
        {
          name:
            'ai-search-learning-v1-preview-186',
          key:
            'sessions/2026-05-01/as_preview_old/0000-filters_applied.json'
        }
      ]
    );

    assert.deepEqual(
      result,
      {
        retentionDays:
          90,

        cutoffDate:
          '2026-06-19',

        storesScanned:
          2,

        expiredPartitions:
          2,

        deletedBlobs:
          2
      }
    );
  }
);

test(
  'retention ignores malformed directories and keeps cutoff day',
  async () => {
    const deleted =
      [];

    const handler =
      createAiSearchLearningRetentionRunner({
        listStoresFn:
          async () => ({
            stores: [
              'ai-search-learning-v1'
            ]
          }),

        getStoreFn:
          () => ({
            async list({
              directories,
              prefix
            }) {
              if (directories) {
                return {
                  blobs:
                    [],

                  directories: [
                    'sessions/not-a-date/',
                    'sessions/2026-06-19/',
                    'sessions/2026-06-20/'
                  ]
                };
              }

              return {
                blobs: [
                  {
                    key:
                      prefix +
                      'as_test/0000-filters_applied.json'
                  }
                ],

                directories:
                  []
              };
            },

            async delete(
              key
            ) {
              deleted.push(
                key
              );
            }
          }),

        nowProvider:
          () =>
            new Date(
              '2026-09-17T23:59:59.000Z'
            )
      });

    const result =
      await handler();

    assert.deepEqual(
      deleted,
      []
    );

    assert.equal(
      result.deletedBlobs,
      0
    );

    assert.equal(
      result.expiredPartitions,
      0
    );
  }
);


test(
  'retention bounds concurrent delete operations',
  async () => {
    let activeDeletes =
      0;

    let maxActiveDeletes =
      0;

    let deleted =
      0;

    const blobs =
      Array.from(
        {
          length:
            45
        },
        (_, index) => ({
          key:
            'sessions/2026-01-01/' +
            'as_test/' +
            String(index)
              .padStart(
                4,
                '0'
              ) +
            '-event.json'
        })
      );

    const handler =
      createAiSearchLearningRetentionRunner({
        listStoresFn:
          async () => ({
            stores: [
              'ai-search-learning-v1'
            ]
          }),

        getStoreFn:
          () => ({
            async list({
              directories,
              prefix
            }) {
              if (directories) {
                return {
                  blobs:
                    [],

                  directories: [
                    'sessions/2026-01-01/'
                  ]
                };
              }

              assert.equal(
                prefix,
                'sessions/2026-01-01/'
              );

              return {
                blobs,
                directories:
                  []
              };
            },

            async delete() {
              activeDeletes +=
                1;

              maxActiveDeletes =
                Math.max(
                  maxActiveDeletes,
                  activeDeletes
                );

              await new Promise(
                resolve =>
                  setTimeout(
                    resolve,
                    2
                  )
              );

              deleted +=
                1;

              activeDeletes -=
                1;
            }
          }),

        nowProvider:
          () =>
            new Date(
              '2026-09-17T15:00:00.000Z'
            )
      });

    const result =
      await handler();

    assert.equal(
      deleted,
      45
    );

    assert.equal(
      result.deletedBlobs,
      45
    );

    assert.equal(
      maxActiveDeletes,
      LEARNING_RETENTION_DELETE_CONCURRENCY
    );

    assert.ok(
      maxActiveDeletes <
        blobs.length
    );
  }
);


test(
  'scheduled handler returns undefined after successful cleanup',
  async () => {
    const handler =
      createAiSearchLearningRetentionHandler({
        listStoresFn:
          async () => ({
            stores:
              []
          }),

        getStoreFn:
          () => {
            throw new Error(
              'store should not be opened'
            );
          },

        nowProvider:
          () =>
            new Date(
              '2026-09-17T15:00:00.000Z'
            )
      });

    const result =
      await handler();

    assert.equal(
      result,
      undefined
    );
  }
);
