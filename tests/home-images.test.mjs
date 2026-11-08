import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import images from '../src/generated/home-image-variants.json' with { type: 'json' };
import { homeImageAttributes } from '../src/home-images.js';

test('responsive candidates exist and declare their actual dimensions without enlargement', async () => {
  for (const [source, image] of Object.entries(images)) {
    let previous = 0;
    for (const variant of image.variants) {
      const bytes = await fs.readFile(new URL('../public' + variant.src, import.meta.url));
      const actual = await sharp(bytes).metadata();
      assert.equal(actual.width, variant.width, source);
      assert.equal(actual.height, variant.height, source);
      assert.equal(bytes.length, variant.bytes, source);
      assert.ok(variant.width > previous && variant.width <= image.width, source);
      assert.ok(Math.abs(variant.height - variant.width * image.height / image.width) <= 1, source);
      previous = variant.width;
    }
    const attributes = homeImageAttributes(source);
    assert.ok(image.variants.some(variant => variant.src === attributes.src), source);
    assert.equal(attributes.width, image.width);
    assert.equal(attributes.height, image.height);
  }
});

test('unmapped and partner-hosted images retain their original URL', () => {
  for (const source of ['/images/new-editorial.jpg', 'https://partner.example/photo.jpg?token=a&size=2']) {
    assert.deepEqual(homeImageAttributes(source), { src: source });
  }
});

test('large audited covers and the accommodation promotion transfer fewer bytes', () => {
  for (const source of [
    '/uploads/cover-06.jpg',
    '/images/accommodation/trustedstays-home-original.jpg',
    '/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-cover.avif',
  ]) {
    const image = images[source];
    assert.ok(image, source);
    for (const variant of image.variants) assert.ok(variant.bytes < image.originalBytes, source);
  }
});
