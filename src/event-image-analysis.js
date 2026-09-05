const EVENT_IMAGE_ANALYSIS_VERSION =
  1;

const EVENT_IMAGE_PRESENTATION_VERSION =
  2;

const EVENT_IMAGE_VISION_COVER_MIN_CONFIDENCE =
  0.88;

const EVENT_IMAGE_CONTENT_TYPES =
  new Set([
    'photo',
    'person',
    'poster',
    'text-heavy-artwork',
    'graphic',
    'collage',
    'unknown'
  ]);

const EVENT_IMAGE_COVER_CONTENT_TYPES =
  new Set([
    'photo',
    'person'
  ]);

function normalizeAnalysisSource(
  value
) {
  const source =
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase();

  return source === 'manual' ||
    source === 'vision'
      ? source
      : '';
}

function normalizeAnalysisContentType(
  value
) {
  const contentType =
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase();

  return EVENT_IMAGE_CONTENT_TYPES.has(
    contentType
  )
    ? contentType
    : 'unknown';
}

function normalizeAnalysisConfidence(
  value
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      numeric
    )
  );
}

function normalizeAnalysisFocalPoint(
  value
) {
  if (
    value == null ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numeric
    )
  );
}

function normalizeManualFit(
  value
) {
  const fit =
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase();

  return fit === 'cover' ||
    fit === 'contain'
      ? fit
      : '';
}

function normalizeManualSurface(
  value,
  fit
) {
  if (
    fit !== 'contain'
  ) {
    return 'neutral';
  }

  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase() ===
      'adaptive-matte'
    ? 'adaptive-matte'
    : 'neutral';
}

export function eventImageAnalysisCacheKey(
  rawUrl = ''
) {
  return String(
    rawUrl ||
    ''
  )
    .trim()
    .replace(
      /^http:\/\//i,
      'https://'
    );
}

export function normalizeEventImageAnalysisRecord(
  raw = {}
) {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  if (
    Number(
      raw.version
    ) !==
    EVENT_IMAGE_ANALYSIS_VERSION
  ) {
    return null;
  }

  const source =
    normalizeAnalysisSource(
      raw.source
    );

  if (!source) {
    return null;
  }

  const contentType =
    normalizeAnalysisContentType(
      raw.contentType
    );

  const confidence =
    normalizeAnalysisConfidence(
      raw.confidence
    );

  const x =
    normalizeAnalysisFocalPoint(
      raw.x
    );

  const y =
    normalizeAnalysisFocalPoint(
      raw.y
    );

  const cropSafe =
    raw.cropSafe === true
      ? true
      : raw.cropSafe === false
        ? false
        : null;

  const normalized = {
    version:
      EVENT_IMAGE_ANALYSIS_VERSION,

    source,
    contentType,
    confidence,
    cropSafe,
    x,
    y
  };

  if (
    source === 'manual'
  ) {
    const fit =
      normalizeManualFit(
        raw.fit
      );

    if (!fit) {
      return null;
    }

    return {
      ...normalized,

      fit,

      surface:
        normalizeManualSurface(
          raw.surface,
          fit
        )
    };
  }

  return normalized;
}

function visionPresentation(
  analysis
) {
  const hasReliableFocalPoint =
    Number.isFinite(
      analysis.x
    ) &&
    Number.isFinite(
      analysis.y
    );

  const safeCover =
    EVENT_IMAGE_COVER_CONTENT_TYPES.has(
      analysis.contentType
    ) &&
    analysis.cropSafe === true &&
    analysis.confidence >=
      EVENT_IMAGE_VISION_COVER_MIN_CONFIDENCE &&
    hasReliableFocalPoint;

  if (safeCover) {
    return {
      fit:
        'cover',

      x:
        analysis.x,

      y:
        analysis.y,

      surface:
        'neutral',

      contentType:
        analysis.contentType,

      cropSafe:
        true,

      confidence:
        analysis.confidence,

      source:
        'vision',

      version:
        EVENT_IMAGE_PRESENTATION_VERSION
    };
  }

  return {
    fit:
      'contain',

    x:
      50,

    y:
      50,

    surface:
      'adaptive-matte',

    contentType:
      analysis.contentType,

    cropSafe:
      analysis.cropSafe,

    confidence:
      analysis.confidence,

    source:
      'vision',

    version:
      EVENT_IMAGE_PRESENTATION_VERSION
  };
}

function manualPresentation(
  analysis
) {
  return {
    fit:
      analysis.fit,

    x:
      Number.isFinite(
        analysis.x
      )
        ? analysis.x
        : 50,

    y:
      Number.isFinite(
        analysis.y
      )
        ? analysis.y
        : 50,

    surface:
      analysis.surface,

    contentType:
      analysis.contentType,

    cropSafe:
      analysis.cropSafe,

    confidence:
      analysis.confidence,

    source:
      'manual',

    version:
      EVENT_IMAGE_PRESENTATION_VERSION
  };
}

export function resolveEventImageAnalysis(
  cache = {},
  rawUrl = ''
) {
  if (
    !cache ||
    typeof cache !== 'object' ||
    Number(
      cache.version
    ) !==
      EVENT_IMAGE_ANALYSIS_VERSION ||
    !cache.assets ||
    typeof cache.assets !== 'object'
  ) {
    return null;
  }

  const key =
    eventImageAnalysisCacheKey(
      rawUrl
    );

  if (!key) {
    return null;
  }

  const analysis =
    normalizeEventImageAnalysisRecord(
      cache.assets[key]
    );

  if (!analysis) {
    return null;
  }

  return analysis.source ===
    'manual'
      ? manualPresentation(
          analysis
        )
      : visionPresentation(
          analysis
        );
}
