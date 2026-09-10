
const EVENT_IMAGE_CARD_TARGET_RATIO =
  4 / 3;

const EVENT_IMAGE_CARD_TARGET_WIDTH =
  640;

const EVENT_IMAGE_CARD_MIN_WIDTH =
  480;

const EVENT_IMAGE_CARD_MAX_PREFERRED_WIDTH =
  1200;

const EVENT_IMAGE_RATIO_BY_LABEL =
  new Map([
    ['4_3', 4 / 3],
    ['3_2', 3 / 2],
    ['16_9', 16 / 9]
  ]);

export function normalizeEventImageAsset(
  raw = {}
) {
  const url =
    String(
      raw?.url ||
      ''
    ).trim();

  if (!url) {
    return null;
  }

  const width =
    Number(
      raw?.width ||
      0
    );

  const height =
    Number(
      raw?.height ||
      0
    );

  return {
    url,

    width:
      Number.isFinite(width) &&
      width > 0
        ? width
        : 0,

    height:
      Number.isFinite(height) &&
      height > 0
        ? height
        : 0,

    ratio:
      String(
        raw?.ratio ||
        ''
      )
        .trim()
        .toLowerCase(),

    fallback:
      raw?.fallback === true,

    attribution:
      String(
        raw?.attribution ||
        ''
      ).trim()
  };
}

export function eventImageAssetRatio(
  asset = {}
) {
  if (
    asset.width > 0 &&
    asset.height > 0
  ) {
    return (
      asset.width /
      asset.height
    );
  }

  return (
    EVENT_IMAGE_RATIO_BY_LABEL.get(
      asset.ratio
    ) ??
    null
  );
}

function eventImageRatioDistance(
  asset = {}
) {
  const ratio =
    eventImageAssetRatio(
      asset
    );

  if (
    !Number.isFinite(ratio)
  ) {
    return 100;
  }

  return Math.abs(
    ratio -
    EVENT_IMAGE_CARD_TARGET_RATIO
  );
}

function eventImageWidthDistance(
  asset = {}
) {
  if (!(asset.width > 0)) {
    return 1000000;
  }

  return Math.abs(
    asset.width -
    EVENT_IMAGE_CARD_TARGET_WIDTH
  );
}

function eventImageCandidatePool(
  assets = []
) {
  const preferred =
    assets.filter(
      (asset) =>
        asset.width >=
          EVENT_IMAGE_CARD_MIN_WIDTH &&
        asset.width <=
          EVENT_IMAGE_CARD_MAX_PREFERRED_WIDTH
    );

  const adequate =
    preferred.length
      ? preferred
      : assets.filter(
          (asset) =>
            asset.width >=
            EVENT_IMAGE_CARD_MIN_WIDTH
        );

  const qualityPool =
    adequate.length
      ? adequate
      : assets;

  const eventSpecific =
    qualityPool.filter(
      (asset) =>
        asset.fallback !== true
    );

  return eventSpecific.length
    ? eventSpecific
    : qualityPool;
}

export function resolveEventImageAsset(
  rawAssets = []
) {
  const assets =
    Array.isArray(rawAssets)
      ? rawAssets
          .map(
            normalizeEventImageAsset
          )
          .filter(Boolean)
      : [];

  if (!assets.length) {
    return null;
  }

  const candidates =
    eventImageCandidatePool(
      assets
    );

  return (
    [...candidates]
      .sort(
        (a, b) => {
          const ratioDifference =
            eventImageRatioDistance(
              a
            ) -
            eventImageRatioDistance(
              b
            );

          if (
            Math.abs(
              ratioDifference
            ) > 0.0001
          ) {
            return ratioDifference;
          }

          const widthDifference =
            eventImageWidthDistance(
              a
            ) -
            eventImageWidthDistance(
              b
            );

          if (
            widthDifference !== 0
          ) {
            return widthDifference;
          }

          return (
            Number(
              b.width ||
              0
            ) -
            Number(
              a.width ||
              0
            )
          );
        }
      )[0] ||
    null
  );
}

export function resolveProviderImagePresentation(
  rawAsset
) {
  const asset =
    normalizeEventImageAsset(
      rawAsset
    );

  if (!asset) {
    return null;
  }

  const ratio =
    eventImageAssetRatio(
      asset
    );

  const isFourThree =
    asset.ratio === '4_3' ||
    (
      Number.isFinite(ratio) &&
      Math.abs(
        ratio -
        EVENT_IMAGE_CARD_TARGET_RATIO
      ) <= 0.03
    );

  if (!isFourThree) {
    return null;
  }

  return {
    fit: 'cover',
    x: 50,
    y: 50,
    source: 'provider',
    version: 2
  };
}
