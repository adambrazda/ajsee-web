import test from 'node:test';
import assert from 'node:assert/strict';

import {
  promises as fs
} from 'node:fs';

import {
  spawnSync
} from 'node:child_process';

import os from 'node:os';
import path from 'node:path';

import {
  fileURLToPath
} from 'node:url';

const CURRENT_FILE =
  fileURLToPath(import.meta.url);

const ROOT =
  path.resolve(
    path.dirname(CURRENT_FILE),
    '..'
  );

const REVIEW_ITEMS_DIRECTORY =
  path.join(
    ROOT,
    'content',
    'reviews',
    'items'
  );

const REQUIRED_LANGUAGES = [
  'cs',
  'en',
  'de',
  'sk',
  'pl',
  'hu'
];

function hasText(value) {
  return Boolean(
    String(value || '').trim()
  );
}

function isValidDate(value) {
  return (
    hasText(value) &&
    Number.isFinite(
      Date.parse(value)
    )
  );
}

function isPublishedReview(review) {
  return (
    String(
      review?.status || ''
    ).toLowerCase() === 'published' &&
    review?.published === true
  );
}

function toPublicFilePath(webPath) {
  const relativePath =
    String(webPath || '')
      .replace(/^\/+/, '');

  return path.join(
    ROOT,
    'public',
    relativePath
  );
}

async function readReviewFiles() {
  const fileNames =
    (await fs.readdir(
      REVIEW_ITEMS_DIRECTORY
    ))
      .filter(
        (fileName) =>
          fileName.endsWith('.json')
      )
      .sort();

  return Promise.all(
    fileNames.map(
      async (fileName) => {
        const filePath =
          path.join(
            REVIEW_ITEMS_DIRECTORY,
            fileName
          );

        const review =
          JSON.parse(
            await fs.readFile(
              filePath,
              'utf8'
            )
          );

        return {
          fileName,
          filePath,
          review
        };
      }
    )
  );
}

function getPopulatedLanguages(review) {
  return REQUIRED_LANGUAGES.filter(
    (language) => {
      const translation =
        review?.translations?.[language];

      return Boolean(
        translation &&
        (
          hasText(translation.title) ||
          hasText(translation.body) ||
          hasText(translation.excerpt)
        )
      );
    }
  );
}

function normalizeIndex(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function runReviewBuild(
  fixtureRoot,
  previewMode
) {
  const env = {
    ...process.env
  };

  if (previewMode) {
    env.REVIEW_PREVIEW = '1';
  }
  else {
    delete env.REVIEW_PREVIEW;
  }

  return spawnSync(
    process.execPath,
    [
      path.join(
        fixtureRoot,
        'scripts',
        'build-reviews.mjs'
      )
    ],
    {
      cwd: fixtureRoot,
      env,
      encoding: 'utf8'
    }
  );
}

test(
  'review source files satisfy structural and publication invariants',
  async () => {
    const entries =
      await readReviewFiles();

    assert.ok(
      entries.length > 0,
      'No review source files were found.'
    );

    const knownSlugs =
      new Set();

    for (const {
      fileName,
      review
    } of entries) {
      const label =
        `Review ${fileName}`;

      assert.ok(
        hasText(review.slug),
        `${label} is missing a slug.`
      );

      assert.match(
        review.slug,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${label} has an invalid slug.`
      );

      assert.equal(
        fileName,
        `${review.slug}.json`,
        `${label} filename does not match its slug.`
      );

      assert.equal(
        knownSlugs.has(review.slug),
        false,
        `Duplicate review slug: ${review.slug}`
      );

      knownSlugs.add(review.slug);

      assert.equal(
        typeof review.published,
        'boolean',
        `${label} must have a boolean published value.`
      );

      if (review.published === true) {
        assert.equal(
          String(
            review.status || ''
          ).toLowerCase(),
          'published',
          `${label} is published but status is not published.`
        );

        assert.ok(
          isValidDate(review.publishedAt),
          `${label} is published without a valid publishedAt date.`
        );
      }
      else {
        assert.notEqual(
          String(
            review.status || ''
          ).toLowerCase(),
          'published',
          `${label} has published status but published is false.`
        );

        assert.equal(
          String(
            review.publishedAt || ''
          ).trim(),
          '',
          `${label} is unpublished but publishedAt is populated.`
        );
      }

      assert.ok(
        review.translations &&
        typeof review.translations === 'object',
        `${label} is missing translations.`
      );

      const populatedLanguages =
        getPopulatedLanguages(review);

      assert.ok(
        populatedLanguages.length > 0,
        `${label} has no populated translation.`
      );

      if (isPublishedReview(review)) {
        assert.deepEqual(
          [...populatedLanguages].sort(),
          [...REQUIRED_LANGUAGES].sort(),
          `${label} is published without all six languages.`
        );
      }

      for (
        const language
        of populatedLanguages
      ) {
        const translation =
          review.translations[language];

        assert.ok(
          hasText(translation.title),
          `${label} ${language} is missing title.`
        );

        assert.ok(
          hasText(translation.body),
          `${label} ${language} is missing body.`
        );

        const listingSummary =
          translation.excerpt ||
          translation.subtitle ||
          review.productionTitle;

        assert.ok(
          hasText(listingSummary),
          `${label} ${language} cannot produce a review listing summary.`
        );

        assert.ok(
          hasText(translation.ctaText),
          `${label} ${language} is missing CTA text.`
        );

        assert.ok(
          hasText(translation.seoTitle),
          `${label} ${language} is missing SEO title.`
        );

        assert.ok(
          hasText(translation.seoDescription),
          `${label} ${language} is missing SEO description.`
        );

        assert.ok(
          translation.seoTitle.length <= 70,
          `${label} ${language} SEO title is longer than 70 characters.`
        );

        assert.ok(
          translation.seoDescription.length <= 180,
          `${label} ${language} SEO description is longer than 180 characters.`
        );
      }

      if (hasText(review.ticketUrl)) {
        const ticketUrl =
          new URL(review.ticketUrl);

        assert.ok(
          ['http:', 'https:'].includes(
            ticketUrl.protocol
          ),
          `${label} has an invalid ticket URL protocol.`
        );
      }

      if (hasText(review.cover)) {
        const coverPath =
          toPublicFilePath(review.cover);

        await assert.doesNotReject(
          fs.access(coverPath),
          `${label} cover image does not exist: ${review.cover}`
        );
      }

      if (review.gallery !== undefined) {
        assert.ok(
          Array.isArray(review.gallery),
          `${label} gallery must be an array.`
        );

        const galleryPaths =
          new Set();

        for (
          const [index, image]
          of review.gallery.entries()
        ) {
          const imagePath =
            image?.image || image?.src;

          assert.ok(
            hasText(imagePath),
            `${label} gallery image ${index + 1} is missing its path.`
          );

          assert.ok(
            hasText(image.alt),
            `${label} gallery image ${index + 1} is missing alt text.`
          );

          assert.ok(
            hasText(image.credit),
            `${label} gallery image ${index + 1} is missing credit.`
          );

          assert.equal(
            galleryPaths.has(imagePath),
            false,
            `${label} contains duplicate gallery image: ${imagePath}`
          );

          galleryPaths.add(imagePath);

          await assert.doesNotReject(
            fs.access(
              toPublicFilePath(imagePath)
            ),
            `${label} gallery image does not exist: ${imagePath}`
          );
        }
      }
    }
  }
);

test(
  'review index excludes drafts in production and includes them only in preview',
  async (context) => {
    const fixtureRoot =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          'ajsee-reviews-test-'
        )
      );

    context.after(
      async () => {
        await fs.rm(
          fixtureRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const fixtureScripts =
      path.join(
        fixtureRoot,
        'scripts'
      );

    const fixtureItems =
      path.join(
        fixtureRoot,
        'content',
        'reviews',
        'items'
      );

    await fs.mkdir(
      fixtureScripts,
      {
        recursive: true
      }
    );

    await fs.mkdir(
      fixtureItems,
      {
        recursive: true
      }
    );

    await fs.copyFile(
      path.join(
        ROOT,
        'scripts',
        'build-reviews.mjs'
      ),
      path.join(
        fixtureScripts,
        'build-reviews.mjs'
      )
    );

    const translations = {
      cs: {
        title: 'Český titulek',
        subtitle: '',
        excerpt: 'Český perex',
        body: 'Český text recenze.',
        ctaText: 'Zobrazit vstupenky',
        seoTitle: 'Český SEO titulek recenze',
        seoDescription:
          'Český SEO popis testovací recenze pro automatický test.'
      },
      en: {
        title: 'English title',
        subtitle: '',
        excerpt: 'English excerpt',
        body: 'English review body.',
        ctaText: 'Check tickets',
        seoTitle: 'English review SEO title',
        seoDescription:
          'English SEO description for the automated review test.'
      }
    };

    const publicReview = {
      slug: 'public-review-fixture',
      type: 'review',
      status: 'published',
      published: true,
      publishedAt:
        '2026-01-02T10:00:00Z',
      reviewDate:
        '2026-01-01T10:00:00Z',
      performanceDate:
        '2025-12-31',
      showTitle: 'Public Review',
      productionTitle:
        'Public Review Production',
      cover: '/fixture-public.webp',
      translations
    };

    const draftReview = {
      slug: 'draft-review-fixture',
      type: 'review',
      status: 'approved',
      published: false,
      publishedAt: '',
      reviewDate:
        '2026-01-03T10:00:00Z',
      performanceDate:
        '2026-01-02',
      showTitle: 'Draft Review',
      productionTitle:
        'Draft Review Production',
      cover: '/fixture-draft.webp',
      translations
    };

    await fs.writeFile(
      path.join(
        fixtureItems,
        `${publicReview.slug}.json`
      ),
      JSON.stringify(
        publicReview,
        null,
        2
      ) + '\n',
      'utf8'
    );

    await fs.writeFile(
      path.join(
        fixtureItems,
        `${draftReview.slug}.json`
      ),
      JSON.stringify(
        draftReview,
        null,
        2
      ) + '\n',
      'utf8'
    );

    const productionResult =
      runReviewBuild(
        fixtureRoot,
        false
      );

    assert.equal(
      productionResult.status,
      0,
      [
        'Production review build failed.',
        productionResult.stdout,
        productionResult.stderr
      ].join('\n')
    );

    const outputIndexPath =
      path.join(
        fixtureRoot,
        'public',
        'content',
        'reviews',
        'index.json'
      );

    const productionItems =
      normalizeIndex(
        JSON.parse(
          await fs.readFile(
            outputIndexPath,
            'utf8'
          )
        )
      );

    assert.ok(
      productionItems.some(
        (item) =>
          item.slug === publicReview.slug
      ),
      'Published review is missing from production index.'
    );

    assert.equal(
      productionItems.some(
        (item) =>
          item.slug === draftReview.slug
      ),
      false,
      'Draft review leaked into production index.'
    );

    assert.equal(
      productionItems.some(
        (item) =>
          item.previewOnly === true
      ),
      false,
      'Production index contains previewOnly item.'
    );

    const productionDraftItem =
      path.join(
        fixtureRoot,
        'public',
        'content',
        'reviews',
        'items',
        `${draftReview.slug}.json`
      );

    await assert.rejects(
      fs.access(productionDraftItem),
      'Draft review detail JSON leaked into production output.'
    );

    const previewResult =
      runReviewBuild(
        fixtureRoot,
        true
      );

    assert.equal(
      previewResult.status,
      0,
      [
        'Preview review build failed.',
        previewResult.stdout,
        previewResult.stderr
      ].join('\n')
    );

    const previewItems =
      normalizeIndex(
        JSON.parse(
          await fs.readFile(
            outputIndexPath,
            'utf8'
          )
        )
      );

    const previewPublic =
      previewItems.find(
        (item) =>
          item.slug === publicReview.slug
      );

    const previewDraft =
      previewItems.find(
        (item) =>
          item.slug === draftReview.slug
      );

    assert.ok(
      previewPublic,
      'Published review is missing from preview index.'
    );

    assert.ok(
      previewDraft,
      'Draft review is missing from preview index.'
    );

    assert.equal(
      previewPublic.previewOnly,
      false,
      'Published review is incorrectly marked previewOnly.'
    );

    assert.equal(
      previewDraft.previewOnly,
      true,
      'Draft review is not marked previewOnly.'
    );

    await assert.doesNotReject(
      fs.access(
        path.join(
          fixtureRoot,
          'public',
          'content',
          'reviews',
          'items',
          `${draftReview.slug}.json`
        )
      ),
      'Draft review detail JSON is missing from preview output.'
    );
  }
);

test(
  'blog listing accepts published reviews and explicitly marked preview items only',
  async () => {
    const source =
      await fs.readFile(
        path.join(
          ROOT,
          'src',
          'blog.js'
        ),
        'utf8'
      );

    assert.match(
      source,
      /const isPublished\s*=\s*[\s\S]*item\.published === true;/,
      'Blog listing no longer verifies published reviews.'
    );

    assert.match(
      source,
      /return isPublished \|\| item\.previewOnly === true;/,
      'Blog listing no longer supports previewOnly review cards.'
    );

    assert.doesNotMatch(
      source,
      /return isPublished \|\| item\.published !== true;/,
      'Blog listing contains an unsafe draft visibility condition.'
    );
  }
);

test(
  'review details return to the real blog listing',
  async () => {
    const source =
      await fs.readFile(
        path.join(
          ROOT,
          'scripts',
          'build-review-details.mjs'
        ),
        'utf8'
      );

    assert.match(
      source,
      /\? '\/blog\/'\s*: `\/\$\{currentLang\}\/blog\/`;/,
      'Review back link does not target the localized blog listing.'
    );

    assert.match(
      source,
      /\? `\$\{SITE_ORIGIN\}\/blog\/`\s*: `\$\{SITE_ORIGIN\}\/\$\{lang\}\/blog\/`/,
      'Review breadcrumb does not target the localized blog listing.'
    );

    assert.doesNotMatch(
      source,
      /\? '\/reviews\/'\s*: `\/\$\{currentLang\}\/reviews\/`;/,
      'Review back link still targets the non-existent reviews listing.'
    );
  }
);

test(
  'review and theatre-preview source records stay semantically distinct',
  async () => {
    const entries =
      await readReviewFiles();

    for (const {
      fileName,
      review
    } of entries) {
      const contentType =
        String(
          review.contentType ||
          review.type ||
          'review'
        ).toLowerCase();

      assert.ok(
        [
          'review',
          'preview'
        ].includes(contentType),
        `Review ${fileName} has unsupported content type "${contentType}".`
      );

      if (contentType === 'preview') {
        assert.equal(
          review.rating,
          null,
          `Preview ${fileName} must not contain a rating.`
        );

        assert.equal(
          String(
            review.performanceDate ||
            ''
          ).trim(),
          '',
          `Preview ${fileName} must not claim a seen performance date.`
        );

        assert.ok(
          isValidDate(
            review.eventDate
          ),
          `Preview ${fileName} must have a valid premiere or event date.`
        );
      }
    }

    const sweeney =
      entries.find(
        ({ review }) =>
          review.slug ===
          'sweeney-todd-prague-2026'
      );

    assert.ok(
      sweeney,
      'Sweeney Todd preview source record is missing.'
    );

    assert.equal(
      sweeney.review.contentType,
      'preview'
    );

    assert.deepEqual(
      getPopulatedLanguages(
        sweeney.review
      ).sort(),
      [...REQUIRED_LANGUAGES].sort()
    );
  }
);

test(
  'preview output uses Article schema and no review rating',
  async () => {
    const detailSource =
      await fs.readFile(
        path.join(
          ROOT,
          'scripts',
          'build-review-details.mjs'
        ),
        'utf8'
      );

    assert.match(
      detailSource,
      /contentType === 'preview'[\s\S]*'@type': 'Article'/
    );

    assert.match(
      detailSource,
      /!preview[\s\S]*review.rating/
    );

    const blogSource =
      await fs.readFile(
        path.join(
          ROOT,
          'src',
          'blog.js'
        ),
        'utf8'
      );

    assert.match(
      blogSource,
      /const previewBadge = {/
    );

    assert.match(
      blogSource,
      /contentType === 'preview'/
    );
  }
);

test(
  'preview detail uses a localized content-type badge',
  async () => {
    const detailSource =
      await fs.readFile(
        path.join(
          ROOT,
          'scripts',
          'build-review-details.mjs'
        ),
        'utf8'
      );

    assert.match(
      detailSource,
      /const REVIEW_CONTENT_TYPE_LABELS = \{/
    );

    assert.match(
      detailSource,
      /getReviewContentTypeLabel/
    );

    assert.doesNotMatch(
      detailSource,
      /<span class="card-badge">Review<\/span>/
    );

    assert.match(
      detailSource,
      /\$\{escapeHtml\(contentTypeLabel\)\}/
    );
  }
);

test(
  'preview metadata uses localized labels and location',
  async () => {
    const detailSource =
      await fs.readFile(
        path.join(
          ROOT,
          'scripts',
          'build-review-details.mjs'
        ),
        'utf8'
      );

    const styleSource =
      await fs.readFile(
        path.join(
          ROOT,
          'src',
          'styles',
          'pages',
          'blog-detail-page.scss'
        ),
        'utf8'
      );

    const preview =
      JSON.parse(
        await fs.readFile(
          path.join(
            ROOT,
            'content',
            'reviews',
            'items',
            'sweeney-todd-prague-2026.json'
          ),
          'utf8'
        )
      );

    assert.match(
      detailSource,
      /buildMetaRow\(\s*review,\s*translation,\s*lang\s*\)/
    );

    assert.match(
      detailSource,
      /translation\.venue\s*\|\|\s*review\.venue/
    );

    assert.match(
      detailSource,
      /published: 'Publikováno'/
    );

    assert.match(
      detailSource,
      /prepared: 'Připraveno'/
    );

    assert.match(
      detailSource,
      /class="review-meta-header"/
    );

    assert.match(
      styleSource,
      /\.review-content-type-badge\s*\{/
    );

    assert.equal(
      preview.translations.cs.venue,
      'Státní opera'
    );

    assert.equal(
      preview.translations.cs.city,
      'Praha'
    );

    assert.equal(
      preview.translations.en.venue,
      'State Opera'
    );

    assert.equal(
      preview.translations.en.city,
      'Prague'
    );
  }
);
