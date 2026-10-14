import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { HOME_HERO_PHOTOS, selectHomeHeroPhoto, homeHeroPhotoText } from '../src/home-hero-photos.js';
import { initHomeHeroPhoto } from '../src/home-hero.js';

const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const createPage = () => new JSDOM(home, { url: 'https://ajsee.cz/' });

test('all ten photographs have valid responsive assets, distinct IDs, credits and six-language descriptions', async () => {
  assert.equal(HOME_HERO_PHOTOS.length, 10);
  assert.equal(new Set(HOME_HERO_PHOTOS.map(photo => photo.id)).size, 10);
  assert.deepEqual(HOME_HERO_PHOTOS.reduce((counts, photo) => ({ ...counts, [photo.category]: (counts[photo.category] || 0) + 1 }), {}), { theatre: 3, concert: 3, festival: 2, sport: 2 });
  const placeholder = home.match(/src="data:image\/gif;base64,([^"]+)"/)[1];
  const pixel = await sharp(Buffer.from(placeholder, 'base64')).metadata();
  assert.equal(pixel.width, 1);
  assert.equal(pixel.height, 1);
  await sharp(Buffer.from(placeholder, 'base64')).raw().toBuffer();
  for (const photo of HOME_HERO_PHOTOS) {
    assert.ok(photo.author && photo.source);
    for (const width of [640, 1200]) {
      const file = new URL(`../public/images/home-hero/${photo.id}-${width}.webp`, import.meta.url);
      assert.ok(fs.statSync(file).size > 1024);
      const meta = await sharp(fs.readFileSync(file)).metadata();
      assert.equal(meta.width, width);
      assert.equal(meta.height, Math.round(width / 1.2));
      await sharp(fs.readFileSync(file)).raw().toBuffer();
    }
    for (const lang of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) {
      const text = homeHeroPhotoText(photo, lang);
      assert.ok(text.alt && text.caption && text.credit.includes(photo.author));
      assert.ok(photo.alt[lang]);
    }
  }
});

test('random selection can reach every photograph and always excludes the previous one', () => {
  for (let index = 0; index < HOME_HERO_PHOTOS.length; index++) {
    assert.equal(selectHomeHeroPhoto(HOME_HERO_PHOTOS, null, () => (index + .5) / 10), HOME_HERO_PHOTOS[index]);
  }
  for (const previous of HOME_HERO_PHOTOS) {
    const selected = Array.from({ length: 9 }, (_, index) => selectHomeHeroPhoto(HOME_HERO_PHOTOS, previous.id, () => (index + .5) / 9));
    assert.equal(new Set(selected.map(photo => photo.id)).size, 9);
    assert.ok(selected.every(photo => photo.id !== previous.id));
  }
  assert.equal(selectHomeHeroPhoto([], null), null);
  assert.equal(selectHomeHeroPhoto([HOME_HERO_PHOTOS[0]], HOME_HERO_PHOTOS[0].id), HOME_HERO_PHOTOS[0]);
});

test('a refresh changes the photo while repeated initialization preserves the current one', () => {
  let stored = null;
  const storage = { getItem: () => stored, setItem: (key, value) => { stored = value; } };
  const first = createPage();
  initHomeHeroPhoto(first.window.document, { random: () => 0, storage });
  assert.equal(stored, HOME_HERO_PHOTOS[0].id);
  initHomeHeroPhoto(first.window.document, { random: () => .8, storage });
  assert.equal(first.window.document.querySelector('[data-home-hero-photo]').dataset.photoId, HOME_HERO_PHOTOS[0].id);
  const second = createPage();
  initHomeHeroPhoto(second.window.document, { random: () => 0, storage });
  assert.equal(stored, HOME_HERO_PHOTOS[1].id);
  const source = second.window.document.querySelector('[data-home-hero-photo] source');
  assert.equal(source.media, '(min-width: 761px)');
  assert.match(source.srcset, /concert-gold-640.webp 640w, .*concert-gold-1200.webp 1200w/);
  assert.ok(second.window.document.querySelector('[data-home-hero-photo] img').src.startsWith('data:'));
  first.window.close(); second.window.close();
});

test('blocked storage does not break the hero and language changes keep the same photograph', async () => {
  const page = createPage();
  const doc = page.window.document;
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  initHomeHeroPhoto(doc, { random: () => .15, storage });
  const figure = doc.querySelector('[data-home-hero-photo]');
  const before = figure.querySelector('source').srcset;
  doc.documentElement.lang = 'hu';
  await Promise.resolve();
  assert.equal(figure.dataset.photoId, 'concert-gold');
  assert.equal(figure.querySelector('source').srcset, before);
  assert.equal(figure.querySelector('img').alt, HOME_HERO_PHOTOS[1].alt.hu);
  assert.match(figure.querySelector('[data-home-hero-credit]').textContent, /^Fotó: Nainoa Shizuru/);
  page.window.close();
});

test('a failed selected image restores the original photo and its own matching credit', () => {
  const page = createPage();
  const doc = page.window.document;
  initHomeHeroPhoto(doc, { random: () => .85 });
  const figure = doc.querySelector('[data-home-hero-photo]');
  assert.equal(figure.dataset.photoId, 'sport-basketball');
  figure.querySelector('img').dispatchEvent(new page.window.Event('error'));
  assert.equal(figure.dataset.photoId, 'jesus-christ-superstar');
  assert.match(figure.querySelector('source').srcset, /standing-ovation-oya-canli.jpg$/);
  assert.equal(figure.querySelector('[data-home-hero-credit]').textContent, 'Foto: Oya Canli');
  page.window.close();
});
