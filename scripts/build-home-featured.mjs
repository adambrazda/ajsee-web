import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { collectHomeFeaturedSources, createHomeFeaturedSnapshot } from '../shared/home-featured-source.js';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('content/home/featured.json', root), 'utf8'));
const localFeeds = {};
if (!process.argv.includes('--from-production')) {
  for (const provider of ['smsticket', 'colosseumticket']) {
    try { localFeeds[provider] = JSON.parse(await readFile(new URL(`public/data/${provider}-events.json`, root), 'utf8')); }
    catch { /* A missing local source can be read from the published site. */ }
  }
}
const sources = await collectHomeFeaturedSources({ localFeeds, apiKey: process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY || '' });
const snapshot = createHomeFeaturedSnapshot(sources, config);
if (snapshot.events.length < 6) throw new Error('Cannot build a complete six-card homepage recommendation pool');
await mkdir(new URL('public/data/', root), { recursive: true });
await writeFile(new URL('public/data/home-featured-events.json', root), JSON.stringify(snapshot));
console.log(`[home tips] ${snapshot.events.length} candidates; ${JSON.stringify(snapshot).length} bytes; sources ${Object.entries(snapshot.sources).map(([name, value]) => `${name}:${value.state}`).join(', ')}`);
