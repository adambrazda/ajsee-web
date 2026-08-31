import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeColosseumFeed
} from '../scripts/sync-colosseumticket-events.mjs';

import {
  COLOSSEUMTICKET_MARKET_COUNTRY_CODE
} from '../src/adapters/colosseumticket.js';


function rawParent() {
  return {
    '@_id':
      'geo-parent',

    eventname:
      'Geography source truth test',

    type: {
      category: {
        '#text':
          'Divadlo',

        '@_id':
          '5417324'
      }
    },

    CENA:
      '100 Kč',

    DESCRIPTION:
      'Test',

    url:
      'https://colosseumticket.cz/cs/akce/geo-test',

    imageurl:
      '',

    'TERMÍNY': {
      'TERMÍN': {
        ID_TERMIN:
          'geo-term',

        CENA:
          '100 Kč',

        location: {
          locationname:
            'Test Venue',

          city:
            'Praha',

          street:
            'Testovací 1'
        },

        ADDRESS:
          'Testovací 1, Praha',

        eventdate: {
          datefrom:
            '01/09/2026',

          timefrom:
            '19:00:00',

          seats: {
            '#text':
              '10',

            '@_status':
              'available'
          },

          url_objednavka:
            'https://colosseumticket.cz/cs/akce/geo-test'
        }
      }
    }
  };
}


test(
  'Colosseum normalization does not invent canonical country metadata',
  () => {
    const normalized =
      normalizeColosseumFeed([
        rawParent()
      ]);

    assert.equal(
      normalized.events.length,
      1
    );

    const event =
      normalized.events[0];

    assert.equal(
      event.location.city,
      'Praha'
    );

    assert.equal(
      Object.hasOwn(
        event.location,
        'country'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        event.venue,
        'country'
      ),
      false
    );
  }
);


test(
  'AJSEE market scope is separate from canonical event geography',
  () => {
    assert.equal(
      COLOSSEUMTICKET_MARKET_COUNTRY_CODE,
      'CZ'
    );
  }
);
