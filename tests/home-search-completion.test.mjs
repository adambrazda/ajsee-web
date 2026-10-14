import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { entryFunction } from './helpers/entry-function.mjs';

function count(total, options) {
  const dom = new JSDOM('<main><div id="eventsList"></div></main>', { url: 'https://ajsee.test/?city=Brno&priceMax=100' });
  const update = entryFunction('home-entry.js', 'updateResultsCount', {
    ensureHomeResultsCountCtaStyles() {}, document: dom.window.document, window: dom.window,
    qs: selector => dom.window.document.querySelector(selector), currentLang: 'cs',
    t: (key, fallback) => fallback
  });
  update(total, { isHomePreview: true, ...options });
  return dom;
}

test('a six-card AI preview still exposes continued coverage when its known count is six', () => {
  const dom = count(6, { visible: 6, hasMore: true, rankingPartial: true });
  const status = dom.window.document.querySelector('#eventsResultsCount');
  assert.match(status.textContent, /6\+/);
  assert.match(status.textContent, /dosud prohledané nabídky/);
  assert.equal(status.querySelector('a').textContent, 'Pokračovat v hledání');
  assert.equal(status.querySelector('a').getAttribute('href'), '/events/?city=Brno&priceMax=100');
  dom.window.close();
});

test('partial local results display the failure and offer a fresh search with the same filters', () => {
  const dom = count(2, { visible: 2, hasMore: false, incomplete: true });
  const status = dom.window.document.querySelector('#eventsResultsCount');
  assert.match(status.textContent, /2\+/);
  assert.match(status.textContent, /Nabídka je neúplná/);
  assert.equal(status.querySelector('a').textContent, 'Zkusit znovu');
  assert.equal(status.querySelector('a').getAttribute('href'), '/events/?city=Brno&priceMax=100');
  dom.window.close();
});

test('a complete small preview still discloses missing venue geography without a misleading continuation', () => {
  const dom = count(2, { visible: 2, hasMore: false, geographyLimited: true });
  const status = dom.window.document.querySelector('#eventsResultsCount');
  assert.match(status.textContent, /bez ověřené polohy/);
  assert.match(status.textContent, /podle města/);
  assert.equal(status.querySelector('a'), null);
  dom.window.close();
});
