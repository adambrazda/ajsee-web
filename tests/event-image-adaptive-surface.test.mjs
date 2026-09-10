import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderSharedEventCard,
  sharedEventImageMatteUrl,
  wireSharedEventImageFraming
} from '../src/event-card.js';

test(
  'adaptive matte uses a one-pixel Netlify Image CDN transformation',
  () => {
    const url =
      sharedEventImageMatteUrl(
        'https://www.smsticket.cz/cdn/events/2026/1/example.jpg'
      );

    assert.match(
      url,
      /^\/\.netlify\/images\?/
    );

    const query =
      new URLSearchParams(
        url.split('?')[1]
      );

    assert.equal(
      query.get('url'),
      'https://www.smsticket.cz/cdn/events/2026/1/example.jpg'
    );

    assert.equal(
      query.get('w'),
      '1'
    );

    assert.equal(
      query.get('h'),
      '1'
    );

    assert.equal(
      query.get('fit'),
      'fill'
    );

    assert.equal(
      query.get('fm'),
      'webp'
    );
  }
);

test(
  'adaptive matte rejects non-network image sources',
  () => {
    assert.equal(
      sharedEventImageMatteUrl(
        'data:image/png;base64,abc'
      ),
      ''
    );

    assert.equal(
      sharedEventImageMatteUrl(
        'blob:https://ajsee.cz/example'
      ),
      ''
    );
  }
);

test(
  'shared event card exposes adaptive matte as presentation data',
  () => {
    const html =
      renderSharedEventCard({
        event: {
          partner:
            'smsticket',

          imagePresentation: {
            fit:
              'auto',

            x:
              50,

            y:
              50,

            surface:
              'adaptive-matte'
          }
        },

        modalId:
          'adaptive-test',

        titleHtml:
          'Adaptive Test',

        titleRaw:
          'Adaptive Test',

        imageSrc:
          'https://www.smsticket.cz/cdn/events/2026/1/example.jpg'
      });

    assert.match(
      html,
      /data-ajsee-image-surface="adaptive-matte"/
    );

    assert.match(
      html,
      /data-ajsee-image-fit="auto"/
    );
  }
);

test(
  'adaptive matte request is deferred until the foreground image resolves',
  () => {
    const attributes =
      new Map([
        [
          'data-ajsee-image-fit',
          'auto'
        ],
        [
          'data-ajsee-image-surface',
          'adaptive-matte'
        ]
      ]);

    const styleValues =
      new Map();

    const frame = {
      getAttribute(
        name
      ) {
        return (
          attributes.get(name) ||
          ''
        );
      },

      setAttribute(
        name,
        value
      ) {
        attributes.set(
          name,
          String(value)
        );
      },

      removeAttribute(
        name
      ) {
        attributes.delete(
          name
        );
      },

      style: {
        setProperty(
          name,
          value
        ) {
          styleValues.set(
            name,
            value
          );
        },

        removeProperty(
          name
        ) {
          styleValues.delete(
            name
          );
        }
      }
    };

    let loadHandler = null;

    const imageAttributes =
      new Map([
        [
          'data-ajsee-image-fit',
          'auto'
        ],
        [
          'src',
          'https://www.smsticket.cz/cdn/events/2026/1/example.jpg'
        ]
      ]);

    const image = {
      complete:
        false,

      naturalWidth:
        0,

      naturalHeight:
        0,

      currentSrc:
        'https://www.smsticket.cz/cdn/events/2026/1/example.jpg',

      getAttribute(
        name
      ) {
        return (
          imageAttributes.get(name) ||
          ''
        );
      },

      setAttribute(
        name,
        value
      ) {
        imageAttributes.set(
          name,
          String(value)
        );
      },

      closest() {
        return frame;
      },

      addEventListener(
        type,
        handler
      ) {
        if (
          type === 'load'
        ) {
          loadHandler =
            handler;
        }
      }
    };

    const root = {
      querySelectorAll() {
        return [
          image
        ];
      }
    };

    wireSharedEventImageFraming(
      root
    );

    assert.equal(
      styleValues.has(
        '--aj-event-image-matte'
      ),
      false
    );

    assert.equal(
      typeof loadHandler,
      'function'
    );

    image.complete =
      true;

    image.naturalWidth =
      242;

    image.naturalHeight =
      342;

    loadHandler();

    assert.equal(
      imageAttributes.get(
        'data-ajsee-image-fit'
      ),
      'contain'
    );

    assert.equal(
      attributes.get(
        'data-ajsee-image-fit'
      ),
      'contain'
    );

    assert.equal(
      attributes.get(
        'data-ajsee-image-matte'
      ),
      'ready'
    );

    assert.match(
      styleValues.get(
        '--aj-event-image-matte'
      ),
      /\.netlify\/images/
    );
  }
);

test(
  'adaptive matte CSS is a solid derived surface and never a blur backdrop',
  () => {
    const source =
      fs.readFileSync(
        'src/event-card.js',
        'utf8'
      );

    const matteStart =
      source.indexOf(
        'data-ajsee-image-surface="adaptive-matte"'
      );

    assert.notEqual(
      matteStart,
      -1
    );

    const cssStart =
      source.indexOf(
        '.event-card .event-image-frame::before'
      );

    assert.notEqual(
      cssStart,
      -1
    );

    const css =
      source.slice(
        cssStart,
        cssStart + 1500
      );

    assert.match(
      css,
      /saturate\(0\.42\)/
    );

    assert.doesNotMatch(
      css,
      /blur\s*\(/
    );
  }
);

test(
  'Netlify allows only the SMS Ticket event image path for remote transforms',
  () => {
    const config =
      fs.readFileSync(
        'netlify.toml',
        'utf8'
      );

    assert.match(
      config,
      /\[images\]/
    );

    assert.match(
      config,
      /https:\/\/www\\\.smsticket\\\.cz\/cdn\/events\/\.\*/
    );
  }
);
