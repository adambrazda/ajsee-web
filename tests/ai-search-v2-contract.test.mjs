import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEmptyFilterIntent } from '../src/ai-search/intent-schema.js';
import { mapIntentToFilters } from '../src/ai-search/intent-to-filters.js';
import { materializeSearchPlan } from '../src/ai-search/search-plan-materializer.js';
import { materializedPlanToRuntimeFilters } from '../src/ai-search/runtime-filter-state.js';
import { providerSearchFilters } from '../src/search/event-relevance.js';
import { buildFilterIntentJsonSchema } from '../netlify/functions/ai-event-search.js';

const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/ai-search-v2-queries.json', import.meta.url)));
// Reference intents test downstream contracts, NOT live LLM interpretation.
// The same queries are the manual/live-model acceptance set documented in the PR.
for (const fixture of cases) {
  test(`reference intent ${fixture.id}: ${fixture.query}`, () => {
    const empty = createEmptyFilterIntent(fixture.locale);
    const intent = { ...empty, ...fixture.expected, place: { ...empty.place, ...fixture.expected.place } };
    const plan = mapIntentToFilters(intent);
    const runtime = materializedPlanToRuntimeFilters(materializeSearchPlan(plan));
    assert.equal(runtime.sort, 'relevance');
    assert.equal(runtime.city, fixture.expected.place.label);
    assert.equal(runtime.countryCode, fixture.expected.place.countryCode);
    assert.equal(runtime.category, fixture.expected.category);
    assert.equal(runtime.keyword, fixture.expected.keyword);
    assert.equal(providerSearchFilters(runtime).keyword, fixture.expected.keywordMatch === 'soft' ? '' : fixture.expected.keyword);
  });
}

test('strict model schema requires searchMode/keywordMatch and exposes relevance', () => {
  const schema = buildFilterIntentJsonSchema('cs');
  assert.equal(schema.additionalProperties, false);
  for (const key of ['searchMode','keywordMatch']) assert.ok(schema.required.includes(key));
  assert.deepEqual(schema.properties.searchMode.enum, ['exact','discovery']);
  assert.ok(schema.properties.sort.enum.includes('relevance'));
});
