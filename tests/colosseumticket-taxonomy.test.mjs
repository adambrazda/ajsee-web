import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildColosseumTicketTaxonomy,
  buildEventTaxonomy,
  deriveLegacyCategory,
  tokenizeColosseumTicketType
} from '../src/taxonomy/event-taxonomy.js';

import {
  matchesEventDiscoveryFilters
} from '../src/taxonomy/event-filtering.js';


test(
  'tokenizes concatenated Colosseum type deterministically',
  () => {
    assert.deepEqual(
      tokenizeColosseumTicketType(
        'OstatníMuzikálHudbaDivadloPro děti'
      ),
      [
        'Ostatní',
        'Muzikál',
        'Hudba',
        'Divadlo',
        'Pro děti'
      ]
    );
  }
);


test(
  'maps Colosseum theatre music and family dimensions',
  () => {
    const taxonomy =
      buildColosseumTicketTaxonomy({
        sourceMeta: {
          rawType:
            'DivadloHudbaPro děti'
        }
      });

    assert.deepEqual(
      taxonomy.domains,
      [
        'stage',
        'music'
      ]
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      [
        'theatre',
        'concert'
      ]
    );

    assert.deepEqual(
      taxonomy.genres,
      [
        'children'
      ]
    );

    assert.deepEqual(
      taxonomy.audiences,
      [
        'family'
      ]
    );

    assert.equal(
      taxonomy.source.provider,
      'colosseumticket'
    );

    const event = {
      category:
        deriveLegacyCategory(
          taxonomy
        ),
      taxonomy
    };

    assert.equal(
      event.category,
      'concert'
    );

    assert.equal(
      matchesEventDiscoveryFilters(
        event,
        {
          category:
            'concert'
        }
      ),
      true
    );

    assert.equal(
      matchesEventDiscoveryFilters(
        event,
        {
          category:
            'theatre'
        }
      ),
      true
    );

    assert.equal(
      matchesEventDiscoveryFilters(
        event,
        {
          audience:
            'family'
        }
      ),
      true
    );
  }
);


test(
  'maps Colosseum musical to stage and musical genre',
  () => {
    const taxonomy =
      buildColosseumTicketTaxonomy({
        types: [
          'MuzikálPro děti'
        ]
      });

    assert.deepEqual(
      taxonomy.domains,
      [
        'stage'
      ]
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      [
        'theatre'
      ]
    );

    assert.deepEqual(
      taxonomy.genres,
      [
        'musical',
        'children'
      ]
    );

    assert.deepEqual(
      taxonomy.audiences,
      [
        'family'
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
  'maps Colosseum festival music with festival legacy priority',
  () => {
    const taxonomy =
      buildEventTaxonomy(
        {
          types: [
            'HudbaFestival'
          ]
        },
        'colosseumticket'
      );

    assert.equal(
      taxonomy.source.provider,
      'colosseumticket'
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      [
        'festival',
        'concert'
      ]
    );

    assert.equal(
      deriveLegacyCategory(
        taxonomy
      ),
      'festival'
    );
  }
);


test(
  'maps Colosseum tour cinema and other without inventing metadata',
  () => {
    const tour =
      buildColosseumTicketTaxonomy({
        types: [
          'Prohlídky'
        ]
      });

    assert.deepEqual(
      tour.domains,
      [
        'experience'
      ]
    );

    assert.deepEqual(
      tour.eventTypes,
      [
        'tour'
      ]
    );

    const cinema =
      buildColosseumTicketTaxonomy({
        types: [
          'Kino'
        ]
      });

    assert.deepEqual(
      cinema.domains,
      [
        'film'
      ]
    );

    assert.deepEqual(
      cinema.eventTypes,
      [
        'cinema'
      ]
    );

    const other =
      buildColosseumTicketTaxonomy({
        types: [
          'Ostatní'
        ]
      });

    assert.deepEqual(
      other.domains,
      [
        'other'
      ]
    );

    assert.deepEqual(
      other.eventTypes,
      []
    );

    assert.deepEqual(
      other.genres,
      []
    );

    assert.deepEqual(
      other.audiences,
      []
    );
  }
);

test(
  'prefers structured provider categories over concatenated fallback metadata',
  () => {
    const taxonomy =
      buildColosseumTicketTaxonomy({
        sourceMeta: {
          rawType:
            'Ostatní',

          rawCategories: [
            'Divadlo',
            'Pro děti'
          ]
        }
      });

    assert.deepEqual(
      taxonomy.domains,
      [
        'stage'
      ]
    );

    assert.deepEqual(
      taxonomy.eventTypes,
      [
        'theatre'
      ]
    );

    assert.deepEqual(
      taxonomy.audiences,
      [
        'family'
      ]
    );

    assert.deepEqual(
      taxonomy.source.rawCategories,
      [
        'Divadlo',
        'Pro děti'
      ]
    );
  }
);
