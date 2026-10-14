import test from 'node:test';
import assert from 'node:assert/strict';
import { withRequestDeadline } from '../src/provider-request.js';

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
