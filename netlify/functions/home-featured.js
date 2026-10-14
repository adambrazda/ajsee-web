import { getStore } from '@netlify/blobs';
import seed from '../../public/data/home-featured-events.json' with { type: 'json' };

export function createHomeFeaturedHandler({ getStoreFn = getStore, fallback = seed } = {}) {
  return async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    let snapshot = fallback;
    try {
      const saved = await getStoreFn({ name: 'home-featured-v1', consistency: 'eventual' }).get('current', { type: 'json' });
      if (saved?.version === 1 && saved.events?.length >= 6 && Date.parse(saved.generatedAt) > Date.parse(fallback.generatedAt)) snapshot = saved;
    } catch { /* The build's own snapshot remains a complete standalone fallback. */ }
    return new Response(request.method === 'HEAD' ? null : JSON.stringify(snapshot), { headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=300, stale-while-revalidate=1800',
      'X-Content-Type-Options': 'nosniff'
    } });
  };
}

export default createHomeFeaturedHandler();
