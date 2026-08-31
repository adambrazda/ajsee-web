import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeColosseumFeed,
  parseColosseumPrice,
  parseColosseumXml
} from '../scripts/sync-colosseumticket-events.mjs';

test(
  'parses Colosseum single and range CZK prices',
  () => {
    assert.deepEqual(
      parseColosseumPrice(
        '250 - 1390 Kč'
      ),
      {
        raw: '250 - 1390 Kč',
        min: 250,
        max: 1390,
        currency: 'CZK'
      }
    );

    assert.deepEqual(
      parseColosseumPrice(
        '445 Kč'
      ),
      {
        raw: '445 Kč',
        min: 445,
        max: 445,
        currency: 'CZK'
      }
    );
  }
);

test(
  'materializes TERMÍN nodes as canonical AJSEE occurrences',
  () => {
    const xml = `
      <events>
        <event id="62505388">
          <eventname>Prodaná nevěsta</eventname>
          <type>Divadlo</type>
          <CENA>190 - 1390 Kč</CENA>
          <DESCRIPTION>Popis akce</DESCRIPTION>
          <GALLERY>https://example.com/gallery-1.jpg</GALLERY>
          <url>https://colosseumticket.cz/cs/akce/62505388-test</url>
          <imageurl>https://example.com/main.jpg</imageurl>

          <TERMÍNY>
            <TERMÍN>
              <ID_TERMIN>term-a</ID_TERMIN>
              <CENA>250 - 1390 Kč</CENA>

              <location>
                <locationname>Národní divadlo</locationname>
                <city>Praha</city>
                <street>Národní 2</street>
              </location>

              <ADDRESS>Národní 2, Praha</ADDRESS>

              <eventdate>
                <datefrom>30/08/2026</datefrom>
                <timefrom>19:00:00</timefrom>
                <seats status="available">229</seats>
                <note></note>
                <url_objednavka>https://colosseumticket.cz/cs/akce/62505388-test</url_objednavka>
              </eventdate>
            </TERMÍN>
          </TERMÍNY>
        </event>
      </events>
    `;

    const raw =
      parseColosseumXml(
        xml
      );

    const result =
      normalizeColosseumFeed(
        raw
      );

    assert.equal(
      result.events.length,
      1
    );

    const event =
      result.events[0];

    assert.equal(
      event.id,
      'colosseumticket-62505388-term-a'
    );

    assert.equal(
      event.sourceId,
      '62505388:term-a'
    );

    assert.equal(
      event.providerEventId,
      '62505388'
    );

    assert.equal(
      event.providerOccurrenceId,
      'term-a'
    );

    assert.equal(
      event.datetime,
      '2026-08-30T19:00:00'
    );

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

    assert.equal(
      event.venue.name,
      'Národní divadlo'
    );

    assert.equal(
      event.price.min,
      250
    );

    assert.equal(
      event.price.max,
      1390
    );

    assert.equal(
      event.currency,
      'CZK'
    );

    assert.deepEqual(
      event.priceOptions,
      [
        {
          amount: 250,
          currency: 'CZK'
        }
      ]
    );

    assert.equal(
      event.seats,
      229
    );

    assert.equal(
      event.sourceMeta.seatsStatus,
      'available'
    );

    assert.equal(
      event.availability,
      null
    );

    assert.equal(
      event.affiliate.provider,
      'colosseumticket'
    );
  }
);

test(
  'same raw term id under different parents remains uniquely addressable',
  () => {
    const makeParent =
      (id, name) => ({
        '@_id': id,

        eventname: name,
        type: 'Hudba',
        CENA: '500 Kč',
        DESCRIPTION: '',
        imageurl:
          'https://example.com/image.jpg',
        url:
          `https://example.com/${id}`,

        'TERMÍNY': {
          'TERMÍN': {
            ID_TERMIN:
              'shared-term',

            CENA:
              '500 Kč',

            location: {
              locationname:
                'Venue',
              city:
                'Praha',
              street:
                ''
            },

            ADDRESS:
              'Praha',

            eventdate: {
              datefrom:
                '01/09/2026',
              timefrom:
                '20:00:00',
              seats: {
                '#text':
                  '0',
                '@_status':
                  'available'
              },
              note:
                '',
              url_objednavka:
                `https://example.com/${id}`
            }
          }
        }
      });

    const result =
      normalizeColosseumFeed(
        [
          makeParent(
            'parent-a',
            'Event A'
          ),
          makeParent(
            'parent-b',
            'Event B'
          )
        ]
      );

    assert.equal(
      result.events.length,
      2
    );

    assert.equal(
      new Set(
        result.events.map(
          (event) =>
            event.id
        )
      ).size,
      2
    );

    assert.deepEqual(
      result.stats
        .duplicateRawTermIds,
      [
        {
          id:
            'shared-term',
          count:
            2
        }
      ]
    );

    assert.equal(
      result.events[0]
        .seats,
      0
    );

    assert.equal(
      result.events[0]
        .sourceMeta
        .seatsStatus,
      'available'
    );

    assert.equal(
      result.events[0]
        .availability,
      null
    );
  }
);

test(
  'parents without TERMÍN are skipped and counted',
  () => {
    const result =
      normalizeColosseumFeed(
        [
          {
            '@_id':
              'no-term',

            eventname:
              'No term',

            'TERMÍNY': {}
          }
        ]
      );

    assert.equal(
      result.events.length,
      0
    );

    assert.equal(
      result.stats
        .zeroTermParents,
      1
    );
  }
);

test(
  'rejects XML entity declarations before parsing provider data',
  () => {
    assert.throws(
      () =>
        parseColosseumXml(
          '<!DOCTYPE events [<!ENTITY x "unsafe">]><events><event>&x;</event></events>'
        ),
      /forbidden XML entity declaration/
    );
  }
);

test(
  'preserves structured Colosseum type/category labels and provider ids',
  () => {
    const result =
      normalizeColosseumFeed([
        {
          '@_id':
            'structured-parent',

          eventname:
            'Structured event',

          type: {
            category: [
              {
                '#text':
                  'Divadlo',
                '@_id':
                  '5417324'
              },
              {
                '#text':
                  'Pro děti',
                '@_id':
                  '5417323'
              }
            ]
          },

          CENA:
            '300 Kč',

          DESCRIPTION:
            '',

          imageurl:
            'https://example.com/image.jpg',

          url:
            'https://example.com/event',

          'TERMÍNY': {
            'TERMÍN': {
              ID_TERMIN:
                'structured-term',

              CENA:
                '300 Kč',

              location: {
                locationname:
                  'Venue',

                city:
                  'Praha',

                street:
                  ''
              },

              ADDRESS:
                'Praha',

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

                note:
                  '',

                url_objednavka:
                  'https://example.com/event'
              }
            }
          }
        }
      ]);

    assert.equal(
      result.events.length,
      1
    );

    const event =
      result.events[0];

    assert.deepEqual(
      event.categories,
      [
        'Divadlo',
        'Pro děti'
      ]
    );

    assert.deepEqual(
      event.types,
      [
        'Divadlo',
        'Pro děti'
      ]
    );

    assert.deepEqual(
      event.sourceMeta.rawCategories,
      [
        'Divadlo',
        'Pro děti'
      ]
    );

    assert.deepEqual(
      event.sourceMeta.rawCategoryIds,
      [
        '5417324',
        '5417323'
      ]
    );

    assert.equal(
      event.sourceMeta.rawType,
      'DivadloPro děti'
    );
  }
);
