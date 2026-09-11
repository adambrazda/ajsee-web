
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeColosseumFeed,
  normalizeColosseumPurchaseUrl,
  requireColosseumAffiliateBox
} from '../scripts/sync-colosseumticket-events.mjs';


function rawParent({
  id,
  termId = 'term-1',
  price = '500 Kč',
  orderUrl =
    'https://colosseumticket.cz/cs/akce/test',
  date =
    '01/10/2099'
}) {
  return {
    '@_id':
      id,

    eventname:
      `Event ${id}`,

    type:
      'Divadlo',

    CENA:
      price,

    DESCRIPTION:
      '',

    imageurl:
      '',

    url:
      'https://colosseumticket.cz/cs/',

    'TERMÍNY': {
      'TERMÍN': {
        ID_TERMIN:
          termId,

        CENA:
          price,

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
            date,

          timefrom:
            '19:00:00',

          seats: {
            '#text':
              '0',

            '@_status':
              'available'
          },

          note:
            '',

          url_objednavka:
            orderUrl
        }
      }
    }
  };
}


test(
  'zero provider price remains source metadata but is never exposed as free',
  () => {
    const result =
      normalizeColosseumFeed([
        rawParent({
          id:
            'zero-price',

          price:
            '0 Kč'
        })
      ]);

    assert.equal(
      result.events.length,
      1
    );

    const event =
      result.events[0];

    assert.equal(
      event.priceFrom,
      ''
    );

    assert.equal(
      event.currency,
      ''
    );

    assert.equal(
      event.price.min,
      null
    );

    assert.equal(
      event.price.max,
      null
    );

    assert.deepEqual(
      event.priceOptions,
      []
    );

    assert.equal(
      event.sourceMeta.termPriceRaw,
      '0 Kč'
    );

    assert.equal(
      event.sourceMeta.termPriceMin,
      0
    );

    assert.equal(
      event.sourceMeta.priceState,
      'zero'
    );

    assert.equal(
      event.seats,
      0
    );

    assert.equal(
      event.availability,
      null
    );

    assert.equal(
      result.stats.rejectedOccurrences,
      0
    );

    assert.equal(
      result.stats.priceDiagnostics.zero,
      1
    );

    assert.equal(
      result.stats.priceDiagnostics.unknown,
      1
    );
  }
);


test(
  'missing and unparseable prices retain valid occurrences with unknown public price',
  () => {
    const result =
      normalizeColosseumFeed([
        rawParent({
          id:
            'missing-price',

          price:
            ''
        }),

        rawParent({
          id:
            'unparseable-price',

          price:
            'Cena dle sektoru'
        })
      ]);

    assert.equal(
      result.events.length,
      2
    );

    assert.equal(
      result.stats.rejectedOccurrences,
      0
    );

    assert.equal(
      result.stats.priceDiagnostics.missing,
      1
    );

    assert.equal(
      result.stats.priceDiagnostics.unparseable,
      1
    );

    assert.equal(
      result.stats.priceDiagnostics.unknown,
      2
    );

    for (
      const event of
      result.events
    ) {
      assert.equal(
        event.priceFrom,
        ''
      );

      assert.equal(
        event.price.min,
        null
      );

      assert.deepEqual(
        event.priceOptions,
        []
      );
    }
  }
);


test(
  'invalid purchase URLs fail closed with precise diagnostics',
  () => {
    const result =
      normalizeColosseumFeed([
        rawParent({
          id:
            'missing-url',

          orderUrl:
            ''
        }),

        rawParent({
          id:
            'http-url',

          orderUrl:
            'http://colosseumticket.cz/cs/akce/test'
        }),

        rawParent({
          id:
            'malformed-url',

          orderUrl:
            'not a url'
        }),

        rawParent({
          id:
            'foreign-host',

          orderUrl:
            'https://example.com/tickets'
        }),

        rawParent({
          id:
            'credentials',

          orderUrl:
            'https://user:pass@colosseumticket.cz/cs/akce/test'
        }),

        rawParent({
          id:
            'custom-port',

          orderUrl:
            'https://colosseumticket.cz:8443/cs/akce/test'
        })
      ]);

    assert.equal(
      result.events.length,
      0
    );

    assert.equal(
      result.stats.rejectedOccurrences,
      6
    );

    assert.equal(
      result.stats.rejectionReasons.missingPurchaseUrl,
      1
    );

    assert.equal(
      result.stats.rejectionReasons.insecurePurchaseUrl,
      1
    );

    assert.equal(
      result.stats.rejectionReasons.malformedPurchaseUrl,
      1
    );

    assert.equal(
      result.stats.rejectionReasons.untrustedPurchaseHost,
      1
    );

    assert.equal(
      result.stats.rejectionReasons.credentialedPurchaseUrl,
      1
    );

    assert.equal(
      result.stats.rejectionReasons.unexpectedPurchasePort,
      1
    );
  }
);


test(
  'approved ColosseumTicket HTTPS hosts remain unchanged when affiliate mode is omitted',
  () => {
    for (
      const raw of
      [
        'https://colosseumticket.cz/cs/akce/test?foo=bar',
        'https://www.colosseumticket.cz/cs/akce/test?foo=bar'
      ]
    ) {
      assert.deepEqual(
        normalizeColosseumPurchaseUrl(
          raw
        ),
        {
          url:
            raw,

          rejectionReason:
            ''
        }
      );
    }
  }
);


test(
  'affiliate a_box is appended or replaced without losing provider parameters',
  () => {
    const result =
      normalizeColosseumPurchaseUrl(
        'https://colosseumticket.cz/cs/akce/test?foo=bar&a_box=old-value',
        {
          affiliateBox:
            'ajsee-test-affiliate'
        }
      );

    assert.equal(
      result.rejectionReason,
      ''
    );

    const url =
      new URL(
        result.url
      );

    assert.equal(
      url.protocol,
      'https:'
    );

    assert.equal(
      url.hostname,
      'colosseumticket.cz'
    );

    assert.equal(
      url.searchParams.get(
        'foo'
      ),
      'bar'
    );

    assert.equal(
      url.searchParams.get(
        'a_box'
      ),
      'ajsee-test-affiliate'
    );

    assert.equal(
      url.searchParams.getAll(
        'a_box'
      ).length,
      1
    );
  }
);


test(
  'production affiliate configuration rejects missing or unsafe values',
  () => {
    assert.throws(
      () =>
        requireColosseumAffiliateBox(
          ''
        ),
      /COLOSSEUMTICKET_A_BOX/
    );

    assert.throws(
      () =>
        requireColosseumAffiliateBox(
          'bad value'
        ),
      /invalid/
    );

    assert.equal(
      requireColosseumAffiliateBox(
        'valid_test-value'
      ),
      'valid_test-value'
    );
  }
);


test(
  'feed normalization applies affiliate URLs and suppresses provider images',
  () => {
    const parent =
      rawParent({
        id:
          'affiliate-image-safety'
      });

    parent.imageurl =
      'https://example.invalid/provider-image.jpg';

    parent.GALLERY =
      [
        'https://example.invalid/gallery-image.jpg'
      ];

    const result =
      normalizeColosseumFeed(
        [
          parent
        ],
        {
          affiliateBox:
            'ajsee-test-affiliate'
        }
      );

    assert.equal(
      result.events.length,
      1
    );

    const event =
      result.events[0];

    const purchaseUrl =
      new URL(
        event.url
      );

    assert.equal(
      purchaseUrl.searchParams.get(
        'a_box'
      ),
      'ajsee-test-affiliate'
    );

    assert.equal(
      event.tickets,
      event.url
    );

    assert.equal(
      event.rawUrl,
      event.url
    );

    assert.equal(
      event.image,
      ''
    );

    assert.deepEqual(
      event.gallery,
      []
    );
  }
);
