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

const modalLayoutSource = readFileSync(
  new URL('../src/event-modal-layout.js', import.meta.url),
  'utf8'
);

const ticketmasterSource = readFileSync(
  new URL('../src/adapters/ticketmaster.js', import.meta.url),
  'utf8'
);

test('single event result keeps a stable shared desktop card track', () => {
  assert.match(
    sharedCardSource,
    /@media\s*\(min-width:\s*1100px\)[\s\S]*repeat\(\s*3,\s*minmax\(0,\s*1fr\)\s*\)/
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
    /background:var\(--aj-modal-control-bg,\s*#fff\)/
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
    modalLayoutSource,
    /\.modal-calendar-picker \.calendar-btns-wrap\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.doesNotMatch(modalSource,/installAjseeModalDesktopCalendarPolish/);
});

test('mobile calendar actions remain one column', () => {
  assert.match(
    modalLayoutSource,
    /@media \(max-width: 599px\)[\s\S]*\.modal-calendar-picker \.calendar-btns-wrap \{ grid-template-columns: minmax\(0, 1fr\); \}/
  );
});


test('mobile event cards keep artwork and text in separate grid columns and put provider badge below metadata', () => {
  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-card \.event-image-frame\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1 \/ span 4;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-card \.event-title\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-content > \.event-partner-badge\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*4;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-card-footer\s*\{[\s\S]*?grid-row:\s*5;/
  );
});

test('event modal never creates or styles a provider badge over the image', () => {
  assert.doesNotMatch(
    modalLayoutSource,
    /provider\.className\s*=\s*['"]modal-provider-badge['"]/
  );

  assert.doesNotMatch(
    modalLayoutSource,
    /\.event-modal \.modal-provider-badge\s*\{/
  );

  assert.doesNotMatch(
    modalSource,
    /const providerBadge\s*=\s*modal\.querySelector\(['"]\.modal-provider-badge['"]\)/
  );
});


test('desktop provider badge shares the price row while mobile badge placement remains unchanged', () => {
  assert.match(
    sharedCardSource,
    /@media\s*\(min-width:\s*600px\)[\s\S]*?\.event-commerce-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(min-width:\s*600px\)[\s\S]*?\.event-content > \.event-partner-badge:not\(\.event-partner-badge--commerce\)\s*\{[\s\S]*?display:\s*none;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-content > \.event-partner-badge\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*4;/
  );

  assert.match(
    sharedCardSource,
    /@media\s*\(max-width:\s*599px\)[\s\S]*?\.event-partner-badge--commerce\s*\{\s*display:\s*none !important;\s*\}/
  );
});
