import test from 'node:test';
import assert from 'node:assert/strict';

async function withProxyRequests(run) {
  const originalFetch = globalThis.fetch, originalKey = process.env.TM_API_KEY;
  process.env.TM_API_KEY = 'radius-test-key';
  const requests = [];
  globalThis.fetch = async input => {
    requests.push(new URL(input));
    return new Response(JSON.stringify({ page: { totalPages: 0 } }));
  };
  try {
    const { handler } = await import('../netlify/functions/ticketmasterEvents.js');
    await run(async (radius, unit) => {
      const before = requests.length;
      const response = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {
        latlong: '50.08,14.43', radius: String(radius), unit,
        keyword: `radius-${unit}-fixture`, dateFrom: '2099-01-01', paginationMode: 'cursor'
      } });
      assert.equal(response.statusCode, 200);
      assert.equal(requests.length, before + 1);
      return requests.at(-1);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TM_API_KEY; else process.env.TM_API_KEY = originalKey;
  }
}

test('upstream miles cover the entire requested kilometre radius', async () => {
  await withProxyRequests(async request => {
    for (const radius of [10, 12, 20, 30, 50, 100, 300]) {
      const url = await request(radius, 'km');
      const miles = Number(url.searchParams.get('radius'));
      assert.equal(url.searchParams.get('unit'), 'miles');
      assert.ok(miles * 1.609344 >= radius, `${radius} km must not shrink to ${miles} miles`);
      assert.ok((miles - 1) * 1.609344 < radius, 'use the smallest covering integer radius');
    }
  });
});

test('fractional mile callers also keep their complete requested radius', async () => {
  await withProxyRequests(async request => {
    for (const radius of [1.1, 6.3, 18.1]) {
      const url = await request(radius, 'miles');
      const miles = Number(url.searchParams.get('radius'));
      assert.ok(miles >= radius);
      assert.ok(miles - 1 < radius);
    }
  });
});
