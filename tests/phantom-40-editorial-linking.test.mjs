import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRelatedReadingHtml } from '../scripts/review-related-reading.mjs';

const OLD = 'phantom-of-the-opera-2026';
const NEW = 'phantom-of-the-opera-40th-anniversary-reunion';
const LANGS = ['cs', 'en', 'sk', 'de', 'pl', 'hu'];
const read = async slug => JSON.parse(await readFile(
  new URL('../content/reviews/items/' + slug + '.json', import.meta.url), 'utf8'
));

test('40th anniversary is an approved, unpublished Article in all six languages', async () => {
  const feature = await read(NEW);
  assert.equal(feature.contentType, 'article');
  assert.equal(feature.status, 'approved');
  assert.equal(feature.published, false);
  assert.equal(feature.publishedAt, '');
  assert.equal(feature.featured, false);
  assert.equal(feature.rating, null);
  assert.equal(feature.performanceDate, '');
  assert.deepEqual(Object.keys(feature.translations).sort(), [...LANGS].sort());
  assert.deepEqual(feature.relatedSlugs, [OLD]);
  assert.match(feature.internalNotes, /TodayTix permission also covers/);
  assert.doesNotMatch(feature.internalNotes, /reconfirm its scope before public publishing/i);
});

test('related reading is reciprocal in preview and hidden for unpublished targets in production', async () => {
  const [feature, review] = await Promise.all([read(NEW), read(OLD)]);
  const map = new Map([[NEW, feature], [OLD, review]]);
  assert.deepEqual(review.relatedSlugs, [NEW]);
  assert.equal(review.published, true);

  for (const lang of LANGS) {
    const featurePublic = buildRelatedReadingHtml(feature, lang, map);
    const reviewPublic = buildRelatedReadingHtml(review, lang, map);
    const featurePreview = buildRelatedReadingHtml(feature, lang, map, { previewMode: true });
    const reviewPreview = buildRelatedReadingHtml(review, lang, map, { previewMode: true });

    assert.match(featurePublic, new RegExp('/reviews/' + OLD + '/'));
    assert.equal(reviewPublic, '', 'Published review must not link to hidden article');
    assert.match(featurePreview, new RegExp('/reviews/' + OLD + '/'));
    assert.match(reviewPreview, new RegExp('/reviews/' + NEW + '/'));
    assert.match(reviewPreview, /<aside class="review-related-reading"/);

    const previewDeployed = buildRelatedReadingHtml(review, lang, map,
      { previewMode: true, deployPreview: true });
    assert.match(previewDeployed, new RegExp('href="/reviews/' + NEW + '/"'));
  }
});

test('related-reading target gating prevents rendering nonexistent or malicious links', () => {
  const parent = { slug: 'test', relatedSlugs: ['missing', 'javascript:alert(1)', 'test'] };
  assert.equal(buildRelatedReadingHtml(parent, 'cs', new Map(), { previewMode: true }), '');
});
