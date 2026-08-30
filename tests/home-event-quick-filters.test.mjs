import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(
  new URL(
    '../src/home-entry.js',
    import.meta.url
  ),
  'utf8'
);

test(
  'homepage quick dates use the canonical date preset helpers',
  () => {
    assert.match(
      home,
      /detectDatePreset/
    );

    assert.match(
      home,
      /getDatePresetRange/
    );

    assert.match(
      home,
      /function syncQuickDateButtons/
    );

    assert.match(
      home,
      /function applyQuickDatePreset/
    );
  }
);

test(
  'homepage carries family audience through state and form sync',
  () => {
    assert.match(
      home,
      /audience:\s*''/
    );

    assert.match(
      home,
      /#filter-audience-family/
    );

    assert.match(
      home,
      /currentFilters\.audience\s*=\s*active\s*\?\s*'family'\s*:\s*''/
    );
  }
);

test(
  'homepage wires every shared quick filter action',
  () => {
    for (const token of [
      '#chipToday',
      '#chipTomorrow',
      '#chipThisWeek',
      '#chipWeekend',
      '#chipClear',
      '#chipNearMe',
      'family-audience-click',
      'quick-near-me-click'
    ]) {
      assert.ok(
        home.includes(token),
        `missing quick-filter wiring: ${token}`
      );
    }

    assert.match(
      home,
      /function resetAllEventFilters/
    );
  }
);

test(
  'homepage audience participates in URL state and fetch identity',
  () => {
    assert.match(
      home,
      /p\.set\(\s*'audience'\s*,\s*'family'\s*\)/
    );

    assert.match(
      home,
      /sp\.get\('audience'\)\s*===\s*'family'/
    );

    assert.match(
      home,
      /audience:\s*api\.audience\s*\|\|\s*''/
    );
  }
);

test(
  'homepage trusts taxonomy-filtered API results',
  () => {
    assert.doesNotMatch(
      home,
      /out\s*=\s*out\.filter\(\s*e\s*=>\s*e\.category\s*===\s*filters\.category\s*\)/
    );
  }
);

test(
  'homepage view-all CTA uses canonical events query parameters',
  () => {
    assert.match(
      home,
      /setIfMissing\('from'/
    );

    assert.match(
      home,
      /setIfMissing\('to'/
    );

    assert.match(
      home,
      /setIfMissing\('q'/
    );

    assert.match(
      home,
      /setIfMissing\('audience',\s*'family'\)/
    );

    assert.doesNotMatch(
      home,
      /setIfMissing\('dateFrom'/
    );

    assert.doesNotMatch(
      home,
      /setIfMissing\('dateTo'/
    );

    assert.doesNotMatch(
      home,
      /setIfMissing\('keyword'/
    );
  }
);