import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import {
  detectDatePreset,
  getActiveFilterDescriptors,
  getDatePresetRange,
  renderEventsFilterSummary
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
    /<option value="film"[^>]*data-i18n-key="category-film"/
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
    'html body[data-page="events"] main#main ' +
    'section#upcoming-events.events-upcoming-section ' +
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
    new URL('../events.html', import.meta.url),
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
