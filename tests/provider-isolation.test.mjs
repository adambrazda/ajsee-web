import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test(
  'Ticketmaster cooldown does not block SMS Ticket aggregation',
  async () => {
    const storage = new Map([
      [
        'ajsee.tm.rateLimit.v1',
        JSON.stringify({
          until: Date.now() + 10 * 60_000,
          reason: 'provider_isolation_test',
          savedAt: Date.now()
        })
      ]
    ]);

    const localStorage = {
      getItem(key) {
        return storage.has(key)
          ? storage.get(key)
          : null;
      },

      setItem(key, value) {
        storage.set(
          String(key),
          String(value)
        );
      },

      removeItem(key) {
        storage.delete(key);
      }
    };

    globalThis.window = {
      localStorage,
      location: {
        hostname: 'ajsee.test',
        search: ''
      },
      __ajsee: {},
      dispatchEvent() {
        return true;
      }
    };

    globalThis.document = {
      documentElement: {
        lang: 'cs'
      }
    };

    globalThis.location = {
      search: ''
    };

    globalThis.CustomEvent =
      class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      };

    let ticketmasterRequests = 0;
    let smsticketRequests = 0;

    globalThis.fetch =
      async (input) => {
        const url =
          String(input);

        if (
          url.includes(
            'ticketmasterEvents'
          )
        ) {
          ticketmasterRequests += 1;

          throw new Error(
            'Ticketmaster network request must not happen during cooldown'
          );
        }

        if (
          url.includes(
            '/data/smsticket-events'
          )
        ) {
          smsticketRequests += 1;

          return {
            ok: true,

            async json() {
              return {
                events: [
                  {
                    id:
                      'smsticket-provider-isolation-test',

                    sourceId:
                      'provider-isolation-test',

                    title: {
                      cs:
                        'Provider isolation test'
                    },

                    description: {
                      cs:
                        'Test event'
                    },

                    category:
                      'concert',

                    datetime:
                      '2099-01-01T20:00:00',

                    bookingEndsAt:
                      '2099-01-01',

                    location: {
                      city:
                        'Praha',

                      country:
                        'CZ',

                      lat:
                        50.0755,

                      lon:
                        14.4378
                    },

                    venue: {
                      city:
                        'Praha',

                      name:
                        'Test venue'
                    },

                    partner:
                      'smsticket',

                    sourceName:
                      'SMS Ticket',

                    tickets:
                      'https://www.smsticket.cz/',

                    url:
                      'https://www.smsticket.cz/'
                  }
                ]
              };
            }
          };
        }

        throw new Error(
          `Unexpected fetch in provider isolation test: ${url}`
        );
      };

    try {
      const module =
        await import(
          `../src/api/eventsApi.js?provider-isolation=${Date.now()}`
        );

      const events =
        await module.fetchEvents({
          locale:
            'cs',

          filters: {
            countryCode:
              'CZ',

            page:
              0,

            size:
              12
          }
        });

      assert.equal(
        ticketmasterRequests,
        0,
        'Ticketmaster must not make a network request while cooldown is active'
      );

      assert.equal(
        smsticketRequests,
        1,
        'SMS Ticket must still be loaded'
      );

      assert.ok(
        events.length > 0,
        'Aggregation must return events from another provider'
      );

      assert.equal(
        events[0].partner,
        'smsticket'
      );
    } finally {
      delete globalThis.fetch;
      delete globalThis.CustomEvent;
      delete globalThis.location;
      delete globalThis.document;
      delete globalThis.window;
    }
  }
);

test(
  'events page loads providers before showing Ticketmaster rate-limit fallback',
  () => {
    const source =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    const marker =
      source.indexOf(
        'AJSEE_PROVIDER_ISOLATION_v1'
      );

    assert.notEqual(
      marker,
      -1,
      'provider-isolation marker is missing'
    );

    const ensureLoad =
      source.indexOf(
        'await ensureEventsPageLoaded(locale, api, pagination.page);',
        marker
      );

    assert.notEqual(
      ensureLoad,
      -1,
      'events provider loading call is missing'
    );

    const rateLimitFallback =
      source.indexOf(
        "renderEventsStateMessage('rateLimit');",
        ensureLoad
      );

    assert.ok(
      rateLimitFallback > ensureLoad,
      'Ticketmaster rate-limit fallback must run only after provider loading'
    );
  }
);

test(
  'events page does not bypass provider aggregation with a global Ticketmaster rate-limit listener',
  () => {
    const source =
      readFileSync(
        new URL(
          '../src/events-entry.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.equal(
      source.includes(
        'bindTicketmasterRateLimitEvents'
      ),
      false,
      'events page must not bind a global Ticketmaster rate-limit handler'
    );

    assert.equal(
      source.includes(
        'ajsee:ticketmaster-rate-limit'
      ),
      false,
      'legacy Ticketmaster rate-limit event listener must stay removed'
    );

    assert.equal(
      source.includes(
        'AJSEE:ticketmaster-rate-limit'
      ),
      false,
      'legacy Ticketmaster rate-limit event listener must stay removed'
    );
  }
);
