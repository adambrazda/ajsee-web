
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  eventImageAssetRatio,
  normalizeEventImageAsset,
  resolveEventImageAsset,
  resolveProviderImagePresentation
} from '../src/event-image-resolver.js';

test(
  'normalizes the shared event image asset contract',
  () => {
    assert.deepEqual(
      normalizeEventImageAsset({
        url:
          ' https://example.com/event.jpg ',
        width:
          '640',
        height:
          '480',
        ratio:
          '4_3',
        fallback:
          true,
        attribution:
          ' Photo: Example '
      }),
      {
        url:
          'https://example.com/event.jpg',
        width:
          640,
        height:
          480,
        ratio:
          '4_3',
        fallback:
          true,
        attribution:
          'Photo: Example'
      }
    );
  }
);

test(
  'rejects an image asset without a URL',
  () => {
    assert.equal(
      normalizeEventImageAsset({
        width: 640,
        height: 480
      }),
      null
    );
  }
);

test(
  'uses intrinsic dimensions before provider ratio labels',
  () => {
    assert.equal(
      eventImageAssetRatio({
        width: 640,
        height: 360,
        ratio: '4_3'
      }),
      640 / 360
    );
  }
);

test(
  'selects an adequately sized 4:3 asset for the canonical card',
  () => {
    const selected =
      resolveEventImageAsset([
        {
          url:
            'https://example.com/16-9.jpg',
          width:
            640,
          height:
            360,
          ratio:
            '16_9'
        },
        {
          url:
            'https://example.com/4-3.jpg',
          width:
            640,
          height:
            480,
          ratio:
            '4_3'
        }
      ]);

    assert.equal(
      selected?.url,
      'https://example.com/4-3.jpg'
    );
  }
);

test(
  'does not trade adequate resolution for a tiny 4:3 thumbnail',
  () => {
    const selected =
      resolveEventImageAsset([
        {
          url:
            'https://example.com/tiny-4-3.jpg',
          width:
            320,
          height:
            240,
          ratio:
            '4_3'
        },
        {
          url:
            'https://example.com/usable-16-9.jpg',
          width:
            640,
          height:
            360,
          ratio:
            '16_9'
        }
      ]);

    assert.equal(
      selected?.url,
      'https://example.com/usable-16-9.jpg'
    );
  }
);

test(
  'prefers event-specific artwork within the same quality tier',
  () => {
    const selected =
      resolveEventImageAsset([
        {
          url:
            'https://example.com/fallback-4-3.jpg',
          width:
            640,
          height:
            480,
          ratio:
            '4_3',
          fallback:
            true
        },
        {
          url:
            'https://example.com/event-16-9.jpg',
          width:
            640,
          height:
            360,
          ratio:
            '16_9',
          fallback:
            false
        }
      ]);

    assert.equal(
      selected?.url,
      'https://example.com/event-16-9.jpg'
    );
  }
);

test(
  'prefers 3:2 over 16:9 when 4:3 is unavailable at equal quality',
  () => {
    const selected =
      resolveEventImageAsset([
        {
          url:
            'https://example.com/16-9.jpg',
          width:
            640,
          height:
            360,
          ratio:
            '16_9'
        },
        {
          url:
            'https://example.com/3-2.jpg',
          width:
            640,
          height:
            427,
          ratio:
            '3_2'
        }
      ]);

    assert.equal(
      selected?.url,
      'https://example.com/3-2.jpg'
    );
  }
);

test(
  'native 4:3 asset receives zero-crop provider presentation',
  () => {
    assert.deepEqual(
      resolveProviderImagePresentation({
        url:
          'https://example.com/event.jpg',
        width:
          640,
        height:
          480,
        ratio:
          '4_3'
      }),
      {
        fit:
          'cover',
        x:
          50,
        y:
          50,
        source:
          'provider',
        version:
          2
      }
    );
  }
);

test(
  'non-4:3 asset does not receive an explicit provider presentation',
  () => {
    assert.equal(
      resolveProviderImagePresentation({
        url:
          'https://example.com/event.jpg',
        width:
          640,
        height:
          360,
        ratio:
          '16_9'
      }),
      null
    );
  }
);
