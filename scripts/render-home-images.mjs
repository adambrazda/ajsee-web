import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { homeImageAttributes, HOME_PROMO_IMAGE_SIZES } from '../src/home-images.js';

// Run before language cloning: all six initial HTML pages get the same image metadata.
const file = 'dist/index.html';
const dom = new JSDOM(await fs.readFile(file, 'utf8'));
for (const image of dom.window.document.querySelectorAll('.home-promo > img, .homepage-blog-card > img')) {
  const source = image.getAttribute('src');
  const attributes = homeImageAttributes(source, image.closest('.home-promo') ? HOME_PROMO_IMAGE_SIZES : undefined);
  for (const [name, value] of Object.entries(attributes)) image.setAttribute(name, String(value));
}
await fs.writeFile(file, dom.serialize());
dom.window.close();
