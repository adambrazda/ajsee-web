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

test('Sweeney Todd is published on 26 October 2026 with a valid review state', () => {
  const item = readItem();

  assert.equal(item.contentType, 'review');
  assert.equal(item.featured, false);
  assert.equal(item.status, 'published');
  assert.equal(item.published, true);
  assert.equal(item.publishedAt, '2026-10-26');
  assert.equal(item.performanceDate, '2026-10-03');
  assert.equal(item.eventDate || '', '');
});

test('Sweeney Todd exposes all six approved review masters', () => {
  const item = readItem();

  assert.ok(item.translations.en?.body);
  assert.ok(item.translations.cs?.body);
  assert.ok(item.translations.sk?.body);
  assert.ok(item.translations.de?.body);
  assert.ok(item.translations.pl?.body);
  assert.ok(item.translations.hu?.body);
});

test('Sweeney Todd provides localized cover alt text for every published language', () => {
  const item = readItem();

  for (const language of ['en', 'cs', 'sk', 'de', 'pl', 'hu']) {
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

  assert.match(item.translations.cs.coverAlt, /Státní opery/);
  assert.match(item.translations.en.coverAlt, /State Opera/);
  assert.match(item.translations.sk.coverAlt, /Štátnej opery/);
  assert.match(item.translations.de.coverAlt, /Prager Staatsoper/);
  assert.match(item.translations.pl.coverAlt, /Opery Państwowej/);
  assert.match(item.translations.hu.coverAlt, /Állami Opera/);
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

test('Sweeney Todd uses the AJSEE ColosseumTicket sales path', () => {
  const item = readItem();

  for (const language of ['en', 'cs', 'sk', 'de', 'pl', 'hu']) {
    assert.match(
      item.translations[language].ticketUrl,
      /^https:\/\/colosseumticket\.cz\/cs\/akce\//
    );
    assert.doesNotMatch(
      item.translations[language].ticketUrl,
      /a_box=/
    );
  }

  assert.match(
    item.ticketUrl,
    /^https:\/\/colosseumticket\.cz\/cs\/akce\//
  );
  assert.doesNotMatch(item.ticketUrl, /a_box=/);
});

test('approved English and Czech review masters are present', () => {
  const item = readItem();

  assert.equal(
    item.translations.en.title,
    'Sweeney Todd at the State Opera: When Broadway Meets the Opera House'
  );
  assert.match(
    item.translations.en.body,
    /More Broadway at the State Opera, Please/
  );
  assert.match(
    item.translations.en.body,
    /Perhaps \*Jekyll & Hyde\*\?/
  );

  assert.equal(
    item.translations.cs.title,
    'Sweeney Todd ve Státní opeře: Když se Broadway potká s operou'
  );
  assert.match(
    item.translations.cs.body,
    /Více Broadwaye ve Státní opeře, prosím/
  );
  assert.match(
    item.translations.cs.body,
    /Co třeba \*Jekyll & Hyde\*\?/
  );
});

test('English and Czech SEO descriptions remain within a safe snippet length', () => {
  const item = readItem();

  for (const language of ['en', 'cs', 'sk', 'de', 'pl', 'hu']) {
    const description = item.translations[language].seoDescription;

    assert.ok(
      description.length <= 180,
      `${language} SEO description length was ${description.length}`
    );
  }
});

test('Sweeney Todd photo descriptions are localized in all six languages', () => {
  const item = readItem();
  const galleryLength = item.gallery.length;

  assert.equal(galleryLength, 5);

  for (const lang of ['en', 'cs', 'sk', 'de', 'pl', 'hu']) {
    const alts = item.translations[lang].galleryAlts;

    assert.equal(alts.length, galleryLength, `Wrong gallery count for ${lang}`);
    assert.ok(alts.every((alt) => typeof alt === 'string' && alt.trim().length >= 40));
  }

  const builder = fs.readFileSync(builderPath, 'utf8');

  assert.match(builder, /localizedAlts\?\.\[index\] \|\| item\.alt/);
  assert.match(builder, /buildReviewGalleryHtml\(review\.gallery, lang, translation\.galleryAlts\)/);
});

test('review deploy previews are noindex while production stays indexable', () => {
  const builder = fs.readFileSync(builderPath, 'utf8');

  assert.match(builder, /PREVIEW_MODE && !isPublishedReview\(review\) \? 'noindex, nofollow' : 'index, follow'/);
});
