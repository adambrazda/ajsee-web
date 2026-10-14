import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeColosseumFeed
} from '../scripts/sync-colosseumticket-events.mjs';

import {
  COLOSSEUMTICKET_MARKET_COUNTRY_CODE
} from '../src/adapters/colosseumticket.js';
import { COLOSSEUM_VENUE_LOCATIONS } from '../shared/geo/colosseum-venue-locations.js';
import { withColosseumGeography, colosseumVenueKey } from '../shared/geo/colosseum-geography.js';
import { eventCoordinates } from '../shared/geo/coordinates.js';


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

test('the reviewed registry has distinct identities, Czech address points and source evidence', () => {
  assert.ok(COLOSSEUM_VENUE_LOCATIONS.length > 100);
  const identities = new Map();
  for (const venue of COLOSSEUM_VENUE_LOCATIONS) {
    assert.ok(venue.venue && venue.city && venue.matchedAddress && /^\d{4}-\d{2}-\d{2}$/.test(venue.verifiedAt));
    assert.ok(venue.lat > 48 && venue.lat < 52 && venue.lon > 12 && venue.lon < 19);
    assert.ok(['ags.cuzk.gov.cz', 'www.karlovarske-divadlo.cz'].includes(new URL(venue.verificationUrl).hostname));
    for (const city of [venue.city, ...(venue.cityAliases || [])]) {
      for (const street of [venue.street, ...(venue.streetAliases || [])]) {
        const key = colosseumVenueKey({ ...venue, city, street });
        if (identities.has(key)) assert.deepEqual(identities.get(key), [venue.lat, venue.lon]);
        identities.set(key, [venue.lat, venue.lon]);
      }
    }
  }
});

test('verified occurrence locations enrich both normalization and legacy feeds without changing ticket URLs', () => {
  const raw = rawParent();
  const venue = COLOSSEUM_VENUE_LOCATIONS.find(venue => venue.venue === 'Státní opera Praha');
  const term = raw['TERMÍNY']['TERMÍN'];
  term.location = { locationname: venue.venue, city: venue.city, street: venue.street };
  const normalized = normalizeColosseumFeed([raw]).events[0];
  assert.deepEqual(eventCoordinates(normalized), { lat: venue.lat, lon: venue.lon });
  assert.equal(normalized.location.country, 'CZ');
  assert.equal(normalized.sourceMeta.geography.precision, 'address');
  const legacy = { id: 'legacy', venue: { name: venue.venue, city: venue.city, address: { street: venue.street } },
    location: { city: venue.city }, tickets: 'https://colosseumticket.cz/cs/akce/legacy?a_box=kept', priceFrom: '100 Kč' };
  const enriched = withColosseumGeography(legacy);
  assert.deepEqual(eventCoordinates(enriched), eventCoordinates(normalized));
  assert.equal(enriched.tickets, legacy.tickets);
  assert.equal(enriched.priceFrom, legacy.priceFrom);
  assert.equal(eventCoordinates(legacy), null, 'enrichment must not mutate cached provider input');
});

test('unknown places, conflicting countries and changed street numbers never inherit a city or another venue location', () => {
  const base = { location: { city: 'Praha' }, venue: { name: 'Národní divadlo', city: 'Praha', address: { street: 'Národní 2' } } };
  assert.ok(eventCoordinates(withColosseumGeography(base)));
  for (const event of [
    { ...base, location: { city: 'Brno' } },
    { ...base, venue: { ...base.venue, address: { street: 'Národní 20' } } },
    { ...base, venue: { ...base.venue, name: 'Unknown venue' } },
    { ...base, location: { city: 'Praha', country: 'DE' } },
    { location: { city: 'Brno' }, venue: { name: 'EXTERNÍ - Brno' } },
    { location: { city: 'Turnov' }, venue: { name: 'Kulturní dům Pěnčín', address: { street: 'Turnov 123' } } }
  ]) assert.equal(withColosseumGeography(event), event);
  const declared = { ...base, location: { city: 'Praha', lat: 50.1, lon: 14.4 } };
  assert.equal(withColosseumGeography(declared), declared, 'valid provider coordinates remain authoritative');
});


test(
  'AJSEE market scope is separate from canonical event geography',
  () => {
    assert.equal(
      COLOSSEUMTICKET_MARKET_COUNTRY_CODE,
      'CZ'
    );
  }
);
