// Keep the legacy array API while carrying authoritative continuation separately.
export function withEventPageInfo(events, pageInfo) {
  Object.defineProperty(events, 'pageInfo', { value: pageInfo, configurable: true });
  return events;
}

export function eventTime(event = {}) {
  const raw = event.datetime || event.date || '';
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : Infinity;
}

export function ticketmasterPageInfo(data, { page, size, sort }) {
  if (data?._ajseePageInfo) return data._ajseePageInfo;
  const events = data?._embedded?.events || [];
  const totalPages = Number(data?.page?.totalPages);
  const hasTotal = data?.page?.totalPages != null && Number.isFinite(totalPages);
  const hasMore = hasTotal ? page + 1 < totalPages : events.length >= size;
  const times = events.map(event => new Date(event?.dates?.start?.dateTime ||
    (event?.dates?.start?.localDate
      ? `${event.dates.start.localDate}T${event.dates.start.localTime || '12:00:00'}` : '')).getTime())
    .filter(Number.isFinite);
  return {
    hasMore, nextPage: page + 1,
    frontier: times.length ? (sort === 'date,desc' ? Math.min(...times) : Math.max(...times)) : null
  };
}
