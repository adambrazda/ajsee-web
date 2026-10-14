import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parse } from 'acorn';
import * as place from '../../src/event-place-runtime.js';
import * as price from '../../src/event-price.js';
import * as canonical from '../../src/city/canonical.js';
import * as catalog from '../../src/city/eventCityCatalog.js';
import * as relevance from '../../src/search/event-relevance.js';
import * as country from '../../src/event-country.js';
import * as listing from '../../src/event-search-listing.js';
import * as ux from '../../src/events-filter-ux.js';

// Exercise the real entry-point functions with their actual shared modules,
// without bootstrapping identity, analytics, or live provider traffic.
export function entryRuntime(file, { query = '', locale = 'cs', cookie = '' } = {}) {
  const source = readFileSync(new URL('../../src/' + file, import.meta.url), 'utf8');
  const body = parse(source, { sourceType: 'module', ecmaVersion: 'latest' }).body;
  const functions = body.filter(n => n.type === 'FunctionDeclaration');
  const names = new Set(['CITY_SYNONYMS', 'LANGS', 'slugList', 'normKey', 'currentFilters', 'nearMeLabel', 'announce', '_lastEventsEmptyStateViewSignature']);
  const variables = body.filter(n => n.type === 'VariableDeclaration' && n.declarations.every(d => names.has(d.id.name)));
  const dom = new JSDOM(`<html lang="${locale}"><body><div id="eventsResultsCount"></div><div id="eventsList"></div>
    <form><select id="filter-category"><option value="all">all</option><option value="theatre">theatre</option></select>
    <input id="filter-city"><input id="filter-date-from"><input id="filter-date-to"><input id="filter-keyword">
    <input id="filter-price-max"><select id="filter-price-currency"><option value="CZK">CZK</option><option value="EUR">EUR</option></select></form></body></html>`,
    { url: 'https://ajsee.test/' + query });
  if (cookie) dom.window.document.cookie = cookie;
  dom.window.translations = JSON.parse(readFileSync(new URL(`../../src/locales/${locale}.json`, import.meta.url), 'utf8'));
  const renders = [];
  const deps = { ...place, ...price, ...canonical, ...catalog, ...relevance, ...country, ...listing, ...ux,
    window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history,
    URL, URLSearchParams, console, requestAnimationFrame: () => 0,
    _userInteractedWithFilters: false, _lastFetchSig: '',
    qs: (s, r = dom.window.document) => r.querySelector(s), qsa: (s, r = dom.window.document) => [...r.querySelectorAll(s)],
    renderStub: async () => { renders.push(true); }
  };
  for (const node of variables) for (const d of node.declarations) delete deps[d.id.name];
  const code = `let currentLang = ${JSON.stringify(locale)};
    ${functions.map(n => source.slice(n.start, n.end)).join('\n')}
    ${variables.map(n => source.slice(n.start, n.end)).join('\n')}
    renderAndSync = renderStub;
    expandFilters = () => {};
    if (typeof resetEventsPager === 'function') resetEventsPager = () => {};
    if (typeof updateEventsPagerControls === 'function') updateEventsPagerControls = () => {};
    currentFilters.countryCode = defaultCountryCodeForLang(currentLang);
    return { init: initFiltersFromURL, sync: syncURLFromFilters, form: syncFiltersFromForm,
      api: buildApiFilters, choose: input => buildCityTypeaheadOptions(input, currentLang),
      empty: ${file === 'home-entry.js' ? '() => renderHomeEmptyState()' : "() => renderEventsStateMessage('empty')"},
      read: () => JSON.parse(JSON.stringify(currentFilters)), set: next => Object.assign(currentFilters, next) };`;
  return { ...new Function(...Object.keys(deps), code)(...Object.values(deps)), dom, renders };
}
