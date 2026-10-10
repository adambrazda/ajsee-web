import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildEventCityCatalog } from '../shared/city/event-city-catalog.js';

export async function buildEventCities({ dataDir = path.resolve('public/data') } = {}) {
  const sources = [];
  for (const name of ['smsticket', 'colosseumticket']) {
    try {
      const payload = JSON.parse(await readFile(path.join(dataDir, `${name}-events.json`), 'utf8'));
      if (!Array.isArray(payload.events)) throw new Error(`${name}: invalid events payload`);
      sources.push({ events: payload.events, marketCountryCode: 'CZ' });
    } catch (error) {
      // Colosseum is not synchronized by predev. Its absence there is expected.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!sources.length) throw new Error('Cannot build city catalog without any partner feed');
  const items = buildEventCityCatalog(sources);
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'event-cities.json'), JSON.stringify({ version: 1, items }) + '\n');
  console.log(`[event cities] ${items.length} cities from ${sources.length} partner feeds`);
  return items;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildEventCities();
}
