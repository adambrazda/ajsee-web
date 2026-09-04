import fs from 'node:fs';
import path from 'node:path';
import {
  pathToFileURL
} from 'node:url';

import {
  eventImageAnalysisCacheKey,
  normalizeEventImageAnalysisRecord,
  resolveEventImageAnalysis
} from '../src/event-image-analysis.js';

const PROVIDER =
  'smsticket';

const CACHE_VERSION =
  1;

const PRODUCTION_CACHE =
  path.resolve(
    'data/event-image-analysis/smsticket.json'
  );

function normalizedJson(
  value
) {
  return JSON.stringify(
    value
  );
}

function sortedAssets(
  assets = {}
) {
  return Object.fromEntries(
    Object
      .entries(
        assets
      )
      .sort(
        (
          [left],
          [right]
        ) =>
          left.localeCompare(
            right
          )
      )
  );
}

export function parsePromotionArgs(
  argv = []
) {
  const options = {
    input:
      '',

    write:
      false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const token =
      argv[index];

    if (
      token ===
      '--input'
    ) {
      options.input =
        String(
          argv[
            index + 1
          ] ||
          ''
        ).trim();

      index +=
        1;

      continue;
    }

    if (
      token ===
      '--write'
    ) {
      options.write =
        true;

      continue;
    }

    throw new Error(
      `Unknown argument: ${token}`
    );
  }

  if (!options.input) {
    throw new Error(
      '--input is required.'
    );
  }

  return options;
}

export function validatePromotionPreview(
  preview = {}
) {
  if (
    !preview ||
    typeof preview !==
      'object'
  ) {
    throw new Error(
      'Invalid analysis preview.'
    );
  }

  if (
    String(
      preview.provider ||
      ''
    ) !==
      PROVIDER
  ) {
    throw new Error(
      'Only SMS Ticket analysis previews can be promoted.'
    );
  }

  if (
    String(
      preview.mode ||
      ''
    ) !==
      'preview-only'
  ) {
    throw new Error(
      'Analysis input must be a preview-only artifact.'
    );
  }

  /*
   * Low detail is discovery only.
   * Production decisions require the final original-detail gate.
   */
  if (
    String(
      preview.detail ||
      ''
    ) !==
      'original'
  ) {
    throw new Error(
      'Only original-detail analysis can be promoted.'
    );
  }

  if (
    !Array.isArray(
      preview.review
    ) ||
    !preview.review.length
  ) {
    throw new Error(
      'Analysis preview contains no reviewed assets.'
    );
  }

  if (
    !preview.assets ||
    typeof preview.assets !==
      'object' ||
    Array.isArray(
      preview.assets
    )
  ) {
    throw new Error(
      'Analysis preview contains no cache-compatible assets.'
    );
  }

  const promotion = [];

  const seen =
    new Set();

  for (
    const item
    of preview.review
  ) {
    const displayImage =
      String(
        item?.image ||
        ''
      ).trim();

    const rawCacheKey =
      String(
        item?.cacheKey ||
        ''
      ).trim();

    const cacheKey =
      eventImageAnalysisCacheKey(
        displayImage
      );

    if (
      !displayImage ||
      !cacheKey
    ) {
      throw new Error(
        `Reviewed asset ${item?.sourceId || ''} has no display image.`
      );
    }

    if (
      rawCacheKey !==
      cacheKey
    ) {
      throw new Error(
        `Reviewed asset ${item?.sourceId || ''} is not keyed by its runtime display image.`
      );
    }

    if (
      seen.has(
        cacheKey
      )
    ) {
      throw new Error(
        `Duplicate reviewed display asset: ${cacheKey}`
      );
    }

    seen.add(
      cacheKey
    );

    if (
      !Object.prototype.hasOwnProperty.call(
        preview.assets,
        cacheKey
      )
    ) {
      throw new Error(
        `Missing preview cache record for ${item?.sourceId || cacheKey}.`
      );
    }

    const fromAssets =
      normalizeEventImageAnalysisRecord(
        preview.assets[
          cacheKey
        ]
      );

    const fromReview =
      normalizeEventImageAnalysisRecord(
        item?.analysis
      );

    if (
      !fromAssets ||
      !fromReview
    ) {
      throw new Error(
        `Invalid analysis record for ${item?.sourceId || cacheKey}.`
      );
    }

    if (
      fromAssets.source !==
        'vision' ||
      fromReview.source !==
        'vision'
    ) {
      throw new Error(
        `Only vision analysis may be promoted by this command.`
      );
    }

    if (
      normalizedJson(
        fromAssets
      ) !==
      normalizedJson(
        fromReview
      )
    ) {
      throw new Error(
        `Preview review/cache mismatch for ${item?.sourceId || cacheKey}.`
      );
    }

    promotion.push({
      sourceId:
        String(
          item?.sourceId ||
          ''
        ),

      title:
        String(
          item?.title ||
          ''
        ),

      image:
        displayImage,

      cacheKey,

      analysis:
        fromAssets,

      presentation:
        resolveEventImageAnalysis(
          {
            version:
              CACHE_VERSION,

            provider:
              PROVIDER,

            assets: {
              [cacheKey]:
                fromAssets
            }
          },
          cacheKey
        )
    });
  }

  return promotion;
}

export function normalizeProductionCache(
  raw = {}
) {
  if (
    !raw ||
    typeof raw !==
      'object' ||
    Number(
      raw.version
    ) !==
      CACHE_VERSION ||
    String(
      raw.provider ||
      ''
    ) !==
      PROVIDER ||
    !raw.assets ||
    typeof raw.assets !==
      'object' ||
    Array.isArray(
      raw.assets
    )
  ) {
    throw new Error(
      'Invalid production image analysis cache.'
    );
  }

  const assets = {};

  for (
    const [
      rawKey,
      rawRecord
    ]
    of Object.entries(
      raw.assets
    )
  ) {
    const key =
      eventImageAnalysisCacheKey(
        rawKey
      );

    const record =
      normalizeEventImageAnalysisRecord(
        rawRecord
      );

    if (
      !key ||
      !record
    ) {
      throw new Error(
        `Invalid existing cache asset: ${rawKey}`
      );
    }

    assets[
      key
    ] =
      record;
  }

  return {
    version:
      CACHE_VERSION,

    provider:
      PROVIDER,

    assets:
      sortedAssets(
        assets
      )
  };
}

export function mergePromotionIntoCache(
  cache,
  promotion
) {
  const normalizedCache =
    normalizeProductionCache(
      cache
    );

  const assets = {
    ...normalizedCache.assets
  };

  let added =
    0;

  let unchanged =
    0;

  for (
    const item
    of promotion
  ) {
    const existing =
      assets[
        item.cacheKey
      ];

    if (!existing) {
      assets[
        item.cacheKey
      ] =
        item.analysis;

      added +=
        1;

      continue;
    }

    if (
      normalizedJson(
        existing
      ) ===
      normalizedJson(
        item.analysis
      )
    ) {
      unchanged +=
        1;

      continue;
    }

    if (
      existing.source ===
        'manual'
    ) {
      throw new Error(
        `Refusing to overwrite manual image analysis: ${item.cacheKey}`
      );
    }

    throw new Error(
      `Existing image analysis differs for ${item.cacheKey}. Explicit replacement workflow is required.`
    );
  }

  return {
    cache: {
      version:
        CACHE_VERSION,

      provider:
        PROVIDER,

      assets:
        sortedAssets(
          assets
        )
    },

    added,
    unchanged
  };
}

async function readJson(
  file
) {
  return JSON.parse(
    await fs.promises.readFile(
      file,
      'utf8'
    )
  );
}

async function main() {
  const options =
    parsePromotionArgs(
      process.argv.slice(
        2
      )
    );

  const input =
    path.resolve(
      options.input
    );

  if (
    input ===
    PRODUCTION_CACHE
  ) {
    throw new Error(
      'Production cache cannot be used as a promotion preview.'
    );
  }

  const preview =
    await readJson(
      input
    );

  const promotion =
    validatePromotionPreview(
      preview
    );

  const productionCache =
    normalizeProductionCache(
      await readJson(
        PRODUCTION_CACHE
      )
    );

  const merged =
    mergePromotionIntoCache(
      productionCache,
      promotion
    );

  console.log(
    '===== AJSEE IMAGE ANALYSIS PROMOTION ====='
  );

  console.log(
    'Mode      :',
    options.write
      ? 'WRITE'
      : 'DRY-RUN'
  );

  console.log(
    'Input     :',
    input
  );

  console.log(
    'Provider  :',
    PROVIDER
  );

  console.log(
    'Detail    : original'
  );

  console.log(
    'Reviewed  :',
    promotion.length
  );

  console.log(
    'Added     :',
    merged.added
  );

  console.log(
    'Unchanged :',
    merged.unchanged
  );

  console.log('');

  for (
    const item
    of promotion
  ) {
    console.log(
      `${item.sourceId} — ${item.title}`
    );

    console.log(
      '  type      :',
      item.analysis.contentType
    );

    console.log(
      '  confidence:',
      item.analysis.confidence
    );

    console.log(
      '  cropSafe  :',
      item.analysis.cropSafe
    );

    console.log(
      '  result    :',
      item.presentation?.fit ||
      'none'
    );

    console.log(
      '  focal     :',
      `${item.presentation?.x ?? 'none'},${item.presentation?.y ?? 'none'}`
    );

    console.log(
      '  key       :',
      item.cacheKey
    );

    console.log('');
  }

  if (!options.write) {
    console.log(
      'PASS: dry-run only. Production cache was not modified.'
    );

    return;
  }

  const content =
    JSON.stringify(
      merged.cache,
      null,
      2
    ) +
    '\n';

  await fs.promises.writeFile(
    PRODUCTION_CACHE,
    content,
    'utf8'
  );

  console.log(
    'PASS: validated original-detail analysis promoted to tracked cache.'
  );
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      path.resolve(
        process.argv[1]
      )
    ).href;

if (invokedDirectly) {
  main().catch(
    (error) => {
      console.error(
        error?.message ||
        error
      );

      process.exitCode =
        1;
    }
  );
}