import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEvents } from '../src/api/eventsApi.js';

test('unavailable static feeds are partial, retryable, and not cached as empty inventory', async () => {
  const original = globalThis.fetch;
  let broken = true;
  let feedRequests = 0;
  globalThis.fetch = async input => {
    if (String(input).includes('ticketmasterEvents')) return new Response(JSON.stringify({ page: { totalPages: 0 } }));
    feedRequests++;
    return broken ? new Response('unavailable', { status: 503 }) : new Response(JSON.stringify({ events: [] }));
  };
  try {
    const query = { locale: 'cs', filters: { countryCode: 'CZ', paginationMode: 'cursor' } };
    const first = await fetchEvents(query);
    assert.equal(first.length, 0);
    assert.deepEqual(first.pageInfo.failedProviders.sort(), ['colosseumticket', 'smsticket']);
    assert.equal(first.pageInfo.interrupted, true);
    broken = false;
    const second = await fetchEvents(query);
    assert.equal(feedRequests, 4, 'both failed feeds must be requested again');
    assert.equal(second.length, 0);
    assert.equal(second.pageInfo.interrupted, false, 'a successfully loaded empty feed is a complete result');
    assert.deepEqual(second.pageInfo.failedProviders, []);
  } finally { globalThis.fetch = original; }
});
