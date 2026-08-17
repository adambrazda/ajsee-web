export default async function handler() {
  return Response.json(
    {
      ok: true,
      probe: 'rate-limit'
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}

export const config = {
  path: '/api/rate-limit-probe',
  rateLimit: {
    windowLimit: 3,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  }
};