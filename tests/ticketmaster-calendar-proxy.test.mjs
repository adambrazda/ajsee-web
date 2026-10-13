import test from 'node:test';
import assert from 'node:assert/strict';

test('real proxy uses local interval overlap and retains explicit absolute-time callers', async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.TM_API_KEY;
  process.env.TM_API_KEY = 'calendar-test-key';
  const requests = [];
  globalThis.fetch = async input => {
    requests.push(new URL(input));
    return new Response(JSON.stringify({ page: { totalPages: 0 } }));
  };
  try {
    const { handler } = await import('../netlify/functions/ticketmasterEvents.js');
    const query = { countryCode: 'CZ', dateFrom: '2099-06-15', dateTo: '2099-06-15', paginationMode: 'cursor' };
    await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: query });
    assert.equal(requests[0].searchParams.get('localStartEndDateTime'), '2099-06-15T00:00:00,2099-06-16T00:00:00');
    assert.equal(requests[0].searchParams.has('startDateTime'), false);
    assert.equal(requests[0].searchParams.has('endDateTime'), false);
    await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { countryCode: 'CZ',
      startDateTime: '2099-06-15T00:00:00Z', endDateTime: '2099-06-16T00:00:00Z' } });
    assert.equal(requests[1].searchParams.get('startDateTime'), '2099-06-15T00:00:00Z');
    assert.equal(requests[1].searchParams.get('endDateTime'), '2099-06-16T00:00:00Z');
    assert.equal(requests[1].searchParams.has('localStartEndDateTime'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TM_API_KEY; else process.env.TM_API_KEY = originalKey;
  }
});
