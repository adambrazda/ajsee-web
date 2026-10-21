// Exact occurrence IDs own the detail. Missing data never changes its identity
// or means cancellation. Prices have a shorter lifetime than the event itself.
export const PRICE_TTL_MS = 24 * 60 * 60 * 1000;
export const LANGUAGES = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
export const ORIGIN = 'https://ajsee.cz';
export const localeCode = lang => ({ cs: 'cs-CZ', en: 'en-GB', de: 'de-DE', sk: 'sk-SK', pl: 'pl-PL', hu: 'hu-HU' })[lang] || 'cs-CZ';
export const detailPath = (slug, lang = 'cs') => `${lang === 'cs' ? '' : '/' + lang}/udalosti/${slug}/`;

export function localDateTime(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)?$/.test(raw)) return null;
  const local = raw.slice(0, 19).length === 16 ? raw.slice(0, 16) + ':00' : raw.slice(0, 19);
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', dateStyle: 'short', timeStyle: 'medium' });
  const candidates = /(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? [raw] : [local + '+01:00', local + '+02:00'];
  const matches = candidates.filter(candidate => Number.isFinite(Date.parse(candidate)) && formatter.format(new Date(candidate)).replace(' ', 'T') === local);
  // A local time in a DST gap or fold needs explicit provider evidence.
  return matches.length === 1 ? matches[0] : null;
}

export function freshTimestamp(value, now = new Date(), maxAge = PRICE_TTL_MS) {
  const age = +now - Date.parse(value || '');
  return Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= maxAge;
}

export function resolveEvent(event, snapshot, now = new Date()) {
  const row = snapshot?.version === 1 && Array.isArray(snapshot.events)
    ? snapshot.events.find(item => item.id === event.id && item.partner === event.partner) : null;
  const valid = row && localDateTime(row.startDate) && ['scheduled', 'rescheduled', 'cancelled', 'postponed'].includes(row.status)
    && (row.status !== 'rescheduled' || localDateTime(row.previousStartDate))
    && Number.isFinite(Date.parse(row.lastVerifiedAt || '')) && Date.parse(row.lastVerifiedAt) <= +now + 5 * 60 * 1000;
  const result = { ...event };
  if (valid) {
    result.startDate = row.startDate;
    result.status = row.status;
    result.previousStartDate = row.previousStartDate || undefined;
    result.lastVerifiedAt = row.lastVerifiedAt;
    if (row.venue?.name && row.venue?.city && row.venue.country === event.venue.country) result.venue = { ...event.venue, ...row.venue };
    result.price = row.price && Number.isFinite(row.price.minimum) && row.price.minimum > 0 && row.price.currency === 'CZK' && freshTimestamp(row.price.observedAt, now)
      ? { ...row.price, checkedAt: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', dateStyle: 'short' }).format(new Date(row.price.observedAt)) } : null;
  } else {
    result.price = null;
    result.lastVerifiedAt = event.verifiedAt + 'T00:00:00Z';
  }
  return result;
}

export function mergeEventSnapshots(seed, saved, events, now = new Date()) {
  // A newer refresh can contain an older retained record for a failed provider.
  // Compare each occurrence's verification time, never just the job timestamp.
  return { version: 1, generatedAt: seed.generatedAt,
    events: events.map(event => {
      const candidates = [seed, saved].flatMap(snapshot => snapshot?.version === 1 && Array.isArray(snapshot.events)
        ? snapshot.events.filter(row => row.id === event.id && row.partner === event.partner) : []);
      return candidates.filter(row => localDateTime(row.startDate) && ['scheduled', 'rescheduled', 'cancelled', 'postponed'].includes(row.status)
        && (row.status !== 'rescheduled' || localDateTime(row.previousStartDate))
        && Number.isFinite(Date.parse(row.lastVerifiedAt || '')) && Date.parse(row.lastVerifiedAt) <= +now + 5 * 60 * 1000)
        .sort((left, right) => Date.parse(right.lastVerifiedAt) - Date.parse(left.lastVerifiedAt))[0];
    }).filter(Boolean) };
}

export function pageCacheSeconds(event, now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', dateStyle: 'short' }).format(now);
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const midnight = Date.parse(localDateTime(tomorrow + 'T00:00:00'));
  const priceExpiry = event.price?.observedAt ? Date.parse(event.price.observedAt) + PRICE_TTL_MS : Infinity;
  // A cached response must never extend a price's lifetime or retain yesterday's
  // purchase CTA after the Prague calendar day has ended.
  return Math.max(0, Math.min(300, Math.floor((Math.min(midnight, priceExpiry) - +now) / 1000)));
}

export function advanceOccurrence(event, previous, record, observedAt) {
  const baseline = previous?.id === event.id && previous?.partner === event.partner && localDateTime(previous.startDate)
    ? previous : { id: event.id, partner: event.partner, startDate: event.startDate, status: event.status,
      venue: event.venue, price: event.price ? { ...event.price, observedAt: event.price.checkedAt + 'T00:00:00Z' } : null,
      lastVerifiedAt: event.verifiedAt + 'T00:00:00Z' };
  if (!record || record.id !== event.id || record.partner !== event.partner) return { ...baseline, sourceState: 'missing' };
  const nextDate = localDateTime(record.datetime);
  const explicitStatus = ({ canceled: 'cancelled', cancelled: 'cancelled', postponed: 'postponed' })[record.saleStatus];
  if (!nextDate && !explicitStatus) return { ...baseline, sourceState: 'invalid' };
  const startDate = nextDate || baseline.startDate;
  const moved = +new Date(startDate) !== +new Date(event.startDate);
  const status = explicitStatus || (record.saleStatus === 'onsale' || record.saleStatus === 'rescheduled'
    ? moved ? 'rescheduled' : 'scheduled'
    : moved ? 'rescheduled' : baseline.status === 'rescheduled' ? 'scheduled' : baseline.status);
  const ranges = record.priceRanges || (record.price ? [record.price] : []);
  let amounts = ranges.filter(price => price.currency === 'CZK' && Number.isFinite(price.min) && price.min > 0).map(price => price.min);
  if (!amounts.length && record.currency === 'CZK' && typeof record.priceFrom === 'number' && record.priceFrom > 0) amounts = [record.priceFrom];
  // SMS Ticket gives a formatted CZK price rather than a numeric range.
  if (!amounts.length && event.partner === 'smsticket' && /^\d[\d\s\u00a0]*(?:[,.]\d{1,2})?\s*Kč$/.test(String(record.priceFrom || ''))) {
    const amount = Number(record.priceFrom.replace(/\s|\u00a0|Kč/g, '').replace(',', '.'));
    if (amount > 0) amounts = [amount];
  }
  const venue = record.venue || {};
  return { id: event.id, partner: event.partner, startDate, status,
    ...(moved ? { previousStartDate: event.startDate } : {}),
    venue: { ...baseline.venue, ...(venue.name ? { name: String(venue.name).slice(0, 250) } : {}),
      ...(venue.city ? { city: String(venue.city).slice(0, 150) } : {}),
      ...(venue.address?.street ? { street: String(venue.address.street).slice(0, 250) } : {}) },
    price: amounts.length ? { minimum: Math.min(...amounts), currency: 'CZK', observedAt } : null,
    lastVerifiedAt: observedAt, sourceState: 'ok' };
}
