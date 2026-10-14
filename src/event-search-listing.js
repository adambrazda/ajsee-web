import { createEventSearchSession } from './event-search-session.js';
import { hasActivePriceFilter } from './event-price.js';

export const EVENT_LISTING_PAGE_SIZE = 20;
export const eventListingBatchLimit = filters => hasActivePriceFilter(filters) ? 5 : 3;

function ajseeProviderKeyForVisibleMix(ev = {}) {
  try {
    if (typeof ajseeEventProviderKey === 'function') {
      const fromHelper = ajseeEventProviderKey(ev);
      if (fromHelper) return fromHelper;
    }
  } catch {
    /* noop */
  }

  const raw = String(
    ev?.partner ||
    ev?.source ||
    ev?.bookingProvider ||
    ev?.affiliate?.provider ||
    ev?.tickets ||
    ev?.url ||
    ''
  ).trim().toLowerCase();

  if (raw.includes('seatplan')) return 'seatplan';
  if (raw.includes('ticketmaster')) return 'ticketmaster';
  if (raw.includes('smsticket')) return 'smsticket';
  if (raw.includes('colosseum')) return 'colosseumticket';

  return raw
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ajseeHasProviderMixIntent(filters = {}, api = {}) {
  const keyword = String(
    filters.keyword ||
    filters.q ||
    filters.search ||
    api.keyword ||
    api.q ||
    api.search ||
    ''
  ).trim();

  if (keyword) return false;

  return Boolean(
    filters.city ||
    filters.cityLabel ||
    filters.cityCountryCode ||
    filters.countryCode ||
    api.city ||
    api.cityLabel ||
    api.cityCountryCode ||
    api.countryCode ||
    api.placeType === 'country' ||
    filters.placeType === 'country'
  );
}

export function ajseeApplyProviderMixForFirstPage(events = [], options = {}) {
  if (!Array.isArray(events) || events.length < 2) return events;

  const filters = options.filters || {};
  const api = options.api || {};
  const pageSize = Math.max(6, Number(options.pageSize) || 20);

  if (!ajseeHasProviderMixIntent(filters, api)) return events;

  const providerCounts = new Map();

  for (const event of events) {
    const provider = ajseeProviderKeyForVisibleMix(event);
    if (!provider) continue;
    providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  }

  const providers = Array.from(providerCounts.keys());
  if (providers.length < 2) return events;

  const windowSize = Math.min(pageSize, events.length);
  const firstWindow = events.slice(0, windowSize);

  const firstWindowCounts = new Map();

  for (const event of firstWindow) {
    const provider = ajseeProviderKeyForVisibleMix(event) || 'unknown';
    firstWindowCounts.set(provider, (firstWindowCounts.get(provider) || 0) + 1);
  }

  const dominantProvider = Array.from(firstWindowCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  if (!dominantProvider) return events;

  const nonDominantTotal = events.filter((event) => {
    const provider = ajseeProviderKeyForVisibleMix(event);
    return provider && provider !== dominantProvider;
  }).length;

  if (!nonDominantTotal) return events;

  const currentNonDominantInWindow = firstWindow.filter((event) => {
    const provider = ajseeProviderKeyForVisibleMix(event);
    return provider && provider !== dominantProvider;
  }).length;

  const targetNonDominant = Math.min(
    nonDominantTotal,
    Math.max(2, Math.min(5, Math.floor(windowSize * 0.25)))
  );

  if (currentNonDominantInWindow >= targetNonDominant) return events;

  const promoted = events
    .filter((event) => {
      const provider = ajseeProviderKeyForVisibleMix(event);
      return provider && provider !== dominantProvider;
    })
    .slice(0, targetNonDominant);

  if (!promoted.length) return events;

  const promotedSet = new Set(promoted);
  const remaining = events.filter((event) => !promotedSet.has(event));

  const insertPositions = [2, 6, 10, 14, 18].filter((position) => position < windowSize);
  const mixedFirstWindow = [];

  let promotedIndex = 0;
  let remainingIndex = 0;

  for (let index = 0; index < windowSize; index += 1) {
    if (insertPositions.includes(index) && promotedIndex < promoted.length) {
      mixedFirstWindow.push(promoted[promotedIndex]);
      promotedIndex += 1;
      continue;
    }

    if (remainingIndex < remaining.length) {
      mixedFirstWindow.push(remaining[remainingIndex]);
      remainingIndex += 1;
    }
  }

  while (mixedFirstWindow.length < windowSize && promotedIndex < promoted.length) {
    mixedFirstWindow.push(promoted[promotedIndex]);
    promotedIndex += 1;
  }

  return mixedFirstWindow.concat(remaining.slice(remainingIndex));
}

// Homepage previews the same first page that Events publishes. Both must
// inspect the same candidate window before committing its provider mix.
export function createEventListingSession({ locale, filters, fetchBatch, getRates, pageSize = EVENT_LISTING_PAGE_SIZE }) {
  return createEventSearchSession({ locale, filters, fetchBatch, getRates, firstPageSize: pageSize,
    mixFirstPage: events => ajseeApplyProviderMixForFirstPage(events, { filters, api: filters, pageSize }) });
}
