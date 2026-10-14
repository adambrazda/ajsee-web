import { eventStartInstant, eventDateBounds, calendarDay } from './event-calendar.js';
import { eventLocalStart } from './event-date-time.js';

export const HOME_FEATURED_CARD_LIMIT = 6;
export const HOME_FEATURED_POOL_LIMIT = 36;
const DAY = 86400000;
const LIVE_MUSIC_GENRES = new Set(['pop', 'rock', 'metal', 'jazz', 'classical', 'folk', 'country', 'electronic', 'hip-hop', 'rap', 'blues', 'soul', 'rnb', 'punk', 'post-punk']);
const fold = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const featuredEventTitle = event => typeof event.title === 'string' ? event.title : event.title?.cs || event.title?.en || Object.values(event.title || {})[0] || '';
export const featuredEventKey = event => fold(featuredEventTitle(event));
const country = event => String(event.location?.country || event.country || '').toUpperCase();

export function homeFeaturedBucket(event) {
  const types = event.taxonomy?.eventTypes || [];
  const genres = event.taxonomy?.genres || [];
  const domains = event.taxonomy?.domains || [];
  if (types.includes('festival')) {
    if (types.some(type => ['exhibition', 'fair', 'conference', 'tour', 'meeting'].includes(type)) &&
      !types.some(type => ['concert', 'theatre', 'cinema', 'competition'].includes(type))) return '';
    if (types.some(type => ['concert', 'theatre', 'cinema', 'competition'].includes(type)) ||
      domains.includes('film') || genres.some(genre => LIVE_MUSIC_GENRES.has(genre))) return 'festival';
    return '';
  }
  if (domains.includes('sport')) return 'sport';
  if (genres.some(genre => /musical/.test(genre)) || types.includes('musical')) return 'stage';
  if (domains.includes('stage')) return 'stage';
  if (domains.includes('music') && !types.includes('party')) return 'concert';
  return '';
}

export function isHomeFeaturedTicketUrl(event) {
  try {
    const url = new URL(event.tickets || event.url || '', 'https://ajsee.cz');
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (event.partner === 'ticketmaster') {
      return host === 'ajsee.cz' && url.pathname === '/.netlify/functions/tmOutbound' && Boolean(url.searchParams.get('to'));
    }
    if (event.partner === 'smsticket') return /^(?:www\.)?smsticket\.cz$/.test(host) && Boolean(url.searchParams.get('a_box'));
    if (event.partner === 'colosseumticket') return /^(?:www\.)?colosseumticket\.cz$/.test(host) && Boolean(url.searchParams.get('a_box'));
  } catch { /* Invalid or missing destination is not a recommendation. */ }
  return false;
}

export function isHomeFeaturedEligible(event, { now = new Date(), leadHours = 24, horizonDays = 180 } = {}) {
  const current = +new Date(now);
  const title = featuredEventTitle(event);
  const bucket = homeFeaturedBucket(event);
  if (!title || !bucket || !event.location?.city || !country(event) || !event.image || !isHomeFeaturedTicketUrl(event)) return false;
  if (['canceled', 'cancelled', 'postponed', 'rescheduled'].includes(String(event.saleStatus || '').toLowerCase())) return false;
  // A CZK 1 lower bound on a much wider range can be an unconfirmed special
  // tariff. Keep that occurrence in search, but choose a clearer homepage tip.
  if (event.price?.currency === 'CZK' && event.price.min <= 1 && event.price.max >= 100) return false;
  if (/\b(parking|parkovani|fast track|vip upgrade|vip doplatek|meet and greet|early entry|soundcheck upgrade)\b/.test(fold(title))) return false;
  const bounds = eventDateBounds(event);
  if (bounds.uncertain || !bounds.start) return false;
  const start = eventStartInstant(event);
  if (!Number.isFinite(start) || start < current + leadHours * 3600000 || start > current + horizonDays * DAY) return false;
  // Date-only listings must be future calendar days, never synthetic times today.
  if (!eventLocalStart(event).time && bounds.start <= calendarDay(new Date(current), bounds.timezone)) return false;
  return true;
}

function editorialOrder(event, config) {
  if (Number.isInteger(event.homeFeatured?.editorialOrder)) return event.homeFeatured.editorialOrder;
  const index = (config.editorial || []).findIndex(pin => event.partner === pin.provider &&
    (String(event.providerEventId || '') === String(pin.providerEventId || '') || featuredEventKey(event) === fold(pin.title)));
  return index < 0 ? 99 : index;
}

export function homeFeaturedScore(event, config = {}, now = new Date()) {
  const days = (eventStartInstant(event) - +new Date(now)) / DAY;
  const types = event.taxonomy?.eventTypes || [];
  const genres = event.taxonomy?.genres || [];
  let score = country(event) === 'CZ' ? 15 : 0;
  score += days >= 3 && days <= 60 ? 15 : days <= 120 ? 8 : 3;
  score += types.includes('musical') || genres.some(genre => /musical/.test(genre)) ? 12 : 0;
  score += event.venue?.name ? 4 : 0;
  score += eventLocalStart(event).time ? 3 : 0;
  score += event.priceFrom != null && event.priceFrom !== '' ? 2 : 0;
  if (homeFeaturedBucket(event) === 'festival' && /(?:festival|fest\b)/.test(fold(featuredEventTitle(event)))) score += 8;
  // A provider's own relevance order is a supporting signal, not sales data.
  if (Number.isFinite(event.homeFeatured?.providerRelevance)) score += event.homeFeatured.providerRelevance * 22;
  if (/\b(o2 arena|o2 universum|forum karlin|lucerna|statni opera|narodni divadlo|wiener stadthalle|tipos arena)\b/.test(fold(event.venue?.name))) score += 7;
  return score;
}

export function selectHomeFeaturedEvents(events = [], config = {}, { now = new Date(), limit = HOME_FEATURED_CARD_LIMIT } = {}) {
  const candidates = events.filter(event => isHomeFeaturedEligible(event, { ...config, now }));
  candidates.sort((a, b) => homeFeaturedScore(b, config, now) - homeFeaturedScore(a, config, now) || eventStartInstant(a) - eventStartInstant(b) || String(a.id).localeCompare(String(b.id)));
  const selected = [], seen = new Set();
  let foreign = 0;
  const canAdd = event => event && selected.length < limit && !seen.has(featuredEventKey(event)) &&
    (country(event) === 'CZ' || foreign < (config.maxForeign ?? 1));
  const add = event => {
    if (!canAdd(event)) return false;
    const abroad = country(event) !== 'CZ';
    if (abroad && foreign >= (config.maxForeign ?? 1)) return false;
    selected.push(event); seen.add(featuredEventKey(event)); foreign += Number(abroad); return true;
  };
  for (let order = 0; order < Math.min(2, config.editorial?.length || 2); order++) {
    add(candidates.filter(event => editorialOrder(event, config) === order).sort((a, b) => eventStartInstant(a) - eventStartInstant(b))[0]);
  }
  // Soft coverage: each available main category gets a place; missing buckets
  // are filled by the next best candidate rather than unrelated placeholders.
  for (const [bucket, target] of [['concert', 2], ['stage', 2], ['sport', 1], ['festival', 1]]) {
    while (selected.filter(event => homeFeaturedBucket(event) === bucket).length < target) {
      const next = candidates.find(event => homeFeaturedBucket(event) === bucket && canAdd(event));
      if (!next) break;
      add(next);
    }
  }
  for (const event of candidates) add(event);
  return selected;
}

export function buildHomeFeaturedPool(events, config = {}, { now = new Date(), limit = HOME_FEATURED_POOL_LIMIT } = {}) {
  const eligible = events.filter(event => isHomeFeaturedEligible(event, { ...config, now }));
  const pool = [], ids = new Set(), titleCounts = new Map();
  const add = event => {
    const key = featuredEventKey(event);
    if (!event || ids.has(event.id) || pool.length >= limit || (titleCounts.get(key) || 0) >= 3) return;
    ids.add(event.id); titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    pool.push({ ...event, homeFeatured: { ...event.homeFeatured, editorialOrder: editorialOrder(event, config) } });
  };
  for (const event of selectHomeFeaturedEvents(eligible, config, { now })) add(event);
  for (let order = 0; order < 2; order++) {
    for (const event of eligible.filter(event => editorialOrder(event, config) === order).sort((a, b) => eventStartInstant(a) - eventStartInstant(b)).slice(0, 3)) add(event);
  }
  const ranked = eligible.sort((a, b) => homeFeaturedScore(b, config, now) - homeFeaturedScore(a, config, now) || eventStartInstant(a) - eventStartInstant(b));
  for (const bucket of ['concert', 'stage', 'sport', 'festival']) {
    const seen = new Set();
    for (const event of ranked.filter(event => homeFeaturedBucket(event) === bucket)) {
      if (seen.has(featuredEventKey(event))) continue;
      seen.add(featuredEventKey(event)); add(event);
      if (seen.size >= 7) break;
    }
  }
  for (const event of ranked) add(event);
  return pool;
}
