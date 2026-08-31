import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  COLOSSEUMTICKET_MAX_FEED_BYTES,
  assertColosseumFeedByteLength,
  assertColosseumHttpsFeedUrl,
  assertColosseumPayloadSanity,
  readColosseumResponseTextWithLimit,
  writeColosseumJsonAtomically
} from '../scripts/sync-colosseumticket-events.mjs';


function makePayload(
  occurrenceCount,
  parentEvents = 120
) {
  const events =
    Array.from(
      {
        length:
          occurrenceCount
      },
      (_, index) => ({
        id:
          `event-${index}`
      })
    );

  return {
    source:
      'colosseumticket',

    count:
      events.length,

    stats: {
      parentEvents,
      occurrences:
        events.length,
      zeroTermParents:
        0,
      rejectedOccurrences:
        0,
      missingCityOccurrences:
        0,
      missingCategoryParents:
        0,
      duplicateRawTermIds:
        []
    },

    events
  };
}


test(
  'remote feed URL must use HTTPS',
  () => {
    assert.match(
      assertColosseumHttpsFeedUrl(
        'https://colosseumticket.cz/api/export/affiliate.xml'
      ),
      /^https:\/\//
    );

    assert.throws(
      () =>
        assertColosseumHttpsFeedUrl(
          'http://colosseumticket.cz/api/export/affiliate.xml'
        ),
      /must use HTTPS/
    );
  }
);


test(
  'feed byte guard rejects oversized inputs',
  () => {
    assert.equal(
      assertColosseumFeedByteLength(
        1024,
        2048
      ),
      1024
    );

    assert.throws(
      () =>
        assertColosseumFeedByteLength(
          2049,
          2048
        ),
      /exceeds maximum size/
    );

    assert.equal(
      COLOSSEUMTICKET_MAX_FEED_BYTES,
      10 * 1024 * 1024
    );
  }
);


test(
  'response content-length is rejected before oversized body consumption',
  async () => {
    const response =
      new Response(
        'small-body',
        {
          headers: {
            'content-length':
              '100'
          }
        }
      );

    await assert.rejects(
      () =>
        readColosseumResponseTextWithLimit(
          response,
          50
        ),
      /exceeds maximum size/
    );
  }
);


test(
  'chunked response is capped even without trusted content-length',
  async () => {
    const response =
      new Response(
        '1234567890'
      );

    await assert.rejects(
      () =>
        readColosseumResponseTextWithLimit(
          response,
          5
        ),
      /exceeds maximum size/
    );
  }
);


test(
  'small valid response is read normally',
  async () => {
    const response =
      new Response(
        '<events></events>'
      );

    const xml =
      await readColosseumResponseTextWithLimit(
        response,
        1024
      );

    assert.equal(
      xml,
      '<events></events>'
    );
  }
);


test(
  'payload sanity rejects implausibly small snapshots',
  () => {
    assert.throws(
      () =>
        assertColosseumPayloadSanity(
          makePayload(
            99,
            120
          )
        ),
      /rejected only 99 occurrences/
    );

    assert.throws(
      () =>
        assertColosseumPayloadSanity(
          makePayload(
            150,
            99
          )
        ),
      /rejected only 99 parent events/
    );
  }
);


test(
  'payload sanity rejects a sudden greater-than-half count drop',
  () => {
    const existing =
      makePayload(
        1000,
        500
      );

    const next =
      makePayload(
        499,
        250
      );

    assert.throws(
      () =>
        assertColosseumPayloadSanity(
          next,
          existing
        ),
      /dropped from 1000 to 499/
    );

    assert.doesNotThrow(
      () =>
        assertColosseumPayloadSanity(
          next,
          existing,
          {
            allowLargeDrop:
              true
          }
        )
    );
  }
);


test(
  'payload sanity verifies declared counts',
  () => {
    const payload =
      makePayload(
        150,
        120
      );

    payload.count =
      149;

    assert.throws(
      () =>
        assertColosseumPayloadSanity(
          payload
        ),
      /payload count does not match/
    );
  }
);


test(
  'atomic JSON writer replaces valid cache without leftover temp files',
  async () => {
    const directory =
      await mkdtemp(
        path.join(
          os.tmpdir(),
          'ajsee-colosseum-atomic-'
        )
      );

    const target =
      path.join(
        directory,
        'events.json'
      );

    try {
      await writeColosseumJsonAtomically(
        target,
        {
          version:
            1
        }
      );

      await writeColosseumJsonAtomically(
        target,
        {
          version:
            2
        }
      );

      const stored =
        JSON.parse(
          await readFile(
            target,
            'utf8'
          )
        );

      assert.equal(
        stored.version,
        2
      );

      const files =
        await readdir(
          directory
        );

      assert.deepEqual(
        files,
        [
          'events.json'
        ]
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
