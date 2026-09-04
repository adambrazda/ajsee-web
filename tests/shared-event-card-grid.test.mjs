import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderSharedEventCard,
  sharedEventImageFitForDimensions,
  wireSharedEventImageFraming
} from '../src/event-card.js';

const sharedSource = fs.readFileSync(
  new URL('../src/event-card.js', import.meta.url),
  'utf8'
);

const homeSource = fs.readFileSync(
  new URL('../src/home-entry.js', import.meta.url),
  'utf8'
);

const eventsSource = fs.readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
  'utf8'
);

test(
  'shared event card contains the canonical AJSEE card contract',
  () => {
    const html = renderSharedEventCard({
      event: {
        partner: 'ticketmaster',
        location: {
          city: 'Praha'
        },
        venue: {
          name: 'O2 arena',
          city: 'Praha 9'
        }
      },
      modalId: 'ticketmaster-test-1',
      titleHtml: 'Test event',
      titleRaw: 'Test event',
      dateHtml: '20. května 2027',
      imageSrc: 'https://example.com/image.jpg',
      ticketsHref: 'https://example.com/tickets',
      detailLabelHtml: 'Zjistit více',
      ticketLabelHtml: 'Vstupenky'
    });

    assert.match(
      html,
      /class="event-card"/
    );

    assert.match(
      html,
      /O2 arena · Praha/
    );

    assert.match(
      html,
      /Ticketmaster/
    );

    assert.match(
      html,
      /class="btn-event ticket js-partner-click"/
    );

    assert.match(
      html,
      /data-placement="event_card"/
    );

    assert.match(
      html,
      /data-event-id="ticketmaster-test-1"/
    );
  }
);

test(
  'homepage and events page use the same event-card renderer',
  () => {
    assert.match(
      homeSource,
      /renderSharedEventCard\(\{/
    );

    assert.match(
      eventsSource,
      /renderSharedEventCard\(\{/
    );

    assert.match(
      homeSource,
      /ensureSharedEventGridStyles\(\)/
    );

    assert.match(
      eventsSource,
      /ensureSharedEventGridStyles\(\)/
    );
  }
);

test(
  'legacy events-only grid injection is removed',
  () => {
    assert.doesNotMatch(
      eventsSource,
      /ajsee-events-card-grid-v1-css/
    );
  }
);

test(
  'shared grid owns responsive card sizing',
  () => {
    assert.match(
      sharedSource,
      /max-width:\s*1440px/
    );

    assert.match(
      sharedSource,
      /@media\s*\(min-width:\s*1024px\)/
    );

    assert.match(
      sharedSource,
      /@media\s*\(min-width:\s*1536px\)[\s\S]*repeat\(\s*4,\s*minmax\(0,\s*1fr\)\s*\)/
    );

    assert.match(
      sharedSource,
      /max-width:\s*24rem/
    );

    assert.match(
      sharedSource,
      /@media\s*\(max-width:\s*700px\)/
    );
  }
);

test(
  'homepage no longer owns its own event-card markup',
  () => {
    assert.doesNotMatch(
      homeSource,
      /<article class="event-card" data-event-id=/
    );
  }
);

test(
  'shared event image framing keeps landscape photos covered and preserves poster-like images',
  () => {
    assert.equal(
      sharedEventImageFitForDimensions(
        1600,
        900
      ),
      'cover'
    );

    assert.equal(
      sharedEventImageFitForDimensions(
        1200,
        800
      ),
      'cover'
    );

    assert.equal(
      sharedEventImageFitForDimensions(
        1200,
        1000
      ),
      'contain'
    );

    assert.equal(
      sharedEventImageFitForDimensions(
        1000,
        1000
      ),
      'contain'
    );

    assert.equal(
      sharedEventImageFitForDimensions(
        800,
        1200
      ),
      'contain'
    );
  }
);

test(
  'shared event card supports explicit image fit and focal point',
  () => {
    const html =
      renderSharedEventCard({
        event: {
          imagePresentation: {
            fit: 'cover',
            x: 50,
            y: 20
          }
        },

        modalId:
          'focal-test',

        titleHtml:
          'Focal test',

        titleRaw:
          'Focal test',

        imageSrc:
          'https://example.com/focal.jpg'
      });

    assert.match(
      html,
      /data-ajsee-image-fit="cover"/
    );

    assert.match(
      html,
      /object-position: 50% 20%;/
    );
  }
);

test(
  'shared event image framing resolves auto mode from intrinsic dimensions',
  () => {
    const attributes =
      new Map([
        [
          'data-ajsee-image-fit',
          'auto'
        ]
      ]);

    const image = {
      complete: true,
      naturalWidth: 800,
      naturalHeight: 1200,

      setAttribute(
        name,
        value
      ) {
        attributes.set(
          name,
          value
        );
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
      attributes.get(
        'data-ajsee-image-fit'
      ),
      'contain'
    );
  }
);

test(
  'homepage and events wire shared event image framing after rendering cards',
  () => {
    assert.match(
      homeSource,
      /wireSharedEventImageFraming\(list\)/
    );

    assert.match(
      eventsSource,
      /wireSharedEventImageFraming\(list\)/
    );
  }
);


test(
  'shared event card wraps images in the canonical image frame',
  () => {
    const html =
      renderSharedEventCard({
        event: {},
        modalId:
          'image-frame-test',
        titleHtml:
          'Image frame test',
        titleRaw:
          'Image frame test',
        imageSrc:
          'https://example.com/image.jpg'
      });

    assert.match(
      html,
      /class="event-image-frame"/
    );

    assert.match(
      html,
      /class="event-img"/
    );
  }
);

test(
  'shared contain image framing adds a decorative blurred backdrop',
  () => {
    let insertedBackdrop =
      null;

    const frameAttributes =
      new Map();

    const frame = {
      setAttribute(
        name,
        value
      ) {
        frameAttributes.set(
          name,
          value
        );
      },

      querySelector() {
        return null;
      },

      insertBefore(
        node
      ) {
        insertedBackdrop =
          node;
      }
    };

    const imageAttributes =
      new Map([
        [
          'data-ajsee-image-fit',
          'auto'
        ]
      ]);

    const backdropAttributes =
      new Map();

    const backdrop = {
      setAttribute(
        name,
        value
      ) {
        backdropAttributes.set(
          name,
          value
        );
      },

      removeAttribute(
        name
      ) {
        backdropAttributes.delete(
          name
        );
      }
    };

    const image = {
      complete: true,
      naturalWidth: 800,
      naturalHeight: 1200,

      getAttribute(
        name
      ) {
        return imageAttributes.get(
          name
        );
      },

      setAttribute(
        name,
        value
      ) {
        imageAttributes.set(
          name,
          value
        );
      },

      closest() {
        return frame;
      },

      cloneNode() {
        return backdrop;
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
      imageAttributes.get(
        'data-ajsee-image-fit'
      ),
      'contain'
    );

    assert.equal(
      frameAttributes.get(
        'data-ajsee-image-fit'
      ),
      'contain'
    );

    assert.equal(
      insertedBackdrop,
      backdrop
    );

    assert.equal(
      backdropAttributes.get(
        'class'
      ),
      'event-img-backdrop'
    );

    assert.equal(
      backdropAttributes.get(
        'alt'
      ),
      ''
    );

    assert.equal(
      backdropAttributes.get(
        'aria-hidden'
      ),
      'true'
    );
  }
);

test(
  'landscape shared event images do not create decorative backdrops',
  () => {
    let inserted =
      false;

    const frame = {
      setAttribute() {},

      querySelector() {
        return null;
      },

      insertBefore() {
        inserted =
          true;
      }
    };

    const image = {
      complete: true,
      naturalWidth: 1600,
      naturalHeight: 900,

      getAttribute() {
        return 'auto';
      },

      setAttribute() {},

      closest() {
        return frame;
      },

      cloneNode() {
        throw new Error(
          'Landscape image must not clone a backdrop.'
        );
      }
    };

    wireSharedEventImageFraming({
      querySelectorAll() {
        return [
          image
        ];
      }
    });

    assert.equal(
      inserted,
      false
    );
  }
);
