import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapTicketmasterEvent
} from '../src/adapters/ticketmaster.js';

function rawEvent(
  images = []
) {
  return {
    id: 'image-test',
    name: 'Image Test Event',

    images,

    dates: {
      start: {
        localDate:
          '2026-10-10'
      }
    },

    _embedded: {
      venues: [
        {
          name:
            'Test Venue',

          city: {
            name:
              'Praha'
          },

          country: {
            countryCode:
              'CZ'
          }
        }
      ]
    }
  };
}

function mapImages(
  images
) {
  return mapTicketmasterEvent(
    rawEvent(
      images
    ),
    'cs'
  );
}

test(
  'Ticketmaster prefers an adequately sized native 4:3 asset for the canonical event frame',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/event-16-9.jpg',
          width: 640,
          height: 360,
          ratio: '16_9'
        },
        {
          url:
            'https://example.com/event-4-3.jpg',
          width: 640,
          height: 480,
          ratio: '4_3',
          fallback: false,
          attribution: 'Photo: Example'
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/event-4-3.jpg'
    );

    assert.deepEqual(
      event.imageAsset,
      {
        url:
          'https://example.com/event-4-3.jpg',
        width: 640,
        height: 480,
        ratio: '4_3',
        fallback: false,
        attribution: 'Photo: Example'
      }
    );

    assert.deepEqual(
      event.imagePresentation,
      {
        fit: 'cover',
        x: 50,
        y: 50,
        source: 'provider',
        version: 2
      }
    );
  }
);

test(
  'Ticketmaster does not prefer a tiny 4:3 thumbnail over an adequately sized card asset',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/tiny-4-3.jpg',
          width: 320,
          height: 240,
          ratio: '4_3'
        },
        {
          url:
            'https://example.com/usable-16-9.jpg',
          width: 640,
          height: 360,
          ratio: '16_9'
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/usable-16-9.jpg'
    );

    assert.equal(
      event.imagePresentation,
      undefined
    );
  }
);

test(
  'Ticketmaster prefers 3:2 over 16:9 when both assets are suitable and 4:3 is unavailable',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/event-16-9.jpg',
          width: 640,
          height: 360,
          ratio: '16_9'
        },
        {
          url:
            'https://example.com/event-3-2.jpg',
          width: 640,
          height: 427,
          ratio: '3_2'
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/event-3-2.jpg'
    );

    assert.deepEqual(
      event.imageAsset,
      {
        url:
          'https://example.com/event-3-2.jpg',
        width: 640,
        height: 427,
        ratio: '3_2',
        fallback: false,
        attribution: ''
      }
    );

    assert.equal(
      event.imagePresentation,
      undefined
    );
  }
);

test(
  'Ticketmaster prefers event-specific artwork over a same-quality fallback image',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/fallback-4-3.jpg',
          width: 640,
          height: 480,
          ratio: '4_3',
          fallback: true
        },
        {
          url:
            'https://example.com/event-specific-16-9.jpg',
          width: 640,
          height: 360,
          ratio: '16_9',
          fallback: false
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/event-specific-16-9.jpg'
    );

    assert.equal(
      event.imageAsset?.fallback,
      false
    );

    assert.equal(
      event.imagePresentation,
      undefined
    );
  }
);

test(
  'Ticketmaster ignores SOURCE artwork when a normal card-sized asset exists',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/event_SOURCE',
          width: 2048,
          height: 1536,
          ratio: '4_3'
        },
        {
          url:
            'https://example.com/event-card.jpg',
          width: 640,
          height: 360,
          ratio: '16_9'
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/event-card.jpg'
    );
  }
);

test(
  'Ticketmaster recognizes geometric 4:3 even when provider ratio metadata is missing',
  () => {
    const event =
      mapImages([
        {
          url:
            'https://example.com/geometric-4-3.jpg',
          width: 640,
          height: 480
        }
      ]);

    assert.equal(
      event.image,
      'https://example.com/geometric-4-3.jpg'
    );

    assert.equal(
      event.imageAsset?.ratio,
      ''
    );

    assert.equal(
      event.imagePresentation?.fit,
      'cover'
    );

    assert.equal(
      event.imagePresentation?.source,
      'provider'
    );
  }
);
