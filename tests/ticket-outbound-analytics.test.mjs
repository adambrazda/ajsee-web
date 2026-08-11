import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const eventsEntrySource = fs.readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
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
      eventsEntrySource,
      /data-event-id="\$\{esc\(modalId\)\}"/
    );

    assert.match(
      eventsEntrySource,
      /data-placement="event_card"/
    );

    assert.match(
      eventsEntrySource,
      /const eventId = cleanText\(link\.dataset\.eventId\);/
    );

    assert.match(
      eventsEntrySource,
      /const placement = cleanText\(link\.dataset\.placement\) \|\| 'event_card';/
    );

    assert.match(
      eventsEntrySource,
      /event_id:\s*eventId,/
    );

    assert.match(
      eventsEntrySource,
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
      eventsEntrySource,
      /let tracked = false;/
    );

    assert.match(
      eventsEntrySource,
      /if \(tracked\) return;\s*tracked = true;\s*trackPartnerClickFromLink\(link\);/
    );

    assert.match(
      eventsEntrySource,
      /addEventListener\('pointerdown', trackOnce/
    );

    assert.match(
      eventsEntrySource,
      /addEventListener\('click', trackOnce\)/
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