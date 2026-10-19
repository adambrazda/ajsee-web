const COUNTRY_TIMEZONES = {
  CZ: 'Europe/Prague', SK: 'Europe/Bratislava', AT: 'Europe/Vienna',
  DE: 'Europe/Berlin', PL: 'Europe/Warsaw', HU: 'Europe/Budapest',
  GB: 'Europe/London', IE: 'Europe/Dublin', RS: 'Europe/Belgrade', EG: 'Africa/Cairo'
};
const dayFormatters = new Map();
const clockFormatters = new Map();
const instantCache = new WeakMap();

export function validCalendarDay(value = '') {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const parsed = new Date(`${raw}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : '';
}

export function filterCalendarDay(value = '') {
  const raw = String(value || '').trim();
  const cz = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return validCalendarDay(cz ? `${cz[3]}-${cz[2].padStart(2, '0')}-${cz[1].padStart(2, '0')}` : raw);
}

export function knownEventTimezone(event = {}) {
  const supplied = event.dateAvailability?.timezone || event.timezone || event.venue?.timezone;
  if (supplied) return String(supplied);
  const country = String(event.location?.country || event.venue?.country || event.country || '').toUpperCase();
  // Do not guess a city or a timezone within a country with multiple zones.
  return COUNTRY_TIMEZONES[country] || '';
}

export function eventTimezone(event = {}) {
  return knownEventTimezone(event) || 'UTC';
}

export function calendarDay(value, timezone = 'UTC') {
  if (!value) return '';
  const raw = String(value).trim();
  if (!(value instanceof Date)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validCalendarDay(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !validCalendarDay(raw.slice(0, 10))) return '';
    const local = raw.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (local) return +local[1] < 24 && +local[2] < 60 && +(local[3] || 0) < 60
      ? validCalendarDay(raw.slice(0, 10)) : '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    let formatter = dayFormatters.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en', { timeZone: timezone || 'UTC',
        year: 'numeric', month: '2-digit', day: '2-digit' });
      if (dayFormatters.size < 64) dayFormatters.set(timezone, formatter);
    }
    const parts = formatter.formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return date.toISOString().slice(0, 10); }
}

export function eventDateBounds(event = {}) {
  const data = event.dateAvailability || {};
  const timezone = eventTimezone(event);
  const uncertain = data.dateTBA || data.dateTBD;
  const absolute = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(event.datetime || ''));
  const start = uncertain ? '' : validCalendarDay(data.startLocalDate) ||
    (absolute && knownEventTimezone(event) ? calendarDay(event.datetime, timezone) : '') ||
    validCalendarDay(event.date) || calendarDay(event.datetime, timezone);
  let end = validCalendarDay(data.endLocalDate) || calendarDay(data.endDateTime, timezone);
  if (start && end && end < start) end = '';
  return { data, timezone, start, end, uncertain };
}

// A chosen date is a calendar day at the venue, regardless of visitor timezone.
// Only a declared event end extends the interval; sale/booking dates never do.
export function matchesEventDateRange(event, from = '', to = '') {
  if (!from && !to) return true;
  const lower = filterCalendarDay(from), upper = filterCalendarDay(to);
  if ((from && !lower) || (to && !upper) || (lower && upper && lower > upper)) return false;
  const { start, end } = eventDateBounds(event);
  return Boolean(start) && (!lower || (end || start) >= lower) && (!upper || start <= upper);
}

export function isLocalEventDateAvailable(event = {}, now = new Date(), { allowBooking = false } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(current.getTime())) return false;
  const { start, end, timezone } = eventDateBounds(event);
  const today = calendarDay(current, timezone);
  if (end) return end >= today;
  if (start && start >= today) return true;
  return allowBooking && calendarDay(event.bookingEndsAt, timezone) >= today;
}

// Ticketmaster documents this as overlap of the event's local start/end range.
// Open sides cover all supported ticket dates without using visitor/UTC midnight.
export function ticketmasterCalendarRange(from = '', to = '') {
  const lower = filterCalendarDay(from), upper = filterCalendarDay(to);
  if ((!lower && !upper) || (from && !lower) || (to && !upper) ||
      (lower && upper && lower > upper)) return '';
  // Include fractional seconds before midnight; the precise client calendar
  // filter removes an event beginning exactly on the following day.
  const upperBound = upper && upper !== '9999-12-31'
    ? `${new Date(new Date(`${upper}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)}T00:00:00`
    : '9999-12-31T23:59:59';
  return `${lower || '0001-01-01'}T00:00:00,${upperBound}`;
}

// Raw provider boundaries and local feed candidates must share one time scale.
// Offset timestamps remain exact; local wall time uses the known venue zone.
function calculateStartInstant(event) {
  const { start, data, timezone } = eventDateBounds(event);
  if (!start) return Number.NaN;
  const raw = String(event.datetime || '').trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return new Date(raw).getTime();
  const rawTime = raw.match(/T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/)?.[1];
  const supplied = data.startLocalTime || (Object.hasOwn(event, 'time') ? event.time : rawTime);
  const time = !data.timeTBA && !data.noSpecificTime &&
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(supplied || '') ? supplied : '12:00:00';
  const wall = new Date(`${start}T${time}Z`).getTime();
  if (!Number.isFinite(wall) || timezone === 'UTC') return wall;
  try {
    let formatter = clockFormatters.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en', { timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
        minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      if (clockFormatters.size < 64) clockFormatters.set(timezone, formatter);
    }
    let candidate = wall;
    for (let i = 0; i < 4; i++) {
      const instant = new Date(candidate);
      const parts = formatter.formatToParts(instant);
      const get = type => parts.find(part => part.type === type)?.value;
      const observed = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`).getTime() + instant.getUTCMilliseconds();
      if (observed === wall) return candidate;
      candidate += wall - observed;
    }
    return Number.NaN; // A nonexistent DST wall time is not an exact instant.
  } catch { return wall; }
}

export function eventStartInstant(event = {}) {
  const data = event.dateAvailability || {};
  const signature = [event.datetime, event.date, data.startLocalDate, data.startLocalTime,
    event.time, data.dateTBA, data.dateTBD, data.timeTBA, data.noSpecificTime, eventTimezone(event)].join('|');
  const previous = instantCache.get(event);
  if (previous?.signature === signature) return previous.time;
  const time = calculateStartInstant(event);
  instantCache.set(event, { signature, time });
  return time;
}
