import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import { navigateToCatalogue } from '../src/catalogue-search.js';
import { formatAiResultSummary } from '../src/ai-search/result-summary.js';
import { MAX_CLARIFICATION_ROUNDS } from '../src/ai-search/clarification-context.js';
import { formatLocalIsoWithOffset, resolveAiSearchClientConfig } from '../src/ai-search/runtime-config.js';
import { trackAiSearchOutcome, trackAiSearchStep } from '../src/ai-search/analytics.js';
import { getAiSearchCopy } from '../src/ai-search/copy.js';
import { recognizeFallbackFilters } from '../src/ai-search/fallback-filters.js';
import { renderAiSearchIdleMarkup } from '../src/ai-search/idle-markup.js';
import { isOpenEndedSearch, needsSearchGuidance } from '../src/ai-search/search-guidance.js';

const source = readFileSync(new URL('../src/ai-search/ui-controller.js', import.meta.url), 'utf8');
const body = parse(source, { sourceType: 'module', ecmaVersion: 'latest' }).body
  .filter(node => node.type !== 'ImportDeclaration')
  .map(node => node.declaration && node.type === 'ExportNamedDeclaration' ? node.declaration : node)
  .map(node => source.slice(node.start, node.end))
  .join('\n')
  .replaceAll('import.meta.env', 'undefined');

const QUERY = 'koncert v Ostravě tento víkend do 800 Kč';
const flush = () => new Promise(resolve => setImmediate(resolve));
const result = (intent = { category: 'concert' }, needsClarification = false) => ({
  ok: true, status: 200, json: async () => ({ ok: true, intent, needsClarification })
});

function fixture(testContext, { consent = false, widgetReady = true, fetchResult = () => result(), home = false } = {}) {
  const dom = new JSDOM('<html lang="cs"><body><form id="events-filters-form"></form></body></html>', {
    url: 'https://deploy-preview-1--ajsee-demo.netlify.app' + (home ? '/' : '/en/events/?city=Ostrava')
  });
  testContext.after(() => dom.window.close());
  const win = dom.window;
  const { document } = win;
  if (home) document.body.dataset.page = 'home';
  const calls = [];
  const removed = [];
  const widgets = [];
  const analytics = [];
  const fallback = [];
  const applications = [];
  const deadlines = new Map();
  const widgetApi = {
    render(container, options) {
      widgets.push(options);
      return widgets.length - 1;
    },
    execute() {},
    remove(id) { removed.push(id); }
  };
  if (widgetReady) win.turnstile = widgetApi;
  win.gtag = (...args) => analytics.push(args);
  win.setTimeout = (handler, delay) => {
    deadlines.set(delay, handler);
    return delay;
  };
  win.clearTimeout = delay => deadlines.delete(delay);

  const navigation = [];
  const navigationTarget = {
    location: { origin: win.location.origin, assign: url => navigation.push(url) },
    sessionStorage: win.sessionStorage
  };
  const dependencies = {
    document,
    globalThis: win,
    fetch: (url, options) => {
      calls.push({ url, ...options });
      return fetchResult(options);
    },
    formatAiResultSummary, MAX_CLARIFICATION_ROUNDS, formatLocalIsoWithOffset, resolveAiSearchClientConfig,
    trackAiSearchOutcome, trackAiSearchStep, getAiSearchCopy, recognizeFallbackFilters, renderAiSearchIdleMarkup,
    isOpenEndedSearch, needsSearchGuidance,
    hasAnalyticsConsent: () => consent,
    recordAiSearchFeedback: () => false,
    aiBrandMark: '<svg></svg>'
  };
  const initialize = new Function(...Object.keys(dependencies), body + '\nreturn initAiEventSearch;');
  const initAiEventSearch = initialize(...Object.values(dependencies));
  const form = document.querySelector('form');
  initAiEventSearch({
    form,
    onIntent: intent => applications.push(intent),
    onCatalogueSearch: home ? ({ intent }) => {
      applications.push(intent);
      return 'success';
    } : null,
    onFallback: context => {
      fallback.push(context);
      if (home) navigateToCatalogue(context, navigationTarget);
    }
  });
  const input = form.querySelector('#ai-event-search-query');
  const submit = form.querySelector('[data-ai-search-submit]');
  const manual = form.querySelector('[data-ai-search-manual]');

  return {
    win, form, input, submit, manual, calls, analytics, fallback, applications, widgets, removed, deadlines, navigation, widgetApi,
    search(query = QUERY) {
      input.value = query;
      submit.click();
    }
  };
}

test('an open-ended home search stays in the form and offers an actionable example', async t => {
  const ui = fixture(t, { home: true });
  const example = ui.form.querySelector('[data-ai-search-guidance-example]');
  ui.search('Nevím, co hledám');
  assert.equal(ui.input.value, 'Nevím, co hledám');
  assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, false);
  assert.match(ui.form.querySelector('[data-ai-search-status]').textContent, /městem, termínem nebo typem/);
  assert.equal(ui.widgets.length, 0);
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.applications.length, 0);

  example.click();
  await flush();
  assert.equal(ui.input.value, 'Koncerty v Brně tento víkend');
  assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, true);
  ui.widgets[0].callback('test-token');
  await flush();
  assert.equal(ui.applications.length, 1);
});

test('an unconstrained service response leaves both pages on their current filters', async t => {
  for (const home of [true, false]) {
    const ui = fixture(t, { home, fetchResult: () => result({ category: 'all', sort: 'relevance' }) });
    const originalUrl = ui.win.location.href;
    ui.search('Chtěl bych se nějak zabavit');
    await flush();
    ui.widgets[0].callback('test-token');
    await flush();
    assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, false);
    assert.equal(ui.applications.length, 0);
    assert.equal(ui.navigation.length, 0);
    assert.equal(ui.win.location.href, originalUrl);
  }
});

test('manual fallback appears during verification and ignores late widget callbacks', async t => {
  const ui = fixture(t, { consent: true, home: true });
  assert.equal(ui.manual.hidden, true);
  ui.search();
  assert.equal(ui.manual.hidden, false);
  assert.match(ui.manual.textContent, /Hledat pomocí filtrů/);
  await flush();

  const [first] = ui.widgets;
  first['before-interactive-callback']();
  first['before-interactive-callback']();
  ui.manual.click();
  await flush();

  assert.equal(ui.fallback.length, 1);
  assert.equal(ui.fallback[0].reason, 'manual');
  assert.equal(ui.manual.hidden, true);
  assert.deepEqual(ui.removed, [0]);
  assert.equal(ui.calls.length, 0);
  const landing = new URL(ui.navigation[0]);
  assert.equal(landing.searchParams.get('city'), 'Ostrava');
  assert.equal(landing.searchParams.get('segment'), 'concert');
  assert.equal(landing.searchParams.has('q'), false);

  ui.search('divadlo v Praze');
  await flush();
  first.callback('stale-token');
  await flush();
  assert.equal(ui.calls.length, 0);
  ui.widgets[1].callback('current-test-token');
  await flush();
  assert.equal(ui.calls.length, 1);
  assert.equal(JSON.parse(ui.calls[0].body).turnstileToken, 'current-test-token');
  assert.equal(ui.fallback.length, 1);
  assert.deepEqual(ui.analytics.map(([, event]) => event), [
    'ai_event_search_start', 'ai_event_search_challenge', 'ai_event_search_fallback', 'ai_event_search_start'
  ]);
  assert.equal(ui.analytics[2][2].fallback_reason, 'manual');
  assert.doesNotMatch(JSON.stringify(ui.analytics), /Ostrava|800|stale-token|current-test-token/);
});

test('manual fallback works before the Turnstile script loads', async t => {
  const ui = fixture(t, { widgetReady: false });
  ui.search();
  assert.equal(ui.manual.hidden, false);
  const script = ui.win.document.querySelector('[data-ajsee-turnstile-api]');
  assert.ok(script);
  ui.manual.click();
  await flush();
  assert.equal(ui.fallback[0].reason, 'manual');
  ui.win.turnstile = ui.widgetApi;
  script.dispatchEvent(new ui.win.Event('load'));
  await flush();
  assert.equal(ui.widgets.length, 0);
  assert.equal(ui.calls.length, 0);
});

test('widget timeout opens filters with the draft and sends no telemetry without consent', async t => {
  const ui = fixture(t);
  ui.search(' ');
  await flush();
  assert.equal(ui.manual.hidden, true);
  assert.equal(ui.widgets.length, 0);

  ui.search();
  await flush();
  ui.widgets[0]['before-interactive-callback']();
  ui.deadlines.get(30_000)();
  await flush();
  assert.equal(ui.fallback[0].reason, 'verification-timeout');
  assert.equal(ui.fallback[0].notice, 'failed');
  assert.equal(ui.fallback[0].query, QUERY);
  assert.equal(ui.input.value, QUERY);
  assert.deepEqual(ui.fallback[0].fallbackFields, ['category', 'city']);
  assert.equal(ui.navigation.length, 0);
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.analytics.length, 0);
  assert.equal(ui.win.dataLayer, undefined);
});

test('API error on a follow-up keeps the original draft and clears clarification', async t => {
  let requests = 0;
  const ui = fixture(t, {
    consent: true,
    fetchResult: () => ++requests === 1
      ? result({ clarification: { question: 'Myslíte Ostravu?' } }, true)
      : { ok: false, status: 503, json: async () => ({ ok: false }) }
  });
  ui.search();
  await flush();
  ui.widgets[0].callback('test-token');
  await flush();
  const yes = ui.form.querySelector('[data-ai-search-clarification-yes]');
  yes.click();
  await flush();
  ui.widgets[1].callback('test-token-2');
  await flush();
  assert.equal(ui.fallback[0].reason, 'service-error');
  assert.equal(ui.fallback[0].query, QUERY);
  assert.equal(ui.input.value, QUERY);
  assert.equal(ui.form.querySelector('[data-ai-search-clarification-actions]').hidden, true);
  assert.equal(ui.analytics.at(-1)[2].page_location, ui.win.location.origin + '/events');
});

test('API response timeout cancels the request and routes to filters once', async t => {
  const ui = fixture(t, {
    fetchResult: ({ signal }) => ({
      ok: true, status: 200,
      json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
    })
  });
  ui.search();
  await flush();
  ui.widgets[0].callback('test-token');
  await flush();
  assert.equal(ui.manual.hidden, true);
  ui.deadlines.get(20_000)();
  await flush();
  assert.equal(ui.calls[0].signal.aborted, true);
  assert.equal(ui.fallback.length, 1);
  assert.equal(ui.fallback[0].reason, 'service-timeout');
});
