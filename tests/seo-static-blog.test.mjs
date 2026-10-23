import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStaticBlogCards } from '../scripts/seo-static-blog.mjs';

const publishedReviews = Array.from({ length: 13 }, (_, i) => ({ slug: `published-review-${i + 1}` }));
const publishedGuides = Array.from({ length: 6 }, (_, i) => ({ slug: `published-guide-${i + 1}` }));
const stagedReview = { slug: 'sweeney-todd-prague-2026' };

const markupFor = (cards) =>
  cards.map(({ slug }) => `<article class="blog-card" data-slug="${slug}"><a href="/reviews/${slug}/">Read</a></article>`).join('\n');

test('production static SEO check accepts exactly 13 published reviews and 6 guides', () => {
  const cards = [...publishedReviews, ...publishedGuides];
  const result = checkStaticBlogCards(markupFor(cards), cards);
  assert.equal(result.expectedCount, 19);
  assert.equal(result.renderedCount, 19);
  assert.equal(result.ok, true);
});

test('preview static SEO check accepts the same 19 items plus unpublished Sweeney Todd', () => {
  const cards = [...publishedReviews, ...publishedGuides, stagedReview];
  const result = checkStaticBlogCards(markupFor(cards), cards);
  assert.equal(result.expectedCount, 20);
  assert.equal(result.renderedCount, 20);
  assert.equal(result.ok, true);
});

test('production SEO check rejects a leaked unpublished review', () => {
  const cards = [...publishedReviews, ...publishedGuides];
  const result = checkStaticBlogCards(markupFor([...cards, stagedReview]), cards);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unexpected, [stagedReview.slug]);
});

test('SEO check rejects missing, duplicated, and empty editorial cards', () => {
  const cards = [...publishedReviews, ...publishedGuides];
  assert.equal(checkStaticBlogCards(markupFor(cards.slice(1)), cards).ok, false);
  assert.equal(checkStaticBlogCards(markupFor([...cards.slice(1), cards[1]]), cards).ok, false);
  assert.equal(checkStaticBlogCards('', []).ok, false);
});
