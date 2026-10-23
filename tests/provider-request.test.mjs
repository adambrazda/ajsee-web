import test from 'node:test';
import assert from 'node:assert/strict';
import { withRequestDeadline, fetchProviderJson } from '../src/provider-request.js';
import { packEventFeed } from '../shared/event-feed.js';

test('deadline aborts a stuck transport and settles even if it ignores abort', async () => {
  let signal;
  await assert.rejects(withRequestDeadline(requestSignal => {
    signal = requestSignal;
    return new Promise(() => {});
  }, 20), { code: 'PROVIDER_TIMEOUT' });
  assert.equal(signal.aborted, true);
});

test('deadline includes a stalled body after headers already arrived', async () => {
  await assert.rejects(withRequestDeadline(async () => {
    const response = { json: () => new Promise(() => {}) };
    return response.json();
  }, 20), { code: 'PROVIDER_TIMEOUT' });
});

test('successful and failed requests settle without waiting for the deadline', async () => {
  assert.equal(await withRequestDeadline(async () => 42, 1000), 42);
  const error = new Error('HTTP failure');
  await assert.rejects(withRequestDeadline(() => { throw error; }, 1000), error);
});

test('full feeds use their complete compact sibling while city subsets retain their original URL', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const payload = { events: [{ id: 'one', description: { cs: 'Full description' }, tickets: 'https://seller.test/?a_box=kept' }] };
  const requests = [];
  globalThis.fetch = async input => {
    requests.push(input);
    return new Response(JSON.stringify(input.includes('.compact.') ? packEventFeed(payload) : payload));
  };
  for (const provider of ['smsticket', 'colosseumticket']) {
    assert.deepEqual(await fetchProviderJson(`/data/${provider}-events.json`), payload.events);
    assert.deepEqual(await fetchProviderJson(`/data/${provider}-events-praha.json`), payload.events);
  }
  assert.deepEqual(requests, ['/data/smsticket-events.compact.json', '/data/smsticket-events-praha.json',
    '/data/colosseumticket-events.compact.json', '/data/colosseumticket-events-praha.json']);
});

test('missing, malformed and truncated compact feeds fall back to the complete original inventory', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const payload = { events: [{ id: 'kept', priceFrom: '0 Kč', tickets: 'https://seller.test/?a_box=kept' }] };
  const broken = packEventFeed(payload);
  broken.rows = [];
  for (const badResponse of [() => new Response('missing', { status: 404 }),
    () => new Response('{broken'), () => new Response(JSON.stringify(broken)),
    () => new Response(JSON.stringify({ format: 'unknown' }))]) {
    const requests = [];
    const signals = [];
    globalThis.fetch = async (input, options) => {
      requests.push(input); signals.push(options.signal);
      return input.includes('.compact.') ? badResponse() : new Response(JSON.stringify(payload));
    };
    assert.deepEqual(await fetchProviderJson('/data/smsticket-events.json'), payload.events);
    assert.deepEqual(requests, ['/data/smsticket-events.compact.json', '/data/smsticket-events.json']);
    assert.equal(signals[0], signals[1], 'the shared deadline also covers fallback body reads');
  }
});
