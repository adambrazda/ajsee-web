import path from 'node:path';

import {
  eventImageAnalysisCacheKey,
  normalizeEventImageAnalysisRecord
} from '../src/event-image-analysis.js';

export const EVENT_IMAGE_ANALYSIS_MODEL =
  'gpt-5.6-terra';

export const EVENT_IMAGE_ANALYSIS_DETAIL =
  'original';

export const EVENT_IMAGE_ANALYSIS_SCHEMA = {
  type:
    'object',

  additionalProperties:
    false,

  required: [
    'contentType',
    'confidence',
    'cropSafe',
    'x',
    'y',
    'rationale'
  ],

  properties: {
    contentType: {
      type:
        'string',

      enum: [
        'photo',
        'person',
        'poster',
        'text-heavy-artwork',
        'graphic',
        'collage',
        'unknown'
      ]
    },

    confidence: {
      type:
        'number',

      minimum:
        0,

      maximum:
        1
    },

    cropSafe: {
      type:
        'boolean'
    },

    x: {
      type: [
        'number',
        'null'
      ],

      minimum:
        0,

      maximum:
        100
    },

    y: {
      type: [
        'number',
        'null'
      ],

      minimum:
        0,

      maximum:
        100
    },

    rationale: {
      type:
        'string'
    }
  }
};

export const EVENT_IMAGE_ANALYSIS_PROMPT =
  `Analyze this source event image for presentation inside a fixed 4:3 AJSEE event-card frame.

Classify ONLY what is visually present in the image.

contentType:
- "person": primarily a photographic portrait or people-focused photograph with little or no critical typography.
- "photo": primarily a photographic scene, object, venue, performance, food, landscape, or other photographic subject rather than poster artwork.
- "poster": designed promotional artwork containing meaningful typography or event branding.
- "text-heavy-artwork": promotional artwork where text, logos, dates, schedules, prices, sponsor marks, or other information is critical and cropping could remove meaning.
- "graphic": illustration or graphic design with little critical text.
- "collage": multiple distinct photos, panels, subjects, or compositions.
- "unknown": uncertain.

The target presentation uses CSS object-fit: cover in a 4:3 landscape frame.

For a portrait source image, cover can remove a large portion of the image vertically. Set cropSafe=true ONLY when there exists a 4:3 crop that preserves the complete primary visual subject and does not remove critical text, logos, faces, heads, or meaningful context.

For posters and text-heavy artwork, be conservative: cropSafe should normally be false.

x and y are percentages from 0 to 100 describing the most useful visual focal point in the ORIGINAL source image for CSS object-position if cover is used. For people, prioritize keeping complete faces and heads comfortably visible. For portrait images, y is especially important.

If you cannot identify a reliable focal point, return null for x and y.

confidence describes confidence in the classification and crop-safety judgment, not general image quality.

Keep rationale short and factual.`;

function fold(
  value = ''
) {
  return String(value)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim();
}

function eventTitleText(
  event = {}
) {
  const title =
    event?.title;

  if (
    title &&
    typeof title === 'object'
  ) {
    const preferredKeys = [
      'cs',
      'sk',
      'en',
      'de',
      'pl',
      'hu'
    ];

    for (
      const key
      of preferredKeys
    ) {
      const value =
        String(
          title?.[key] ||
          ''
        ).trim();

      if (value) {
        return value;
      }
    }

    return (
      Object.values(
        title
      )
        .map(
          (value) =>
            String(
              value ||
              ''
            ).trim()
        )
        .find(Boolean) ||
      ''
    );
  }

  return String(
    title ||
    ''
  ).trim();
}

function normalizeId(
  value = ''
) {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}

export function selectSmsticketAnalysisTargets(
  payload,
  {
    match = '',
    ids = [],
    limit = 20
  } = {}
) {
  const events =
    Array.isArray(payload)
      ? payload
      : Array.isArray(
          payload?.events
        )
        ? payload.events
        : [];

  const safeLimit =
    Math.min(
      50,
      Math.max(
        1,
        Math.floor(
          Number(limit) ||
          20
        )
      )
    );

  const matchToken =
    fold(
      match
    );

  const idTokens =
    new Set(
      (
        Array.isArray(ids)
          ? ids
          : []
      )
        .map(
          normalizeId
        )
        .filter(Boolean)
    );

  if (
    !matchToken &&
    !idTokens.size
  ) {
    return [];
  }

  const unique =
    new Map();

  for (const event of events) {
    const id =
      normalizeId(
        event?.id
      );

    const sourceId =
      normalizeId(
        event?.sourceId
      );

    const title =
      eventTitleText(
        event
      );

    const matchesId =
      idTokens.size > 0 &&
      (
        idTokens.has(id) ||
        idTokens.has(sourceId)
      );

    const matchesTitle =
      Boolean(
        matchToken
      ) &&
      fold(
        title
      ).includes(
        matchToken
      );

    if (
      !matchesId &&
      !matchesTitle
    ) {
      continue;
    }

    const image =
      String(
        event?.image ||
        ''
      ).trim();

    const imageOriginal =
      String(
        event?.imageOriginal ||
        ''
      ).trim();

    const sourceImage =
      imageOriginal ||
      image;

    const cacheKey =
      eventImageAnalysisCacheKey(
        sourceImage
      );

    if (
      !cacheKey ||
      unique.has(
        cacheKey
      )
    ) {
      continue;
    }

    unique.set(
      cacheKey,
      {
        id:
          String(
            event?.id ||
            ''
          ),

        sourceId:
          String(
            event?.sourceId ||
            ''
          ),

        title,

        image,
        imageOriginal,

        sourceImage:
          cacheKey,

        cacheKey
      }
    );

    if (
      unique.size >=
      safeLimit
    ) {
      break;
    }
  }

  return [
    ...unique.values()
  ];
}

export function buildEventImageAnalysisRequest(
  target,
  {
    model =
      EVENT_IMAGE_ANALYSIS_MODEL,

    detail =
      EVENT_IMAGE_ANALYSIS_DETAIL
  } = {}
) {
  const imageUrl =
    String(
      target?.sourceImage ||
      target?.imageOriginal ||
      target?.image ||
      ''
    ).trim();

  if (!imageUrl) {
    throw new Error(
      'Image analysis target has no source image.'
    );
  }

  const allowedDetails =
    new Set([
      'low',
      'high',
      'original',
      'auto'
    ]);

  if (
    !allowedDetails.has(
      detail
    )
  ) {
    throw new Error(
      `Unsupported image detail: ${detail}`
    );
  }

  return {
    model,

    store:
      false,

    reasoning: {
      effort:
        'none'
    },

    max_output_tokens:
      600,

    input: [
      {
        role:
          'user',

        content: [
          {
            type:
              'input_text',

            text:
              EVENT_IMAGE_ANALYSIS_PROMPT
          },

          {
            type:
              'input_image',

            image_url:
              imageUrl,

            detail
          }
        ]
      }
    ],

    text: {
      format: {
        type:
          'json_schema',

        name:
          'ajsee_event_image_analysis',

        strict:
          true,

        schema:
          EVENT_IMAGE_ANALYSIS_SCHEMA
      }
    }
  };
}

export function extractResponsesOutputText(
  response = {}
) {
  if (
    response?.status ===
      'incomplete'
  ) {
    const reason =
      String(
        response?.incomplete_details?.reason ||
        'unknown'
      );

    const outputTokens =
      Number(
        response?.usage?.output_tokens
      );

    const reasoningTokens =
      Number(
        response?.usage
          ?.output_tokens_details
          ?.reasoning_tokens
      );

    const tokenSummary =
      Number.isFinite(
        outputTokens
      )
        ? ` outputTokens=${outputTokens}, reasoningTokens=${
            Number.isFinite(
              reasoningTokens
            )
              ? reasoningTokens
              : 'unknown'
          }`
        : '';

    throw new Error(
      `Image analysis response incomplete: ${reason}.${tokenSummary}`
    );
  }

  for (
    const item
    of Array.isArray(
      response?.output
    )
      ? response.output
      : []
  ) {
    if (
      item?.type !== 'message'
    ) {
      continue;
    }

    for (
      const content
      of Array.isArray(
        item?.content
      )
        ? item.content
        : []
    ) {
      if (
        content?.type ===
          'refusal'
      ) {
        throw new Error(
          'Image analysis model refused the request.'
        );
      }

      if (
        content?.type ===
          'output_text' &&
        typeof content?.text ===
          'string' &&
        content.text.trim()
      ) {
        return content.text.trim();
      }
    }
  }

  throw new Error(
    'Image analysis response contained no output text.'
  );
}

export function normalizeAnalyzerOutput(
  rawText
) {
  let parsed;

  try {
    parsed =
      JSON.parse(
        rawText
      );
  } catch {
    throw new Error(
      'Image analysis output is not valid JSON.'
    );
  }

  const expectedTypes =
    new Set(
      EVENT_IMAGE_ANALYSIS_SCHEMA
        .properties
        .contentType
        .enum
    );

  if (
    !expectedTypes.has(
      parsed?.contentType
    )
  ) {
    throw new Error(
      'Image analysis output has an unsupported content type.'
    );
  }

  if (
    typeof parsed?.cropSafe !==
      'boolean'
  ) {
    throw new Error(
      'Image analysis output has invalid cropSafe.'
    );
  }

  if (
    typeof parsed?.confidence !==
      'number' ||
    !Number.isFinite(
      parsed.confidence
    ) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1
  ) {
    throw new Error(
      'Image analysis output has invalid confidence.'
    );
  }

  if (
    typeof parsed?.rationale !==
      'string' ||
    !parsed.rationale.trim()
  ) {
    throw new Error(
      'Image analysis output has no rationale.'
    );
  }

  const analysis =
    normalizeEventImageAnalysisRecord({
      version:
        1,

      source:
        'vision',

      contentType:
        parsed.contentType,

      confidence:
        parsed.confidence,

      cropSafe:
        parsed.cropSafe,

      x:
        parsed.x,

      y:
        parsed.y
    });

  if (!analysis) {
    throw new Error(
      'Image analysis output does not satisfy the AJSEE cache contract.'
    );
  }

  return {
    analysis,

    rationale:
      parsed.rationale.trim()
  };
}

export async function analyzeEventImageTarget(
  target,
  {
    apiKey,
    model =
      EVENT_IMAGE_ANALYSIS_MODEL,

    detail =
      EVENT_IMAGE_ANALYSIS_DETAIL,

    fetchImpl =
      globalThis.fetch,

    timeoutMs =
      60000
  } = {}
) {
  if (
    !apiKey ||
    typeof apiKey !== 'string'
  ) {
    throw new Error(
      'OPENAI_API_KEY is required for live image analysis.'
    );
  }

  if (
    typeof fetchImpl !==
      'function'
  ) {
    throw new Error(
      'No fetch implementation available.'
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const request =
      buildEventImageAnalysisRequest(
        target,
        {
          model,
          detail
        }
      );

    const response =
      await fetchImpl(
        'https://api.openai.com/v1/responses',
        {
          method:
            'POST',

          headers: {
            authorization:
              `Bearer ${apiKey}`,

            'content-type':
              'application/json'
          },

          body:
            JSON.stringify(
              request
            ),

          signal:
            controller.signal
        }
      );

    let body = {};

    try {
      body =
        await response.json();
    } catch {
      body = {};
    }

    if (
      !response.ok
    ) {
      const message =
        String(
          body?.error?.message ||
          `HTTP ${response.status}`
        )
          .replace(
            apiKey,
            '[redacted]'
          );

      throw new Error(
        `OpenAI image analysis failed: ${message}`
      );
    }

    const outputText =
      extractResponsesOutputText(
        body
      );

    const normalized =
      normalizeAnalyzerOutput(
        outputText
      );

    return {
      ...normalized,

      responseId:
        String(
          body?.id ||
          ''
        ),

      usage:
        body?.usage &&
        typeof body.usage ===
          'object'
          ? body.usage
          : null
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

export function buildImageAnalysisPreview(
  targets,
  results,
  {
    provider =
      'smsticket',

    model =
      EVENT_IMAGE_ANALYSIS_MODEL,

    detail =
      EVENT_IMAGE_ANALYSIS_DETAIL,

    generatedAt =
      new Date().toISOString()
  } = {}
) {
  if (
    targets.length !==
    results.length
  ) {
    throw new Error(
      'Targets and analysis results do not align.'
    );
  }

  const assets = {};
  const review = [];

  for (
    let index = 0;
    index < targets.length;
    index += 1
  ) {
    const target =
      targets[index];

    const result =
      results[index];

    assets[
      target.cacheKey
    ] = {
      ...result.analysis
    };

    review.push({
      id:
        target.id,

      sourceId:
        target.sourceId,

      title:
        target.title,

      image:
        target.image,

      imageOriginal:
        target.imageOriginal,

      cacheKey:
        target.cacheKey,

      analysis:
        result.analysis,

      rationale:
        result.rationale,

      responseId:
        result.responseId,

      usage:
        result.usage
    });
  }

  return {
    version:
      1,

    provider,

    mode:
      'preview-only',

    generatedAt,
    model,
    detail,
    assets,
    review
  };
}

export function assertPreviewOutputPath(
  outputFile
) {
  const output =
    path.resolve(
      String(
        outputFile ||
        ''
      )
    );

  const productionCache =
    path.resolve(
      'data/event-image-analysis/smsticket.json'
    );

  if (
    output ===
    productionCache
  ) {
    throw new Error(
      'Preview analyzer is not allowed to overwrite the production image-analysis cache.'
    );
  }

  return output;
}
