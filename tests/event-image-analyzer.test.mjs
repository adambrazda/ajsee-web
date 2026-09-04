import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  analyzeEventImageTarget,
  assertPreviewOutputPath,
  buildEventImageAnalysisRequest,
  buildImageAnalysisPreview,
  extractResponsesOutputText,
  isRecoverableEventImageAssetError,
  normalizeAnalyzerOutput,
  resolveEventImageAnalysisSource,
  selectSmsticketAnalysisTargets
} from '../scripts/event-image-analyzer.mjs';

test(
  'SMS Ticket target selection requires an explicit selector',
  () => {
    const payload = {
      events: [
        {
          id:
            'smsticket-1',

          title: {
            cs:
              'Roman test'
          },

          imageOriginal:
            'https://example.com/original.jpg'
        }
      ]
    };

    assert.deepEqual(
      selectSmsticketAnalysisTargets(
        payload
      ),
      []
    );
  }
);

test(
  'target selection matches titles and deduplicates source images',
  () => {
    const source =
      'https://www.smsticket.cz/cdn/events/person.jpg';

    const payload = {
      events: [
        {
          id:
            'smsticket-1',

          sourceId:
            '1',

          title: {
            cs:
              'Škola vaření s Romanem Paulusem'
          },

          image:
            'https://www.smsticket.cz/normalized-1.jpg',

          imageOriginal:
            source
        },

        {
          id:
            'smsticket-2',

          sourceId:
            '2',

          title: {
            cs:
              'Další kurz s Romanem Paulusem'
          },

          image:
            'https://www.smsticket.cz/normalized-2.jpg',

          imageOriginal:
            source
        }
      ]
    };

    const targets =
      selectSmsticketAnalysisTargets(
        payload,
        {
          match:
            'romanem paulusem',
          limit:
            20
        }
      );

    assert.equal(
      targets.length,
      1
    );

    assert.equal(
      targets[0].cacheKey,
      source
    );
  }
);

test(
  'Responses request uses source image original detail and strict structured output',
  () => {
    const request =
      buildEventImageAnalysisRequest(
        {
          sourceImage:
            'https://www.smsticket.cz/cdn/events/original.jpg'
        }
      );

    assert.equal(
      request.model,
      'gpt-5.6-terra'
    );

    assert.equal(
      request.store,
      false
    );

    const image =
      request.input[0]
        .content
        .find(
          (item) =>
            item.type ===
            'input_image'
        );

    assert.equal(
      image.image_url,
      'https://www.smsticket.cz/cdn/events/original.jpg'
    );

    assert.equal(
      image.detail,
      'original'
    );

    assert.equal(
      request.text.format.type,
      'json_schema'
    );

    assert.equal(
      request.text.format.strict,
      true
    );

    assert.equal(
      request.text.format.schema.additionalProperties,
      false
    );
  }
);

test(
  'unsupported image detail fails before an API request can be built',
  () => {
    assert.throws(
      () =>
        buildEventImageAnalysisRequest(
          {
            sourceImage:
              'https://www.smsticket.cz/cdn/events/original.jpg'
          },
          {
            detail:
              'ultra'
          }
        ),
      /Unsupported image detail/
    );
  }
);

test(
  'Responses output extractor reads output_text',
  () => {
    assert.equal(
      extractResponsesOutputText({
        output: [
          {
            type:
              'message',

            content: [
              {
                type:
                  'output_text',

                text:
                  '{"ok":true}'
              }
            ]
          }
        ]
      }),
      '{"ok":true}'
    );
  }
);

test(
  'analyzer output normalizes into the existing vision cache contract',
  () => {
    const result =
      normalizeAnalyzerOutput(
        JSON.stringify({
          contentType:
            'person',

          confidence:
            0.97,

          cropSafe:
            true,

          x:
            51,

          y:
            28,

          rationale:
            'Portrait with no critical typography.'
        })
      );

    assert.deepEqual(
      result.analysis,
      {
        version:
          1,

        source:
          'vision',

        contentType:
          'person',

        confidence:
          0.97,

        cropSafe:
          true,

        x:
          51,

        y:
          28
      }
    );
  }
);

test(
  'live analyzer sends one Responses API request and returns normalized output',
  async () => {
    let capturedUrl = '';
    let capturedBody = null;

    const result =
      await analyzeEventImageTarget(
        {
          sourceImage:
            'https://www.smsticket.cz/cdn/events/person.jpg'
        },
        {
          apiKey:
            'test-key',

          fetchImpl:
            async (
              url,
              options
            ) => {
              capturedUrl =
                url;

              capturedBody =
                JSON.parse(
                  options.body
                );

              return {
                ok:
                  true,

                status:
                  200,

                async json() {
                  return {
                    id:
                      'resp_test',

                    output: [
                      {
                        type:
                          'message',

                        content: [
                          {
                            type:
                              'output_text',

                            text:
                              JSON.stringify({
                                contentType:
                                  'person',

                                confidence:
                                  0.95,

                                cropSafe:
                                  true,

                                x:
                                  50,

                                y:
                                  30,

                                rationale:
                                  'Safe portrait crop.'
                              })
                          }
                        ]
                      }
                    ]
                  };
                }
              };
            }
        }
      );

    assert.equal(
      capturedUrl,
      'https://api.openai.com/v1/responses'
    );

    assert.equal(
      capturedBody.input[0].content[1].type,
      'input_image'
    );

    assert.equal(
      result.analysis.contentType,
      'person'
    );
  }
);

test(
  'preview payload is cache-compatible but remains explicitly preview-only',
  () => {
    const preview =
      buildImageAnalysisPreview(
        [
          {
            id:
              'smsticket-1',

            sourceId:
              '1',

            title:
              'Roman',

            image:
              'normalized.jpg',

            imageOriginal:
              'original.jpg',

            cacheKey:
              'https://www.smsticket.cz/original.jpg'
          }
        ],

        [
          {
            analysis: {
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
                50,

              y:
                30
            },

            rationale:
              'Portrait.',

            responseId:
              'resp_1',

            usage:
              null
          }
        ],

        {
          generatedAt:
            '2026-09-04T00:00:00.000Z'
        }
      );

    assert.equal(
      preview.mode,
      'preview-only'
    );

    assert.equal(
      preview.assets[
        'https://www.smsticket.cz/original.jpg'
      ].source,
      'vision'
    );
  }
);

test(
  'preview analyzer cannot overwrite the production cache',
  () => {
    assert.throws(
      () =>
        assertPreviewOutputPath(
          'data/event-image-analysis/smsticket.json'
        ),
      /not allowed to overwrite/
    );

    assert.doesNotThrow(
      () =>
        assertPreviewOutputPath(
          path.join(
            process.cwd(),
            'tmp',
            'review.json'
          )
        )
    );
  }
);

test(
  'image analyzer remains outside prebuild and predev',
  () => {
    const pkg =
      JSON.parse(
        fs.readFileSync(
          'package.json',
          'utf8'
        )
      );

    assert.equal(
      pkg.scripts[
        'event-images:analyze'
      ],
      'node scripts/analyze-event-images.mjs'
    );

    assert.doesNotMatch(
      pkg.scripts.prebuild,
      /event-images:analyze/
    );

    assert.doesNotMatch(
      pkg.scripts.predev,
      /event-images:analyze/
    );
  }
);


test(
  'image analyzer disables reasoning for deterministic classification',
  () => {
    const request =
      buildEventImageAnalysisRequest(
        {
          sourceImage:
            'https://www.smsticket.cz/cdn/events/test.jpg'
        }
      );

    assert.deepEqual(
      request.reasoning,
      {
        effort:
          'none'
      }
    );

    assert.equal(
      request.max_output_tokens,
      600
    );
  }
);

test(
  'incomplete image responses expose the API reason instead of appearing empty',
  () => {
    assert.throws(
      () =>
        extractResponsesOutputText({
          status:
            'incomplete',

          incomplete_details: {
            reason:
              'max_output_tokens'
          },

          usage: {
            output_tokens:
              300,

            output_tokens_details: {
              reasoning_tokens:
                300
            }
          },

          output: []
        }),
      /max_output_tokens/
    );
  }
);


test(
  'image source resolver prefers a live provider original',
  async () => {
    const calls = [];

    const result =
      await resolveEventImageAnalysisSource(
        {
          imageOriginal:
            'https://example.com/original.jpg',

          image:
            'https://example.com/normalized.jpg'
        },
        {
          fetchImpl:
            async (
              url
            ) => {
              calls.push(
                url
              );

              return {
                status:
                  206,

                body: {
                  async cancel() {}
                }
              };
            }
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.sourceKind,
      'original'
    );

    assert.equal(
      result.sourceImage,
      'https://example.com/original.jpg'
    );

    assert.deepEqual(
      calls,
      [
        'https://example.com/original.jpg'
      ]
    );
  }
);

test(
  'image source resolver falls back from dead original to normalized artwork',
  async () => {
    const calls = [];

    const result =
      await resolveEventImageAnalysisSource(
        {
          imageOriginal:
            'https://example.com/original.jpg',

          image:
            'https://example.com/normalized.jpg'
        },
        {
          fetchImpl:
            async (
              url
            ) => {
              calls.push(
                url
              );

              return {
                status:
                  url.includes(
                    'original'
                  )
                    ? 404
                    : 206,

                body: {
                  async cancel() {}
                }
              };
            }
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.sourceKind,
      'normalized'
    );

    assert.equal(
      result.sourceImage,
      'https://example.com/normalized.jpg'
    );

    assert.deepEqual(
      calls,
      [
        'https://example.com/original.jpg',
        'https://example.com/normalized.jpg'
      ]
    );
  }
);

test(
  'image source resolver reports unavailable when every source is dead',
  async () => {
    const result =
      await resolveEventImageAnalysisSource(
        {
          imageOriginal:
            'https://example.com/original.jpg',

          image:
            'https://example.com/normalized.jpg'
        },
        {
          fetchImpl:
            async () => ({
              status:
                404,

              body: {
                async cancel() {}
              }
            })
        }
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.reason,
      'image-unavailable'
    );

    assert.equal(
      result.probes.length,
      2
    );
  }
);

test(
  'only upstream image 404 and 410 failures are recoverable per target',
  () => {
    assert.equal(
      isRecoverableEventImageAssetError(
        new Error(
          'OpenAI image analysis failed: Error while downloading file. Upstream status code: 404.'
        )
      ),
      true
    );

    assert.equal(
      isRecoverableEventImageAssetError(
        new Error(
          'OpenAI image analysis failed: Error while downloading file. Upstream status code: 410.'
        )
      ),
      true
    );

    assert.equal(
      isRecoverableEventImageAssetError(
        new Error(
          'OpenAI image analysis failed: HTTP 429'
        )
      ),
      false
    );

    assert.equal(
      isRecoverableEventImageAssetError(
        new Error(
          'OpenAI image analysis failed: Incorrect API key.'
        )
      ),
      false
    );
  }
);

test(
  'preview CLI records skipped assets without changing cache keys',
  () => {
    const source =
      fs.readFileSync(
        'scripts/analyze-event-images.mjs',
        'utf8'
      );

    assert.match(
      source,
      /resolveEventImageAnalysisSource/
    );

    assert.match(
      source,
      /skipped\.push/
    );

    assert.match(
      source,
      /requestedTargets/
    );

    assert.match(
      source,
      /analysisTarget[\s\S]*sourceImage:[\s\S]*sourceResolution\.sourceImage/
    );

    assert.match(
      source,
      /cacheKey:[\s\S]*target\.cacheKey/
    );
  }
);
