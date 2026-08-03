import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const submissionSlug = process.argv[2];
const targetSlugArg = process.argv[3];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!submissionSlug) {
  fail(
    'Usage: node scripts/promote-review-submission.mjs <submission-slug> [target-slug]'
  );
}

const submissionsDir = path.join(
  root,
  'content',
  'reviews',
  'submissions'
);

const itemsDir = path.join(
  root,
  'content',
  'reviews',
  'items'
);

const submissionPath = path.join(
  submissionsDir,
  `${submissionSlug}.json`
);

if (!fs.existsSync(submissionPath)) {
  fail(
    `Submission not found: ${submissionPath}`
  );
}

fs.mkdirSync(
  itemsDir,
  {
    recursive: true
  }
);

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      'utf8'
    )
  );
}

function writeJson(filePath, data) {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
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

const originalSubmissionSource =
  fs.readFileSync(
    submissionPath,
    'utf8'
  );

let submission;

try {
  submission =
    JSON.parse(
      originalSubmissionSource
    );
}
catch (error) {
  fail(
    `Submission JSON is invalid: ${error.message}`
  );
}

if (
  submission.status ===
  'promoted'
) {
  fail(
    `Submission "${submissionSlug}" has already been promoted to "${submission.promotedReviewSlug || 'an unknown review'}".`
  );
}

if (
  submission.status !==
  'ready_for_adam_review'
) {
  fail(
    `Submission "${submissionSlug}" cannot be promoted from status "${submission.status || ''}".`
  );
}

const targetSlug = normalizeSlug(
  targetSlugArg ||
  submission.slug ||
  submissionSlug
);

if (!targetSlug) {
  fail(
    'Target slug is empty.'
  );
}

const targetPath = path.join(
  itemsDir,
  `${targetSlug}.json`
);

if (fs.existsSync(targetPath)) {
  fail(
    [
      `Target review already exists: ${targetPath}`,
      'Use a different target slug or inspect the existing review intentionally.'
    ].join('\n')
  );
}

const english =
  submission.english || {};

const photos =
  submission.photos || {};

const seo =
  submission.seo || {};

const promotedAt =
  new Date().toISOString();

const review = {
  slug: targetSlug,

  status: 'approved',
  published: false,
  featured: false,

  category:
    submission.category ||
    'theatre',

  showTitle:
    submission.showTitle ||
    '',

  productionTitle:
    submission.productionTitle ||
    submission.showTitle ||
    '',

  venue:
    submission.venue ||
    '',

  city:
    submission.city ||
    '',

  country:
    submission.country ||
    '',

  performanceDate:
    submission.performanceDate ||
    '',

  reviewDate:
    submission.submittedAt ||
    promotedAt,

  publishedAt: '',

  author:
    submission.author ||
    '',

  rating:
    submission.rating ??
    null,

  ticketUrl:
    submission.ticketUrl ||
    '',

  cover:
    photos.cover ||
    '',

  coverAlt:
    photos.coverAlt ||
    '',

  gallery:
    Array.isArray(
      photos.gallery
    )
      ? photos.gallery
      : [],

  translations: {
    en: {
      title:
        english.title ||
        '',

      subtitle:
        english.subtitle ||
        '',

      excerpt:
        english.excerpt ||
        '',

      body:
        english.body ||
        '',

      ctaText:
        english.ctaText ||
        'Check tickets',

      seoTitle:
        seo.title ||
        english.title ||
        '',

      seoDescription:
        seo.description ||
        english.excerpt ||
        ''
    },

    cs: {},
    sk: {},
    hu: {},
    pl: {},
    de: {}
  },

  internalNotes: [
    `Promoted from review submission: ${submissionSlug}`,
    `Original submission status: ${submission.status || ''}`,

    submission.notesForAdam
      ? `Notes for Adam: ${submission.notesForAdam}`
      : '',

    `Promoted at: ${promotedAt}`
  ]
    .filter(Boolean)
    .join('\n')
};

const promotedSubmission = {
  ...submission,

  status:
    'promoted',

  promotedAt,

  promotedReviewSlug:
    targetSlug
};

let targetCreated = false;

try {
  writeJson(
    targetPath,
    review
  );

  targetCreated = true;

  writeJson(
    submissionPath,
    promotedSubmission
  );
}
catch (error) {
  if (targetCreated) {
    fs.rmSync(
      targetPath,
      {
        force: true
      }
    );
  }

  fs.writeFileSync(
    submissionPath,
    originalSubmissionSource,
    'utf8'
  );

  fail(
    `Promotion failed and was rolled back: ${error.message}`
  );
}

console.log(
  'Promoted review submission.'
);

console.log(
  `From: ${submissionPath}`
);

console.log(
  `To:   ${targetPath}`
);

console.log('');

console.log({
  submissionStatus:
    promotedSubmission.status,

  promotedReviewSlug:
    promotedSubmission.promotedReviewSlug,

  promotedAt:
    promotedSubmission.promotedAt,

  reviewStatus:
    review.status,

  reviewPublished:
    review.published
});

console.log('');

console.log(
  'Next step: complete the review content and run npm run reviews:test.'
);