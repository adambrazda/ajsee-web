import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  matchesEventAudienceFilter,
  matchesEventCategoryFilter,
  matchesEventDiscoveryFilters
} from '../src/taxonomy/event-filtering.js';

import {
  fetchEvents as fetchSmsticketEvents
} from '../src/adapters/smsticket.js';

import {
  mapTicketmasterEvent
} from '../src/adapters/ticketmaster.js';

test(
  'legacy concert, festival and theatre filters keep exact category semantics',
  () => {
    const party = {
      category: 'concert',

      taxonomy: {
        domains: ['music'],
        eventTypes: ['party'],
        audiences: []
      }
    };

    const otherShow = {
      category: 'other',

      taxonomy: {
        domains: ['stage'],
        eventTypes: ['show'],
        audiences: []
      }
    };

    assert.equal(
      matchesEventCategoryFilter(
        party,
        'concert'
      ),
      true
    );

    assert.equal(
      matchesEventCategoryFilter(
        otherShow,
        'theatre'
      ),
      false
    );
  }
);

test(
  'film filter uses taxonomy without changing the legacy category',
  () => {
    const event = {
      category: 'other',

      taxonomy: {
        domains: ['film'],
        eventTypes: ['cinema'],
        audiences: []
      }
    };

    assert.equal(
      matchesEventCategoryFilter(
        event,
        'film'
      ),
      true
    );

    assert.equal(
      event.category,
      'other'
    );
  }
);

test(
  'sport filter includes taxonomy sport events from other legacy categories',
  () => {
    const event = {
      category: 'festival',

      taxonomy: {
        domains: [
          'music',
          'sport'
        ],

        eventTypes: [
          'festival',
          'competition'
        ],

        audiences: []
      }
    };

    assert.equal(
      matchesEventCategoryFilter(
        event,
        'sport'
      ),
      true
    );

    assert.equal(
      matchesEventCategoryFilter(
        event,
        'festival'
      ),
      true
    );
  }
);

test(
  'family audience is independent and can be combined with a category',
  () => {
    const familyFestival = {
      category: 'festival',

      taxonomy: {
        domains: [
          'music',
          'experience'
        ],

        eventTypes: [
          'festival'
        ],

        audiences: [
          'family'
        ]
      }
    };

    assert.equal(
      matchesEventAudienceFilter(
        familyFestival,
        'family'
      ),
      true
    );

    assert.equal(
      matchesEventDiscoveryFilters(
        familyFestival,
        {
          category: 'festival',
          audience: 'family'
        }
      ),
      true
    );

    assert.equal(
      matchesEventDiscoveryFilters(
        familyFestival,
        {
          category: 'theatre',
          audience: 'family'
        }
      ),
      false
    );
  }
);

test(
  'SMS Ticket filters film, expanded sport and family before pagination',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    const fixtureEvents = [
      {
        id:
          'sms-film',

        category:
          'other',

        date:
          '2099-08-01',

        datetime:
          '2099-08-01T18:00:00',

        title: {
          cs:
            'Letní kino'
        },

        categories: [
          'Film'
        ],

        types: [
          'Kino / Projekce'
        ]
      },

      {
        id:
          'sms-sport-festival',

        category:
          'sports',

        date:
          '2099-08-02',

        datetime:
          '2099-08-02T18:00:00',

        title: {
          cs:
            'Sportovní festival'
        },

        categories: [
          'Sport'
        ],

        types: [
          'Festival',
          'Soutěž / Zápas / Závod'
        ]
      },

      {
        id:
          'sms-family-festival',

        category:
          'family',

        date:
          '2099-08-03',

        datetime:
          '2099-08-03T18:00:00',

        title: {
          cs:
            'Rodinný festival'
        },

        categories: [
          'Děti'
        ],

        types: [
          'Festival'
        ]
      },

      {
        id:
          'sms-family-theatre',

        category:
          'family',

        date:
          '2099-08-04',

        datetime:
          '2099-08-04T18:00:00',

        title: {
          cs:
            'Rodinné divadlo'
        },

        categories: [
          'Představení',
          'Děti'
        ],

        types: [
          'Divadlo'
        ]
      }
    ];

    globalThis.fetch =
      async () => ({
        ok: true,

        async json() {
          return {
            events:
              fixtureEvents
          };
        }
      });

    t.after(() => {
      globalThis.fetch =
        originalFetch;
    });

    const film =
      await fetchSmsticketEvents({
        filters: {
          category: 'film',
          page: 0,
          size: 50
        }
      });

    assert.deepEqual(
      film.map(
        (event) =>
          event.id
      ),
      [
        'sms-film'
      ]
    );

    const sport =
      await fetchSmsticketEvents({
        filters: {
          category: 'sport',
          page: 0,
          size: 50
        }
      });

    assert.deepEqual(
      sport.map(
        (event) =>
          event.id
      ),
      [
        'sms-sport-festival'
      ]
    );

    const family =
      await fetchSmsticketEvents({
        filters: {
          audience: 'family',
          page: 0,
          size: 50
        }
      });

    assert.deepEqual(
      family.map(
        (event) =>
          event.id
      ),
      [
        'sms-family-festival',
        'sms-family-theatre'
      ]
    );

    const familyFestival =
      await fetchSmsticketEvents({
        filters: {
          category: 'festival',
          audience: 'family',
          page: 0,
          size: 50
        }
      });

    assert.deepEqual(
      familyFestival.map(
        (event) =>
          event.id
      ),
      [
        'sms-family-festival'
      ]
    );
  }
);

test(
  'mapped Ticketmaster film event matches the shared film filter',
  () => {
    const event =
      mapTicketmasterEvent(
        {
          id:
            'tm-film',

          name:
            'Example film screening',

          url:
            'https://www.ticketmaster.co.uk/example-film/event/1',

          dates: {
            start: {
              dateTime:
                '2099-09-01T19:30:00Z'
            }
          },

          classifications: [
            {
              segment: {
                name:
                  'Arts & Theatre'
              },

              genre: {
                name:
                  'Film'
              },

              subGenre: {
                name:
                  'Cinema'
              }
            }
          ],

          _embedded: {
            venues: [
              {
                name:
                  'Example Cinema',

                city: {
                  name:
                    'London'
                },

                country: {
                  countryCode:
                    'GB'
                }
              }
            ]
          }
        },
        'en'
      );

    assert.equal(
      matchesEventCategoryFilter(
        event,
        'film'
      ),
      true
    );

    assert.ok(
      event.taxonomy.domains
        .includes(
          'film'
        )
    );
  }
);

test(
  'aggregate API and Ticketmaster requests use taxonomy filter v1 integration',
  () => {
    const apiSource =
      readFileSync(
        new URL(
          '../src/api/eventsApi.js',
          import.meta.url
        ),
        'utf8'
      );

    const ticketmasterSource =
      readFileSync(
        new URL(
          '../src/adapters/ticketmaster.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.match(
      apiSource,
      /matchesEventDiscoveryFilters/
    );

    assert.match(
      ticketmasterSource,
      /case\s+'film':[\s\S]*?classificationName:\s*'Film'/
    );

    assert.match(
      ticketmasterSource,
      /classificationName'\s*,\s*'Family'/
    );
  }
);

test(
  'events page preserves taxonomy-filtered results without legacy category refiltering',
  () => {
    const entrySource =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.equal(
      entrySource.includes(
        'out = out.filter(e => e.category === filters.category)'
      ),
      false
    );

    assert.match(
      entrySource,
      /Category and audience filtering is already applied by[\s\S]*?shared taxonomy matcher before[\s\S]*?pagination/
    );
  }
);
