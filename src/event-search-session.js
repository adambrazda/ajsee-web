import { filterEventPriceBatch } from './event-price-filtering.js';
import { hasActivePriceFilter } from './event-price.js';
import { filterCurrentEventBatch } from './event-availability.js';
import { exactCrossProviderOccurrenceKey, mergeExactCrossProviderOccurrences } from './event-cross-provider-merge.js';
import { hasAiRelevance, rankEventsByRelevance } from './search/event-relevance.js';
import { eventTime } from './event-pagination.js';

function eventKey(event) {
  // Exact occurrence merging happens before pagination. Distinct IDs from
  // one provider must remain distinct even when their title and time match.
  if (event.id != null && event.id !== '') return String(event.id);
  const occurrence = exactCrossProviderOccurrenceKey(event);
  return occurrence ? `occurrence:${occurrence}` : String(event.id || [
    event.partner, event.datetime || event.date, event.location?.city,
    typeof event.title === 'string' ? event.title : JSON.stringify(event.title), event.tickets || event.url
  ].join('|'));
}

// A session owns both provider cursors and the pages already shown to the user.
// No later fetch may move a published event into another page.
export function createEventSearchSession({ locale = 'cs', filters = {}, fetchBatch,
  getRates = async () => ({}), mixFirstPage, firstPageSize = 20, now = () => new Date() } = {}) {
  const searchFilters = { ...filters };
  const candidates = new Map();
  let cursor = null;
  let started = false;
  let hasMore = true;
  let frontier = null;
  let published = [];
  let ratesPromise = null;
  let inflight = null;
  let lastPageInfo = null;
  let orderedCache = null;
  let cachedMinute = -1;

  async function rates() {
    if (!hasActivePriceFilter(searchFilters)) return {};
    if (!ratesPromise) ratesPromise = Promise.resolve().then(() => getRates(searchFilters)).catch(err => {
      console.warn('[AJSEE price filter] FX rates unavailable; using same-currency comparisons only.', err);
      return {};
    });
    return ratesPromise;
  }

  function ordered() {
    const currentTime = now();
    const minute = Math.floor(currentTime.getTime() / 60000);
    if (orderedCache && minute === cachedMinute) return orderedCache;
    const events = filterEventPriceBatch(filterCurrentEventBatch(
      mergeExactCrossProviderOccurrences([...candidates.values()]), currentTime), searchFilters, currentRates);
    cachedMinute = minute;
    if (hasAiRelevance(searchFilters)) {
      orderedCache = rankEventsByRelevance(events, searchFilters);
      return orderedCache;
    }
    const latest = searchFilters.sort === 'latest';
    orderedCache = events.sort((a, b) => {
      const ta = eventTime(a), tb = eventTime(b);
      if (ta === Infinity || tb === Infinity) return ta === tb ? 0 : ta === Infinity ? 1 : -1;
      return latest ? tb - ta : ta - tb;
    });
    return orderedCache;
  }

  let currentRates = {};

  function available() {
    const all = ordered();
    const seen = new Set(published.map(eventKey));
    const latest = searchFilters.sort === 'latest';
    const ai = hasAiRelevance(searchFilters);
    // Raw query boundaries, not the number of matches, establish a safe page.
    const rest = all.filter(event => !seen.has(eventKey(event)) &&
      (ai || !hasMore || (frontier != null && (latest ? eventTime(event) >= frontier : eventTime(event) <= frontier))));
    return { all, rest };
  }

  function snapshot() {
    const { all, rest } = available();
    return { events: published.concat(rest), hasMore, totalKnown: all.length,
      pending: hasMore, pageInfo: lastPageInfo };
  }

  async function load(targetCount, { maxBatches = 3 } = {}) {
    if (inflight) { await inflight; return load(targetCount, { maxBatches }); }
    const target = Math.max(1, Number(targetCount) || 1);
    inflight = (async () => {
      const nextRates = await rates();
      if (nextRates !== currentRates) orderedCache = null;
      currentRates = nextRates;
      let batches = 0;
      while (hasMore && (published.length + available().rest.length < target || !started) && batches < maxBatches) {
        const batch = await fetchBatch({ locale, filters: {
          ...searchFilters, paginationMode: 'cursor', allLocalEvents: true, size: 50,
          ticketmasterCursor: cursor,
          includeSmsticket: !started && searchFilters.includeSmsticket !== false,
          includeColosseumticket: !started && searchFilters.includeColosseumticket !== false
        } });
        if (!Array.isArray(batch) || !batch.pageInfo) throw new Error('Event continuation metadata unavailable');
        for (const event of batch) candidates.set(String(event.id || eventKey(event)), event);
        orderedCache = null;
        lastPageInfo = batch.pageInfo;
        cursor = lastPageInfo.ticketmasterCursor;
        hasMore = lastPageInfo.hasMore === true;
        frontier = lastPageInfo.frontier;
        started = true;
        batches += 1;
      }
      let { rest } = available();
      if (!published.length && mixFirstPage && !hasAiRelevance(searchFilters)) {
        rest = mixFirstPage(rest);
        // Commit the entire mixed first page so its promoted cards cannot recur.
        published = rest.slice(0, Math.min(firstPageSize, rest.length));
      }
      const seen = new Set(published.map(eventKey));
      rest = available().rest.filter(event => !seen.has(eventKey(event)));
      published = published.concat(rest.slice(0, Math.max(0, target - published.length)));
      return snapshot();
    })();
    try { return await inflight; } finally { inflight = null; }
  }

  return { load, snapshot };
}
