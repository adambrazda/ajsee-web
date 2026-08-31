import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchEvents,
  isColosseumTicketEventCurrent,
  withColosseumTicketTaxonomy
} from '../src/adapters/colosseumticket.js';


function createEvent({
  id,
  title,
  city,
  datetime,
  type,
  priceFrom = '500 Kč'
}) {
  return {
    id,

    partner:
      'colosseumticket',

    source:
      'colosseumticket',

    sourceName:
      'ColosseumTicket',

    title: {
      cs:
        title
    },

    description: {
      cs:
        `${title} description`
    },

    datetime,

    location: {
      city
    },

    venue: {
      name:
        `${city} Venue`,
      city
    },

    address:
      `${city} address`,

    priceFrom,

    currency:
      'CZK',

    priceOptions: [
      {
        amount:
          500,
        currency:
          'CZK'
      }
    ],

    types: [
      type
    ],

    categories: [
      type
    ],

    sourceMeta: {
      rawType:
        type
    }
  };
}


test(
  'adds Colosseum taxonomy without losing provider event data',
  () => {
    const original =
      createEvent({
        id:
          'colosseumticket-1',

        title:
          'Test musical',

        city:
          'Praha',

        datetime:
          '2099-09-10T19:00:00',

        type:
          'Muzikál'
      });

    const normalized =
      withColosseumTicketTaxonomy(
        original
      );

    assert.equal(
      normalized.id,
      original.id
    );

    assert.equal(
      normalized.category,
      'theatre'
    );

    assert.deepEqual(
      normalized.taxonomy.genres,
      [
        'musical'
      ]
    );

    assert.deepEqual(
      normalized.priceOptions,
      original.priceOptions
    );
  }
);


test(
  'current-event guard keeps event through its local calendar day',
  () => {
    const event = {
      datetime:
        '2099-08-30T19:00:00'
    };

    assert.equal(
      isColosseumTicketEventCurrent(
        event,
        new Date(
          '2099-08-30T23:00:00'
        )
      ),
      true
    );

    assert.equal(
      isColosseumTicketEventCurrent(
        event,
        new Date(
          '2099-08-31T00:01:00'
        )
      ),
      false
    );
  }
);


test(
  'uses Prague subset and filters city plus category before pagination',
  async () => {
    const originalFetch =
      globalThis.fetch;

    const requestedUrls = [];

    const payload = {
      events: [
        createEvent({
          id:
            'colosseumticket-prague-concert',

          title:
            'Pražský koncert',

          city:
            'Praha',

          datetime:
            '2099-09-10T20:00:00',

          type:
            'Hudba'
        }),

        createEvent({
          id:
            'colosseumticket-prague-theatre',

          title:
            'Pražské divadlo',

          city:
            'Praha',

          datetime:
            '2099-09-10T19:00:00',

          type:
            'Divadlo'
        }),

        createEvent({
          id:
            'colosseumticket-brno-concert',

          title:
            'Brněnský koncert',

          city:
            'Brno',

          datetime:
            '2099-09-10T18:00:00',

          type:
            'Hudba'
        })
      ]
    };

    globalThis.fetch =
      async (url) => {
        requestedUrls.push(
          String(url)
        );

        return {
          ok:
            true,

          async json() {
            return payload;
          }
        };
      };

    try {
      const events =
        await fetchEvents({
          filters: {
            city:
              'Praha',

            category:
              'concert',

            page:
              0,

            size:
              20
          }
        });

      assert.equal(
        requestedUrls.length,
        1
      );

      assert.equal(
        requestedUrls[0],
        '/data/colosseumticket-events-praha.json'
      );

      assert.equal(
        events.length,
        1
      );

      assert.equal(
        events[0].id,
        'colosseumticket-prague-concert'
      );

      assert.equal(
        events[0].category,
        'concert'
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  'supports family taxonomy independently from legacy category',
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () => ({
        ok:
          true,

        async json() {
          return {
            events: [
              createEvent({
                id:
                  'colosseumticket-family',

                title:
                  'Rodinné představení',

                city:
                  'Olomouc',

                datetime:
                  '2099-09-10T17:00:00',

                type:
                  'DivadloPro děti'
              })
            ]
          };
        }
      });

    try {
      const events =
        await fetchEvents({
          filters: {
            city:
              'Olomouc',

            audience:
              'family'
          }
        });

      assert.equal(
        events.length,
        1
      );

      assert.equal(
        events[0]
          .taxonomy
          .audiences
          .includes(
            'family'
          ),
        true
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  'filters by keyword and date range',
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () => ({
        ok:
          true,

        async json() {
          return {
            events: [
              createEvent({
                id:
                  'colosseumticket-keyword-a',

                title:
                  'Nabucco na Špilberku',

                city:
                  'Brno',

                datetime:
                  '2099-09-10T19:00:00',

                type:
                  'Divadlo'
              }),

              createEvent({
                id:
                  'colosseumticket-keyword-b',

                title:
                  'Jiná opera',

                city:
                  'Brno',

                datetime:
                  '2099-09-12T19:00:00',

                type:
                  'Divadlo'
              })
            ]
          };
        }
      });

    try {
      const events =
        await fetchEvents({
          filters: {
            city:
              'Brno',

            keyword:
              'Nabucco',

            dateFrom:
              '2099-09-10',

            dateTo:
              '2099-09-10'
          }
        });

      assert.equal(
        events.length,
        1
      );

      assert.equal(
        events[0].id,
        'colosseumticket-keyword-a'
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  'returns no Near Me results because provider feed has no coordinates',
  async () => {
    const originalFetch =
      globalThis.fetch;

    let fetchCalls = 0;

    globalThis.fetch =
      async () => {
        fetchCalls += 1;

        throw new Error(
          'Near Me must not fetch Colosseum data.'
        );
      };

    try {
      const events =
        await fetchEvents({
          filters: {
            nearMeLat:
              50.08,

            nearMeLon:
              14.43
          }
        });

      assert.deepEqual(
        events,
        []
      );

      assert.equal(
        fetchCalls,
        0
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  'skips explicit non-CZ markets before provider data is loaded',
  async () => {
    const originalFetch =
      globalThis.fetch;

    let fetchCalls = 0;

    globalThis.fetch =
      async () => {
        fetchCalls += 1;

        throw new Error(
          'Non-CZ query must not fetch Colosseum data.'
        );
      };

    try {
      const events =
        await fetchEvents({
          filters: {
            countryCode:
              'GB'
          }
        });

      assert.deepEqual(
        events,
        []
      );

      assert.equal(
        fetchCalls,
        0
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);


test(
  'explicit provider opt-out skips loading',
  async () => {
    const originalFetch =
      globalThis.fetch;

    let fetchCalls = 0;

    globalThis.fetch =
      async () => {
        fetchCalls += 1;

        throw new Error(
          'Opt-out must not fetch.'
        );
      };

    try {
      const events =
        await fetchEvents({
          filters: {
            includeColosseumticket:
              false
          }
        });

      assert.deepEqual(
        events,
        []
      );

      assert.equal(
        fetchCalls,
        0
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);
