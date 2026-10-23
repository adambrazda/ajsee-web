import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { renderEventFilters } from '../scripts/render-event-filters.mjs';
import { AI_SEARCH_COPY } from '../src/ai-search/ui-copy.js';
import { getAiEventSearchMarkup } from '../src/ai-search/ui-markup.js';
import { ensureSharedEventFiltersMarkup } from '../src/event-filters.js';
import { resolveAiSearchClientConfig } from '../src/ai-search/runtime-config.js';

const page = locale => `<!doctype html><html lang="${locale}"><body data-page="events"><form id="events-filters-form" class="events-filters filter-dock"><div class="ai-event-search" data-ai-static-intro><p class="ai-event-search__helper">AJSEE explanation</p></div></form><div id="demoBadge">Accommodation</div></body></html>`;

test('all six initial forms preserve controls, translations and runtime node identity', async () => {
  for (const locale of Object.keys(AI_SEARCH_COPY)) {
    const base = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url)));
    const html = renderEventFilters(page(locale), { locale, dictionary: base });
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const city = doc.getElementById('filter-city');
    assert.ok(city);
    assert.equal(doc.getElementById('chipToday').textContent.trim(), base.filters.today);
    assert.equal(city.placeholder, base.filters.cityPlaceholder);
    assert.equal(doc.getElementById('events-filters-form').dataset.ajseeFilterDetailsExpanded, 'false');
    city.value = 'Hodonín';
    ensureSharedEventFiltersMarkup(doc);
    ensureSharedEventFiltersMarkup(doc);
    assert.equal(doc.getElementById('filter-city'), city, 'enhancement must reuse the rendered controls');
    assert.equal(city.value, 'Hodonín');
    assert.equal(doc.querySelectorAll('#filter-city').length, 1);
    assert.ok(html.indexOf('data-event-filters-first-paint') < html.indexOf('id="demoBadge"'));
    dom.window.close();
  }
});

test('AI visibility matches the existing host/config contract before following content is parsed', () => {
  for (const locale of Object.keys(AI_SEARCH_COPY)) {
    for (const hostname of ['ajsee.cz', 'www.ajsee.cz', 'deploy-preview-243--ajsee-demo.netlify.app',
      '6adaea248cea0697568598a1--ajsee-demo.netlify.app', 'localhost', 'example.test']) {
      for (const enabled of ['', 'true']) {
        const config = { enabled, sitekey: 'public-configuration-fixture' };
        const html = renderEventFilters(page(locale), { locale, ...config }).replace('<div id="demoBadge">',
          '<script>window.atBanner={loading:document.readyState,ai:!!document.querySelector("[data-ai-first-paint]"),city:!!document.getElementById("filter-city")}</script><div id="demoBadge">');
        const dom = new JSDOM(html, { url: `https://${hostname}/events`, runScripts: 'dangerously' });
        const expected = resolveAiSearchClientConfig({ hostname, ...config }).enabled;
        assert.equal(dom.window.atBanner.loading, 'loading');
        assert.equal(dom.window.atBanner.city, true);
        assert.equal(dom.window.atBanner.ai, expected, hostname + ': ' + enabled);
        const doc = dom.window.document;
        if (expected) {
          assert.equal(doc.querySelector('[data-ai-search-label]').textContent, AI_SEARCH_COPY[locale].label);
          assert.equal(doc.querySelector('[data-ai-search-helper]').textContent, AI_SEARCH_COPY[locale].helper);
          assert.equal(doc.getElementById('ai-event-search-query').placeholder, AI_SEARCH_COPY[locale].placeholder);
          assert.equal(doc.getElementById('ai-event-search-query').disabled, true);
          const placeholder = doc.querySelector('[data-ai-first-paint]');
          const actual = JSDOM.fragment(getAiEventSearchMarkup('', locale));
          for (const element of placeholder.querySelectorAll('[disabled]')) element.removeAttribute('disabled');
          assert.equal(placeholder.innerHTML, (() => { const container = doc.createElement('div'); container.append(actual); return container.innerHTML; })());
        } else assert.ok(doc.querySelector('[data-ai-static-intro]').textContent.includes('AJSEE explanation'));
        assert.ok(!html.includes(config.sitekey), 'build HTML must not serialize the configured key');
        dom.window.close();
      }
    }
  }
});
