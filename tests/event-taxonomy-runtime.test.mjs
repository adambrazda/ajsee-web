import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  fetchEvents as fetchSmsticketEvents,
  normalizeSmsticketEventCategory,
  withSmsticketTaxonomy
} from '../src/adapters/smsticket.js';

import {
  mapTicketmasterEvent
} from '../src/adapters/ticketmaster.js';

import {
  deriveLegacyCategory
} from '../src/taxonomy/event-taxonomy.js';

test(
  'SMS Ticket runtime output includes taxonomy v1 and derived legacy category',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () => ({
        ok: true,

        async json() {
          return {
            events: [
              {
                id:
                  'sms-runtime-concert',

                category:
                  'music',

                date:
                  '2099-08-01',

                datetime:
                  '2099-08-01T20:00:00',

                title: {
                  cs: 'Runtime koncert'
                },

                categories: [
                  'Hudba'
                ],

                genres: [
                  'Pop'
                ],

                types: [
                  'Koncert'
                ]
              }
            ]
          };
        }
      });

    t.after(() => {
      globalThis.fetch =
        originalFetch;
    });

    const [event] =
      await fetchSmsticketEvents({
        filters: {
          category: 'concert',
          page: 0,
          size: 10
        }
      });

    assert.ok(event);

    assert.equal(
      event.taxonomy.version,
      1
    );

    assert.deepEqual(
      event.taxonomy.domains,
      ['music']
    );

    assert.deepEqual(
      event.taxonomy.eventTypes,
      ['concert']
    );

    assert.deepEqual(
      event.taxonomy.genres,
      ['pop']
    );

    assert.equal(
      event.category,
      'concert'
    );

    assert.equal(
      event.category,
      deriveLegacyCategory(
        event.taxonomy
      )
    );
  }
);

test(
  'SMS Ticket title-only festival hint is represented in runtime taxonomy',
  () => {
    const event =
      withSmsticketTaxonomy({
        id:
          'sms-title-festival',

        category:
          'music',

        title: {
          cs:
            'Letní hudební festival 2026'
        },

        categories: [
          'Hudba'
        ],

        genres: [
          'Rock'
        ],

        types: [
          'Koncert'
        ]
      });

    assert.deepEqual(
      event.taxonomy.eventTypes,
      [
        'festival',
        'concert'
      ]
    );

    assert.equal(
      event.category,
      'festival'
    );

    assert.equal(
      event.category,
      deriveLegacyCategory(
        event.taxonomy
      )
    );
  }
);

test(
  'Ticketmaster runtime mapper includes taxonomy v1 and derived legacy category',
  () => {
    const event =
      mapTicketmasterEvent(
        {
          id:
            'tm-runtime-musical',

          name:
            'Example musical',

          url:
            'https://www.ticketmaster.co.uk/example-musical/event/1',

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
                  'Theatre'
              },

              subGenre: {
                name:
                  'Musical'
              },

              type: {
                name:
                  'Event Style'
              },

              subType: {
                name:
                  'Theatre'
              }
            }
          ],

          _embedded: {
            venues: [
              {
                name:
                  'Example Theatre',

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
      event.taxonomy.version,
      1
    );

    assert.deepEqual(
      event.taxonomy.domains,
      ['stage']
    );

    assert.ok(
      event.taxonomy.eventTypes.includes(
        'theatre'
      )
    );

    assert.ok(
      event.taxonomy.genres.includes(
        'musical'
      )
    );

    assert.equal(
      event.category,
      'theatre'
    );

    assert.equal(
      event.category,
      deriveLegacyCategory(
        event.taxonomy
      )
    );

    assert.equal(
      event.taxonomy.source.provider,
      'ticketmaster'
    );
  }
);

test(
  'current SMS Ticket feed keeps complete legacy category parity',
  () => {
    const feedUrl =
      new URL(
        '../public/data/smsticket-events.json',
        import.meta.url
      );

    const payload =
      JSON.parse(
        fs.readFileSync(
          feedUrl,
          'utf8'
        )
      );

    const events =
      Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

    assert.ok(
      events.length > 0,
      'The SMS Ticket feed must contain events.'
    );

    const mismatches = [];

    for (
      const event of events
    ) {
      const previousCategory =
        normalizeSmsticketEventCategory(
          event
        );

      const normalizedEvent =
        withSmsticketTaxonomy(
          event
        );

      if (
        normalizedEvent.category !==
        previousCategory
      ) {
        mismatches.push({
          id:
            event.id ?? '',

          title:
            typeof event.title === 'string'
              ? event.title
              : event.title?.cs ??
                event.title?.en ??
                '',

          rawCategory:
            event.category ?? '',

          previousCategory,

          taxonomyCategory:
            normalizedEvent.category,

          domains:
            normalizedEvent.taxonomy
              ?.domains ?? [],

          eventTypes:
            normalizedEvent.taxonomy
              ?.eventTypes ?? []
        });
      }
    }

    assert.deepEqual(
      mismatches.slice(
        0,
        20
      ),
      [],

      [
        `Found ${mismatches.length} legacy category mismatches.`,
        JSON.stringify(
          mismatches.slice(
            0,
            20
          ),
          null,
          2
        )
      ].join('\n')
    );
  }
);
