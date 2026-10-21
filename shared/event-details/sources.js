import { parseColosseumXml, normalizeColosseumFeed, readColosseumResponseTextWithLimit } from '../../scripts/sync-colosseumticket-events.mjs';
import { buildSmsticketPayload } from '../../scripts/sync-smsticket-events.mjs';
import { mapTicketmasterEvent } from '../../src/adapters/ticketmaster.js';
import { advanceOccurrence, freshTimestamp } from './state.js';

async function fetchSource(url, fetchImpl, xml = false) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: xml ? 'application/xml' : 'application/json' } });
  if (!response.ok) throw new Error('Provider unavailable');
  return xml ? readColosseumResponseTextWithLimit(response, 30 * 1024 * 1024) : response.json();
}

export async function collectEventDetails(events, { previous, localFeeds = {}, fetchImpl = fetch,
  apiKey = '', affiliateBox = '', now = new Date(), origin = 'https://ajsee.cz' } = {}) {
  const sources = {}, records = new Map();
  await Promise.all(['smsticket', 'colosseumticket'].map(async partner => {
    try {
      let feed = localFeeds[partner];
      if (!feed) {
        const url = partner === 'smsticket' ? 'https://www.smsticket.cz/api/public/v1.1/events' : 'https://colosseumticket.cz/api/export/affiliate.xml';
        const xml = await fetchSource(url, fetchImpl, true);
        feed = partner === 'smsticket'
          ? buildSmsticketPayload(xml, { syncedAt: now.toISOString() })
          : { ...normalizeColosseumFeed(parseColosseumXml(xml), { affiliateBox: affiliateBox || 'metadata-only' }), generatedAt: now.toISOString() };
      }
      const observedAt = feed.generatedAt || feed.syncedAt;
      const count = feed.events?.length || 0, oldCount = previous?.sources?.[partner]?.count || 0;
      if (count < 100 || (oldCount >= 100 && count < oldCount * 0.5) || !freshTimestamp(observedAt, now)) throw new Error('Incomplete or stale provider data');
      const ids = new Set(feed.events.map(record => record.id));
      if (ids.size !== count) throw new Error('Duplicate provider IDs');
      for (const event of events.filter(item => item.partner === partner)) {
        const row = feed.events.find(item => item.id === event.id && item.partner === partner);
        if (row) records.set(event.id, { record: row, observedAt });
      }
      sources[partner] = { state: 'ok', observedAt, count };
    } catch {
      sources[partner] = { state: 'unavailable' };
    }
  }));
  // The pilot is bounded: one Discovery lookup per allowlisted TM occurrence,
  // never a full catalog scan or a visitor-triggered upstream request.
  await Promise.all(events.filter(event => event.partner === 'ticketmaster').map(async event => {
    try {
      const id = event.id.slice('ticketmaster-'.length);
      const url = apiKey ? new URL(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json`)
        : new URL('/.netlify/functions/ticketmasterEvents', origin);
      if (apiKey) { url.searchParams.set('apikey', apiKey); url.searchParams.set('locale', '*'); }
      else { url.searchParams.set('keyword', event.title); url.searchParams.set('countryCode', event.venue.country); url.searchParams.set('size', '50'); }
      const data = await fetchSource(url, fetchImpl);
      if (data?._ajseeProxy?.upstreamStatus === 429) throw new Error('Rate limited');
      const raw = data.id === id ? data : data?._embedded?.events?.find(item => item.id === id);
      if (raw) {
        const row = mapTicketmasterEvent(raw, 'cs');
        const start = raw.dates?.start;
        row.datetime = start?.localDate && start?.localTime && !start.dateTBA && !start.dateTBD && !start.timeTBA
          ? start.localDate + 'T' + start.localTime : '';
        records.set(event.id, { record: row, observedAt: now.toISOString() });
      }
      sources[event.id] = { state: 'ok', observedAt: now.toISOString(), count: raw ? 1 : 0 };
    } catch { sources[event.id] = { state: 'unavailable' }; }
  }));
  return { version: 1, generatedAt: now.toISOString(), sources,
    events: events.map(event => {
      const old = previous?.events?.find(item => item.id === event.id), update = records.get(event.id);
      const result = advanceOccurrence(event, old, update?.record, update?.observedAt || now.toISOString());
      if (!update && (sources[event.partner]?.state === 'unavailable' || sources[event.id]?.state === 'unavailable')) result.sourceState = 'unavailable';
      return result;
    }) };
}
