import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getSharedEventFiltersMarkup,
  setSharedEventFilterDetailsExpanded
} from '../src/event-filters.js';

const homeEntry =
  fs.readFileSync(
    new URL(
      '../src/home-entry.js',
      import.meta.url
    ),
    'utf8'
  );

const eventsEntry =
  fs.readFileSync(
    new URL(
      '../src/events-entry.js',
      import.meta.url
    ),
    'utf8'
  );

const filterScss =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/_filters-parity-final.scss',
      import.meta.url
    ),
    'utf8'
  );

const aiScss =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/_ai-event-search.scss',
      import.meta.url
    ),
    'utf8'
  );


test(
  'shared filter markup keeps Near Me with quick actions and adds accessible disclosure',
  () => {
    const markup =
      getSharedEventFiltersMarkup();

    assert.match(
      markup,
      /class="chips"[\s\S]*?id="filter-audience-family"[\s\S]*?id="chipNearMe"[\s\S]*?id="chipClear"/
    );

    assert.match(
      markup,
      /id="filters-details-toggle"[\s\S]*?aria-expanded="false"[\s\S]*?aria-controls="events-filters-details"/
    );

    assert.match(
      markup,
      /class="filters-fieldset"[\s\S]*?id="events-filters-details"/
    );
  }
);


test(
  'shared disclosure state synchronizes aria and localized copy',
  () => {
    const label = {
      textContent:
        ''
    };

    const attributes =
      new Map();

    const button = {
      querySelector(selector) {
        return selector ===
          '[data-filter-details-label]'
            ? label
            : null;
      },

      setAttribute(
        name,
        value
      ) {
        attributes.set(
          name,
          String(value)
        );
      }
    };

    const form = {
      dataset: {},

      querySelector(selector) {
        return selector ===
          '#filters-details-toggle'
            ? button
            : null;
      }
    };

    const doc = {
      documentElement: {
        lang:
          'cs'
      },

      getElementById(id) {
        return id ===
          'events-filters-form'
            ? form
            : null;
      }
    };

    assert.equal(
      setSharedEventFilterDetailsExpanded(
        true,
        doc
      ),
      true
    );

    assert.equal(
      form.dataset
        .ajseeFilterDetailsExpanded,
      'true'
    );

    assert.equal(
      attributes.get(
        'aria-expanded'
      ),
      'true'
    );

    assert.equal(
      label.textContent,
      'Skrýt filtry'
    );

    doc.documentElement.lang =
      'en';

    setSharedEventFilterDetailsExpanded(
      false,
      doc
    );

    assert.equal(
      label.textContent,
      'Refine filters'
    );
  }
);


test(
  'successful AI application keeps manual filter details closed on both pages',
  () => {
    for (
      const source of [
        homeEntry,
        eventsEntry
      ]
    ) {
      const aiStart =
        source.indexOf(
          'async function applyAiEventSearchIntent(intent) {'
        );

      const aiEnd =
        source.indexOf(
          'function bindFilterFormInteractions',
          aiStart
        );

      assert.notEqual(
        aiStart,
        -1
      );

      assert.notEqual(
        aiEnd,
        -1
      );

      const aiBlock =
        source.slice(
          aiStart,
          aiEnd
        );

      assert.doesNotMatch(
        aiBlock,
        /setSharedEventFilterDetailsExpanded\(\s*true\s*\)/
      );

      assert.match(
        aiBlock,
        /await renderAndSync\([\s\S]*?setSharedEventFilterDetailsExpanded\(\s*false\s*\)[\s\S]*?scrollToSharedEventResults\(\)/
      );
    }
  }
);


test(
  'compact CSS is consolidated into final architecture without V1 V2 layers',
  () => {
    assert.match(
      filterScss,
      /AJSEE_FILTER_ARCHITECTURE_FINAL/
    );

    assert.doesNotMatch(
      filterScss,
      /AJSEE_AI_FILTER_COMPACT_V1/
    );

    assert.doesNotMatch(
      filterScss,
      /AJSEE_FILTER_COMPACT_V2/
    );

    assert.doesNotMatch(
      filterScss,
      /AJSEE_EVENTS_MOBILE_QUICK_FILTER_LAYOUT_V2/
    );

    assert.match(
      filterScss,
      /data-ajsee-filter-details-expanded="false"/
    );

    assert.match(
      filterScss,
      /"category city"[\s\S]*?"date keyword"[\s\S]*?"price price"[\s\S]*?"actions actions"/
    );

    assert.match(
      aiScss,
      /AJSEE_AI_SEARCH_COMPACT_FINAL/
    );

    assert.doesNotMatch(
      aiScss,
      /AJSEE_AI_SEARCH_COMPACT_V2/
    );
  }
);
