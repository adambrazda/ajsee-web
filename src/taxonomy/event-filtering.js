// /src/taxonomy/event-filtering.js
// AJSEE – shared taxonomy-aware event filtering helpers.

function text(value) {
  if (value == null) return '';

  return String(value).trim();
}

function fold(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function values(value) {
  return Array.isArray(value)
    ? value
        .map(fold)
        .filter(Boolean)
    : [];
}

export function normalizeEventCategoryFilter(
  value = 'all'
) {
  const normalized =
    fold(
      value ||
      'all'
    );

  switch (normalized) {
    case '':
    case 'all':
      return 'all';

    case 'sports':
      return 'sport';

    case 'cinema':
    case 'movie':
    case 'movies':
      return 'film';

    default:
      return normalized;
  }
}

export function normalizeEventAudienceFilter(
  value = ''
) {
  const normalized =
    fold(value);

  switch (normalized) {
    case '':
    case 'all':
      return '';

    case 'children':
    case 'kids':
      return 'family';

    default:
      return normalized;
  }
}

export function matchesEventCategoryFilter(
  event = {},
  category = 'all'
) {
  const wanted =
    normalizeEventCategoryFilter(
      category
    );

  if (wanted === 'all') {
    return true;
  }

  const legacyCategory =
    normalizeEventCategoryFilter(
      event.category ||
      ''
    );

  const domains =
    values(
      event.taxonomy?.domains
    );

  const eventTypes =
    values(
      event.taxonomy?.eventTypes
    );

  if (wanted === 'film') {
    return (
      legacyCategory === 'film' ||
      domains.includes('film') ||
      eventTypes.includes('cinema')
    );
  }

  if (wanted === 'sport') {
    return (
      legacyCategory === 'sport' ||
      domains.includes('sport')
    );
  }

  if (wanted === 'theatre') {
    return (
      legacyCategory === 'theatre' ||
      eventTypes.includes('theatre')
    );
  }

  /*
   * Concert and festival retain their existing legacy
   * category semantics in filter v1.
   *
   * Their taxonomy domains and event types currently
   * overlap too broadly for a safe public migration.
   */
  return (
    legacyCategory ===
    wanted
  );
}

export function matchesEventAudienceFilter(
  event = {},
  audience = ''
) {
  const wanted =
    normalizeEventAudienceFilter(
      audience
    );

  if (!wanted) {
    return true;
  }

  const audiences =
    values(
      event.taxonomy?.audiences
    );

  const legacyCategory =
    normalizeEventCategoryFilter(
      event.category ||
      ''
    );

  if (wanted === 'family') {
    return (
      audiences.includes('family') ||
      legacyCategory === 'family'
    );
  }

  return audiences.includes(
    wanted
  );
}

export function matchesEventDiscoveryFilters(
  event = {},
  filters = {}
) {
  const category =
    filters.category ??
    filters.segment ??
    'all';

  const audience =
    filters.audience ??
    '';

  return (
    matchesEventCategoryFilter(
      event,
      category
    ) &&
    matchesEventAudienceFilter(
      event,
      audience
    )
  );
}
