import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const eventsEntrySource = fs.readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
  'utf8'
);

const sharedCardSource = fs.readFileSync(
  new URL('../src/event-card.js', import.meta.url),
  'utf8'
);

const eventModalSource = fs.readFileSync(
  new URL('../src/event-modal.js', import.meta.url),
  'utf8'
);

test(
  'event card exposes event identity and explicit analytics placement',
  () => {
    assert.match(
      sharedCardSource,
      /data-event-id="\$\{safeModalId\}"/
    );

    assert.match(
      sharedCardSource,
      /data-placement="event_card"/
    );

    assert.match(
      sharedCardSource,
      /const eventId =\s*cleanText\(\s*link\.dataset\.eventId\s*\);/
    );

    assert.match(
      sharedCardSource,
      /const placement =\s*cleanText\(\s*link\.dataset\.placement\s*\)\s*\|\|\s*'event_card';/
    );

    assert.match(
      sharedCardSource,
      /event_id:\s*eventId/
    );

    assert.match(
      sharedCardSource,
      /\bplacement,/
    );
  }
);

test(
  'event modal exposes event id in partner_click contract',
  () => {
    assert.match(
      eventModalSource,
      /const eventId =\s*modalTrackingText\(\s*link\.dataset\.eventId\s*\);/
    );

    assert.match(
      eventModalSource,
      /event_id:\s*eventId,/
    );

    const assignments =
      eventModalSource.match(
        /dataset\.eventId\s*=/g
      ) || [];

    assert.ok(
      assignments.length >= 2,
      'Primary CTA and ticket-option CTA must expose event id.'
    );
  }
);

test(
  'event card guards pointerdown plus click against duplicate tracking',
  () => {
    assert.match(
      sharedCardSource,
      /const partnerClickBound = new WeakSet\(\)/
    );

    assert.match(
      sharedCardSource,
      /let tracked = false/
    );

    assert.match(
      sharedCardSource,
      /if \(tracked\) return;/
    );

    assert.match(
      sharedCardSource,
      /link\.addEventListener\(\s*'pointerdown',\s*trackOnce,\s*\{\s*passive:\s*true\s*\}\s*\)/
    );

    assert.match(
      sharedCardSource,
      /link\.addEventListener\(\s*'click',\s*trackOnce\s*\)/
    );
  }
);

test(
  'Ticketmaster outbound attribution remains event_card',
  () => {
    assert.match(
      eventsEntrySource,
      /withOutboundTracking\(ev\.tickets \|\| ev\.url \|\| '', \{ sourcePage, placement: 'event_card' \}\)/
    );

    assert.match(
      eventsEntrySource,
      /u\.searchParams\.set\('placement', placement\);/
    );
  }
);