import test from 'node:test';
import assert from 'node:assert/strict';

test('cursor requests do not reuse legacy filtered totals from the proxy cache', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.TM_API_KEY;
  process.env.TM_API_KEY = 'fixture-key';
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ _embedded: { events: Array.from({ length: 50 }, (_, i) => ({
      id: String(i), dates: { start: { dateTime: '2099-01-01T18:00:00Z' } },
      _embedded: { venues: [{ country: { countryCode: i === 0 ? 'CZ' : 'PL' } }] }
    })) }, page: { totalPages: 2, totalElements: 100, number: 0, size: 50 } }));
  };
  try {
    const { handler } = await import('../netlify/functions/ticketmasterEvents.js');
    const request = { httpMethod: 'GET', headers: {}, queryStringParameters: {
      city: 'Praha', countryCode: 'CZ', countryStrategy: 'both', size: '50', page: '0'
    } };
    const legacy = JSON.parse((await handler(request)).body);
    assert.equal(legacy._embedded.events.length, 1);
    assert.equal(legacy.page.totalPages, 1);
    const cursor = JSON.parse((await handler({ ...request, queryStringParameters: {
      ...request.queryStringParameters, paginationMode: 'cursor'
    } })).body);
    assert.equal(requests, 2);
    assert.equal(cursor._embedded.events.length, 1);
    assert.equal(cursor._ajseePageInfo.hasMore, true);
    assert.equal(cursor._ajseePageInfo.nextPage, 1);
    assert.equal(cursor._ajseePageInfo.frontier, Date.parse('2099-01-01T18:00:00Z'));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TM_API_KEY; else process.env.TM_API_KEY = oldKey;
  }
});
