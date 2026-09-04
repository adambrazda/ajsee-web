import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  eventImageAnalysisCacheKey,
  normalizeEventImageAnalysisRecord,
  resolveEventImageAnalysis
} from '../src/event-image-analysis.js';

test(
  'image analysis cache keys canonicalize provider HTTP URLs',
  () => {
    assert.equal(
      eventImageAnalysisCacheKey(
        'http://www.smsticket.cz/cdn/events/example.jpg'
      ),
      'https://www.smsticket.cz/cdn/events/example.jpg'
    );
  }
);

test(
  'high-confidence person analysis becomes face-aware cover',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/person.jpg';

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'vision',

              contentType:
                'person',

              confidence:
                0.96,

              cropSafe:
                true,

              x:
                58,

              y:
                34
            }
          }
        },
        url
      );

    assert.deepEqual(
      presentation,
      {
        fit:
          'cover',

        x:
          58,

        y:
          34,

        surface:
          'neutral',

        contentType:
          'person',

        cropSafe:
          true,

        confidence:
          0.96,

        source:
          'vision',

        version:
          2
      }
    );
  }
);

test(
  'text-heavy artwork always remains safely contained',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/poster.jpg';

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'vision',

              contentType:
                'text-heavy-artwork',

              confidence:
                0.99,

              cropSafe:
                true,

              x:
                50,

              y:
                50
            }
          }
        },
        url
      );

    assert.equal(
      presentation.fit,
      'contain'
    );

    assert.equal(
      presentation.surface,
      'adaptive-matte'
    );
  }
);

test(
  'low-confidence person analysis fails closed to contain',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/uncertain-person.jpg';

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'vision',

              contentType:
                'person',

              confidence:
                0.72,

              cropSafe:
                true,

              x:
                55,

              y:
                30
            }
          }
        },
        url
      );

    assert.equal(
      presentation.fit,
      'contain'
    );

    assert.equal(
      presentation.surface,
      'adaptive-matte'
    );
  }
);

test(
  'vision cover requires explicit crop safety and focal coordinates',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/person-without-focal.jpg';

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'vision',

              contentType:
                'person',

              confidence:
                0.98,

              cropSafe:
                true
            }
          }
        },
        url
      );

    assert.equal(
      presentation.fit,
      'contain'
    );
  }
);

test(
  'null focal coordinates are never coerced into a zero focal point',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/null-focal.jpg';

    const record =
      normalizeEventImageAnalysisRecord({
        version:
          1,

        source:
          'vision',

        contentType:
          'person',

        confidence:
          0.99,

        cropSafe:
          true,

        x:
          null,

        y:
          null
      });

    assert.equal(
      record.x,
      null
    );

    assert.equal(
      record.y,
      null
    );

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'vision',

              contentType:
                'person',

              confidence:
                0.99,

              cropSafe:
                true,

              x:
                null,

              y:
                null
            }
          }
        },
        url
      );

    assert.equal(
      presentation.fit,
      'contain'
    );

    assert.equal(
      presentation.surface,
      'adaptive-matte'
    );
  }
);

test(
  'manual analysis has priority over automatic cover policy',
  () => {
    const url =
      'https://www.smsticket.cz/cdn/events/manual.jpg';

    const presentation =
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets: {
            [url]: {
              version:
                1,

              source:
                'manual',

              contentType:
                'poster',

              confidence:
                1,

              cropSafe:
                false,

              fit:
                'contain',

              surface:
                'neutral',

              x:
                50,

              y:
                50
            }
          }
        },
        url
      );

    assert.equal(
      presentation.fit,
      'contain'
    );

    assert.equal(
      presentation.surface,
      'neutral'
    );

    assert.equal(
      presentation.source,
      'manual'
    );
  }
);

test(
  'stale analysis versions are rejected',
  () => {
    assert.equal(
      normalizeEventImageAnalysisRecord({
        version:
          0,

        source:
          'vision',

        contentType:
          'person',

        confidence:
          1,

        cropSafe:
          true,

        x:
          50,

        y:
          50
      }),
      null
    );
  }
);

test(
  'unknown assets do not create a presentation',
  () => {
    assert.equal(
      resolveEventImageAnalysis(
        {
          version:
            1,

          assets:
            {}
        },
        'https://www.smsticket.cz/cdn/events/unknown.jpg'
      ),
      null
    );
  }
);

test(
  'SMS Ticket sync consumes the tracked cache without performing vision analysis',
  () => {
    const source =
      fs.readFileSync(
        'scripts/sync-smsticket-events.mjs',
        'utf8'
      );

    assert.match(
      source,
      /data\/event-image-analysis\/smsticket\.json/
    );

    assert.match(
      source,
      /resolveEventImageAnalysis/
    );

    assert.match(
      source,
      /imageOriginal \|\| image/
    );

    assert.doesNotMatch(
      source,
      /api\.openai\.com/
    );

    assert.doesNotMatch(
      source,
      /OPENAI_API_KEY/
    );
  }
);

test(
  'SMS Ticket city subsets preserve image presentation metadata',
  () => {
    const source =
      fs.readFileSync(
        'scripts/sync-smsticket-events.mjs',
        'utf8'
      );

    const start =
      source.indexOf(
        'function createLightCitySubsetEvent'
      );

    const end =
      source.indexOf(
        'function createSubsetPayload',
        start
      );

    assert.notEqual(
      start,
      -1
    );

    assert.notEqual(
      end,
      -1
    );

    const block =
      source.slice(
        start,
        end
      );

    assert.doesNotMatch(
      block,
      /imagePresentation\s*,/
    );
  }
);
