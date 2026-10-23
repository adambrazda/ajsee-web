import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { packEventFeed, unpackEventFeed } from '../shared/event-feed.js';
import { buildEventFeeds } from '../scripts/build-event-feeds.mjs';

const fixture = () => ({ generatedAt: '2026-10-23T00:00:00Z', count: 3, events: [
  { id: 'first', title: { cs: 'Muzikál', en: 'Musical' }, description: { cs: 'Úplný popis '.repeat(100) },
    datetime: '2099-03-28T19:00:00+02:00', tickets: 'https://seller.test/ticket?a_box=preserved&x=1',
    location: { city: 'Hodonín', lat: 48.8489, lon: 17.1324 }, gallery: ['https://seller.test/image.jpg'],
    sourceMeta: { rawCategories: ['Muzikál'], geography: { verifiedAt: '2026-10-23' } } },
  { id: 'second', title: { cs: 'Muzikál', en: 'Musical' }, description: { cs: 'Úplný popis '.repeat(100) },
    datetime: '2099-03-29T19:00:00+02:00', tickets: 'https://seller.test/ticket?a_box=preserved&x=2',
    location: { city: 'Hodonín', lat: 48.8489, lon: 17.1324 }, gallery: ['https://seller.test/image.jpg'],
    sourceMeta: { rawCategories: ['Muzikál'], geography: { verifiedAt: '2026-10-23' } } },
  { id: 'foreign', title: 'Koncert', price: 0, active: false, optional: null,
    location: { city: 'Bratislava', country: 'SK' }, extra: [null, 0, false, '', { unknownFutureField: true }] }
] });
const wire = data => JSON.parse(JSON.stringify(packEventFeed(data)));

test('wire round trip retains every field, occurrence, order and original metadata', () => {
  const data = fixture();
  assert.deepEqual(unpackEventFeed(wire(data)), data);
  assert.deepEqual(unpackEventFeed(wire({ events: [] })), { events: [] });
  assert.equal(unpackEventFeed(data), data, 'legacy feeds and city subsets remain supported');
  const special = JSON.parse('{"events":[{"__proto__":{"safe":true},"constructor":"value"}]}');
  assert.deepEqual(unpackEventFeed(wire(special)), special);
  assert.equal({}.safe, undefined);
});

test('deduplicated wire values do not couple mutable events', () => {
  const data = fixture();
  const decoded = unpackEventFeed(wire(data));
  decoded.events[0].title.cs = 'Changed';
  decoded.events[0].gallery.push('Changed');
  decoded.events[0].sourceMeta.rawCategories.push('Changed');
  assert.deepEqual(decoded.events[1], data.events[1]);
  assert.equal(data.events[0].title.cs, 'Muzikál');
});

test('truncated rows, invalid references and unknown versions are rejected', () => {
  for (const breakFeed of [
    p => { p.rows.pop(); },
    p => { p.rows[0].pop(); },
    p => { p.rows[0][0] = p.values.length; },
    p => { p.rows[0][0] = -2; },
    p => { p.rows[0][0] = 0.5; },
    p => { p.columns[1] = p.columns[0]; },
    p => { p.format = 'unknown'; }
  ]) {
    const payload = wire(fixture());
    breakFeed(payload);
    assert.throws(() => unpackEventFeed(payload), /Invalid provider/);
  }
});

test('build produces complete compact siblings and retains the original files verbatim', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ajsee-event-feeds-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const raw = JSON.stringify(fixture(), null, 2);
  for (const provider of ['smsticket', 'colosseumticket']) {
    await writeFile(path.join(directory, `${provider}-events.json`), raw);
  }
  const results = await buildEventFeeds(directory);
  assert.equal(results.length, 2);
  for (const provider of ['smsticket', 'colosseumticket']) {
    assert.equal(await readFile(path.join(directory, `${provider}-events.json`), 'utf8'), raw);
    const decoded = unpackEventFeed(JSON.parse(await readFile(path.join(directory, `${provider}-events.compact.json`), 'utf8')));
    assert.deepEqual(decoded, fixture());
  }
  await rm(path.join(directory, 'colosseumticket-events.json'));
  assert.equal((await buildEventFeeds(directory)).length, 1);
  await assert.rejects(access(path.join(directory, 'colosseumticket-events.compact.json')));
  const previous = await readFile(path.join(directory, 'smsticket-events.compact.json'), 'utf8');
  await writeFile(path.join(directory, 'smsticket-events.json'), '{broken');
  await assert.rejects(buildEventFeeds(directory));
  assert.equal(await readFile(path.join(directory, 'smsticket-events.compact.json'), 'utf8'), previous);
});
