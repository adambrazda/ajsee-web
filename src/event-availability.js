import { calendarDay, eventDateBounds } from './event-calendar.js';

// SMS Ticket and ColosseumTicket validate their own availability in the adapters.

export function isCurrentEvent(event = {}, now = new Date()) {
  if (String(event.partner || '').toLowerCase() !== 'ticketmaster') return true;
  const { data, timezone, start, end, uncertain } = eventDateBounds(event);
  const today = calendarDay(now, timezone);
  if (!today) return false;
  // An explicit event end wins over stale onsale metadata.
  if (end) return end >= today;
  if (uncertain) return true;
  if (!start || start >= today) return true;
  // Sales expiry alone must not revive a years-old single performance.
  // Use it only for a provider-declared multi-day pass with no event end.
  return data.spanMultipleDays === true &&
    calendarDay(data.salesEndDateTime, timezone) >= today;
}

export function filterCurrentEventBatch(events, now = new Date()) {
  return (Array.isArray(events) ? events : []).filter(event => isCurrentEvent(event, now));
}

// Show the actual range for retained multi-day events instead of only a past start.
export function formatEventDateRange(event = {}, locale = 'cs') {
  const { start, end, data } = eventDateBounds(event);
  if (!start) return '';
  const format = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  });
  if (end && end > start) return `${format(start)} – ${format(end)}`;
  if (!end && data.spanMultipleDays) return `${format(start)} – …`;
  return '';
}
