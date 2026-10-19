import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildSmsticketPayload, runSmsticketSync } from '../scripts/sync-smsticket-events.mjs';

const event = id => `<event><id>${id}</id><name>Concert ${id}</name><booking_url>https://www.smsticket.cz/vstupenky/${id}</booking_url><dates><start_date>2099-01-01</start_date><start_time>19:00</start_time></dates><place><city>Brno</city></place></event>`;
const xml = count => '<events>' + Array.from({ length: count }, (_, i) => event(i + 1)).join('') + '</events>';
const previous = { source: 'smsticket', syncedAt: '2026-10-18T09:00:00Z', count: 100,
  events: Array.from({ length: 100 }, (_, i) => ({ id: 'kept-' + i, sourceId: String(i), title: { cs: 'Kept' },
    date: '2099-01-01', tickets: 'https://www.smsticket.cz/vstupenky/' + i + '?a_box=kept' })) };

for (const [label, body] of [['empty XML', '<events/>'], ['HTML with HTTP 200', '<html><body>Maintenance</body></html>'],
  ['malformed XML', '<events><event>'], ['wrong root', '<maintenance/>'],
  ['unexpected count drop', xml(2)], ['external declaration', '<!DOCTYPE events SYSTEM "https://example.test/dtd"><events/>']]) {
  test('real sync preserves the previous snapshot after ' + label, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ajsee-sms-guard-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    const outputFile = path.join(directory, 'data/smsticket-events.json');
    await mkdir(path.dirname(outputFile));
    await writeFile(outputFile, JSON.stringify(previous));
    const result = await runSmsticketSync({ outputFile, minimumEvents: 1, startedAt: '2026-10-19T09:00:00Z',
      fetchImpl: async () => new Response(body, { status: 200 }) });
    assert.equal(result.events.length, 100);
    assert.equal(result.syncedAt, previous.syncedAt, 'failed import must not reset data freshness');
    assert.equal(result.lastSyncStatus, 'fallback');
    assert.equal(result.lastSyncAttemptAt, '2026-10-19T09:00:00Z');
    assert.equal(result.events[0].tickets, previous.events[0].tickets);
    const saved = JSON.parse(await readFile(outputFile, 'utf8'));
    assert.equal(saved.count, 100);
    assert.ok(saved.warning);
  });
}

test('valid complete data replaces the snapshot and records reconciliation counts', () => {
  const payload = buildSmsticketPayload(xml(100), { existingPayload: previous });
  assert.equal(payload.count, 100);
  assert.equal(payload.stats.rawEvents, payload.stats.accepted);
  assert.equal(payload.stats.rejected, 0);
  assert.equal(payload.lastSyncStatus, 'ok');
  assert.ok(payload.events.every(x => new URL(x.tickets).searchParams.has('a_box')));
  assert.throws(() => buildSmsticketPayload('<events>' + event(1) + event(1) + '</events>', { minimumEvents: 1 }), /Duplicate/);
});

test('initial failure rejects instead of manufacturing a successful empty feed', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ajsee-sms-first-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(console, 'warn', () => {});
  const outputFile = path.join(directory, 'missing.json');
  await assert.rejects(runSmsticketSync({ outputFile, fetchImpl: async () => new Response('<events/>') }));
  await assert.rejects(readFile(outputFile), { code: 'ENOENT' });
});
