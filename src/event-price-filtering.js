import {
  hasActivePriceFilter,
  matchesEventMaxPrice
} from './event-price.js';

export function filterEventPriceBatch(
  events = [],
  filters = {},
  rates = {}
) {
  const list =
    Array.isArray(events)
      ? events
      : [];

  if (
    !hasActivePriceFilter(
      filters
    )
  ) {
    return list;
  }

  return list.filter(
    event =>
      matchesEventMaxPrice(
        event,
        filters,
        {
          rates:
            rates || {}
        }
      )
  );
}