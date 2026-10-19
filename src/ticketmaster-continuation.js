// Discovery's offset limit applies to each query, not to the whole inventory.
// Roll the query's inclusive date boundary before requesting an invalid page.
// Inclusive bounds preserve other events at exactly the same time; the search
// session already deduplicates provider IDs across all received batches.
import { validCalendarDay } from './event-calendar.js';

export const TICKETMASTER_PAGING_DEPTH = 1000;

export function advanceTicketmasterStream(info, previous = {}, { size, sort, forceWindow = false } = {}) {
  const next = { ...previous, ...info, failed: false,
    pagesFetched: (previous.pagesFetched ?? previous.nextPage ?? 0) + (forceWindow ? 0 : 1) };
  if (!info.hasMore || (!forceWindow && info.nextPage * size < TICKETMASTER_PAGING_DEPTH)) return next;
  const field = sort === 'date,desc' ? 'windowEnd' : 'windowStart';
  const boundary = Date.parse(info.boundaryDateTime || '');
  const oldBoundary = Date.parse(previous[field] || '');
  const progresses = Number.isFinite(boundary) && (!Number.isFinite(oldBoundary) ||
    (sort === 'date,desc' ? boundary < oldBoundary : boundary > oldBoundary));
  if (progresses) return { ...next, [field]: info.boundaryDateTime, nextPage: 0, limited: false };
  // Date-only tickets have no exact UTC instant. Keep the whole boundary day
  // using the documented local-start filter instead of inventing a show time.
  const day = validCalendarDay(info.boundaryLocalDate);
  if (!Number.isFinite(boundary) && day && day !== '9999-12-31') {
    const localField = sort === 'date,desc' ? 'windowLocalEnd' : 'windowLocalStart';
    const localBound = sort === 'date,desc'
      ? new Date(Date.parse(day + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10) + 'T00:00:00'
      : day + 'T00:00:00';
    if (!previous[localField] || (sort === 'date,desc' ? localBound < previous[localField] : localBound > previous[localField])) {
      return { ...next, [localField]: localBound, nextPage: 0, limited: false };
    }
  }
  // More than the API's entire depth at one instant (or no exact timestamp)
  // cannot be traversed safely. Report partial coverage instead of looping or
  // silently stepping over tied/undated events.
  return { ...next, limited: true };
}

export function applyTicketmasterWindow(params, stream = {}) {
  if (stream.windowStart) params.set('startDateTime', stream.windowStart);
  if (stream.windowEnd) params.set('endDateTime', stream.windowEnd);
  if (stream.windowLocalStart || stream.windowLocalEnd) {
    params.set('localStartDateTime', (stream.windowLocalStart || '0001-01-01T00:00:00') + ',' +
      (stream.windowLocalEnd || '9999-12-31T23:59:59'));
  }
  if (stream.windowStart || stream.windowEnd || stream.windowLocalStart || stream.windowLocalEnd) {
    // API date filters otherwise default these to "no". Keep undated events
    // reachable in unrestricted searches; explicit user date filters still
    // exclude them through the shared calendar filter.
    params.set('includeTBA', 'yes');
    params.set('includeTBD', 'yes');
  }
}

export function isTicketmasterPagingLimit(error) {
  if (error?.status !== 400) return false;
  try {
    const data = JSON.parse(error.body);
    return data.errors?.some(item => ['DIS1035', 'DIS1024'].includes(item.code)) === true;
  } catch { return false; }
}
