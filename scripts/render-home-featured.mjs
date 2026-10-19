import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { renderHomeFeaturedMarkup } from '../src/home-featured.js';
import { ensureSharedEventGridStyles } from '../src/event-card.js';

const snapshot = JSON.parse(await readFile('public/data/home-featured-events.json', 'utf8'));
const locales = new Map();
for (const language of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) locales.set(language, JSON.parse(await readFile(`src/locales/${language}.json`, 'utf8')));
let count = 0;
let eventCount = 0;
const STATIC_NOTE = {"cs":"Malý výběr z aktuální nabídky. Pro vyhledávání a úplný výpis zapněte JavaScript.","en":"A small selection of current events. Enable JavaScript to search and view the full list.","de":"Eine kleine Auswahl aktueller Veranstaltungen. Aktivieren Sie JavaScript für die Suche und die vollständige Liste.","sk":"Malý výber z aktuálnej ponuky. Na vyhľadávanie a úplný výpis zapnite JavaScript.","pl":"Mały wybór aktualnych wydarzeń. Włącz JavaScript, aby wyszukiwać i przeglądać pełną listę.","hu":"Válogatás az aktuális eseményekből. A kereséshez és a teljes listához engedélyezd a JavaScriptet."};
async function renderDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await renderDirectory(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    const isHome = /data-page=["']home["']/.test(html);
    const isEvents = /data-page=["']events["']/.test(html);
    if (!isHome && !isEvents) continue;
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const list = doc.getElementById('eventsList');
    if (!list) { dom.window.close(); continue; }
    const language = doc.documentElement.lang.slice(0, 2) || 'cs';
    const translations = locales.get(language) || locales.get('cs');
    const { markup } = renderHomeFeaturedMarkup(snapshot, language, { translate: (key, fallback) => translations[key] || fallback });
    if (isEvents) {
      list.innerHTML = '<div data-events-static><p class="events-static-note">' + STATIC_NOTE[language] + '</p><div class="events-list">' + markup + '</div></div>';
      list.querySelectorAll('[data-events-static] .event-image-action').forEach(node => node.remove());
      list.querySelectorAll('[data-events-static] .event-title-action').forEach(button => {
        const span = doc.createElement('span'); span.className = button.className.replace('js-event-detail',''); span.innerHTML = button.innerHTML; button.replaceWith(span);
      });
      doc.querySelector('#upcoming-events > noscript')?.remove();
      doc.querySelector('#upcoming-events')?.setAttribute('aria-busy','false');
      eventCount++;
    } else {
      list.innerHTML = markup;
      list.dataset.homeStaticFeatured = '1';
    }
    // Do not briefly show editorial cards as the results of a bookmarked search.
    const guard = doc.createElement('script');
    guard.textContent = `if (['city','cityCc','country','countryCode','placeType','q','keyword','search','from','to','dateFrom','dateTo','segment','category','audience','sort','lat','lon','radius','priceMax','maxPrice','searchMode'].some(key => new URLSearchParams(location.search).has(key))) document.documentElement.setAttribute('data-home-search-requested','');`;
    doc.head.appendChild(guard);
    const guardStyle = doc.createElement('style');
    guardStyle.textContent = '[data-home-search-requested] #eventsList[data-home-static-featured], [data-home-search-requested] #eventsList [data-events-static] { visibility: hidden; }';
    doc.head.appendChild(guardStyle);
    const data = doc.createElement('script'); data.id = isHome ? 'home-featured-data' : 'events-static-data'; data.type = 'application/json';
    data.textContent = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    list.after(data);
    ensureSharedEventGridStyles(doc);
    doc.querySelector('#events noscript')?.remove();
    await writeFile(path, dom.serialize());
    dom.window.close(); count++;
  }
}
await renderDirectory('dist');
if (count < 12 || eventCount < 6) throw new Error('Not all localized homepages received static recommendation cards');
console.log(`[home tips] Static cards rendered into ${count} pages (including ${eventCount} event pages)`);
