import assert
  from 'node:assert/strict';

import test
  from 'node:test';

import {
  EVENT_TAXONOMY_VERSION,
  buildEventTaxonomy,
  buildSmsticketTaxonomy,
  buildTicketmasterTaxonomy,
  deriveLegacyCategory,
  withEventTaxonomy
} from '../src/taxonomy/event-taxonomy.js';

test(
  'SMS Ticket pop concert follows taxonomy v1 contract',
  () => {
    const taxonomy =
      buildSmsticketTaxonomy({
        category: 'music',
        categories: ['Hudba'],
        genres: ['Pop'],
        types: ['Koncert']
      });

    assert.deepEqual(
      taxonomy,
      {
        version:
          EVENT_TAXONOMY_VERSION,

        domains: ['music'],
        eventTypes: ['concert'],
        genres: ['pop'],
        audiences: [],

        source: {
          provider: 'smsticket',
          rawCategory: 'music',
          rawCategories: ['Hudba'],
          rawGenres: ['Pop'],
          rawTypes: ['Koncert']
        }
      }
    );

    assert.equal(
      deriveLegacyCategory(
        taxonomy
      ),
      'concert'
    );
  }
);

test(
  'family musical remains theatre-compatible and family discoverable',
  () => {
    const taxonomy =
      buildSmsticketTaxonomy({
        category: 'family',

        categories: [
          'Představení',
          'Děti'
        ],

        genres: [
          'Muzikál'
        ],

        types: [
          'Divadlo',
          'Show / Vystoupení'
        ]
      });

    assert.deepEqual(
      taxonomy.domains,
      ['stage']
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      [
        'theatre',
        'show'
      ]
    );

    assert.deepEqual(
      taxonomy.genres,
      ['musical']
    );

    assert.deepEqual(
      taxonomy.audiences,
      ['family']
    );

    assert.equal(
      deriveLegacyCategory(
        taxonomy
      ),
      'theatre'
    );
  }
);

test(
  'festival keeps legacy priority over concert',
  () => {
    const event =
      withEventTaxonomy({
        provider: 'smsticket',
        category: 'music',
        categories: ['Hudba'],
        genres: ['Rock'],

        types: [
          'Festival',
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
  }
);

test(
  'missing genres stay empty and are not invented',
  () => {
    const taxonomy =
      buildSmsticketTaxonomy({
        category: 'other',
        categories: ['Vzdělávání'],
        types: ['Přednáška']
      });

    assert.deepEqual(
      taxonomy.genres,
      []
    );

    assert.deepEqual(
      taxonomy.domains,
      ['experience']
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      ['talk']
    );

    assert.equal(
      deriveLegacyCategory(
        taxonomy
      ),
      'other'
    );
  }
);

test(
  'raw and normalized values are deduplicated without rewriting source labels',
  () => {
    const taxonomy =
      buildSmsticketTaxonomy({
        category: 'music',

        categories: [
          'Hudba',
          'Hudba'
        ],

        genres: [
          'Pop',
          'Pop'
        ],

        types: [
          'Koncert',
          'Koncert'
        ]
      });

    assert.deepEqual(
      taxonomy.genres,
      ['pop']
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      ['concert']
    );

    assert.deepEqual(
      taxonomy.source.rawCategories,
      ['Hudba']
    );

    assert.deepEqual(
      taxonomy.source.rawGenres,
      ['Pop']
    );

    assert.deepEqual(
      taxonomy.source.rawTypes,
      ['Koncert']
    );
  }
);

test(
  'Ticketmaster classification maps to the shared taxonomy contract',
  () => {
    const taxonomy =
      buildTicketmasterTaxonomy({
        name: 'Example musical',

        classifications: [
          {
            segment: {
              name: 'Arts & Theatre'
            },

            genre: {
              name: 'Theatre'
            },

            subGenre: {
              name: 'Musical'
            },

            type: {
              name: 'Event Style'
            },

            subType: {
              name: 'Theatre'
            }
          }
        ]
      });

    assert.deepEqual(
      taxonomy.domains,
      ['stage']
    );

    assert.ok(
      taxonomy.eventTypes.includes(
        'theatre'
      )
    );

    assert.deepEqual(
      taxonomy.genres,
      [
        'theatre',
        'musical'
      ]
    );

    assert.equal(
      taxonomy.source.provider,
      'ticketmaster'
    );

    assert.equal(
      taxonomy.source.rawCategory,
      'Arts & Theatre'
    );

    assert.deepEqual(
      taxonomy.source.rawGenres,
      [
        'Theatre',
        'Musical'
      ]
    );

    assert.deepEqual(
      taxonomy.source.rawTypes,
      [
        'Event Style',
        'Theatre'
      ]
    );

    assert.equal(
      deriveLegacyCategory(
        taxonomy
      ),
      'theatre'
    );
  }
);

test(
  'generic builder rejects unsupported providers instead of guessing',
  () => {
    assert.throws(
      () =>
        buildEventTaxonomy(
          {},
          'unknown-provider'
        ),

      /Unsupported event taxonomy provider/
    );
  }
);