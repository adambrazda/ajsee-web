import { formatEventDateRange } from './event-availability.js';

function validDay(value = '') {
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw
    ? raw : '';
}

function validTime(value = '') {
  const match = String(value).trim().match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) > 59) return '';
  return `${match[1]}:${match[2]}`;
}

// Only convert absolute timestamps when the venue timezone is known. A local
// feed datetime is already wall-clock time and must not use the visitor's zone.
function venueStart(raw, timezone) {
  if (!timezone || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return null;
  const date = new Date(raw);
  if (!validDay(raw.slice(0, 10)) || !Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value || '';
    return {
      date: validDay(`${get('year')}-${get('month')}-${get('day')}`),
      time: validTime(`${get('hour')}:${get('minute')}`)
    };
  } catch {
    return null;
  }
}

export function eventLocalStart(event = {}) {
  const data = event.dateAvailability || {};
  if (data.dateTBA || data.dateTBD) return { date: '', time: '' };

  const raw = String(event.datetime || event.date || '').trim();
  const zoned = venueStart(raw, data.timezone || event.timezone || '');
  const date = validDay(data.startLocalDate) || validDay(event.date) ||
    zoned?.date || validDay(raw.slice(0, 10));
  if (!date || data.timeTBA || data.noSpecificTime) return { date, time: '' };

  let time = '';
  if (data.startLocalTime) {
    time = validTime(data.startLocalTime);
  } else if (Object.hasOwn(event, 'time')) {
    // SMS Ticket's datetime uses synthetic noon when start_time is missing.
    // An explicit empty time is therefore authoritative, never a fallback hour.
    time = validTime(event.time);
  } else {
    const local = raw.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/);
    time = local ? validTime(local[1]) : (zoned?.time || '');
  }
  return { date, time };
}

// Shared by homepage cards, search cards and the modal. Existing multi-day
// ranges stay intact; one start time must not imply a time for every day.
export function formatEventDateTime(event = {}, locale = 'cs') {
  const { date, time } = eventLocalStart(event);
  if (!date) return '';
  const range = formatEventDateRange(event, locale);
  if (range) return range;
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  });
  // Keep the separator with the time when narrow mobile metadata wraps.
  return time ? `${label} ·\u00a0${time}` : label;
}
