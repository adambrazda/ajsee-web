import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { FEATURED_EVENT_STORE, publishFeaturedPages } from '../../shared/event-details/featured.js';

export default {
  async deploySucceeded({ deploy }) {
    if (deploy.context !== 'production') return;
    const pages = JSON.parse(await readFile(join(process.cwd(), 'dist/event-detail-assets/featured.json'), 'utf8'));
    await publishFeaturedPages(getStore({ name: FEATURED_EVENT_STORE, consistency: 'strong' }), pages);
  }
};
