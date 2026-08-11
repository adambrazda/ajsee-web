import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderSharedEventCard
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
      /auto-fill/
    );

    assert.match(
      sharedSource,
      /min\(100%,\s*280px\)/
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