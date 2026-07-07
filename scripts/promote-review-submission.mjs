import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const submissionSlug = process.argv[2];
const targetSlugArg = process.argv[3];

if (!submissionSlug) {
  console.error('Usage: node scripts/promote-review-submission.mjs <submission-slug> [target-slug]');
  process.exit(1);
}

const submissionsDir = path.join(root, 'content', 'reviews', 'submissions');
const itemsDir = path.join(root, 'content', 'reviews', 'items');

const submissionPath = path.join(submissionsDir, submissionSlug + '.json');

if (!fs.existsSync(submissionPath)) {
  console.error('Submission not found: ' + submissionPath);
  process.exit(1);
}

fs.mkdirSync(itemsDir, { recursive: true });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

const submission = readJson(submissionPath);

const targetSlug = normalizeSlug(
  targetSlugArg ||
  submission.slug ||
  submissionSlug
);

if (!targetSlug) {
  console.error('Target slug is empty.');
  process.exit(1);
}

const english = submission.english || {};
const photos = submission.photos || {};
const seo = submission.seo || {};

const review = {
  slug: targetSlug,
  status: 'approved',
  published: false,
  featured: false,

  category: submission.category || 'theatre',
  showTitle: submission.showTitle || '',
  productionTitle: submission.productionTitle || submission.showTitle || '',

  venue: submission.venue || '',
  city: submission.city || '',
  country: submission.country || '',

  performanceDate: submission.performanceDate || '',
  reviewDate: submission.submittedAt || new Date().toISOString(),
  publishedAt: '',

  author: submission.author || '',
  rating: submission.rating ?? null,
  ticketUrl: submission.ticketUrl || '',

  cover: photos.cover || '',
  coverAlt: photos.coverAlt || '',
  gallery: Array.isArray(photos.gallery) ? photos.gallery : [],

  translations: {
    en: {
      title: english.title || '',
      subtitle: english.subtitle || '',
      excerpt: english.excerpt || '',
      body: english.body || '',
      ctaText: english.ctaText || 'Check tickets',
      seoTitle: seo.title || english.title || '',
      seoDescription: seo.description || english.excerpt || ''
    },
    cs: {},
    sk: {},
    hu: {},
    pl: {},
    de: {}
  },

  internalNotes: [
    'Promoted from review submission: ' + submissionSlug,
    'Original submission status: ' + (submission.status || ''),
    submission.notesForAdam ? 'Notes for Adam: ' + submission.notesForAdam : '',
    'Promoted at: ' + new Date().toISOString()
  ].filter(Boolean).join('\n')
};

const targetPath = path.join(itemsDir, targetSlug + '.json');

if (fs.existsSync(targetPath)) {
  console.error('Target review already exists: ' + targetPath);
  console.error('Use a different target slug or delete the existing file intentionally.');
  process.exit(1);
}

writeJson(targetPath, review);

console.log('Promoted review submission.');
console.log('From: ' + submissionPath);
console.log('To:   ' + targetPath);
console.log('');
console.log('Next step: npm run reviews:build');
