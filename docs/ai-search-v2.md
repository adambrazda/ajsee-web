# AI Search v2 — first iteration

## Behaviour

Both the homepage and events listing use the same intent contract and lexical scorer.

- Exact searches retain the existing all-token prefix keyword filter at the provider and aggregation layers.
- Discovery keywords are ranking hints. All keyword aliases are removed before provider calls; city, country, category, audience, dates and price keep their existing filtering semantics.
- The parser defaults to relevance. Explicit chronological requests still work. Existing v1 intents without new fields keep strict keywords and their original sort.
- `keyword` stays a string. Additive `searchMode` and `keywordMatch` fields avoid breaking the existing form, clarification context and URL keyword representation. Invalid mode/match combinations are rejected.
- Relevance uses title, artist/production when present, venue, taxonomy and description evidence, with a small explicit multilingual genre vocabulary. Date and stable input order break ties. No second model call, popularity inference or commission boost.
- Previously displayed event pages stay fixed. New provider batches rank only unseen candidates, preventing duplicate cards caused by shifting page boundaries.
- Classical searches retain their default chronological order. Editing an AI keyword restores ordinary strict matching. Changing other filters preserves the hint; clearing all filters removes AI context.
- URL roundtrips and the homepage full-results link preserve mode/matching. The extra relevance button appears only with AI search context. Buttons use native keyboard behaviour and `aria-pressed`.

## Counts and telemetry

The status reports **loaded events**, not a claimed total inventory. Counts can be lower bounds. Homepage counts are always treated as preview lower bounds. Listing counts reflect its existing incremental loader.

With analytics consent, `filters_applied.searchMetrics` contains only:

- `result_count`: count loaded after filtering on the initial applied render.
- `zero_results`: whether that loaded result count is zero.
- `result_count_is_lower_bound`: additional candidates may exist.
- `search_mode`: exact/discovery.
- `strict_keyword_present`: boolean.

The client allowlists these fields; the server validates types, keys and consistency. No raw query, hint or location text is added to telemetry. Existing click positions, feedback and correction tracking remain. A caught render error or a known Ticketmaster cooldown with no results does not create a successful AI learning session.

## Limits / acceptance before merge

This is lexical ranking of **retrieved candidates**, not global ranking of all provider inventory. Providers still paginate by date and can cap or partially fail requests. `zero_results` therefore measures the loaded result set, not proof that no matching event exists anywhere. The existing loader does not expose complete per-provider coverage; interpret this metric alongside failures and lower-bound flags.

Unsupported moods, fame, romantic suitability and inferred similarity remain unsupported preferences. This release cannot infer that a show is suitable for a particular person. Time of day and new zero-result recovery actions are outside this iteration. Disabled SeatPlan/ColosseumTicket integrations stay disabled.

`tests/fixtures/ai-search-v2-queries.json` contains 60 natural-language queries (10 per locale) with reference intents. Automated tests validate their downstream mapping and provider contracts. They **do not call the live model** and must not be presented as measured multilingual parser accuracy.

Before merge, run the query set on the deploy preview with the configured model and normal Turnstile flow. Check reference intent dimensions (city aliases may normalize), exact/discovery, explicit dates/budgets, clarification, and unchanged hard constraints. Also try “something for a Mamma Mia fan”, unsupported mood requests, mobile sort wrapping, keyboard activation, reset, reload and homepage → events navigation. No production deployment or merge is part of this draft.

## Validation

- `npm run ai-search:test` runs the AI regression suites, relevance tests, provider integration fixtures and reference intent cases. The same gate is included in `prebuild`.
- Related homepage/filter/price/taxonomy tests and the CSS priority guard are checked separately.
- `npx vite build` verifies the frontend build without running live feed synchronization. It is not a full Netlify deployment test.
- Known baseline failure at base commit `fb3a1571685f167232b24f5457bbfb33a8d32968`: `tests/provider-isolation.test.mjs` expects a ColosseumTicket request although `ENABLE_COLOSSEUMTICKET` is false. Reproduced on the unchanged base; not repaired by enabling an intentionally disabled provider.
