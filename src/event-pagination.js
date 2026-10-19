import { eventStartInstant, validCalendarDay } from './event-calendar.js';

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
      timezone: event?.dates?.timezone || event?._embedded?.venues?.[0]?.timezone || '',
      dateTBA: event?.dates?.start?.dateTBA, dateTBD: event?.dates?.start?.dateTBD
    }, location: { country: event?._embedded?.venues?.[0]?.country?.countryCode || '' }
  }))
    .filter(Number.isFinite);
  const exactTimes = events.filter(event => !event?.dates?.start?.dateTBA && !event?.dates?.start?.dateTBD)
    .map(event => Date.parse(event?.dates?.start?.dateTime || '')).filter(Number.isFinite);
  const boundary = exactTimes.length ? (sort === 'date,desc' ? Math.min(...exactTimes) : Math.max(...exactTimes)) : null;
  const localDays = events.filter(event => !event?.dates?.start?.dateTBA && !event?.dates?.start?.dateTBD)
    .map(event => validCalendarDay(event?.dates?.start?.localDate)).filter(Boolean).sort();
  return {
    hasMore, nextPage: page + 1,
    frontier: times.length ? (sort === 'date,desc' ? Math.min(...times) : Math.max(...times)) : null,
    boundaryDateTime: boundary == null ? null : new Date(boundary).toISOString().replace(/\.000Z$/, 'Z'),
    boundaryLocalDate: localDays.length ? (sort === 'date,desc' ? localDays[0] : localDays.at(-1)) : null
  };
}
