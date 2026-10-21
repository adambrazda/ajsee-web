import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import pilot from '../content/event-detail-pilot.json' with { type: 'json' };
import COPY from '../content/event-detail-copy.json' with { type: 'json' };
import { collectEventDetails } from '../shared/event-details/sources.js';
import { LANGUAGES, detailPath } from '../shared/event-details/state.js';
import { renderEventPage, HEAD_TOKEN, BODY_TOKEN } from '../shared/event-details/page.js';
import { validatePilot, escapeHtml } from './event-detail-pilot.mjs';

validatePilot(pilot.events);
const assets = 'dist/event-detail-assets';
await mkdir(assets, { recursive: true });
const localFeeds = {};
for (const partner of ['smsticket', 'colosseumticket']) {
  try { localFeeds[partner] = JSON.parse(await readFile(`public/data/${partner}-events.json`, 'utf8')); } catch { /* Fetch directly if the build has no local feed. */ }
}
const snapshot = await collectEventDetails(pilot.events, { localFeeds, apiKey: process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY || '' });
await writeFile(assets + '/seed.json', JSON.stringify(snapshot));
const template = await readFile('dist/templates/event-detail-preview.html', 'utf8');

for (const lang of LANGUAGES) {
  const shell = new JSDOM(template), doc = shell.window.document;
  const page = new JSDOM(await readFile(lang === 'cs' ? 'dist/about.html' : `dist/${lang}/about/index.html`, 'utf8'));
  const header = page.window.document.querySelector('.site-header').cloneNode(true);
  header.querySelectorAll('.language-switcher').forEach(node => node.remove());
  header.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
  header.querySelector('[data-i18n-key="nav-events"]').setAttribute('aria-current', 'page');
  header.querySelector('.main-nav').setAttribute('aria-label', COPY[lang].labels.mainMenu);
  header.querySelector('.hamburger-btn')?.setAttribute('aria-label', COPY[lang].labels.openMenu);
  header.querySelector('.menu-close')?.setAttribute('aria-label', COPY[lang].labels.closeMenu);
  const footerNode = page.window.document.querySelector('.site-footer');
  footerNode.querySelector('nav')?.setAttribute('aria-label', COPY[lang].labels.legalLinks);
  const footer = footerNode.outerHTML;
  doc.documentElement.lang = lang;
  doc.querySelectorAll('title, meta[name="robots"], meta[name="description"], link[rel="canonical"], link[hreflang], script[type="application/ld+json"]').forEach(node => node.remove());
  doc.head.insertAdjacentHTML('beforeend', HEAD_TOKEN);
  doc.body.innerHTML = header.outerHTML + BODY_TOKEN + footer;
  const shellText = shell.serialize();
  await writeFile(`${assets}/${lang}.txt`, shellText);
  for (const event of pilot.events) {
    const html = renderEventPage(shellText, event, snapshot, { lang });
    const directory = 'dist' + detailPath(event.slug, lang);
    await mkdir(directory, { recursive: true });
    await writeFile(directory + 'index.html', html);
  }
  // Indexable links exist in the first HTML on both entry points, even if the
  // selected feed no longer contains one of these explicitly retained events.
  for (const route of ['events', 'home']) {
    const file = route === 'home' ? `dist/${lang === 'cs' ? '' : lang + '/'}index.html` : lang === 'cs' ? 'dist/events.html' : `dist/${lang}/events/index.html`;
    const html = new JSDOM(await readFile(file, 'utf8')), hdoc = html.window.document;
    const section = hdoc.createElement('section');
    section.className = 'event-detail-links';
    section.setAttribute('aria-labelledby', 'event-detail-links-title');
    section.innerHTML = `<h2 id="event-detail-links-title">${escapeHtml(COPY[lang].labels.plan)}</h2><ul>${pilot.events.map(event => `<li><a href="${detailPath(event.slug, lang)}">${escapeHtml(event.title)} · ${escapeHtml(event.venue.city)}</a></li>`).join('')}</ul>`;
    hdoc.querySelector('main').appendChild(section);
    await writeFile(file, html.serialize()); html.window.close();
  }
  shell.window.close(); page.window.close();
}
console.log('[event details] 24 localized pages and server-rendering assets built');
