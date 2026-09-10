export const TURNSTILE_TEST_SITEKEY =
  '1x00000000000000000000AA';

const DEPLOY_PREVIEW_HOST_RE =
  /^deploy-preview-\d+--ajsee-demo\.netlify\.app$/i;

const PRODUCTION_HOSTS =
  new Set([
    'ajsee.cz',
    'www.ajsee.cz'
  ]);

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function enabledFlag(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'true';
}

export function isDeployPreviewHostname(
  hostname
) {
  return DEPLOY_PREVIEW_HOST_RE.test(
    normalizeHostname(hostname)
  );
}

export function isProductionAiSearchHostname(
  hostname
) {
  return PRODUCTION_HOSTS.has(
    normalizeHostname(hostname)
  );
}

export function isAiSearchServerEnabled({
  hostname = '',
  enabled = ''
} = {}) {
  if (
    isDeployPreviewHostname(
      hostname
    )
  ) {
    return true;
  }

  return (
    isProductionAiSearchHostname(
      hostname
    ) &&
    enabledFlag(enabled)
  );
}

export function resolveAiSearchClientConfig({
  hostname = '',
  enabled = '',
  sitekey = ''
} = {}) {
  if (
    isDeployPreviewHostname(
      hostname
    )
  ) {
    return {
      enabled:
        true,

      sitekey:
        TURNSTILE_TEST_SITEKEY,

      mode:
        'cloudflare-dummy'
    };
  }

  const normalizedSitekey =
    String(sitekey || '')
      .trim();

  if (
    isProductionAiSearchHostname(
      hostname
    ) &&
    enabledFlag(enabled) &&
    normalizedSitekey
  ) {
    return {
      enabled:
        true,

      sitekey:
        normalizedSitekey,

      mode:
        'production'
    };
  }

  return {
    enabled:
      false,

    sitekey:
      '',

    mode:
      'disabled'
  };
}

function pad2(value) {
  return String(value)
    .padStart(2, '0');
}

export function formatLocalIsoWithOffset(
  date = new Date(),
  timezoneOffsetMinutes =
    null
) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const resolvedOffset =
    timezoneOffsetMinutes === null
      ? date.getTimezoneOffset()
      : Number(
          timezoneOffsetMinutes
        );

  if (
    !Number.isFinite(
      resolvedOffset
    )
  ) {
    return '';
  }

  const offsetMinutes =
    Math.trunc(
      resolvedOffset
    );

  const localClock =
    new Date(
      date.getTime() -
      offsetMinutes * 60_000
    );

  const offsetSign =
    offsetMinutes <= 0
      ? '+'
      : '-';

  const absoluteOffset =
    Math.abs(
      offsetMinutes
    );

  const offsetHours =
    Math.floor(
      absoluteOffset / 60
    );

  const offsetRemainder =
    absoluteOffset % 60;

  return (
    `${localClock.getUTCFullYear()}-` +
    `${pad2(localClock.getUTCMonth() + 1)}-` +
    `${pad2(localClock.getUTCDate())}T` +
    `${pad2(localClock.getUTCHours())}:` +
    `${pad2(localClock.getUTCMinutes())}:` +
    `${pad2(localClock.getUTCSeconds())}` +
    `${offsetSign}${pad2(offsetHours)}:` +
    `${pad2(offsetRemainder)}`
  );
}
