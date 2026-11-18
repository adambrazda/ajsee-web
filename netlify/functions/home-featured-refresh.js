import { getStore } from '@netlify/blobs';
import policy from '../../content/home/featured.json' with { type: 'json' };
import bundledTips from '../../public/data/home-featured-events.json' with { type: 'json' };
import { collectHomeFeaturedSources, createHomeFeaturedSnapshot } from '../../shared/home-featured-source.js';
import { FEATURED_EVENT_STORE, prepareHomeFeaturedPublication, publishFeaturedPages, refreshPublishedFeaturedPages } from '../../shared/event-details/featured.js';

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
    const { snapshot, pages } = prepareHomeFeaturedPublication(createHomeFeaturedSnapshot(sources, policy, { now: current }));
    if (snapshot.recommendedIds.length < 6) {
      console.warn('[home tips] refresh retained its last snapshot: fewer than six eligible events');
      return;
    }
    const home = getStoreFn({ name: 'home-featured-v1', consistency: 'strong' });
    const previous = await home.getWithMetadata('current', { type: 'json' });
    if (Date.parse(previous?.data?.generatedAt) >= +current) return;
    const retired = refreshPublishedFeaturedPages(snapshot, previous?.data, sources.events);
    const builtPages = prepareHomeFeaturedPublication(bundledTips).pages;
    const published = new Map([...builtPages, ...retired, ...pages].map(page => [page.slug, page]));
    await publishFeaturedPages(getStoreFn({ name: FEATURED_EVENT_STORE, consistency: 'strong' }), [...published.values()]);
    await home.setJSON('current', snapshot, previous?.etag ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
    console.log(`[home tips] refreshed ${snapshot.events.length} candidates`);
  };
}

export default createHomeFeaturedRefresh();
export const config = { schedule: '0 */6 * * *' };
