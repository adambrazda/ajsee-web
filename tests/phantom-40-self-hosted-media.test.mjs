import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PHOTO_DIRECTORY = '/uploads/reviews/phantom-of-the-opera-40th-anniversary-reunion/';
const ARTICLE = path.resolve('content/reviews/items/phantom-of-the-opera-40th-anniversary-reunion.json');
const LANGUAGES = ['en', 'cs', 'sk', 'de', 'pl', 'hu'];

test('Phantom 40th uses only optimized, committed AJSEE media and remains unpublished', async () => {
  const article = JSON.parse(await readFile(ARTICLE, 'utf8'));
  assert.equal(article.status, 'approved');
  assert.equal(article.published, false);
  assert.equal(article.publishedAt, '');
  assert.equal(article.featured, false);
  assert.equal(article.coverCredit, 'Photo: Matthew Hemley / The Stage');
  assert.equal(article.gallery.length, 2);
  assert.ok(article.gallery.every(item => item.credit === 'Photo: Johan Persson'));

  const references = [article.cover, ...article.gallery.map(image => image.image)];
  assert.equal(new Set(references).size, 3, 'Each photograph must have a unique local path');

  for (const source of references) {
    assert.ok(source.startsWith(PHOTO_DIRECTORY), 'Image must be served by AJSEE: ' + source);
    assert.ok(source.endsWith('.webp'), 'Image must be an optimized WebP: ' + source);

    const filename = path.basename(source);
    const localFile = path.resolve('public', '.' + PHOTO_DIRECTORY, filename);
    const fileInfo = await stat(localFile);
    const metadata = await sharp(localFile).metadata();

    assert.equal(metadata.format, 'webp', 'Unexpected file format: ' + filename);
    assert.ok(metadata.width >= 900, 'Image is too narrow: ' + filename);
    assert.ok(metadata.height >= 500, 'Image is too short: ' + filename);
    assert.ok(fileInfo.size < 300 * 1024, 'Image exceeds 300 KiB: ' + filename);
  }

  assert.deepEqual(Object.keys(article.translations).sort(), LANGUAGES.sort());
  for (const [lang, item] of Object.entries(article.translations)) {
    assert.ok(item.coverAlt, 'Missing ' + lang + ' cover alt text');
    assert.equal(item.galleryAlts?.length, 2, 'Missing ' + lang + ' gallery alt text');
  }
});
