import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const itemPath = path.join(
  root,
  'content',
  'reviews',
  'items',
  'sweeney-todd-prague-2026.json'
);
const builderPath = path.join(root, 'scripts', 'build-review-details.mjs');

function readItem() {
  return JSON.parse(fs.readFileSync(itemPath, 'utf8'));
}

test('Sweeney Todd keeps a valid theatre preview publication state', () => {
  const item = readItem();

  assert.equal(item.contentType, 'preview');
  assert.equal(item.featured, false);

  if (item.published) {
    assert.equal(item.status, 'published');
    assert.match(
      item.publishedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  } else {
    assert.equal(item.status, 'approved');
    assert.equal(item.publishedAt || '', '');
  }
});

test('Sweeney Todd provides localized cover alt text in every AJSEE language', () => {
  const item = readItem();
  const languages = ['en', 'cs', 'sk', 'pl', 'hu', 'de'];

  for (const language of languages) {
    assert.equal(
      typeof item.translations[language].coverAlt,
      'string',
      `Missing coverAlt for ${language}`
    );
    assert.ok(
      item.translations[language].coverAlt.trim().length > 40,
      `coverAlt for ${language} is unexpectedly short`
    );
  }

  assert.match(item.translations.cs.coverAlt, /Státní opeře/);
  assert.match(item.translations.de.coverAlt, /Prager Staatsoper/);
});

test('review detail builder prefers localized cover alt text', () => {
  const source = fs.readFileSync(builderPath, 'utf8');

  assert.match(
    source,
    /const imageAlt = translation\.coverAlt \|\| review\.coverAlt/
  );
  assert.match(
    source,
    /const coverAlt = translation\.coverAlt \|\| review\.coverAlt/
  );
});

test('Czech readers use the Czech National Theatre ticket page', () => {
  const item = readItem();

  assert.match(
    item.translations.cs.ticketUrl,
    /^https:\/\/www\.narodni-divadlo\.cz\/cs\/predstaveni\//
  );
  assert.match(item.translations.cs.ticketUrl, /utm_source=ajsee/);
  assert.match(
    item.ticketUrl,
    /^https:\/\/www\.narodni-divadlo\.cz\/en\/show\//
  );
});

test('approved editorial corrections are present', () => {
  const item = readItem();

  assert.match(item.translations.en.body, /book writer Hugh Wheeler/);
  assert.match(item.translations.en.excerpt, /most celebrated interpreters/);
  assert.match(
    item.translations.cs.body,
    /Sweeney Todd: Ďábelský lazebník z Fleet Street/
  );
  assert.match(item.translations.cs.body, /libretistou Hughem Wheelerem/);
  assert.match(item.translations.sk.body, /libretistom Hughom Wheelerom/);
  assert.equal(
    item.translations.pl.title,
    'Sweeney Todd w Pradze: najmroczniejszy golibroda świata musicalu'
  );
  assert.equal(item.translations.pl.ctaText, 'Sprawdź bilety');
  assert.equal(item.translations.hu.venue, 'Állami Opera');
  assert.match(item.translations.hu.body, /- Feliratok: cseh és angol/);
});

test('German SEO description stays within a safe snippet length', () => {
  const item = readItem();
  const description = item.translations.de.seoDescription;

  assert.ok(description.length <= 160, `Length was ${description.length}`);
  assert.match(description, /Prager Premiere/);
  assert.match(description, /Staatsoper/);
});
