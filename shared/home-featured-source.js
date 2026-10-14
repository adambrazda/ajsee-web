import { buildSmsticketTaxonomy, buildColosseumTicketTaxonomy, deriveLegacyCategory } from '../src/taxonomy/event-taxonomy.js';
import { withProviderDateRange } from '../src/provider-event-dates.js';
import { mapTicketmasterEvent } from '../src/adapters/ticketmaster.js';
import { buildHomeFeaturedPool } from '../src/home-featured-selection.js';

export function normalizeHomeFeaturedLocalEvent(source) {
  const event = withProviderDateRange(source);
  const taxonomy = event.partner === 'smsticket' ? buildSmsticketTaxonomy(event) : buildColosseumTicketTaxonomy(event);
  return { ...event, taxonomy, category: deriveLegacyCategory(taxonomy) };
}

export function compactHomeFeaturedEvent(event) {
  const result = {};
  // Commercial links, dates, image framing and currency data stay intact.
  for (const key of ['id', 'partner', 'providerEventId', 'sourceId', 'sourceName', 'title', 'date', 'datetime', 'time', 'dateAvailability',
    'location', 'venue', 'image', 'imageAsset', 'imagePresentation', 'tickets', 'url', 'priceFrom', 'currency',
    'priceOptions', 'priceRanges', 'saleStatus', 'category', 'homeFeatured']) {
    if (event[key] !== undefined) result[key] = event[key];
  }
  if (event.taxonomy) {
    result.taxonomy = Object.fromEntries(['version', 'domains', 'eventTypes', 'genres', 'audiences'].map(key => [key, event.taxonomy[key]]));
  }
  const excerpt = value => String(value || '').length > 600 ? String(value).slice(0, 600).replace(/\s+\S*$/, '') + '…' : String(value || '');
  // A bounded provider description keeps the first-page payload small, like
  // the existing city subset feeds; it is still available in the shared modal.
  result.description = typeof event.description === 'string' ? excerpt(event.description)
    : Object.fromEntries(Object.entries(event.description || {}).map(([language, value]) => [language, excerpt(value)]));
  return result;
}

export async function fetchHomeFeaturedJson(url, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error('Recommendation source unavailable');
  return response.json();
}

export async function collectHomeFeaturedSources({ localFeeds = {}, apiKey = '', fetchJson = fetchHomeFeaturedJson,
  now = new Date(), origin = 'https://ajsee.cz' } = {}) {
  const sources = {}, events = [];
  await Promise.all(['smsticket', 'colosseumticket'].map(async provider => {
    try {
      const feed = localFeeds[provider] || await fetchJson(`${origin}/data/${provider}-events.json`);
      if (!Array.isArray(feed?.events) || !feed.events.length) throw new Error('Empty feed');
      events.push(...feed.events.map(normalizeHomeFeaturedLocalEvent));
      sources[provider] = { state: 'ok', count: feed.events.length, observedAt: feed.generatedAt || feed.syncedAt || now.toISOString() };
    } catch {
      sources[provider] = { state: 'unavailable' };
    }
  }));
  await Promise.all(['CZ', 'SK', 'AT'].map(async market => {
    try {
      const url = apiKey ? new URL('https://app.ticketmaster.com/discovery/v2/events.json')
        : new URL('/.netlify/functions/ticketmasterEvents', origin);
      if (apiKey) url.searchParams.set('apikey', apiKey);
      url.searchParams.set('countryCode', market);
      url.searchParams.set('locale', '*');
      url.searchParams.set('size', market === 'CZ' ? '160' : '60');
      url.searchParams.set('sort', apiKey ? 'relevance,desc' : 'date,asc');
      url.searchParams.set('startDateTime', new Date(+now + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      url.searchParams.set('endDateTime', new Date(+now + 180 * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      const feed = await fetchJson(url);
      if (feed?._ajseeProxy?.upstreamStatus === 429) throw new Error('Rate limited');
      const raw = feed?._embedded?.events || [];
      events.push(...raw.map((event, index) => ({ ...mapTicketmasterEvent(event, 'cs'), homeFeatured: {
        ...(apiKey ? { providerRelevance: 1 - index / Math.max(1, raw.length) } : {})
      } })));
      sources[`ticketmaster-${market}`] = { state: 'ok', count: raw.length, observedAt: now.toISOString(), ranking: apiKey ? 'provider-relevance' : 'date' };
    } catch (error) {
      sources[`ticketmaster-${market}`] = { state: 'unavailable', reason: error.name === 'TimeoutError' ? 'timeout' : error.message === 'Recommendation source unavailable' ? 'http-error' : error.name };
      console.warn(`[home tips] ticketmaster-${market}: ${error.name}`);
    }
  }));
  return { events, sources };
}

export function createHomeFeaturedSnapshot({ events, sources }, config, { now = new Date() } = {}) {
  return { version: 1, generatedAt: now.toISOString(),
    policy: { leadHours: config.leadHours ?? 24, horizonDays: config.horizonDays ?? 180, maxForeign: config.maxForeign ?? 1 },
    sources, events: buildHomeFeaturedPool(events, config, { now }).map(compactHomeFeaturedEvent) };
}
