import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  getSharedEventFiltersMarkup
} from '../src/event-filters.js';

const markup =
  getSharedEventFiltersMarkup();

const homeSource =
  fs.readFileSync(
    new URL(
      '../src/home-entry.js',
      import.meta.url
    ),
    'utf8'
  );

const eventsSource =
  fs.readFileSync(
    new URL(
      '../src/events-entry.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'shared filters expose canonical quick actions',
  () => {
    for (
      const id of [
        'chipToday',
        'chipTomorrow',
        'chipThisWeek',
        'chipWeekend',
        'filter-audience-family',
        'chipClear',
        'chipNearMe'
      ]
    ) {
      assert.match(
        markup,
        new RegExp(
          `id="${id}"`
        )
      );
    }
  }
);

test(
  'stateful quick filters expose pressed state',
  () => {
    for (
      const id of [
        'chipToday',
        'chipTomorrow',
        'chipThisWeek',
        'chipWeekend',
        'filter-audience-family',
        'chipNearMe'
      ]
    ) {
      assert.match(
        markup,
        new RegExp(
          `id="${id}"[\\s\\S]*?aria-pressed="false"`
        )
      );
    }
  }
);

test(
  'shared category taxonomy includes film',
  () => {
    assert.match(
      markup,
      /value="film"[\s\S]*?category-film/
    );
  }
);

test(
  'shared form controls keep semantic names',
  () => {
    assert.match(
      markup,
      /id="filter-category"[\s\S]*?name="category"/
    );

    assert.match(
      markup,
      /id="filter-sort"[\s\S]*?name="sort"/
    );

    assert.match(
      markup,
      /id="filter-city"[\s\S]*?name="city"/
    );

    assert.match(
      markup,
      /id="filter-keyword"[\s\S]*?name="keyword"/
    );

    assert.match(
      markup,
      /id="filter-date-from"[\s\S]*?name="date_from"/
    );

    assert.match(
      markup,
      /id="filter-date-to"[\s\S]*?name="date_to"/
    );
  }
);

test(
  'homepage and events import shared filter markup',
  () => {
    for (
      const source of [
        homeSource,
        eventsSource
      ]
    ) {
      assert.match(
        source,
        /import '\.\/event-filters\.js';/
      );
    }
  }
);

test(
  'page shells do not duplicate shared filter controls',
  () => {
    for (const page of ['../index.html', '../events.html']) {
      const source = fs.readFileSync(
        new URL(page, import.meta.url),
        'utf8'
      );

      assert.match(
        source,
        /<form id="events-filters-form" class="events-filters filter-dock" novalidate role="search">/
      );

      for (const id of [
        'chipToday',
        'chipTomorrow',
        'chipThisWeek',
        'chipWeekend',
        'filter-audience-family',
        'chipNearMe',
        'filter-category',
        'filter-city',
        'filter-keyword'
      ]) {
        assert.doesNotMatch(
          source,
          new RegExp(`id="${id}"`)
        );
      }
    }
  }
);

test(
  'homepage preserves shared filter controls at runtime',
  () => {
    assert.doesNotMatch(
      homeSource,
      /if\s*\(toolbar\)\s*toolbar\.remove\(\)/
    );

    assert.doesNotMatch(
      homeSource,
      /if\s*\(topToolbar\)\s*topToolbar\.remove\(\)/
    );

    assert.doesNotMatch(
      homeSource,
      /legacyNearBtn\.remove\(\)/
    );
  }
);

test(
  'homepage CSS does not hide shared quick filters',
  () => {
    const styles =
      fs.readFileSync(
        new URL(
          '../src/styles/partials/filters-premium.scss',
          import.meta.url
        ),
        'utf8'
      );

    assert.doesNotMatch(
      styles,
      /body\[data-page="home"\]\s+#events-filters-form\.filter-dock\s+\.filters-toolbar\s*\{[\s\S]*?display:\s*none\s*;[\s\S]*?\}/
    );
  }
);