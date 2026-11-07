import { getStore } from '@netlify/blobs';
import pilot from '../../content/event-detail-pilot.json' with { type: 'json' };
import { collectEventDetails } from '../../shared/event-details/sources.js';

export function createEventDetailRefresh({ getStoreFn = getStore, collect = collectEventDetails, now = () => new Date() } = {}) {
  return async () => {
    const store = getStoreFn({ name: 'event-details-v1', consistency: 'strong' });
    const previous = await store.get('current', { type: 'json' }).catch(() => null);
    const snapshot = await collect(pilot.events, { previous, now: now(), apiKey: process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY || '', affiliateBox: process.env.COLOSSEUMTICKET_A_BOX || '' });
    // Each provider advances independently; failed/missing records retain their
    // last known term. Their price expires at read time, even during an outage.
    await store.setJSON('current', snapshot);
    // Keep diagnostics limited to operational metadata; never log upstream URLs
    // or credentials used to collect the provider data.
    const summary = {
      generatedAt: snapshot.generatedAt,
      sources: Object.entries(snapshot.sources || {}).map(([provider, source]) => ({
        provider, state: source.state,
        count: Number.isFinite(source.count) ? source.count : null,
        observedAt: source.observedAt || null
      })),
      events: snapshot.events.map(({ id, partner, sourceState, lastVerifiedAt }) => ({
        id, partner, sourceState, lastVerifiedAt
      }))
    };
    console.log('[event details] scheduled refresh completed', JSON.stringify(summary));
  };
}
export default createEventDetailRefresh();
export const config = { schedule: '15 */6 * * *' };
