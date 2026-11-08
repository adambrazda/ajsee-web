import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Encode the existing photographs without cropping or changing editorial credits.
// Discover published covers so future homepage recommendations receive variants too.
const sources = new Set([
  '/images/london-musicals-todaytix-hero-960.webp',
  '/images/accommodation/trustedstays-home-original.jpg',
]);
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
for (const file of (await fs.readdir('content/reviews/items')).sort()) {
  if (!file.endsWith('.json')) continue;
  const item = await readJson(path.join('content/reviews/items', file));
  if (item.status === 'published' && item.published === true && item.cover) sources.add(item.cover);
}
const guides = await readJson('content/microguides/index.json');
for (const item of guides.items || guides) {
  if ((item.status || 'published') !== 'published') continue;
  if (item.cover) sources.add(item.cover);
  for (const lang of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) {
    const file = path.join('content/microguides', `${item.slug}.${lang}.json`);
    try {
      const localized = await readJson(file);
      if (localized.image || localized.cover) sources.add(localized.image || localized.cover);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const output = 'public/images/home-cards';
await fs.mkdir(output, { recursive: true });
const manifest = {};
for (const source of [...sources].sort()) {
  if (!source.startsWith('/') || source.startsWith('//') || source.includes('..')) continue;
  const original = await fs.readFile(path.join('public', source));
  const metadata = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = metadata.info;
  const hash = createHash('sha256').update(source).update(original).digest('hex').slice(0, 12);
  const variants = [];
  const widths = [...new Set([320, 640, 960].map(value => Math.min(value, width)))];
  for (const targetWidth of widths) {
    const name = `${hash}-${targetWidth}.webp`;
    const encoded = await sharp(original).rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 }).toBuffer({ resolveWithObject: true });
    await fs.writeFile(path.join(output, name), encoded.data);
    variants.push({ src: `/images/home-cards/${name}`, width: encoded.info.width, height: encoded.info.height, bytes: encoded.data.length });
  }
  manifest[source] = { width, height, originalBytes: original.length, variants };
}
await fs.mkdir('src/generated', { recursive: true });
await fs.writeFile('src/generated/home-image-variants.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`[home-images] ${Object.keys(manifest).length} local covers and promotions encoded`);
