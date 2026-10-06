// Calendar-day availability, using the event's timezone rather than the visitor's.
// SMS Ticket already validates its own booking window in its adapter.
function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value : '';
}

function calendarDay(value, timezone = 'UTC') {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !validDay(raw.slice(0, 10))) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validDay(raw);
  // A provider local datetime without an offset already belongs to the venue day.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) {
    return validDay(raw.slice(0, 10));
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function ticketmasterBounds(event) {
  const data = event.dateAvailability || {};
  const timezone = data.timezone || 'UTC';
  const uncertain = data.dateTBA || data.dateTBD;
  const start = uncertain ? '' : (
    validDay(data.startLocalDate) || calendarDay(event.datetime || event.date, timezone)
  );
  let end = validDay(data.endLocalDate) || calendarDay(data.endDateTime, timezone);
  if (start && end && end < start) end = ''; // Invalid interval is not proof of expiry.
  return { data, timezone, start, end, uncertain };
}

export function isCurrentEvent(event = {}, now = new Date()) {
  if (String(event.partner || '').toLowerCase() !== 'ticketmaster') return true;
  const { data, timezone, start, end, uncertain } = ticketmasterBounds(event);
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
  if (String(event.partner || '').toLowerCase() !== 'ticketmaster') return '';
  const { start, end, data } = ticketmasterBounds(event);
  if (!start) return '';
  const format = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  });
  if (end && end > start) return `${format(start)} – ${format(end)}`;
  if (!end && data.spanMultipleDays) return `${format(start)} – …`;
  return '';
}
