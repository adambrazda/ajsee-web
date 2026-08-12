import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import {
  detectDatePreset,
  getActiveFilterDescriptors,
  getDatePresetRange,
  renderEventsFilterSummary,
  getEmptyStateRecommendation,
  getEmptyStateRecommendationLabel,
  getEventsEmptyStateAnalyticsContext
} from '../src/events-filter-ux.js';

test('tomorrow preset uses the next local calendar day', () => {
  const now = new Date(2026, 7, 1, 12, 0, 0);

  assert.deepEqual(
    getDatePresetRange('tomorrow', now),
    {
      from: '2026-08-02',
      to: '2026-08-02'
    }
  );
});

test('this week starts today and ends on Sunday', () => {
  const now = new Date(2026, 7, 5, 12, 0, 0);

  assert.deepEqual(
    getDatePresetRange('thisWeek', now),
    {
      from: '2026-08-05',
      to: '2026-08-09'
    }
  );
});

test('weekend preset keeps the current weekend when it is Saturday', () => {
  const now = new Date(2026, 7, 1, 12, 0, 0);

  assert.deepEqual(
    getDatePresetRange('weekend', now),
    {
      from: '2026-08-01',
      to: '2026-08-02'
    }
  );

  assert.equal(
    detectDatePreset(
      {
        dateFrom: '2026-08-01',
        dateTo: '2026-08-02'
      },
      now
    ),
    'weekend'
  );
});

test('null and empty near-me coordinates do not create an active place filter', () => {
  const inactiveStates = [
    {
      nearMeLat: null,
      nearMeLon: null
    },
    {
      nearMeLat: '',
      nearMeLon: ''
    },
    {
      nearMeLat: undefined,
      nearMeLon: undefined
    }
  ];

  for (const state of inactiveStates) {
    const descriptors = getActiveFilterDescriptors({
      category: 'all',
      sort: 'nearest',
      placeType: '',
      city: '',
      cityLabel: '',
      ...state
    });

    assert.deepEqual(descriptors, []);
  }
});

test('near-me state produces only one place descriptor', () => {
  const descriptors = getActiveFilterDescriptors(
    {
      placeType: 'nearMe',
      cityLabel: 'V mém okolí',
      nearMeLat: 48.85,
      nearMeLon: 17.13,
      nearMeRadiusKm: 50
    },
    {
      labels: {
        nearMe: 'V mém okolí'
      }
    }
  );

  assert.deepEqual(
    descriptors,
    [
      {
        key: 'place',
        label: 'V mém okolí'
      }
    ]
  );
});

test('active descriptor model includes category, place, date, keyword and sort', () => {
  const now = new Date(2026, 7, 1, 12, 0, 0);

  const descriptors = getActiveFilterDescriptors(
    {
      category: 'concert',
      city: 'Praha',
      cityLabel: 'Praha',
      dateFrom: '2026-08-02',
      dateTo: '2026-08-02',
      keyword: 'jazz',
      sort: 'latest'
    },
    {
      locale: 'cs',
      now,
      labels: {
        categories: {
          concert: 'Koncerty'
        },
        datePresets: {
          tomorrow: 'Zítra'
        },
        sorts: {
          latest: 'Nejnovější'
        }
      }
    }
  );

  assert.deepEqual(
    descriptors,
    [
      { key: 'category', label: 'Koncerty' },
      { key: 'place', label: 'Praha' },
      { key: 'date', label: 'Zítra' },
      { key: 'keyword', label: '“jazz”' },
      { key: 'sort', label: 'Nejnovější' }
    ]
  );
});

test('summary renders accessible removable chips and clear-all action', () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html lang="cs">
      <body>
        <main id="host">
          <div id="eventsList"></div>
        </main>
      </body>
    </html>
  `);

  const removed = [];
  let cleared = 0;

  const document = dom.window.document;
  const host = document.getElementById('host');
  const list = document.getElementById('eventsList');

  renderEventsFilterSummary({
    document,
    host,
    list,
    count: '20+',
    filters: {
      category: 'concert',
      city: 'Praha',
      cityLabel: 'Praha'
    },
    labels: {
      found: 'Nalezeno',
      activeFilters: 'Aktivní filtry',
      clearAll: 'Vymazat vše',
      removeFilter: 'Odebrat filtr',
      categories: {
        concert: 'Koncerty'
      }
    },
    onRemove: (key) => removed.push(key),
    onClear: () => {
      cleared += 1;
    }
  });

  assert.equal(
    document.getElementById('eventsResultsCount').textContent,
    'Nalezeno: 20+'
  );

  const buttons = [
    ...document.querySelectorAll('.events-filter-chip')
  ];

  assert.equal(buttons.length, 2);
  assert.equal(
    buttons[0].getAttribute('aria-label'),
    'Odebrat filtr: Koncerty'
  );

  buttons[0].click();
  document.querySelector('.events-filter-summary__clear').click();

  assert.deepEqual(removed, ['category']);
  assert.equal(cleared, 1);
});

test('family audience is represented as a removable active filter', () => {
  const descriptors =
    getActiveFilterDescriptors(
      {
        category: 'film',
        audience: 'family'
      },
      {
        labels: {
          categories: {
            film: 'Film a kino'
          },
          audiences: {
            family: 'Pro rodiny'
          }
        }
      }
    );

  assert.deepEqual(
    descriptors,
    [
      {
        key: 'category',
        label: 'Film a kino'
      },
      {
        key: 'audience',
        label: 'Pro rodiny'
      }
    ]
  );
});

test('events page exposes film and family filters with URL state', () => {
  const html =
    readFileSync(
      new URL(
        '../src/event-filters.js',
        import.meta.url
      ),
      'utf8'
    );

  const entry =
    readFileSync(
      new URL(
        '../src/events-entry.js',
        import.meta.url
      ),
      'utf8'
    );

  const styles =
    readFileSync(
      new URL(
        '../src/styles/partials/_filters-parity-final.scss',
        import.meta.url
      ),
      'utf8'
    );

  assert.match(
    html,
    /<option(?=[^>]*value="film")(?=[^>]*data-i18n-key="category-film")[^>]*>/
  );

  assert.match(
    html,
    /<button(?=[^>]*id="filter-audience-family")(?=[^>]*data-i18n-key="filters\.family")(?=[^>]*aria-pressed="false")[^>]*>/
  );

  assert.doesNotMatch(
    html,
    /<label[^>]*for="filter-audience-family"/
  );

  assert.match(
    entry,
    /p\.set\('audience', 'family'\)/
  );

  assert.match(
    entry,
    /sp\.get\('audience'\) ===\s*'family'/
  );

  assert.doesNotMatch(
    styles,
    /AJSEE_EVENTS_FAMILY_AUDIENCE_FILTER_V1/
  );

  assert.match(
    entry,
    /family-audience-click/
  );

  assert.match(
    entry,
    /aria-pressed/
  );

  for (
    const locale of [
      'cs',
      'en',
      'de',
      'sk',
      'pl',
      'hu'
    ]
  ) {
    const messages =
      JSON.parse(
        readFileSync(
          new URL(
            `../src/locales/${locale}.json`,
            import.meta.url
          ),
          'utf8'
        )
      );

    assert.equal(
      typeof messages['category-film'],
      'string'
    );

    assert.equal(
      typeof messages.filters?.film,
      'string'
    );

    assert.equal(
      typeof messages.filters?.family,
      'string'
    );
  }
});

test('events page preserves the quick-filter toolbar', () => {
  const source = readFileSync(
    new URL('../src/events-entry.js', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /AJSEE_PRESERVE_EVENTS_QUICK_FILTERS_V1/
  );

  assert.doesNotMatch(
    source,
    /if\s*\(toolbar\)\s*toolbar\.remove\(\);/
  );
});

test('events page exposes the quick-filter toolbar in final CSS', () => {
  const source = readFileSync(
    new URL(
      '../src/styles/partials/_filters-parity-final.scss',
      import.meta.url
    ),
    'utf8'
  );

  const selector =
    'html body:is([data-page="home"], [data-page="events"]) ' +
    'form#events-filters-form.events-filters.filter-dock ' +
    '.filters-toolbar';

  const start = source.indexOf(selector);

  assert.notEqual(
    start,
    -1,
    'Quick-filter toolbar selector must exist.'
  );

  const end = source.indexOf('}', start);
  const block = source.slice(start, end + 1);

  assert.match(
    source,
    /AJSEE_EVENTS_QUICK_FILTERS_VISIBLE_V1/
  );

  assert.match(
    block,
    /display:\s*flex;/
  );

  assert.doesNotMatch(
    block,
    /display:\s*none;/
  );
});

test('bootstrap keeps the events quick-filter toolbar in the DOM', () => {
  const source = readFileSync(
    new URL('../src/events-entry.js', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /AJSEE_KEEP_EVENTS_QUICK_FILTERS_BOOTSTRAP_V1/
  );

  assert.doesNotMatch(
    source,
    /topToolbar\.remove\(\)/
  );

  assert.doesNotMatch(
    source,
    /if\s*\(topToolbar\)\s*topToolbar\.remove\(\)/
  );
});

test('mobile quick filters expose all actions and bind near-me', () => {
  const html = readFileSync(
    new URL('../src/event-filters.js', import.meta.url),
    'utf8'
  );

  const entry = readFileSync(
    new URL('../src/events-entry.js', import.meta.url),
    'utf8'
  );

  const styles = readFileSync(
    new URL(
      '../src/styles/partials/_filters-parity-final.scss',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(
    html,
    /id="chipNearMe"[^>]*aria-pressed="false"/
  );

  assert.match(
    entry,
    /AJSEE_QUICK_NEAR_ME_BINDING_V1/
  );

  assert.match(
    entry,
    /bindQuickNearMeButton\(\);/
  );

  assert.match(
    entry,
    /wireOnce\(quickNearBtn,\s*'click'/
  );

  assert.match(
    styles,
    /AJSEE_EVENTS_MOBILE_QUICK_FILTER_LAYOUT_V2/
  );

  assert.match(
    styles,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );

  assert.match(
    styles,
    /#chipNearMe\s*\{[\s\S]*?display:\s*inline-flex\s*!important;/
  );
});


/* AJSEE_SMART_EMPTY_STATE_V1_TESTS */
test(
  'smart empty-state recommendation removes narrow filters before location',
  () => {
    const recommendation =
      getEmptyStateRecommendation(
        {
          category:
            'theatre',

          audience:
            'family',

          city:
            'Praha',

          cityLabel:
            'Praha',

          dateFrom:
            '2026-08-02',

          dateTo:
            '2026-08-02',

          keyword:
            'loutky',

          sort:
            'latest'
        },
        {
          locale:
            'cs',

          labels: {
            categories: {
              theatre:
                'Divadlo'
            },

            audiences: {
              family:
                'Pro rodiny'
            }
          }
        }
      );

    assert.deepEqual(
      recommendation,
      {
        key:
          'keyword',

        label:
          '“loutky”'
      }
    );
  }
);

test(
  'smart empty-state recommendation preserves place until other restrictions are removed',
  () => {
    const recommendation =
      getEmptyStateRecommendation(
        {
          category:
            'film',

          city:
            'Brno',

          cityLabel:
            'Brno'
        },
        {
          labels: {
            categories: {
              film:
                'Film a kino'
            }
          }
        }
      );

    assert.deepEqual(
      recommendation,
      {
        key:
          'category',

        label:
          'Film a kino'
      }
    );
  }
);

test(
  'sort alone does not create a smart empty-state recommendation',
  () => {
    const recommendation =
      getEmptyStateRecommendation({
        category:
          'all',

        sort:
          'latest'
      });

    assert.equal(
      recommendation,
      null
    );
  }
);

test(
  'events page exposes targeted empty-state recovery in every locale',
  () => {
    const entry =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.match(
      entry,
      /data-ajsee-events-remove-filter/
    );

    assert.match(
      entry,
      /data-ajsee-events-clear/
    );

    assert.match(
      entry,
      /focusEventsResultsSummary/
    );

    for (
      const locale of [
        'cs',
        'en',
        'de',
        'sk',
        'pl',
        'hu'
      ]
    ) {
      const source =
        readFileSync(
          new URL(
            `../src/locales/${locale}.json`,
            import.meta.url
          ),
          'utf8'
        );

      assert.match(
        source,
        /"events-empty-remove"/
      );

      assert.match(
        source,
        /"events-empty-no-filters"/
      );
    }
  }
);


/* AJSEE_EMPTY_STATE_SINGLE_QUOTES_REGRESSION */
test(
  'empty-state keyword label has exactly one translated pair of quotes',
  () => {
    const keyword =
      'ajsee-no-results-987654';

    const label =
      getEmptyStateRecommendationLabel({
        key:
          'keyword',

        label:
          `“${keyword}”`
      });

    assert.equal(
      label,
      keyword
    );

    assert.equal(
      getEmptyStateRecommendationLabel({
        key:
          'category',

        label:
          'Divadlo'
      }),
      'Divadlo'
    );

    for (
      const locale of [
        'cs',
        'en',
        'de',
        'sk',
        'pl',
        'hu'
      ]
    ) {
      const json =
        JSON.parse(
          readFileSync(
            new URL(
              `../src/locales/${locale}.json`,
              import.meta.url
            ),
            'utf8'
          )
        );

      for (
        const key of [
          'events-empty-body',
          'events-empty-remove'
        ]
      ) {
        const template =
          json[key];

        assert.equal(
          (
            template.match(
              /\{filter\}/g
            ) ||
            []
          ).length,
          1
        );

        const rendered =
          template.replace(
            '{filter}',
            label
          );

        assert.equal(
          (
            rendered.match(
              /ajsee-no-results-987654/g
            ) ||
            []
          ).length,
          1
        );

        assert.doesNotMatch(
          rendered,
          /[„“”"«»]{2,}/
        );
      }
    }
  }
);


/* AJSEE_EVENTS_EMPTY_STATE_ANALYTICS_V1 */
test(
  'empty-state analytics context contains only privacy-safe filter metadata',
  () => {
    const context =
      getEventsEmptyStateAnalyticsContext(
        {
          category:
            'theatre',

          audience:
            'family',

          city:
            'Praha',

          cityLabel:
            'Praha',

          cityCountryCode:
            'CZ',

          dateFrom:
            '2026-08-02',

          dateTo:
            '2026-08-02',

          keyword:
            'tajne-hledani-987654',

          sort:
            'latest'
        },
        {
          key:
            'keyword',

          label:
            '“tajne-hledani-987654”'
        },
        {
          locale:
            'cs',

          labels: {
            categories: {
              theatre:
                'Divadlo'
            },

            audiences: {
              family:
                'Pro rodiny'
            },

            sorts: {
              latest:
                'Nejnovější'
            }
          },

          now:
            new Date(
              2026,
              7,
              2,
              12,
              0,
              0
            )
        }
      );

    assert.deepEqual(
      context,
      {
        recommended_filter:
          'keyword',

        active_filter_count:
          5,

        filter_category:
          'theatre',

        filter_audience:
          'family',

        has_place_filter:
          1,

        has_date_filter:
          1,

        has_keyword_filter:
          1,

        language:
          'cs'
      }
    );

    const serialized =
      JSON.stringify(
        context
      );

    assert.doesNotMatch(
      serialized,
      /Praha/
    );

    assert.doesNotMatch(
      serialized,
      /tajne-hledani/
    );

    assert.equal(
      Object.hasOwn(
        context,
        'city'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        context,
        'keyword'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        context,
        'nearMeLat'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        context,
        'page_location'
      ),
      false
    );
  }
);

test(
  'events empty-state analytics use dataLayer events and deduplicate unchanged views',
  () => {
    const entry =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    for (
      const eventName of [
        'events_empty_state_view',
        'events_empty_state_remove_filter',
        'events_empty_state_clear_all'
      ]
    ) {
      assert.match(
        entry,
        new RegExp(
          eventName
        )
      );
    }

    assert.match(
      entry,
      /window\.dataLayer\.push\(\s*payload\s*\)/
    );

    assert.match(
      entry,
      /_lastEventsEmptyStateViewSignature/
    );

    assert.match(
      entry,
      /signature\s*===\s*_lastEventsEmptyStateViewSignature/
    );

    assert.match(
      entry,
      /page_path:\s*window\.location\.pathname/
    );

    assert.match(
      entry,
      /lastEventsEmptyStateEvent/
    );

    assert.match(
      entry,
      /resetEventsEmptyStateViewTracking\(\);[\s\S]*?ensureSharedEventGridStyles\(\)/
    );
  }
);


/* AJSEE_EVENTS_STATE_HARDENING_V1 */
test(
  'events loading state synchronizes busy semantics and renders accessible skeletons',
  () => {
    const html =
      readFileSync(
        new URL(
          '../events.html',
          import.meta.url
        ),
        'utf8'
      );

    const entry =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.doesNotMatch(
      html,
      /id="eventsList"[^>]*aria-live/
    );

    assert.match(
      entry,
      /const section\s*=\s*qs\('#upcoming-events'\)/
    );

    assert.match(
      entry,
      /section\.setAttribute\(\s*'aria-busy'/
    );

    assert.match(
      entry,
      /data-ajsee-events-loading/
    );

    assert.match(
      entry,
      /class="event-card skeleton"/
    );

    assert.match(
      entry,
      /prefers-reduced-motion:reduce/
    );
  }
);

test(
  'events generic error state offers retry and restores focus after user interaction',
  () => {
    const entry =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.match(
      entry,
      /function renderEventsLoadErrorState\(\)/
    );

    assert.match(
      entry,
      /data-ajsee-events-load-retry/
    );

    assert.match(
      entry,
      /renderEventsLoadErrorState\(\);/
    );

    assert.match(
      entry,
      /function focusEventsStateMessage\(\)/
    );

    assert.match(
      entry,
      /requestAnimationFrame\(\s*focusEventsStateMessage\s*\)/
    );

    assert.match(
      entry,
      /focusEventsResultsSummary\(\);/
    );

    assert.doesNotMatch(
      entry,
      /class="ajsee-events-state"\s*role="status"\s*aria-live="polite"/
    );

    for (
      const locale of [
        'cs',
        'en',
        'de',
        'sk',
        'pl',
        'hu'
      ]
    ) {
      const translations =
        JSON.parse(
          readFileSync(
            new URL(
              `../src/locales/${locale}.json`,
              import.meta.url
            ),
            'utf8'
          )
        );

      for (
        const key of [
          'events-load-error',
          'events-load-error-title',
          'events-load-retry',
          'events-loading-status',
          'events-results-paused',
          'events-results-unavailable'
        ]
      ) {
        assert.equal(
          typeof translations[key],
          'string',
          `${locale}: missing ${key}`
        );

        assert.ok(
          translations[key].trim(),
          `${locale}: empty ${key}`
        );
      }
    }
  }
);
