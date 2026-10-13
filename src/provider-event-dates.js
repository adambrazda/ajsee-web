import { calendarDay, eventDateBounds, validCalendarDay } from './event-calendar.js';

const MONTHS = ['ledna', 'unora', 'brezna', 'dubna', 'kvetna', 'cervna',
  'cervence', 'srpna', 'zari', 'rijna', 'listopadu', 'prosince'];
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const day = (year, month, date) => validCalendarDay(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`);
const descriptions = event => typeof event.description === 'string' ? event.description
  : String(event.description?.cs || '');

export function declaredDescriptionEnd(event, description = descriptions(event)) {
  // A theatre's overall run must not turn one performance into a multi-day pass.
  // Text-only ranges are accepted only for provider-identified duration events.
  const types = fold([...(event.types || []), ...(event.categories || []), event.category].join(' '));
  if (!event.dateAvailability?.spanMultipleDays &&
      !/\b(festival|vystava|exhibition|konference|conference|veletrh|tabor)\b/.test(types)) return '';
  const { start } = eventDateBounds(event);
  if (!start) return '';
  const text = fold(description).replace(/<[^>]*>/g, ' ').replace(/\u00a0/g, ' ');
  const candidates = new Set();
  const accept = (match, first, last) => {
    if (first !== start || !last || last <= start) return;
    // Keep sales/promotions and past editions separate from the event interval.
    const sentence = text.slice(Math.max(0, match.index - 100), match.index);
    if (/predprodej|prodej vstupenek|rezervac|registrac|early bird|sleva|sale/.test(sentence)) return;
    candidates.add(last);
  };
  for (const m of text.matchAll(/\b(\d{4}-\d{2}-\d{2})\s*[-–—]\s*(\d{4}-\d{2}-\d{2})\b/g)) {
    accept(m, validCalendarDay(m[1]), validCalendarDay(m[2]));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?\s*[-–—]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g)) {
    accept(m, day(m[3] || start.slice(0, 4), m[2], m[1]), day(m[6], m[5], m[4]));
  }
  const shared = new RegExp(`\\b(\\d{1,2})\\.\\s*[-–—]\\s*(\\d{1,2})\\.\\s*(${MONTHS.join('|')}|\\d{1,2}\\.)\\s*(\\d{4})\\b`, 'g');
  for (const m of text.matchAll(shared)) {
    const month = MONTHS.indexOf(m[3]) + 1 || Number(m[3].replace('.', ''));
    accept(m, day(m[4], month, m[1]), day(m[4], month, m[2]));
  }
  return candidates.size === 1 ? [...candidates][0] : '';
}

// Used at feed generation and as a compatibility path for older static feeds.
export function withProviderDateRange(event, { endLocalDate = '', endDateTime = '', description } = {}) {
  const bounds = eventDateBounds(event);
  if (bounds.end || bounds.uncertain || !bounds.start) return event;
  const declaredEnd = validCalendarDay(endLocalDate) || calendarDay(endDateTime, bounds.timezone);
  const end = declaredEnd || declaredDescriptionEnd(event, description);
  if (!end || end < bounds.start) return event;
  return { ...event, dateAvailability: { ...event.dateAvailability,
    startLocalDate: bounds.start, endLocalDate: end,
    ...(declaredEnd && endDateTime ? { endDateTime } : {}),
    endSource: declaredEnd ? 'provider-event-end' : 'provider-description-range'
  } };
}
