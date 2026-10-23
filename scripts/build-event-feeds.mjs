import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packEventFeed, unpackEventFeed } from '../shared/event-feed.js';

export async function buildEventFeeds(dataDir = path.resolve('public/data')) {
  const results = [];
  for (const provider of ['smsticket', 'colosseumticket']) {
    const original = path.join(dataDir, `${provider}-events.json`);
    const output = path.join(dataDir, `${provider}-events.compact.json`);
    let raw;
    try { raw = await readFile(original, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Local development may not have the optional Colosseum snapshot yet.
      await rm(output, { force: true });
      continue;
    }
    const payload = JSON.parse(raw);
    const serialized = JSON.stringify(packEventFeed(payload));
    // Every build checks every field, occurrence and metadata value after a
    // complete wire round trip before publishing the smaller alternative.
    assert.deepEqual(unpackEventFeed(JSON.parse(serialized)), payload);
    await mkdir(dataDir, { recursive: true });
    const temporary = `${output}.tmp-${process.pid}`;
    try {
      await writeFile(temporary, serialized, 'utf8');
      await rename(temporary, output);
    } finally { await rm(temporary, { force: true }); }
    results.push({ provider, events: payload.events.length,
      originalBytes: Buffer.byteLength(raw), compactBytes: Buffer.byteLength(serialized) });
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const result of await buildEventFeeds()) console.log('[event-feeds]', JSON.stringify(result));
}
