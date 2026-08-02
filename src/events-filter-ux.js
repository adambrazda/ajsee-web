// /src/events-filter-ux.js
// AJSEE – reusable UX helpers for the events filter summary and date presets.

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toLocalIso(value) {
  const date = startOfLocalDay(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasCoordinates(filters = {}) {
  const lat = filters.nearMeLat;
  const lon = filters.nearMeLon;

  const hasLatValue =
    lat !== null &&
    lat !== undefined &&
    lat !== '';

  const hasLonValue =
    lon !== null &&
    lon !== undefined &&
    lon !== '';

  return hasLatValue &&
    hasLonValue &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon));
}

function formatIsoDate(value = '', locale = 'cs') {
  if (!value) return '';

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(locale || 'cs', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return value;
  }
}

export function getDatePresetRange(preset, now = new Date()) {
  const today = startOfLocalDay(now);

  if (preset === 'today') {
    const iso = toLocalIso(today);
    return { from: iso, to: iso };
  }

  if (preset === 'tomorrow') {
    const tomorrow = addDays(today, 1);
    const iso = toLocalIso(tomorrow);
    return { from: iso, to: iso };
  }

  if (preset === 'thisWeek') {
    const daysUntilSunday = (7 - today.getDay()) % 7;

    return {
      from: toLocalIso(today),
      to: toLocalIso(addDays(today, daysUntilSunday))
    };
  }

  if (preset === 'weekend') {
    const day = today.getDay();

    if (day === 6) {
      return {
        from: toLocalIso(today),
        to: toLocalIso(addDays(today, 1))
      };
    }

    if (day === 0) {
      const iso = toLocalIso(today);
      return { from: iso, to: iso };
    }

    const saturday = addDays(today, 6 - day);

    return {
      from: toLocalIso(saturday),
      to: toLocalIso(addDays(saturday, 1))
    };
  }

  return { from: '', to: '' };
}

export function detectDatePreset(filters = {}, now = new Date()) {
  const from = String(filters.dateFrom || '');
  const to = String(filters.dateTo || '');

  for (const preset of ['today', 'tomorrow', 'weekend', 'thisWeek']) {
    const range = getDatePresetRange(preset, now);

    if (from === range.from && to === range.to) {
      return preset;
    }
  }

  return '';
}

export function getActiveFilterDescriptors(
  filters = {},
  {
    locale = 'cs',
    labels = {},
    now = new Date()
  } = {}
) {
  const descriptors = [];
  const category = String(filters.category || 'all');

  if (category !== 'all') {
    descriptors.push({
      key: 'category',
      label: labels.categories?.[category] || category
    });
  }

  const audience =
    String(
      filters.audience ||
      ''
    ).trim();

  if (
    audience &&
    audience !== 'all'
  ) {
    descriptors.push({
      key:
        'audience',

      label:
        labels.audiences?.[
          audience
        ] ||
        audience
    });
  }

  const nearMe = hasCoordinates(filters);
  const placeLabel = nearMe
    ? String(labels.nearMe || filters.cityLabel || 'Near me').trim()
    : String(
      filters.cityLabel ||
      filters.city ||
      (filters.placeType === 'country'
        ? labels.countries?.[filters.countryCode] || filters.countryCode || ''
        : '')
    ).trim();

  if (placeLabel) {
    descriptors.push({
      key: 'place',
      label: placeLabel
    });
  }

  const dateFrom = String(filters.dateFrom || '');
  const dateTo = String(filters.dateTo || '');

  if (dateFrom || dateTo) {
    const preset = detectDatePreset(filters, now);
    let label = preset ? labels.datePresets?.[preset] : '';

    if (!label) {
      const fromLabel = formatIsoDate(dateFrom, locale);
      const toLabel = formatIsoDate(dateTo, locale);

      if (fromLabel && toLabel && dateFrom === dateTo) {
        label = fromLabel;
      } else if (fromLabel && toLabel) {
        label = `${fromLabel} – ${toLabel}`;
      } else if (fromLabel) {
        label = `${labels.from || 'From'} ${fromLabel}`;
      } else {
        label = `${labels.to || 'To'} ${toLabel}`;
      }
    }

    descriptors.push({
      key: 'date',
      label
    });
  }

  const keyword = String(filters.keyword || '').trim();

  if (keyword) {
    descriptors.push({
      key: 'keyword',
      label: `“${keyword}”`
    });
  }

  const sort = String(filters.sort || 'nearest');

  if (sort !== 'nearest') {
    descriptors.push({
      key: 'sort',
      label: labels.sorts?.[sort] || sort
    });
  }

  return descriptors;
}

/*
 * Smart empty-state recommendation v1.
 *
 * The order preserves the user's strongest intent:
 * location is removed only after narrower discovery filters.
 * Sort is excluded because it cannot reduce the result count.
 */
const EMPTY_STATE_FILTER_PRIORITY =
  Object.freeze([
    'keyword',
    'date',
    'audience',
    'category',
    'place'
  ]);

export function getEmptyStateRecommendation(
  filters = {},
  {
    locale = 'cs',
    labels = {},
    now = new Date(),
    priority =
      EMPTY_STATE_FILTER_PRIORITY
  } = {}
) {
  const descriptors =
    getActiveFilterDescriptors(
      filters,
      {
        locale,
        labels,
        now
      }
    );

  for (const key of priority) {
    const descriptor =
      descriptors.find(
        (item) =>
          item.key === key
      );

    if (descriptor) {
      return descriptor;
    }
  }

  return null;
}

export function getEmptyStateRecommendationLabel(
  recommendation = null
) {
  const label =
    String(
      recommendation?.label ||
      ''
    ).trim();

  if (
    !label ||
    recommendation?.key !== 'keyword'
  ) {
    return label;
  }

  const quotePairs = [
    ['“', '”'],
    ['„', '“'],
    ['„', '”'],
    ['"', '"'],
    ['«', '»']
  ];

  for (
    const [
      openingQuote,
      closingQuote
    ] of quotePairs
  ) {
    if (
      label.startsWith(
        openingQuote
      ) &&
      label.endsWith(
        closingQuote
      ) &&
      label.length >
        openingQuote.length +
        closingQuote.length
    ) {
      return label
        .slice(
          openingQuote.length,
          label.length -
            closingQuote.length
        )
        .trim();
    }
  }

  return label;
}

/*
 * Privacy-safe context for empty-state analytics.
 *
 * Raw keyword, city, coordinates and full URLs are
 * intentionally excluded from the returned payload.
 * Sort is not counted as a restrictive filter.
 */
export function getEventsEmptyStateAnalyticsContext(
  filters = {},
  recommendation = null,
  {
    locale = 'cs',
    labels = {},
    now = new Date()
  } = {}
) {
  const descriptors =
    getActiveFilterDescriptors(
      filters,
      {
        locale,
        labels,
        now
      }
    );

  const activeKeys =
    new Set(
      descriptors.map(
        (descriptor) =>
          descriptor.key
      )
    );

  const restrictiveFilterCount =
    descriptors.filter(
      (descriptor) =>
        descriptor.key !== 'sort'
    ).length;

  const category =
    String(
      filters.category ||
      'all'
    )
      .trim()
      .toLowerCase();

  const audience =
    String(
      filters.audience ||
      ''
    )
      .trim()
      .toLowerCase();

  const language =
    String(
      locale ||
      'cs'
    )
      .trim()
      .toLowerCase()
      .slice(
        0,
        2
      ) ||
    'cs';

  return Object.freeze({
    recommended_filter:
      String(
        recommendation?.key ||
        'none'
      ),

    active_filter_count:
      restrictiveFilterCount,

    filter_category:
      category &&
      category !== 'all'
        ? category
        : 'all',

    filter_audience:
      audience === 'family'
        ? 'family'
        : 'all',

    has_place_filter:
      activeKeys.has(
        'place'
      )
        ? 1
        : 0,

    has_date_filter:
      activeKeys.has(
        'date'
      )
        ? 1
        : 0,

    has_keyword_filter:
      activeKeys.has(
        'keyword'
      )
        ? 1
        : 0,

    language
  });
}

export function renderEventsFilterSummary({
  document,
  host,
  list,
  count,
  filters = {},
  locale = 'cs',
  labels = {},
  now = new Date(),
  onRemove,
  onClear
} = {}) {
  if (!document || !host) return null;

  let root = host.querySelector('#eventsFilterSummary');

  if (!root) {
    root = document.createElement('section');
    root.id = 'eventsFilterSummary';
    root.className = 'events-filter-summary';

    if (list && list.parentElement === host) {
      host.insertBefore(root, list);
    } else {
      host.appendChild(root);
    }
  }

  root.replaceChildren();

  const descriptors = getActiveFilterDescriptors(filters, {
    locale,
    labels,
    now
  });

  const top = document.createElement('div');
  top.className = 'events-filter-summary__top';

  const countElement = document.createElement('p');
  countElement.id = 'eventsResultsCount';
  countElement.className = 'events-results-count';
  countElement.setAttribute('role', 'status');
  countElement.setAttribute('aria-live', 'polite');
  countElement.textContent = `${labels.found || 'Found'}: ${count}`;

  top.appendChild(countElement);

  if (descriptors.length) {
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'events-filter-summary__clear';
    clearButton.textContent = labels.clearAll || 'Clear all';
    clearButton.addEventListener('click', () => onClear?.());
    top.appendChild(clearButton);
  }

  root.appendChild(top);

  if (descriptors.length) {
    const heading = document.createElement('span');
    heading.className = 'sr-only';
    heading.id = 'eventsActiveFiltersLabel';
    heading.textContent = labels.activeFilters || 'Active filters';
    root.appendChild(heading);

    const listElement = document.createElement('div');
    listElement.className = 'events-filter-summary__chips';
    listElement.setAttribute('role', 'list');
    listElement.setAttribute('aria-labelledby', heading.id);

    descriptors.forEach((descriptor) => {
      const item = document.createElement('span');
      item.className = 'events-filter-summary__item';
      item.setAttribute('role', 'listitem');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'events-filter-chip';
      button.setAttribute(
        'aria-label',
        `${labels.removeFilter || 'Remove filter'}: ${descriptor.label}`
      );

      const text = document.createElement('span');
      text.textContent = descriptor.label;

      const icon = document.createElement('span');
      icon.className = 'events-filter-chip__remove';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '×';

      button.append(text, icon);
      button.addEventListener('click', () => onRemove?.(descriptor.key));
      item.appendChild(button);
      listElement.appendChild(item);
    });

    root.appendChild(listElement);
  }

  return root;
}
