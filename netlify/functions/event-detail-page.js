import { getStore } from '@netlify/blobs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pilot from '../../content/event-detail-pilot.json' with { type: 'json' };
import { renderEventPage } from '../../shared/event-details/page.js';
import { LANGUAGES, detailPath } from '../../shared/event-details/state.js';

const assets = new Map();
async function readAsset(name) {
  if (!assets.has(name)) assets.set(name, readFile(path.join(process.cwd(), 'dist/event-detail-assets', name), 'utf8').catch(error => { assets.delete(name); throw error; }));
  return assets.get(name);
}

export function createEventDetailPage({ getStoreFn = getStore, loadAsset = readAsset, now = () => new Date() } = {}) {
  return async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const match = new URL(request.url).pathname.match(/^\/(?:(en|de|sk|pl|hu)\/)?udalosti\/([a-z0-9-]+)\/?$/);
    const lang = match?.[1] || 'cs', event = pilot.events.find(item => item.slug === match?.[2]);
    if (!event || !LANGUAGES.includes(lang)) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    if (!new URL(request.url).pathname.endsWith('/')) return Response.redirect(new URL(detailPath(event.slug, lang), request.url), 301);
    try {
      const [shell, seedText] = await Promise.all([loadAsset(lang + '.txt'), loadAsset('seed.json')]);
      let snapshot = JSON.parse(seedText);
      try {
        const saved = await getStoreFn({ name: 'event-details-v1', consistency: 'strong' }).get('current', { type: 'json' });
        if (saved?.version === 1 && Date.parse(saved.generatedAt) > Date.parse(snapshot.generatedAt)) snapshot = saved;
      } catch { /* The build snapshot still renders complete HTML. */ }
      const html = renderEventPage(shell, event, snapshot, { lang, now: now() });
      return new Response(request.method === 'HEAD' ? null : html, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Content-Language': lang,
        'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, durable, max-age=300',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      } });
    } catch { return new Response('Service temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } }); }
  };
}

export default createEventDetailPage();
export const config = { path: ['/udalosti/*', '/en/udalosti/*', '/de/udalosti/*', '/sk/udalosti/*', '/pl/udalosti/*', '/hu/udalosti/*'] };
