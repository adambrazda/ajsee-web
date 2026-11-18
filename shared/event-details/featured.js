import { createHash } from 'node:crypto';
import { homeFeaturedBucket, isHomeFeaturedTicketUrl, selectHomeFeaturedEvents, featuredEventTitle } from '../../src/home-featured-selection.js';
import { eventLocalStart } from '../../src/event-date-time.js';
import { eventDateBounds } from '../../src/event-calendar.js';
import { eventPriceRanges } from '../../src/event-commerce.js';
import { resolveEventLocation } from '../../src/event-location.js';
import { EVENT_DETAIL_ROUTES } from '../../src/event-detail-routes.js';
import { LANGUAGES, ORIGIN, localDateTime, pragueEventDate } from './state.js';

export const FEATURED_EVENT_STORE = 'home-featured-details-v1';
export const FEATURED_EVENT_SLUG = /^tip-[0-9a-f]{20}$/;

function publicImage(source) {
  try {
    const url = new URL(source, ORIGIN);
    if (source && url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Use the existing public fallback below. */ }
  return ORIGIN + '/images/fallbacks/concert0.jpg';
}

function descriptionByLanguage(event, country) {
  const source = typeof event.description === 'string'
    ? { [({ AT: 'de', SK: 'sk' })[country] || 'cs']: event.description }
    : event.description;
  return Object.fromEntries(LANGUAGES.flatMap(lang => {
    const value = typeof source?.[lang] === 'string'
      ? source[lang].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
      : '';
    return value ? [[lang, value]] : [];
  }));
}

function observedPrice(event, observedAt, country) {
  const ranges = eventPriceRanges(event).filter(range => range.min > 0);
  const currency = country === 'CZ' ? 'CZK' : 'EUR';
  const range = ranges.find(item => item.currency === currency) || (ranges.length === 1 ? ranges[0] : null);
  return range && Number.isFinite(Date.parse(observedAt)) ? {
    minimum: range.min, currency: range.currency, observedAt, checkedAt: pragueEventDate(new Date(observedAt))
  } : null;
}

function featuredPage(event, snapshot) {
  const id = event.id;
  if (typeof id !== 'string' || !id || Object.hasOwn(EVENT_DETAIL_ROUTES, id) || !isHomeFeaturedTicketUrl(event)) return null;
  const title = featuredEventTitle(event);
  const { city, actualCity, country, venueName } = resolveEventLocation(event);
  const countryCode = country.toUpperCase();
  const { date, time } = eventLocalStart(event);
  const category = homeFeaturedBucket(event);
  if (!date || !title || !city || !/^[A-Z]{2}$/.test(countryCode) || !category) return null;
  const local = `${date}T${time}:00`;
  const exact = localDateTime(event.datetime);
  const startDate = time ? (exact?.startsWith(local.slice(0, 16)) ? exact : localDateTime(local)) || date : date;
  const endDate = eventDateBounds(event).end;
  const slug = 'tip-' + createHash('sha256').update(id).digest('hex').slice(0, 20);
  const source = event.partner === 'ticketmaster' ? 'ticketmaster-' + countryCode : event.partner;
  const observedAt = snapshot.sources?.[source]?.observedAt;
  return {
    id, slug, featured: true, title, category, startDate,
    ...(endDate && endDate > date ? { endDate } : {}),
    partner: event.partner, tickets: event.tickets || event.url,
    venue: {
      name: venueName || actualCity || city, city: actualCity || city, country: countryCode,
      street: typeof event.venue?.address?.street === 'string' ? event.venue.address.street : ''
    },
    image: { url: publicImage(event.image), fit: event.imagePresentation?.fit, alt: title },
    descriptions: descriptionByLanguage(event, countryCode),
    status: ({ canceled: 'cancelled', cancelled: 'cancelled', postponed: 'postponed' })[event.saleStatus] || 'scheduled',
    price: observedPrice(event, observedAt, countryCode), lastVerifiedAt: snapshot.generatedAt
  };
}

export function prepareHomeFeaturedPublication(snapshot) {
  const selected = selectHomeFeaturedEvents(snapshot.events, snapshot.policy, { now: new Date(snapshot.generatedAt) });
  const pages = selected.map(event => featuredPage(event, snapshot)).filter(Boolean);
  const detailSlugs = Object.fromEntries([
    ...selected.filter(event => Object.hasOwn(EVENT_DETAIL_ROUTES, event.id)).map(event => [event.id, EVENT_DETAIL_ROUTES[event.id]]),
    ...pages.map(page => [page.id, page.slug])
  ]);
  return {
    snapshot: { ...snapshot, recommendedIds: selected.map(event => event.id), detailSlugs },
    pages
  };
}

// Update previously published tips when a refresh explicitly confirms their
// new date or status, even when that change makes them ineligible as tips.
export function refreshPublishedFeaturedPages(snapshot, previous, sourceEvents) {
  const published = new Set(previous?.recommendedIds || []);
  const current = new Set(snapshot.recommendedIds);
  return sourceEvents.filter(event => published.has(event.id) && !current.has(event.id))
    .map(event => featuredPage(event, snapshot)).filter(Boolean);
}

export async function publishFeaturedPages(store, pages) {
  await Promise.all(pages.map(async page => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const entry = await store.getWithMetadata(page.slug, { type: 'json' });
      const saved = entry?.data;
      if (saved && Date.parse(saved.lastVerifiedAt) >= Date.parse(page.lastVerifiedAt)) return;
      const initialDate = saved?.previousStartDate || saved?.startDate || page.startDate;
      const moved = initialDate !== page.startDate;
      const value = {
        ...page, ...(moved ? { previousStartDate: initialDate } : {}),
        status: moved && page.status === 'scheduled' ? 'rescheduled' : page.status
      };
      const result = await store.setJSON(page.slug, value, entry?.etag
        ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw new Error('Could not publish the recommended event detail');
  }));
}
