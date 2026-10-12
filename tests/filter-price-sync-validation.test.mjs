import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { entryFunction } from './helpers/entry-function.mjs';
import { normalizePriceFilterState, defaultPriceCurrencyForLocale } from '../src/event-price.js';
import { updateManualKeyword } from '../src/search/event-relevance.js';

for (const file of ['events-entry.js','home-entry.js']) test(`${file}: invalid price cannot mutate any filter during automatic synchronization`, () => {
  const dom = new JSDOM('<select id="filter-category"><option value="theatre">Theatre</option></select><input type="number" min="0" id="filter-price-max"><select id="filter-price-currency"><option value="CZK">CZK</option></select><div id="filter-price-error" hidden></div>');
  const qs = selector => dom.window.document.querySelector(selector);
  const state = { category: 'all', maxPrice: null, priceCurrency: '', city: '' };
  const common = { qs, currentFilters: state, currentLang: 'cs', defaultPriceCurrencyForLocale,
    normalizePriceFilterState, getCityInputEl: () => null, updateManualKeyword,
    updateDateComboLabel() {}, updateToggleBadge() {} };
  const validationState = entryFunction(file,'setPriceFilterValidationState',common);
  const validate = entryFunction(file,'validatePriceFilterInput',{...common,setPriceFilterValidationState:validationState});
  const sync = entryFunction(file,'syncFiltersFromForm',{...common,validatePriceFilterInput:validate});
  qs('#filter-price-max').value = '-100';
  assert.equal(sync(), false);
  assert.equal(state.category,'all'); assert.equal(state.maxPrice,null);
  assert.equal(qs('#filter-price-max').getAttribute('aria-invalid'),'true');
  qs('#filter-price-max').value='100';sync();
  assert.equal(state.category,'theatre');assert.equal(state.maxPrice,100);
  dom.window.close();
});

test('homepage does not present a partially known count as an exact total',()=>{
  const dom = new JSDOM('<div><div id="eventsList"></div></div>',{url:'https://ajsee.test/en/?city=Praha'});
  const update = entryFunction('home-entry.js','updateResultsCount',{
    document:dom.window.document,window:dom.window,currentLang:'en',
    qs:selector=>dom.window.document.querySelector(selector),ensureHomeResultsCountCtaStyles(){},
    t:(key,fallback)=>key==='events-search-continue'?'Continue searching':fallback
  });
  update(47,{visible:6,isHomePreview:true,hasMore:true});
  assert.match(dom.window.document.querySelector('#eventsResultsCount').textContent,/6 of 47\+/);
  assert.equal(dom.window.document.querySelector('.events-results-count__cta').textContent,'Continue searching');
  assert.equal(dom.window.document.querySelector('.events-results-count__cta').getAttribute('href'),'/en/events/?city=Praha');
  dom.window.close();
});
