import { featuredEventTitle, isHomeFeaturedEligible, selectHomeFeaturedEvents } from './home-featured-selection.js';
import { formatEventDateTime } from './event-date-time.js';
import { renderSharedEventCard } from './event-card.js';
import { eventDetailHref } from './event-detail-routes.js';
import featuredPolicy from '../content/home/featured.json' with { type: 'json' };

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let snapshotPromise;

export function homeFeaturedTicketsHref(event, locale = 'cs') {
  const raw = event.tickets || event.url || '';
  if (event.partner !== 'ticketmaster') return raw;
  const url = new URL(raw, 'https://ajsee.cz');
  const language = { cs: 'cs-cz', en: 'en-gb', sk: 'sk-sk', de: 'de-de', pl: 'pl-pl', hu: 'hu-hu' }[locale] || 'en-gb';
  url.searchParams.set('language', language);
  url.searchParams.set('locale', language);
  return url.pathname + url.search;
}

export function renderHomeFeaturedMarkup(snapshot, locale = 'cs', {
  now = new Date(),
  translate = (key, fallback) => fallback,
  withDetailLinks = true,
  withEditorialReasons = true,
} = {}) {
  // Keep the server's published selection until the next refresh. The lead
  // time is applied on entry; an already published tip can run until it starts.
  const byId = new Map(snapshot.events.map(event => [event.id, event]));
  const selected = Array.isArray(snapshot.recommendedIds)
    ? snapshot.recommendedIds.map(id => byId.get(id)).filter(event => event && isHomeFeaturedEligible(event, { ...snapshot.policy, now, leadHours: 0 }))
    : selectHomeFeaturedEvents(snapshot.events, snapshot.policy, { now });
  const events = selected.map(event => ({ ...event }));
  const markup = events.map((event, index) => {
    const title = featuredEventTitle(event);
    const reasonKey = event.providerEventId ? `${event.partner}-${event.providerEventId}` : event.id;
    const editorialReason = withEditorialReasons ? featuredPolicy.editorialReasons?.[reasonKey]?.[locale] : '';
    event.__ajseeTicketsHref = homeFeaturedTicketsHref(event, locale);
    event.__ajseeDetailHref = withDetailLinks ? eventDetailHref(event, locale, snapshot.detailSlugs?.[event.id]) : '';
    event.__ajseeModalId = event.id;
    event.__ajseeResultPosition = index + 1;
    return renderSharedEventCard({ event, locale, modalId: event.id, resultPosition: index + 1,
      titleRaw: title, titleHtml: escapeHtml(title), dateHtml: escapeHtml(formatEventDateTime(event, locale)),
      ticketsHref: event.__ajseeTicketsHref, detailHref: event.__ajseeDetailHref, detailLabelHtml: escapeHtml(translate('event-details', 'Detail')),
      ticketLabelHtml: escapeHtml(translate('event-tickets', 'Vstupenky')), editorialReason });
  }).join('');
  return { events, markup };
}

export async function loadHomeFeaturedSnapshot(doc = document, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (snapshotPromise) return snapshotPromise;
  let seed;
  try { seed = JSON.parse(doc.getElementById('home-featured-data')?.textContent || 'null'); } catch { /* Invalid seed falls back to its small data file. */ }
  const valid = value => value?.version === 1 && Array.isArray(value.events) && value.events.length > 0;
  if (valid(seed) && now - Date.parse(seed.generatedAt) < 6 * 3600000) return seed;
  snapshotPromise = (async () => {
    try {
      const path = valid(seed) ? '/.netlify/functions/home-featured' : '/data/home-featured-events.json';
      const response = await fetchImpl(path, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error('Homepage tips unavailable');
      const snapshot = await response.json();
      if (!valid(snapshot)) throw new Error('Invalid homepage tips');
      return snapshot;
    } catch (error) {
      if (valid(seed)) return seed;
      snapshotPromise = null;
      throw error;
    }
  })();
  return snapshotPromise;
}
