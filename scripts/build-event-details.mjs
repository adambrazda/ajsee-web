import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import pilot from '../content/event-detail-pilot.json' with { type: 'json' };
import COPY from '../content/event-detail-copy.json' with { type: 'json' };
import { collectEventDetails } from '../shared/event-details/sources.js';
import { LANGUAGES, detailPath, resolveEvent } from '../shared/event-details/state.js';
import { renderEventPage, HEAD_TOKEN, BODY_TOKEN } from '../shared/event-details/page.js';
import { validatePilot, escapeHtml, eventState } from './event-detail-pilot.mjs';
import { renderSharedEventCard } from '../src/event-card.js';
import { formatEventDateTime } from '../src/event-date-time.js';

validatePilot(pilot.events);
const assets = 'dist/event-detail-assets';
await mkdir(assets, { recursive: true });
const localFeeds = {};
for (const partner of ['smsticket', 'colosseumticket']) {
  try { localFeeds[partner] = JSON.parse(await readFile(`public/data/${partner}-events.json`, 'utf8')); } catch { /* Fetch directly if the build has no local feed. */ }
}
const now = new Date();
const snapshot = await collectEventDetails(pilot.events, { localFeeds, apiKey: process.env.TM_API_KEY || process.env.TICKETMASTER_API_KEY || '', now });
const events = pilot.events.map(event => resolveEvent(event, snapshot, now));
const plannedEvents = events.filter(event => ['scheduled', 'rescheduled'].includes(eventState(event, now)));
const archivedEvents = events.filter(event => !plannedEvents.includes(event));
const renderLinkItems = (events, lang) => events.map(event =>
  `<li data-event-date="${event.startDate.slice(0, 10)}"><a href="${detailPath(event.slug, lang)}">${escapeHtml(event.title)} · ${escapeHtml(event.venue.city)}</a></li>`
).join('');

function addPlannedCards(doc, lang, dictionary) {
  const grid = doc.querySelector('[data-events-static] .events-list');
  if (!grid) throw new Error(`Static catalogue cards missing for ${lang}`);
  for (const event of plannedEvents) {
    let card = Array.from(grid.children).find(node => node.dataset.eventId === event.id);
    if (!card) {
      const entry = {
        id: event.id,
        partner: event.partner,
        title: event.title,
        datetime: event.startDate,
        venue: event.venue,
        image: event.image.url,
        priceFrom: event.price?.minimum ?? null,
        currency: event.price?.currency ?? ''
      };
      grid.insertAdjacentHTML('beforeend', renderSharedEventCard({
        event: entry,
        locale: lang,
        modalId: event.id,
        titleRaw: event.title,
        titleHtml: escapeHtml(event.title),
        dateHtml: escapeHtml(formatEventDateTime(entry, lang)),
        imageSrc: entry.image,
        ticketsHref: event.tickets,
        detailLabelHtml: escapeHtml(dictionary['event-details']),
        ticketLabelHtml: escapeHtml(dictionary['event-tickets'])
      }));
      card = grid.lastElementChild;
    }
    const detailLink = card.querySelector('a.event-title-action[href]');
    if (!detailLink) throw new Error(`Catalogue card ${event.id} is missing its detail link`);
    card.dataset.eventArchiveDate = event.startDate.slice(0, 10);
  }
}
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
    const html = renderEventPage(shellText, event, snapshot, { lang, now });
    const directory = 'dist' + detailPath(event.slug, lang);
    await mkdir(directory, { recursive: true });
    await writeFile(directory + 'index.html', html);
  }
  // The catalogue's existing grid carries the links to individual event pages.
  const entryPages = lang === 'cs'
    ? ['dist/events.html', 'dist/events/index.html']
    : [`dist/${lang}/events/index.html`];
  const dictionary = JSON.parse(await readFile(`src/locales/${lang}.json`, 'utf8'));
  const archivedItems = renderLinkItems(archivedEvents, lang);

  for (const file of entryPages) {
    const html = new JSDOM(await readFile(file, 'utf8')), hdoc = html.window.document;
    const main = hdoc.querySelector('main');
    main.querySelectorAll('.event-detail-links').forEach(section => section.remove());
    addPlannedCards(hdoc, lang, dictionary);
    main.insertAdjacentHTML('beforeend', `
      <details class="event-detail-links event-detail-links-archive" data-event-detail-archive${archivedItems ? '' : ' hidden'}>
        <summary>${escapeHtml(COPY[lang].labels.archive)}</summary>
        <ul>${archivedItems}</ul>
      </details>
    `);
    await writeFile(file, html.serialize()); html.window.close();
  }
  shell.window.close(); page.window.close();
}
console.log('[event details] 24 localized pages and server-rendering assets built');
