import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const eventsSource = readFileSync(
  new URL('../src/events-entry.js', import.meta.url),
  'utf8'
);

const sharedCardSource = readFileSync(
  new URL('../src/event-card.js', import.meta.url),
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

test('single event result keeps a stable shared desktop card track', () => {
  assert.match(
    sharedCardSource,
    /@media\s*\(min-width:\s*1024px\)[\s\S]*repeat\(\s*3,\s*minmax\(0,\s*1fr\)\s*\)/
  );

  assert.match(
    sharedCardSource,
    /#eventsList\.events-list\s*>\s*\.event-card[\s\S]*max-width:\s*24rem/
  );

  assert.match(
    sharedCardSource,
    /#eventsList\.events-list\s*>\s*:not\(\.event-card\)/
  );

  assert.match(
    eventsSource,
    /ensureSharedEventGridStyles\(\)/
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
test('existing modal shell receives seller trust note at runtime', () => {
  assert.match(
    modalSource,
    /function ensureModalSellerNote\(modal\)/
  );

  assert.match(
    modalSource,
    /const sellerNoteEl = ensureModalSellerNote\(modal\)/
  );
});

test('desktop calendar actions use three compact columns', () => {
  assert.match(
    modalSource,
    /AJSEE_MODAL_CALENDAR_3COL_V1/
  );

  assert.match(
    modalSource,
    /grid-template-columns:repeat\(3,\s*minmax\(0,\s*1fr\)\)/
  );
});

test('mobile calendar actions remain one column', () => {
  assert.match(
    modalSource,
    /AJSEE_MODAL_CALENDAR_MOBILE_1COL_V1/
  );

  assert.match(
    modalSource,
    /grid-template-columns:1fr !important/
  );
});