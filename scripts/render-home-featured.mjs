import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { renderHomeFeaturedMarkup } from '../src/home-featured.js';
import { ensureSharedEventGridStyles } from '../src/event-card.js';

const snapshot = JSON.parse(await readFile('public/data/home-featured-events.json', 'utf8'));
const locales = new Map();
for (const language of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) locales.set(language, JSON.parse(await readFile(`src/locales/${language}.json`, 'utf8')));
let count = 0;
async function renderDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await renderDirectory(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    if (!/data-page=["']home["']/.test(html)) continue;
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const list = doc.getElementById('eventsList');
    if (!list) { dom.window.close(); continue; }
    const language = doc.documentElement.lang.slice(0, 2) || 'cs';
    const translations = locales.get(language) || locales.get('cs');
    const { markup } = renderHomeFeaturedMarkup(snapshot, language, { translate: (key, fallback) => translations[key] || fallback });
    list.innerHTML = markup;
    list.dataset.homeStaticFeatured = '1';
    // Do not briefly show editorial cards as the results of a bookmarked search.
    const guard = doc.createElement('script');
    guard.textContent = `if (['city','cityCc','country','countryCode','placeType','q','keyword','search','from','to','dateFrom','dateTo','segment','category','audience','sort','lat','lon','radius','priceMax','maxPrice','searchMode'].some(key => new URLSearchParams(location.search).has(key))) document.documentElement.setAttribute('data-home-search-requested','');`;
    doc.head.appendChild(guard);
    const guardStyle = doc.createElement('style');
    guardStyle.textContent = '[data-home-search-requested] #eventsList[data-home-static-featured] { visibility: hidden; }';
    doc.head.appendChild(guardStyle);
    const data = doc.createElement('script'); data.id = 'home-featured-data'; data.type = 'application/json';
    data.textContent = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    list.after(data);
    ensureSharedEventGridStyles(doc);
    doc.querySelector('#events noscript')?.remove();
    await writeFile(path, dom.serialize());
    dom.window.close(); count++;
  }
}
await renderDirectory('dist');
if (count < 6) throw new Error('Not all localized homepages received static recommendation cards');
console.log(`[home tips] Static cards and inline data rendered into ${count} homepages`);
