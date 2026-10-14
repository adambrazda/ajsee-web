import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withColosseumGeography } from '../shared/geo/colosseum-geography.js';
import { eventCoordinates } from '../shared/geo/coordinates.js';

export function auditColosseumGeography(events = []) {
  const missing = new Map();
  let located = 0;
  for (const event of events) {
    if (eventCoordinates(withColosseumGeography(event))) { located++; continue; }
    const venue = event.venue?.name || '';
    const city = event.location?.city || event.venue?.city || '';
    const street = event.venue?.address?.street || '';
    const key = JSON.stringify([venue, city, street]);
    const row = missing.get(key) || { venue, city, street, occurrences: 0 };
    row.occurrences++;
    missing.set(key, row);
  }
  return { total: events.length, located, unlocated: events.length - located,
    coveragePercent: events.length ? Math.round(located / events.length * 1000) / 10 : 0,
    unlocatedVenues: [...missing.values()].sort((a, b) => b.occurrences - a.occurrences || a.venue.localeCompare(b.venue, 'cs')) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--')) || fileURLToPath(new URL('../public/data/colosseumticket-events.json', import.meta.url));
  const payload = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(payload.events)) throw new Error('Invalid Colosseum event feed');
  const report = auditColosseumGeography(payload.events);
  if (args.includes('--summary')) delete report.unlocatedVenues;
  console.log(JSON.stringify(report, null, 2));
}
