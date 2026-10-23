import {
  canonForInputCity
} from '../city/canonical.js';

import {
  buildColosseumTicketTaxonomy,
  deriveLegacyCategory
} from '../taxonomy/event-taxonomy.js';

import {
  matchesEventDiscoveryFilters
} from '../taxonomy/event-filtering.js';

import {
  matchesKeywordPrefix
} from '../search/keyword-match.js';
import { isLocalEventDateAvailable, matchesEventDateRange } from '../event-calendar.js';
import { withProviderDateRange } from '../provider-event-dates.js';
import { fetchProviderJson } from '../provider-request.js';
import { withColosseumGeography } from '../../shared/geo/colosseum-geography.js';
import { eventCoordinates, distanceKm } from '../../shared/geo/coordinates.js';
import { withEventPageInfo } from '../event-pagination.js';


const DEFAULT_DATA_URL =
  '/data/colosseumticket-events.json';

const CITY_DATA_URLS = [
  {
    url:
      '/data/colosseumticket-events-praha.json',

    aliases: [
      'praha',
      'prague'
    ]
  },

  {
    url:
      '/data/colosseumticket-events-brno.json',

    aliases: [
      'brno'
    ]
  },

  {
    url:
      '/data/colosseumticket-events-ostrava.json',

    aliases: [
      'ostrava'
    ]
  }
];


const dataCache =
  new Map();

const dataPromiseCache =
  new Map();


function text(value) {
  if (value == null) {
    return '';
  }

  if (
    typeof value ===
    'string'
  ) {
    return value.trim();
  }

  if (
    typeof value ===
    'object'
  ) {
    return String(
      value.cs ||
      value.sk ||
      value.en ||
      Object.values(value)
        .find(
          (item) =>
            typeof item ===
            'string'
        ) ||
      ''
    ).trim();
  }

  return String(
    value
  ).trim();
}


function fold(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function getCity(event = {}) {
  return text(
    event?.location?.city ||
    event?.venue?.city ||
    event?.place?.city ||
    ''
  );
}


function getTitle(event = {}) {
  return text(
    event?.title
  );
}


function getDescription(event = {}) {
  return text(
    event?.description
  );
}


function canonicalCity(value = '') {
  const raw =
    text(value);

  if (!raw) {
    return '';
  }

  try {
    const canonical =
      canonForInputCity?.(
        raw
      );

    return text(
      canonical ||
      raw
    );
  } catch {
    return raw;
  }
}


function cityTokens(value = '') {
  const raw =
    text(value);

  if (!raw) {
    return [];
  }

  return [
    ...new Set(
      [
        fold(raw),
        fold(
          canonicalCity(
            raw
          )
        )
      ].filter(Boolean)
    )
  ];
}


function matchesCity(
  event,
  selectedCity = ''
) {
  const selectedTokens =
    cityTokens(
      selectedCity
    );

  if (!selectedTokens.length) {
    return true;
  }

  const eventTokens =
    cityTokens(
      getCity(
        event
      )
    );

  if (!eventTokens.length) {
    return false;
  }

  return selectedTokens.some(
    (selected) =>
      eventTokens.some(
        (candidate) =>
          candidate === selected
      )
  );
}


function resolveDataUrl(
  filters = {}
) {
  if (hasNearMe(filters)) return DEFAULT_DATA_URL;
  const city =
    text(
      filters.city ||
      filters.cityLabel ||
      filters.location ||
      ''
    );

  if (!city) {
    return DEFAULT_DATA_URL;
  }

  const selectedTokens =
    cityTokens(
      city
    );

  const definition =
    CITY_DATA_URLS.find(
      (item) =>
        item.aliases.some(
          (alias) => {
            const normalizedAlias =
              fold(
                alias
              );

            return selectedTokens.some(
              (selected) =>
                selected ===
                normalizedAlias
            );
          }
        )
    );

  return (
    definition?.url ||
    DEFAULT_DATA_URL
  );
}


async function loadDataUrl(
  dataUrl
) {
  if (
    dataCache.has(
      dataUrl
    )
  ) {
    return dataCache.get(
      dataUrl
    );
  }

  if (
    dataPromiseCache.has(
      dataUrl
    )
  ) {
    return dataPromiseCache.get(
      dataUrl
    );
  }

  const promise =
    (async () => {
      try {
        const events = await fetchProviderJson(dataUrl);

        dataCache.set(
          dataUrl,
          events
        );

        return events;
      } catch (error) {
        console.warn(
          '[colosseumticket adapter] failed to load ' +
            dataUrl +
            ':',
          error
        );

        return null;
      } finally {
        dataPromiseCache.delete(
          dataUrl
        );
      }
    })();

  dataPromiseCache.set(
    dataUrl,
    promise
  );

  return promise;
}


async function loadData(
  filters = {}
) {
  const primaryUrl =
    resolveDataUrl(
      filters
    );

  const primaryEvents =
    await loadDataUrl(
      primaryUrl
    );

  if (
    Array.isArray(
      primaryEvents
    )
  ) {
    return primaryEvents;
  }

  if (
    primaryUrl !==
    DEFAULT_DATA_URL
  ) {
    const fallbackEvents =
      await loadDataUrl(
        DEFAULT_DATA_URL
      );

    if (
      Array.isArray(
        fallbackEvents
      )
    ) {
      return fallbackEvents;
    }
  }

  throw new Error('ColosseumTicket feed unavailable');
}


function hasNearMe(
  filters = {}
) {
  return (
    filters.nearMeLat != null &&
    filters.nearMeLon != null
  );
}


/*
 * AJSEE integration scope.
 *
 * This is deliberately NOT canonical event metadata:
 * the ColosseumTicket XML currently provides no country field.
 * AJSEE currently exposes this provider only for the CZ market.
 */
export const COLOSSEUMTICKET_MARKET_COUNTRY_CODE =
  'CZ';


function shouldSkipCountry(
  filters = {}
) {
  const countryCode =
    text(
      filters.cityCountryCode ||
      filters.cityCc ||
      filters.countryCode ||
      filters.country ||
      ''
    ).toUpperCase();

  return Boolean(
    countryCode &&
    countryCode !==
      COLOSSEUMTICKET_MARKET_COUNTRY_CODE
  );
}


function dateMs(value) {
  const raw =
    text(
      value
    );

  if (!raw) {
    return Number.NaN;
  }

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0
    ).getTime();
  }

  return new Date(
    raw
  ).getTime();
}




export function isColosseumTicketEventCurrent(
  event = {},
  now = new Date()
) {
  return isLocalEventDateAvailable(withProviderDateRange(event), now);
}


function inDateRange(
  event,
  dateFrom = '',
  dateTo = ''
) {
  return matchesEventDateRange(event, dateFrom, dateTo);
}


function matchesKeyword(
  event,
  keyword = ''
) {
  const query =
    fold(
      keyword
    );

  if (!query) {
    return true;
  }

  const haystack =
    fold(
      [
        getTitle(
          event
        ),
        getDescription(
          event
        ),
        getCity(
          event
        ),
        event?.venue?.name,
        event?.address,
        event?.sourceMeta?.rawType,
        ...(
          Array.isArray(
            event?.categories
          )
            ? event.categories
            : []
        ),
        ...(
          Array.isArray(
            event?.types
          )
            ? event.types
            : []
        )
      ]
        .filter(Boolean)
        .join(' ')
    );

  return matchesKeywordPrefix(
    haystack,
    query
  );
}


export function withColosseumTicketTaxonomy(
  event = {}
) {
  const taxonomy =
    buildColosseumTicketTaxonomy(
      event
    );

  return {
    ...event,

    category:
      deriveLegacyCategory(
        taxonomy
      ),

    taxonomy
  };
}


function sortEvents(
  events,
  sort = 'nearest'
) {
  return [
    ...events
  ].sort(
    (left, right) => {
      const leftMs =
        dateMs(
          left?.datetime ||
          left?.date
        );

      const rightMs =
        dateMs(
          right?.datetime ||
          right?.date
        );

      if (
        !Number.isFinite(
          leftMs
        ) &&
        !Number.isFinite(
          rightMs
        )
      ) {
        return 0;
      }

      if (
        !Number.isFinite(
          leftMs
        )
      ) {
        return 1;
      }

      if (
        !Number.isFinite(
          rightMs
        )
      ) {
        return -1;
      }

      return (
        sort === 'latest'
          ? rightMs - leftMs
          : leftMs - rightMs
      );
    }
  );
}


function pageSlice(
  events,
  filters = {}
) {
  const pageRaw =
    Number(
      filters.page ??
      0
    );

  const sizeRaw =
    Number(
      filters.size ??
      50
    );

  const page =
    Number.isFinite(
      pageRaw
    ) &&
    pageRaw > 0
      ? Math.floor(
          pageRaw
        )
      : 0;

  const size =
    Number.isFinite(
      sizeRaw
    ) &&
    sizeRaw > 0
      ? Math.min(
          Math.max(
            Math.floor(
              sizeRaw
            ),
            1
          ),
          100
        )
      : 50;

  const start =
    page * size;

  return events.slice(
    start,
    start + size
  );
}


export async function fetchEvents({
  filters = {}
} = {}) {
  if (
    filters.includeColosseumticket === false ||
    filters.includeColosseumTicket === false
  ) {
    return [];
  }

  /*
   * AJSEE currently scopes this provider integration to CZ.
   * This gate is independent of canonical event country data.
   */
  if (
    shouldSkipCountry(
      filters
    )
  ) {
    return [];
  }

  const sourceEvents =
    await loadData(
      filters
    );

  const geo = hasNearMe(filters);
  const city = geo ? '' :
    text(
      filters.city ||
      ''
    );

  const category =
    filters.category ??
    filters.segment ??
    'all';

  const audience =
    filters.audience ??
    '';

  const keyword =
    text(
      filters.keyword ||
      filters.q ||
      filters.search ||
      ''
    );

  const dateFrom =
    text(
      filters.dateFrom ??
      filters.from ??
      ''
    );

  const dateTo =
    text(
      filters.dateTo ??
      filters.to ??
      ''
    );

  const candidates = [];
  const coverage = { located: 0, missing: 0 };

  for (
    const sourceEvent of
    sourceEvents
  ) {
    const event = withProviderDateRange(withColosseumGeography(sourceEvent));
    if (
      !isColosseumTicketEventCurrent(
        event
      )
    ) {
      continue;
    }

    if (
      city &&
      !matchesCity(
        event,
        city
      )
    ) {
      continue;
    }

    const normalized =
      withColosseumTicketTaxonomy(
        event
      );

    if (
      !matchesEventDiscoveryFilters(
        normalized,
        {
          category,
          audience
        }
      )
    ) {
      continue;
    }

    if (
      keyword &&
      !matchesKeyword(
        normalized,
        keyword
      )
    ) {
      continue;
    }

    if (
      (
        dateFrom ||
        dateTo
      ) &&
      !inDateRange(
        normalized,
        dateFrom,
        dateTo
      )
    ) {
      continue;
    }

    if (geo) {
      const point = eventCoordinates(normalized);
      if (!point) { coverage.missing++; continue; }
      coverage.located++;
      const radius = Number.isFinite(+filters.nearMeRadiusKm) ? +filters.nearMeRadiusKm : 50;
      if (distanceKm(filters.nearMeLat, filters.nearMeLon, point.lat, point.lon) > radius) continue;
    }

    candidates.push(
      normalized
    );
  }

  const sorted =
    sortEvents(
      candidates,
      filters.sort ||
      'nearest'
    );

  const result = filters.allLocalEvents === true ? sorted : pageSlice(sorted, filters);
  return geo ? withEventPageInfo(result, { geographyCoverage: { colosseumticket: coverage } }) : result;
}


export default {
  fetchEvents
};
