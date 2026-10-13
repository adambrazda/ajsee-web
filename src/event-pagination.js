import { eventStartInstant } from './event-calendar.js';

// Keep the legacy array API while carrying authoritative continuation separately.
export function withEventPageInfo(events, pageInfo) {
  Object.defineProperty(events, 'pageInfo', { value: pageInfo, configurable: true });
  return events;
}

export function eventTime(event = {}) {
  const time = eventStartInstant(event);
  return Number.isFinite(time) ? time : Infinity;
}

export function ticketmasterPageInfo(data, { page, size, sort }) {
  if (data?._ajseePageInfo) return data._ajseePageInfo;
  const events = data?._embedded?.events || [];
  const totalPages = Number(data?.page?.totalPages);
  const hasTotal = data?.page?.totalPages != null && Number.isFinite(totalPages);
  const hasMore = hasTotal ? page + 1 < totalPages : events.length >= size;
  const times = events.map(event => eventStartInstant({
    datetime: event?.dates?.start?.dateTime || '',
    dateAvailability: {
      startLocalDate: event?.dates?.start?.localDate || '',
      startLocalTime: event?.dates?.start?.localTime || '',
      timezone: event?.dates?.timezone || event?._embedded?.venues?.[0]?.timezone || ''
    }, location: { country: event?._embedded?.venues?.[0]?.country?.countryCode || '' }
  }))
    .filter(Number.isFinite);
  return {
    hasMore, nextPage: page + 1,
    frontier: times.length ? (sort === 'date,desc' ? Math.min(...times) : Math.max(...times)) : null
  };
}
