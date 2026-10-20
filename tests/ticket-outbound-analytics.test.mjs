import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const eventsEntrySource = fs.readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
  'utf8'
);

const homeEntrySource = fs.readFileSync(
  new URL('../src/home-entry.js', import.meta.url),
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

test('cards and modals expose event identity and use the shared outbound transport', () => {
  assert.match(sharedCardSource, /data-event-id="\$\{safeModalId\}"/);
  assert.match(sharedCardSource, /data-placement="event_card"/);
  assert.match(sharedCardSource, /trackPartnerOutboundLink/);
  assert.match(eventModalSource, /trackPartnerOutboundLink/);
  assert.ok((eventModalSource.match(/dataset\.eventId\s*=/g) || []).length >= 2,
    'Primary CTA and ticket-option CTA must expose event id.');
});

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

test(
  'AI learning funnel wiring exposes rank and records card interactions separately from rich analytics',
  () => {
    assert.match(
      sharedCardSource,
      /data-result-position="\$\{safeResultPosition\}"/
    );

    assert.match(
      sharedCardSource,
      /recordAiSearchPartnerClickout/
    );

    assert.match(
      sharedCardSource,
      /resultPosition:\s*link\.dataset\.resultPosition/
    );

    for (
      const entrySource
      of [
        homeEntrySource,
        eventsEntrySource
      ]
    ) {
      assert.match(
        entrySource,
        /recordAiSearchEventOpened/
      );

      assert.match(
        entrySource,
        /__ajseeResultPosition/
      );

      assert.match(
        entrySource,
        /resultPosition,/
      );

      assert.match(
        entrySource,
        /placement:\s*'event_card'/
      );
    }

    /*
     * The learning recorder receives only identity/rank
     * context. Existing rich analytics fields must not be
     * forwarded into its call.
     */
    const learningCall =
      sharedCardSource.match(
        /recordAiSearchPartnerClickout\(\{[\s\S]*?\}\);/
      )?.[0] || '';

    assert.doesNotMatch(
      learningCall,
      /eventTitle|eventCity|outboundUrl|event_name|city|href/i
    );
  }
);


test(
  'event modal forwards only privacy-safe AI learning clickout context',
  () => {
    assert.match(
      eventModalSource,
      /recordAiSearchPartnerClickout/
    );

    assert.match(
      eventModalSource,
      /link\.dataset\.resultPosition/
    );

    assert.match(
      eventModalSource,
      /__ajseeResultPosition/
    );

    const learningCall =
      eventModalSource.match(
        /recordAiSearchPartnerClickout\(\{[\s\S]*?\}\);/
      )?.[0] || '';

    assert.ok(
      learningCall,
      'Modal learning call must exist.'
    );

    assert.match(
      learningCall,
      /eventRef:\s*link\.dataset\.eventId/
    );

    assert.match(
      learningCall,
      /provider:\s*link\.dataset\.partner/
    );

    assert.match(
      learningCall,
      /resultPosition:\s*link\.dataset\.resultPosition/
    );

    assert.match(
      learningCall,
      /placement:\s*link\.dataset\.placement/
    );

    assert.doesNotMatch(
      learningCall,
      /eventTitle|eventCity|outboundUrl|outbound_url|destination|href|city/i
    );
  }
);


test(
  'AI learning records card clickout only on completed click',
  () => {
    assert.match(
      sharedCardSource,
      /const trackLearningClickout =/
    );

    assert.match(
      sharedCardSource,
      /link\.addEventListener\(\s*'click',\s*trackLearningClickout\s*\)/
    );

    assert.doesNotMatch(
      sharedCardSource,
      /link\.addEventListener\(\s*'pointerdown',\s*trackLearningClickout/
    );
  }
);

test(
  'event_opened learning signal follows successful modal opening',
  () => {
    assert.match(
      homeEntrySource,
      /await lazyOpenHomeEventModal\([\s\S]*?recordAiSearchEventOpened\(/
    );

    assert.match(
      eventsEntrySource,
      /await openEventModal\([\s\S]*?recordAiSearchEventOpened\(/
    );

    assert.match(
      homeEntrySource,
      /classList[\s\S]*?contains\([\s\S]*?'open'/
    );

    assert.match(
      eventsEntrySource,
      /classList[\s\S]*?contains\([\s\S]*?'open'/
    );
  }
);
