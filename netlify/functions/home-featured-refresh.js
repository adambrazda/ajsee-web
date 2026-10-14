import { getStore } from '@netlify/blobs';
import policy from '../../content/home/featured.json' with { type: 'json' };
import { collectHomeFeaturedSources, createHomeFeaturedSnapshot } from '../../shared/home-featured-source.js';
import { selectHomeFeaturedEvents } from '../../src/home-featured-selection.js';

export function createHomeFeaturedRefresh({ getStoreFn = getStore, collectSources = collectHomeFeaturedSources, now = () => new Date() } = {}) {
  return async () => {
    const current = now();
    const sources = await collectSources({ apiKey: process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY || '', now: current });
    // Keep the last complete snapshot during a source outage. Expired cards are
    // still excluded by the client; an outage must not replace good cached data.
    if (Object.values(sources.sources).some(source => source.state !== 'ok')) {
      console.warn('[home tips] refresh retained its last snapshot: a source is unavailable');
      return;
    }
    const snapshot = createHomeFeaturedSnapshot(sources, policy, { now: current });
    if (selectHomeFeaturedEvents(snapshot.events, snapshot.policy, { now: current }).length < 6) {
      console.warn('[home tips] refresh retained its last snapshot: fewer than six eligible events');
      return;
    }
    await getStoreFn({ name: 'home-featured-v1', consistency: 'strong' }).setJSON('current', snapshot);
    console.log(`[home tips] refreshed ${snapshot.events.length} candidates`);
  };
}

export default createHomeFeaturedRefresh();
export const config = { schedule: '0 */6 * * *' };
