import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import { CATALOGUE_AI_HASH, navigateToCatalogue, readCatalogueTransfer } from '../src/catalogue-search.js';
import { formatAiResultSummary } from '../src/ai-search/result-summary.js';
import { MAX_CLARIFICATION_ROUNDS, normalizeClarificationContext } from '../src/ai-search/clarification-context.js';
import { formatLocalIsoWithOffset, resolveAiSearchClientConfig } from '../src/ai-search/runtime-config.js';
import { trackAiSearchOutcome, trackAiSearchStep } from '../src/ai-search/analytics.js';
import { getAiSearchCopy } from '../src/ai-search/copy.js';
import { recognizeFallbackFilters } from '../src/ai-search/fallback-filters.js';
import { renderAiSearchIdleMarkup } from '../src/ai-search/idle-markup.js';
import { isOpenEndedSearch, needsSearchGuidance } from '../src/ai-search/search-guidance.js';
import { mapIntentToFilters, selectCatalogueRefinementFilters } from '../src/ai-search/intent-to-filters.js';
import { resolveIntentRequirements } from '../src/ai-search/requirement-resolver.js';
import { materializeSearchPlan } from '../src/ai-search/search-plan-materializer.js';
import { materializedPlanToRuntimeFilters } from '../src/ai-search/runtime-filter-state.js';

const source = readFileSync(new URL('../src/ai-search/ui-controller.js', import.meta.url), 'utf8');
const body = parse(source, { sourceType: 'module', ecmaVersion: 'latest' }).body
  .filter(node => node.type !== 'ImportDeclaration')
  .map(node => node.declaration && node.type === 'ExportNamedDeclaration' ? node.declaration : node)
  .map(node => source.slice(node.start, node.end))
  .join('\n')
  .replaceAll('import.meta.env', 'undefined');

const homeSource = readFileSync(new URL('../src/home-entry.js', import.meta.url), 'utf8');
const transferFunction = parse(homeSource, { sourceType: 'module', ecmaVersion: 'latest' }).body
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'transferHomeAiSearch');

const QUERY = 'koncert v Ostravě tento víkend do 800 Kč';
const flush = () => new Promise(resolve => setImmediate(resolve));
const result = (intent = { category: 'concert' }, needsClarification = false) => ({
  ok: true, status: 200, json: async () => ({ ok: true, intent, needsClarification })
});

function fixture(testContext, { consent = false, widgetReady = true, fetchResult = () => result(), home = false, transfer = null } = {}) {
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
  win.localStorage.setItem('ajsee_cookie_consent_v1', JSON.stringify({ analytics: consent }));
  win.gtag = (...args) => analytics.push(args);
  win.setTimeout = (handler, delay) => {
    deadlines.set(delay, handler);
    return delay;
  };
  win.clearTimeout = delay => deadlines.delete(delay);

  const navigation = [];
  const navigationTarget = {
    location: {
      origin: win.location.origin,
      assign(url) {
        this.href = url;
        navigation.push(url);
      }
    },
    sessionStorage: win.sessionStorage,
    history: win.history
  };
  const homeDependencies = {
    navigateToCatalogue: context => navigateToCatalogue(context, navigationTarget),
    mapIntentToFilters, selectCatalogueRefinementFilters, resolveIntentRequirements,
    materializeSearchPlan, materializedPlanToRuntimeFilters,
    createSuggestCitiesResolver: () => undefined,
    acquireGeolocation: undefined,
    nearMeLabel: () => 'V mém okolí'
  };
  const transferHomeAiSearch = new Function(...Object.keys(homeDependencies),
    'return ' + homeSource.slice(transferFunction.start, transferFunction.end))(...Object.values(homeDependencies));

  const dependencies = {
    document,
    globalThis: win,
    fetch: (url, options) => {
      calls.push({ url, ...options });
      return fetchResult(options);
    },
    formatAiResultSummary, MAX_CLARIFICATION_ROUNDS, normalizeClarificationContext, formatLocalIsoWithOffset, resolveAiSearchClientConfig,
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
    onCatalogueSearch: home ? transferHomeAiSearch : null,
    onFallback: context => {
      fallback.push(context);
      if (home) navigateToCatalogue(context, navigationTarget);
    },
    initialQuery: transfer?.query,
    initialRefinement: transfer ? { question: transfer.question, previousIntent: transfer.clarificationIntent } : null
  });
  const input = form.querySelector('#ai-event-search-query');
  const submit = form.querySelector('[data-ai-search-submit]');
  const manual = form.querySelector('[data-ai-search-manual]');

  return {
    win, form, input, submit, manual, calls, analytics, fallback, applications, widgets, removed, deadlines, navigation, widgetApi,
    readTransfer: () => readCatalogueTransfer(navigationTarget),
    search(query = QUERY) {
      input.value = query;
      submit.click();
    }
  };
}

test('an open-ended home search opens guidance and an actionable example in the catalogue', async t => {
  const home = fixture(t, { home: true });
  home.search(' ');
  await flush();
  assert.equal(home.navigation.length, 0);

  home.search('Nevím, co hledám');
  await flush();
  const landing = new URL(home.navigation[0]);
  assert.equal(landing.pathname, '/events');
  assert.equal(landing.hash, CATALOGUE_AI_HASH);
  assert.equal(landing.search, '');
  assert.equal(home.widgets.length, 0);
  assert.equal(home.calls.length, 0);

  const ui = fixture(t, { transfer: home.readTransfer() });
  const example = ui.form.querySelector('[data-ai-search-guidance-example]');
  assert.equal(ui.input.value, 'Nevím, co hledám');
  assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, false);
  assert.match(ui.form.querySelector('[data-ai-search-status]').textContent, /město, termín nebo typ akce/);
  example.click();
  await flush();
  assert.equal(ui.input.value, 'Koncerty v Brně tento víkend');
  assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, true);
  ui.widgets[0].callback('test-token');
  await flush();
  assert.equal(ui.applications.length, 1);
});

test('an unconstrained service response redirects from home and preserves filters in the catalogue', async t => {
  for (const home of [true, false]) {
    const ui = fixture(t, { home, fetchResult: () => result({ category: 'all', sort: 'relevance' }) });
    const originalUrl = ui.win.location.href;
    ui.search('Chtěl bych se nějak zabavit');
    await flush();
    ui.widgets[0].callback('test-token');
    await flush();
    assert.equal(ui.form.querySelector('[data-ai-search-guidance]').hidden, home);
    assert.equal(ui.applications.length, 0);
    assert.equal(ui.win.location.href, originalUrl);
    if (home) {
      assert.equal(new URL(ui.navigation[0]).hash, CATALOGUE_AI_HASH);
      assert.equal(ui.readTransfer().query, 'Chtěl bych se nějak zabavit');
    } else {
      assert.equal(ui.navigation.length, 0);
    }
  }
});

test('a home clarification places the question and partial filters in the catalogue and accepts a short reply', async t => {
  const query = 'koncert v Ostravě tento víkend do 800';
  const question = 'Myslíte maximální cenu 800 CZK?';
  const intent = {
    locale: 'cs', category: 'concert',
    place: { type: 'city', label: 'Ostrava', countryCode: 'CZ' },
    date: { type: 'preset', preset: 'weekend' },
    confidence: { overall: 0.95, category: 0.95, place: 0.95, date: 0.95 },
    unsupportedPreferences: [{ type: 'max_price', value: 800, currency: '' }],
    clarification: { required: true, question, fields: ['unsupportedPreferences'] }
  };
  const home = fixture(t, { home: true, fetchResult: () => result(intent, true) });
  home.search(query);
  await flush();
  home.widgets[0].callback('test-token');
  await flush();
  const landing = new URL(home.navigation[0]);
  assert.equal(landing.hash, CATALOGUE_AI_HASH);
  assert.equal(landing.searchParams.get('segment'), 'concert');
  assert.equal(landing.searchParams.get('city'), 'Ostrava');
  assert.ok(landing.searchParams.get('from'));
  assert.equal(landing.searchParams.has('priceMax'), false);
  assert.equal(landing.searchParams.has('q'), false);

  const transfer = home.readTransfer();
  const ui = fixture(t, { transfer });
  assert.equal(ui.form.querySelector('[data-ai-search-status]').textContent, question);
  assert.equal(ui.form.querySelector('[data-ai-search-helper]').textContent, query);
  assert.equal(ui.input.value, '');
  ui.search('800 Kč');
  await flush();
  ui.widgets[0].callback('test-token');
  await flush();
  const body = JSON.parse(ui.calls[0].body);
  assert.equal(body.query, '800 Kč');
  assert.deepEqual(body.clarificationContext, { originalQuery: query, question, round: 1, previousIntent: intent });
  assert.equal(ui.applications.length, 1);

  const edit = fixture(t, { transfer });
  edit.form.querySelector('[data-ai-search-clarification-edit]').click();
  assert.equal(edit.input.value, query);
  assert.equal(edit.form.querySelector('[data-ai-search-clarification-actions]').hidden, true);
  assert.equal(edit.calls.length, 0);
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
  assert.deepEqual(ui.analytics.filter(([, event]) => event !== 'ai_event_search_result').map(([, event]) => event), [
    'ai_event_search_start', 'ai_event_search_challenge', 'ai_event_search_fallback', 'ai_event_search_start'
  ]);
  assert.equal(ui.analytics.find(([, event]) => event === 'ai_event_search_result')[2].outcome, 'manual');
  assert.equal(ui.analytics.find(([, event]) => event === 'ai_event_search_fallback')[2].fallback_reason, 'manual');
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
  assert.equal(ui.analytics.at(-1)[2].page_location, ui.win.location.origin + '/en/events/');
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
