import { getStore } from '@netlify/blobs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pilot from '../../content/event-detail-pilot.json' with { type: 'json' };
import { renderEventPage } from '../../shared/event-details/page.js';
import { LANGUAGES, detailPath, resolveEvent, pageCacheSeconds, mergeEventSnapshots } from '../../shared/event-details/state.js';
import { FEATURED_EVENT_SLUG, FEATURED_EVENT_STORE } from '../../shared/event-details/featured.js';

const assets = new Map();
async function readAsset(name) {
  if (!assets.has(name)) assets.set(name, readFile(path.join(process.cwd(), 'dist/event-detail-assets', name), 'utf8').catch(error => { assets.delete(name); throw error; }));
  return assets.get(name);
}

async function readFeaturedEvent(slug, loadAsset, getStoreFn) {
  const seed = JSON.parse(await loadAsset('featured.json')).find(event => event.slug === slug);
  try {
    const saved = await getStoreFn({ name: FEATURED_EVENT_STORE, consistency: 'strong' }).get(slug, { type: 'json' });
    if (saved?.featured && saved.slug === slug && (!seed || Date.parse(saved.lastVerifiedAt) >= Date.parse(seed.lastVerifiedAt))) return saved;
    return seed;
  } catch (error) {
    if (seed) return seed;
    throw error;
  }
}

export function createEventDetailPage({ getStoreFn = getStore, loadAsset = readAsset, now = () => new Date() } = {}) {
  return async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const match = new URL(request.url).pathname.match(/^\/(?:(en|de|sk|pl|hu)\/)?udalosti\/([a-z0-9-]+)\/?$/);
    const slug = match?.[2], lang = match?.[1] || 'cs';
    const oldEvent = pilot.events.find(item => item.slug === slug);
    const notFound = () => new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    if ((!oldEvent && !FEATURED_EVENT_SLUG.test(slug)) || !LANGUAGES.includes(lang)) return notFound();
    try {
      const event = oldEvent || await readFeaturedEvent(slug, loadAsset, getStoreFn);
      if (!event) return notFound();
      if (!new URL(request.url).pathname.endsWith('/')) return Response.redirect(new URL(detailPath(event.slug, lang), request.url), 301);
      const shell = await loadAsset(lang + '.txt');
      const current = now();
      let snapshot = null;
      if (oldEvent) {
        const seed = JSON.parse(await loadAsset('seed.json'));
        snapshot = seed;
        try {
          const saved = await getStoreFn({ name: 'event-details-v1', consistency: 'strong' }).get('current', { type: 'json' });
          snapshot = mergeEventSnapshots(seed, saved, pilot.events, current);
        } catch { /* The build snapshot still renders complete HTML. */ }
      }
      const html = renderEventPage(shell, event, snapshot, { lang, now: current });
      const cacheSeconds = pageCacheSeconds(resolveEvent(event, snapshot, current), current);
      return new Response(request.method === 'HEAD' ? null : html, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Content-Language': lang,
        'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': cacheSeconds ? `public, durable, max-age=${cacheSeconds}` : 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      } });
    } catch { return new Response('Service temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } }); }
  };
}

export default createEventDetailPage();
export const config = { path: ['/udalosti/*', '/en/udalosti/*', '/de/udalosti/*', '/sk/udalosti/*', '/pl/udalosti/*', '/hu/udalosti/*'] };
