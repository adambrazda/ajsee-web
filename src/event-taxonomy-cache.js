import { copyJsonValue } from '../shared/event-feed.js';
import { deriveLegacyCategory } from './taxonomy/event-taxonomy.js';

// Feed objects are stable for the lifetime of the adapter's data cache. Cache
// their static taxonomy, never date availability, filters or search results.
export function createEventTaxonomyCache(buildTaxonomy) {
  const cache = new WeakMap();
  return (event, sourceEvent = event) => {
    let prepared = cache.get(sourceEvent);
    if (!prepared) {
      const taxonomy = buildTaxonomy(event);
      prepared = { category: deriveLegacyCategory(taxonomy), taxonomy };
      cache.set(sourceEvent, prepared);
    }
    return { ...event, category: prepared.category, taxonomy: copyJsonValue(prepared.taxonomy) };
  };
}
