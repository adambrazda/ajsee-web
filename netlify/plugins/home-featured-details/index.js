import { readFile } from 'node:fs/promises';
import { getStore } from '@netlify/blobs';
import { FEATURED_EVENT_STORE, publishFeaturedPages } from '../../../shared/event-details/featured.js';

export async function onPostBuild() {
  const pages = JSON.parse(await readFile('dist/event-detail-assets/featured.json', 'utf8'));
  // A build already links to these pages. Register them before the production
  // deploy takes over, so the URLs can survive the very next deploy too.
  await publishFeaturedPages(getStore({ name: FEATURED_EVENT_STORE, consistency: 'strong' }), pages);
}
