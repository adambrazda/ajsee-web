import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { FEATURED_EVENT_STORE, publishFeaturedPages } from '../../../shared/event-details/featured.js';

export async function onPostBuild({ constants }) {
  const pages = JSON.parse(await readFile(join(constants.PUBLISH_DIR, 'event-detail-assets', 'featured.json'), 'utf8'));
  if (process.env.CONTEXT !== 'production') return;
  // A build already links to these pages. Register them before the production
  // deploy takes over, so the URLs can survive the very next deploy too.
  await publishFeaturedPages(getStore({ name: FEATURED_EVENT_STORE, consistency: 'strong' }), pages);
}
