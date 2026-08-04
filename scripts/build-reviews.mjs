import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const inputDir = path.join(root, 'content', 'reviews', 'items');
const outputDir = path.join(root, 'public', 'content', 'reviews');
const outputItemsDir = path.join(outputDir, 'items');
const outputIndex = path.join(outputDir, 'index.json');

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const PREVIEW_MODE = process.env.REVIEW_PREVIEW === '1';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function safeSlug(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeReviewContentType(value = '') {
  return String(value || '').trim().toLowerCase() === 'preview'
    ? 'preview'
    : 'review';
}

function hasContent(block) {
  return Boolean(
    block &&
    typeof block === 'object' &&
    String(block.title || '').trim() &&
    String(block.body || '').trim()
  );
}

function hasCardContent(block) {
  return Boolean(
    block &&
    typeof block === 'object' &&
    (
      String(block.title || '').trim() ||
      String(block.excerpt || '').trim() ||
      String(block.seoTitle || '').trim() ||
      String(block.seoDescription || '').trim()
    )
  );
}

function pickCardTranslations(translations = {}) {
  const out = {};

  for (const lang of SUPPORTED_LANGS) {
    const block = translations[lang];

    if (!hasCardContent(block)) continue;

    out[lang] = {
      title: block.title || '',
      subtitle: block.subtitle || '',
      excerpt: block.excerpt || '',
      seoTitle: block.seoTitle || '',
      seoDescription: block.seoDescription || '',
      ctaText: block.ctaText || ''
    };
  }

  return out;
}

function isPublicReview(review) {
  return (
    String(review?.status || '').toLowerCase() === 'published' &&
    review?.published === true
  );
}

function toTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanJsonFiles(dir) {
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.json')) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

ensureDir(inputDir);
ensureDir(outputDir);
ensureDir(outputItemsDir);

// Remove stale generated review JSON files before writing fresh output.
cleanJsonFiles(outputItemsDir);

const files = fs
  .readdirSync(inputDir)
  .filter((file) => file.endsWith('.json'))
  .sort();

const items = [];

for (const file of files) {
  const inputPath = path.join(inputDir, file);

  try {
    const review = readJson(inputPath);
    const slug = safeSlug(review.slug || file.replace(/\.json$/, ''));
    const contentType = normalizeReviewContentType(
      review.contentType || review.type
    );

    if (!slug) {
      console.warn(`[reviews] Skipping ${file}: missing slug`);
      continue;
    }

    const translations = review.translations || {};
    const availableLanguages = SUPPORTED_LANGS.filter((lang) => hasContent(translations[lang]));

    if (!PREVIEW_MODE && !isPublicReview(review)) {
      continue;
    }

    const normalizedReview = {
      ...review,
      type: contentType,
      contentType,
      slug,
      availableLanguages
    };

    writeJson(path.join(outputItemsDir, `${slug}.json`), normalizedReview);

    const publishedAt = review.publishedAt || '';
    const sortDate = review.publishedAt || review.reviewDate || review.performanceDate || '';

    items.push({
      slug,
      previewOnly: PREVIEW_MODE && !isPublicReview(review),
      type: contentType,
      contentType,
      status: review.status || 'draft',
      published: Boolean(review.published),
      featured: Boolean(review.featured),
      category: review.category || 'theatre',
      showTitle: review.showTitle || '',
      productionTitle: review.productionTitle || '',
      venue: review.venue || '',
      city: review.city || '',
      country: review.country || '',
      performanceDate: review.performanceDate || '',
      eventDate: review.eventDate || '',
      reviewDate: review.reviewDate || '',
      publishedAt,
      sortDate,
      author: review.author || '',
      rating: review.rating ?? null,
      cover: review.cover || '',
      coverAlt: review.coverAlt || '',
      ticketUrl: review.ticketUrl || '',
      availableLanguages,
      translations: pickCardTranslations(translations)
    });
  } catch (error) {
    console.warn(`[reviews] Skipping ${file}: ${error.message}`);
  }
}

items.sort((a, b) => {
  const bTime = toTimestamp(b.sortDate);
  const aTime = toTimestamp(a.sortDate);
  return bTime - aTime;
});

writeJson(outputIndex, { items });

console.log(`Reviews index generated (${items.length} items)`);
