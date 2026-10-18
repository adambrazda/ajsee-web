import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { entryFunction } from './helpers/entry-function.mjs';

const expected = {
  cs: { previous: 'Zpět', next: 'Další', loading: 'Načítám…' },
  en: { previous: 'Previous', next: 'Next', loading: 'Loading…' },
  de: { previous: 'Zurück', next: 'Weiter', loading: 'Wird geladen…' },
  sk: { previous: 'Späť', next: 'Ďalej', loading: 'Načítavam…' },
  pl: { previous: 'Wstecz', next: 'Dalej', loading: 'Wczytywanie…' },
  hu: { previous: 'Előző', next: 'Következő', loading: 'Betöltés…' }
};

function locale(directory, language) {
  return JSON.parse(readFileSync(new URL(`../${directory}/locales/${language}.json`, import.meta.url), 'utf8'));
}

function controls(language) {
  const dom = new JSDOM('<div id="eventsPager"></div>');
  const host = dom.window.document.querySelector('#eventsPager');
  const runtimeWindow = { translations: locale('src', language) };
  const getByPath = entryFunction('events-entry.js', 'getByPath', {});
  const t = entryFunction('events-entry.js', 't', { window: runtimeWindow, getByPath });
  const pagination = { page: 1, perPage: 20 };
  const eventsPager = {
    buffer: Array.from({ length: 45 }, (_, id) => ({ id })),
    hasMore: false, loading: false, totalKnown: 45
  };
  const update = entryFunction('events-entry.js', 'updateEventsPagerControls', {
    isHome: () => false, injectOnce() {}, ensureEventsPagerHost: () => host,
    pagination, eventsPager, t, esc: String, eventsPagerLabel: () => '1-20 / 45',
    renderAndSync: async () => {}, scrollToSharedEventResults() {}, _userInteractedWithFilters: false
  });
  update();
  return { dom, host, runtimeWindow, pagination, eventsPager, update };
}

for (const [language, copy] of Object.entries(expected)) {
  test(`${language}: pagination translations exist in source and published dictionaries`, () => {
    for (const directory of ['src', 'public']) {
      assert.deepEqual(locale(directory, language).pagination, copy, `${directory}/${language}`);
    }
  });

  test(`${language}: the actual pager renders translated previous and next controls`, t => {
    const c = controls(language);
    t.after(() => c.dom.window.close());
    const labels = () => [
      c.host.querySelector('[data-events-page-prev]').textContent.trim(),
      c.host.querySelector('[data-events-page-next]').textContent.trim()
    ];
    assert.deepEqual(labels(), [copy.previous, copy.next]);
    assert.equal(c.host.querySelector('[data-events-page-prev]').disabled, true);
    c.pagination.page = 2;
    c.update();
    assert.deepEqual(labels(), [copy.previous, copy.next]);
    assert.equal(c.host.querySelector('[data-events-page-prev]').disabled, false);
  });

  test(`${language}: the loading label is translated`, t => {
    const c = controls(language);
    t.after(() => c.dom.window.close());
    c.eventsPager.loading = true;
    c.update();
    assert.equal(c.host.querySelector('[data-events-page-next]').textContent.trim(), copy.loading);
  });

  test(`${language}: continuation and retry keep using the selected language`, t => {
    const c = controls(language);
    t.after(() => c.dom.window.close());
    c.eventsPager.buffer = [];
    c.eventsPager.hasMore = true;
    c.eventsPager.incomplete = true;
    c.update();
    const dictionary = c.runtimeWindow.translations;
    assert.equal(c.host.querySelector('[data-events-page-next]').textContent.trim(), dictionary['events-search-continue']);
    assert.equal(c.host.querySelector('[data-events-search-retry]').textContent.trim(), dictionary['events-search-retry']);
    assert.ok(c.host.textContent.includes(dictionary['events-search-incomplete']));
  });
}

test('rerendering the pager after a language change replaces both labels', t => {
  const c = controls('en');
  t.after(() => c.dom.window.close());
  for (const [language, copy] of Object.entries(expected)) {
    c.runtimeWindow.translations = locale('src', language);
    c.update();
    assert.equal(c.host.querySelector('[data-events-page-prev]').textContent.trim(), copy.previous);
    assert.equal(c.host.querySelector('[data-events-page-next]').textContent.trim(), copy.next);
  }
});
