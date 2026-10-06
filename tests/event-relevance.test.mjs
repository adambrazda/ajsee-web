import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventRelevanceScorer, hasAiRelevance, providerSearchFilters, rankEventsByRelevance, readAiSearchParams, syncAiSearchParams, updateManualKeyword } from '../src/search/event-relevance.js';
import { createEmptyFilterIntent, validateFilterIntent } from '../src/ai-search/intent-schema.js';
import { mapIntentToFilters } from '../src/ai-search/intent-to-filters.js';
import { formatAiResultSummary } from '../src/ai-search/result-summary.js';

const exact = { searchMode: 'exact', keywordMatch: 'strict', keyword: 'Céline Dion', sort: 'relevance' };
const discovery = { searchMode: 'discovery', keywordMatch: 'soft', keyword: 'rock musical', sort: 'relevance' };

test('exact title outranks earlier description-only match; ranking ignores commission', () => {
  const events = [
    { id: 'description', title: 'Tribute night', description: 'Songs by Céline Dion', date: '2026-10-01', commission: 1000 },
    { id: 'phrase', title: 'Céline Dion live', date: '2026-10-02' },
    { id: 'exact', title: { fr: 'CÉLINE DION' }, date: '2026-10-03', commission: 0 }
  ];
  assert.deepEqual(rankEventsByRelevance(events, exact).map(e => e.id), ['exact', 'phrase', 'description']);
  assert.equal(events[0].id, 'description');
});

test('whole words and diacritics: eros does not match Aerosmith', () => {
  const score = createEventRelevanceScorer({ ...exact, keyword: 'eros' });
  assert.equal(score({ title: 'Aerosmith' }), 0);
  assert.ok(score({ title: 'Eros Ramazzotti' }) > 0);
});

test('multilingual genre hints rank evidence without excluding unmatched candidates', () => {
  const events = [
    { id: 'unknown', title: 'Evening show', date: '2026-10-01' },
    { id: 'partial', title: 'Rock concert', date: '2026-10-02' },
    { id: 'best', title: 'Rockový muzikál', date: '2026-10-03' }
  ];
  assert.deepEqual(rankEventsByRelevance(events, discovery).map(e => e.id), ['best', 'partial', 'unknown']);
});

test('empty or unsupported hint falls back to date, missing dates last, ties stable', () => {
  const events = [{ id: 0 }, { id: 1, date: '2026-10-02' }, { id: 2, date: '2026-10-01' }, { id: 3, date: '2026-10-01' }];
  for (const keyword of ['', 'romantic']) {
    assert.deepEqual(rankEventsByRelevance(events, { ...discovery, keyword }).map(e => e.id), [2, 3, 1, 0]);
  }
});

test('soft keywords cannot leak through legacy aliases to providers; hard constraints stay', () => {
  const filters = { ...discovery, q: 'rock', search: 'rock', city: 'Praha', dateFrom: '2026-10-06', category: 'theatre', maxPrice: 1000, countryCode: 'CZ' };
  assert.deepEqual(providerSearchFilters(filters), { ...filters, keyword: '', q: '', search: '' });
  assert.equal(providerSearchFilters(exact), exact);
  const classic = { keyword: 'rock' };
  assert.equal(providerSearchFilters(classic), classic);
  assert.equal(hasAiRelevance({ sort: 'relevance' }), false);
});

test('URL roundtrip keeps discovery soft; malformed pair fails closed', () => {
  const params = new URLSearchParams();
  syncAiSearchParams(params, discovery);
  assert.deepEqual(readAiSearchParams(params), { searchMode: 'discovery', keywordMatch: 'soft' });
  params.set('keywordMatch', 'strict');
  assert.deepEqual(readAiSearchParams(params), {});
  syncAiSearchParams(params, {});
  assert.equal(params.toString(), '');
});

test('manual keyword edit restores conventional matching; unchanged hint survives other edits', () => {
  const filters = { ...discovery };
  updateManualKeyword(filters, filters.keyword);
  assert.deepEqual(filters, discovery);
  updateManualKeyword(filters, 'Mamma Mia');
  assert.deepEqual(filters, { keyword: 'Mamma Mia', sort: 'nearest' });
});

test('legacy intents remain strict; inconsistent mode and non-string keyword are rejected', () => {
  const legacy = { ...createEmptyFilterIntent(), keyword: 'Mamma Mia' };
  assert.equal(mapIntentToFilters(legacy).filters.keywordMatch, 'strict');
  assert.equal(mapIntentToFilters(legacy).filters.sort, 'nearest');
  assert.equal(validateFilterIntent({ ...legacy, ...discovery }).ok, true);
  for (const bad of [{ searchMode: 'exact', keywordMatch: 'soft' }, { searchMode: 'discovery', keywordMatch: 'strict' }, { keyword: {} }, { searchMode: 'invented' }]) {
    assert.equal(validateFilterIntent({ ...legacy, ...bad }).ok, false);
  }
});

test('result summary labels loaded lower bounds without claiming total inventory', () => {
  for (const locale of ['cs','sk','en','de','pl','hu']) {
    assert.match(formatAiResultSummary({ resultCount: 20, resultCountIsLowerBound: true }, locale), /20\+/);
    assert.match(formatAiResultSummary({ resultCount: 0 }, locale), /0\./);
  }
  assert.equal(formatAiResultSummary({ resultCount: -1 }), '');
});
