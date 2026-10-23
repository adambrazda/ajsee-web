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

test('Sweeney Todd is staged as a valid unpublished review', () => {
  const item = readItem();

  assert.equal(item.contentType, 'review');
  assert.equal(item.featured, false);
  assert.equal(item.status, 'approved');
  assert.equal(item.published, false);
  assert.equal(item.publishedAt || '', '');
  assert.equal(item.performanceDate, '2026-10-03');
  assert.equal(item.eventDate || '', '');
});

test('Sweeney Todd currently exposes the approved English, Czech and Slovak review masters', () => {
  const item = readItem();

  assert.ok(item.translations.en?.body);
  assert.ok(item.translations.cs?.body);
  assert.ok(item.translations.sk?.body);

  for (const language of ['pl', 'hu', 'de']) {
    assert.deepEqual(
      item.translations[language],
      {},
      `Unexpected staged translation for ${language}`
    );
  }
});

test('Sweeney Todd provides localized cover alt text for the staged review masters', () => {
  const item = readItem();

  for (const language of ['en', 'cs', 'sk']) {
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

  for (const language of ['en', 'cs', 'sk']) {
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

  for (const language of ['en', 'cs', 'sk']) {
    const description = item.translations[language].seoDescription;

    assert.ok(
      description.length <= 180,
      `${language} SEO description length was ${description.length}`
    );
  }
});
