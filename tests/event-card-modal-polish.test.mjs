import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const eventsSource = readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
  'utf8'
);

const modalSource = readFileSync(
  new URL('../src/event-modal.js', import.meta.url),
  'utf8'
);

const ticketmasterSource = readFileSync(
  new URL('../src/adapters/ticketmaster.js', import.meta.url),
  'utf8'
);

test('single event result keeps a stable desktop card track', () => {
  assert.match(
    eventsSource,
    /repeat\(\s*auto-fill,\s*minmax\(\s*min\(100%,\s*360px\),\s*24rem\s*\)\s*\)/
  );

  assert.match(
    eventsSource,
    /#eventsList\.events-list\s*>\s*:not\(\.event-card\)/
  );
});

test('Ticketmaster query city is separated from display city', () => {
  assert.match(
    ticketmasterSource,
    /selectedDisplayCity/
  );

  assert.match(
    ticketmasterSource,
    /\?\s*selectedDisplayCity\s*:\s*actualCity/
  );

  assert.match(
    ticketmasterSource,
    /filters\.cityLabel\s*\|\|\s*filters\.city/
  );
});

test('modal hides missing descriptions instead of showing fallback text', () => {
  assert.match(
    modalSource,
    /pickLocalized\(eventData\.description,\s*preferredLocales\)\.trim\(\)/
  );

  assert.match(
    modalSource,
    /descEl\.hidden\s*=\s*!description/
  );

  assert.doesNotMatch(
    modalSource,
    /i18n\(lang,\s*'detailsFallback'\)/
  );
});

test('modal exposes ticket seller trust information', () => {
  assert.match(
    modalSource,
    /modalSellerNote/
  );

  assert.match(
    modalSource,
    /formatModalTicketSeller/
  );
});

test('modal uses secondary calendar styling', () => {
  assert.match(
    modalSource,
    /ajsee-event-modal-conversion-polish-v1-css/
  );

  assert.match(
    modalSource,
    /background:#fff !important/
  );
});
