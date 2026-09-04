import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergePromotionIntoCache,
  normalizeProductionCache,
  parsePromotionArgs,
  validatePromotionPreview
} from '../scripts/promote-event-image-analysis.mjs';

function visionRecord(
  overrides = {}
) {
  return {
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
      53,

    ...overrides
  };
}

function previewFixture(
  {
    detail =
      'original',

    image =
      'https://www.smsticket.cz/display.jpg',

    cacheKey =
      'https://www.smsticket.cz/display.jpg',

    record =
      visionRecord()
  } = {}
) {
  return {
    version:
      1,

    provider:
      'smsticket',

    mode:
      'preview-only',

    detail,

    assets: {
      [cacheKey]:
        record
    },

    review: [
      {
        sourceId:
          '123',

        title:
          'Test event',

        image,
        cacheKey,

        analysis:
          record
      }
    ]
  };
}

test(
  'promotion command defaults to dry-run and requires an input',
  () => {
    assert.deepEqual(
      parsePromotionArgs(
        [
          '--input',
          'preview.json'
        ]
      ),
      {
        input:
          'preview.json',

        write:
          false
      }
    );

    assert.deepEqual(
      parsePromotionArgs(
        [
          '--input',
          'preview.json',
          '--write'
        ]
      ),
      {
        input:
          'preview.json',

        write:
          true
      }
    );

    assert.throws(
      () =>
        parsePromotionArgs(
          []
        ),
      /--input is required/
    );
  }
);

test(
  'low-detail discovery can never be promoted',
  () => {
    assert.throws(
      () =>
        validatePromotionPreview(
          previewFixture({
            detail:
              'low'
          })
        ),
      /Only original-detail analysis can be promoted/
    );
  }
);

test(
  'promotion requires cache key to match the runtime display image',
  () => {
    assert.throws(
      () =>
        validatePromotionPreview(
          previewFixture({
            image:
              'https://www.smsticket.cz/display.jpg',

            cacheKey:
              'https://www.smsticket.cz/original.jpg'
          })
        ),
      /not keyed by its runtime display image/
    );
  }
);

test(
  'valid original-detail vision analysis resolves into a production presentation',
  () => {
    const promotion =
      validatePromotionPreview(
        previewFixture()
      );

    assert.equal(
      promotion.length,
      1
    );

    assert.equal(
      promotion[0].cacheKey,
      'https://www.smsticket.cz/display.jpg'
    );

    assert.equal(
      promotion[0].presentation.fit,
      'cover'
    );

    assert.equal(
      promotion[0].presentation.x,
      51
    );

    assert.equal(
      promotion[0].presentation.y,
      53
    );
  }
);

test(
  'promotion merge is idempotent but refuses a conflicting automatic result',
  () => {
    const promotion =
      validatePromotionPreview(
        previewFixture()
      );

    const empty = {
      version:
        1,

      provider:
        'smsticket',

      assets: {}
    };

    const first =
      mergePromotionIntoCache(
        empty,
        promotion
      );

    assert.equal(
      first.added,
      1
    );

    assert.equal(
      first.unchanged,
      0
    );

    const second =
      mergePromotionIntoCache(
        first.cache,
        promotion
      );

    assert.equal(
      second.added,
      0
    );

    assert.equal(
      second.unchanged,
      1
    );

    const changed =
      validatePromotionPreview(
        previewFixture({
          record:
            visionRecord({
              confidence:
                0.99
            })
        })
      );

    assert.throws(
      () =>
        mergePromotionIntoCache(
          first.cache,
          changed
        ),
      /Existing image analysis differs/
    );
  }
);

test(
  'manual cache analysis can never be overwritten by promotion',
  () => {
    const promotion =
      validatePromotionPreview(
        previewFixture()
      );

    const cache =
      normalizeProductionCache({
        version:
          1,

        provider:
          'smsticket',

        assets: {
          'https://www.smsticket.cz/display.jpg': {
            version:
              1,

            source:
              'manual',

            contentType:
              'person',

            confidence:
              1,

            cropSafe:
              true,

            x:
              45,

            y:
              40,

            fit:
              'cover',

            surface:
              'neutral'
          }
        }
      });

    assert.throws(
      () =>
        mergePromotionIntoCache(
          cache,
          promotion
        ),
      /Refusing to overwrite manual image analysis/
    );
  }
);