import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiSearchLearningTracker } from '../src/ai-search/learning.js';
import { createAiSearchLearningHandler } from '../netlify/functions/ai-search-learning.js';

const metrics = { result_count: 0, zero_results: true, result_count_is_lower_bound: false, search_mode: 'discovery', strict_keyword_present: false };
function payload(consent = true) {
  const posted = [];
  const tracker = createAiSearchLearningTracker({ consentProvider: () => consent, fetchImpl: async (_, options) => { posted.push(JSON.parse(options.body)); return { ok: true }; } });
  tracker.begin({ filters: { sort: 'relevance', keyword: 'private words', city: 'private city' }, searchMetrics: { ...metrics, query: 'private query' } });
  return posted;
}
async function send(body) {
  const stored = [];
  const handler = createAiSearchLearningHandler({ getStoreFn: () => ({ setJSON: async (_, value) => { stored.push(value); return { modified: true }; } }) });
  const response = await handler(new Request('https://ajsee.cz/api/ai-search-learning', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ajsee.cz' }, body: JSON.stringify(body) }));
  return { response, stored };
}
test('metrics roundtrip: consent, allowlist, relevance and no raw query', async () => {
  assert.deepEqual(payload(false), []);
  const [body] = payload();
  assert.deepEqual(body.searchMetrics, metrics);
  assert.doesNotMatch(JSON.stringify(body), /private/);
  const { response, stored } = await send(body);
  assert.equal(response.status, 202, await response.text());
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0].searchMetrics, metrics);
});
test('server rejects inconsistent or non-allowlisted metrics and accepts positive lower bounds', async () => {
  const [body] = payload();
  for (const invalid of [{ result_count: -1 }, { zero_results: false }, { result_count: 1.5 }, { query: 'secret' }, { search_mode: 'other' }]) {
    const { response } = await send({ ...body, searchMetrics: { ...metrics, ...invalid } });
    assert.equal(response.status, 400);
  }
  const { response } = await send({ ...body, searchMetrics: { ...metrics, result_count: 20, zero_results: false, result_count_is_lower_bound: true } });
  assert.equal(response.status, 202, await response.text());
});
