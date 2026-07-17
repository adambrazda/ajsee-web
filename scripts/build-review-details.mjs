import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_ORIGIN = 'https://ajsee.cz';
const DEFAULT_LANG = 'cs';
const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const TEMPLATE_PATH = path.join(ROOT, 'blog-detail.html');
const REVIEWS_INPUT_DIR = path.join(ROOT, 'content', 'reviews', 'items');
const REVIEWS_OUT_DIR = path.join(ROOT, 'reviews');
const PREVIEW_MODE = process.env.REVIEW_PREVIEW === '1';
const REVIEW_OUTPUT_DIR = PREVIEW_MODE
  ? path.join(ROOT, 'review-preview')
  : REVIEWS_OUT_DIR;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value = '') {
  return escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value = '', max = 160) {
  const text = stripHtml(value);

  if (text.length <= max) return text;

  return `${text.slice(0, max - 1).trim().replace(/[.,;:!?-]+$/, '')}…`;
}

function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function normalizeLang(value = '') {
  const lang = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

function toAbsoluteUrl(value = '') {
  if (!value) return '';

  try {
    return new URL(value, SITE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function formatDate(dateValue, lang = DEFAULT_LANG) {
  if (!dateValue) return '';

  try {
    return new Date(dateValue).toLocaleDateString(lang, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return String(dateValue);
  }
}

function isPublishedReview(review) {
  return (
    String(review?.status || '').toLowerCase() === 'published' &&
    review?.published === true
  );
}

function hasTranslationContent(block) {
  return Boolean(
    block &&
    typeof block === 'object' &&
    String(block.title || '').trim() &&
    String(block.body || '').trim()
  );
}

function pickTranslation(review, lang = DEFAULT_LANG) {
  const currentLang = normalizeLang(lang);
  const translations = review.translations || {};
  const candidates = Array.from(new Set([currentLang, 'en', 'cs']));

  for (const candidate of candidates) {
    if (hasTranslationContent(translations[candidate])) {
      return {
        lang: candidate,
        data: translations[candidate]
      };
    }
  }

  return {
    lang: currentLang,
    data: {}
  };
}

function markdownToHtml(markdown = '') {
  const text = String(markdown || '').replace(/\r\n/g, '\n').trim();

  if (!text) return '';

  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return blocks.map((block) => {
    if (/^###\s+/.test(block)) {
      return `<h3>${escapeHtml(block.replace(/^###\s+/, ''))}</h3>`;
    }

    if (/^##\s+/.test(block)) {
      return `<h2>${escapeHtml(block.replace(/^##\s+/, ''))}</h2>`;
    }

    if (/^#\s+/.test(block)) {
      return `<h2>${escapeHtml(block.replace(/^#\s+/, ''))}</h2>`;
    }

    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }

    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
  }).join('\n');
}

function removeExistingSeo(html) {
  return html
    .replace(/<title[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>\s*/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:type["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:locale["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:site_name["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:title["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:description["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:image["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:image:alt["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']twitter:card["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']twitter:title["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']twitter:description["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']twitter:image["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']twitter:image:alt["'])[^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi, '');
}

function buildReviewCanonicalUrl(slug) {
  return `${SITE_ORIGIN}/reviews/${encodeURIComponent(slug)}/`;
}

function buildJsonLd(review, translation, lang = DEFAULT_LANG) {
  const slug = normalizeSlug(review.slug);
  const canonicalUrl = buildReviewCanonicalUrl(slug);
  const title = translation.title || review.showTitle || slug;
  const description = truncate(translation.seoDescription || translation.excerpt || translation.body || title);
  const image = toAbsoluteUrl(review.cover) || `${SITE_ORIGIN}/images/logo-ajsee.png`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Review',
        '@id': `${canonicalUrl}#review`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl
        },
        headline: title,
        name: title,
        description,
        image: [image],
        datePublished: review.publishedAt || review.reviewDate || undefined,
        dateModified: review.publishedAt || review.reviewDate || undefined,
        inLanguage: lang,
        reviewBody: stripHtml(translation.body) || undefined,
        author: {
          '@type': 'Person',
          name: review.author || 'AJSEE'
        },
        publisher: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/images/logo-ajsee.png`
          }
        },
        itemReviewed: {
          '@type': 'Event',
          name: review.productionTitle || review.showTitle || title,
          location: review.venue || review.city
            ? {
                '@type': 'Place',
                name: review.venue || undefined,
                address: [review.city, review.country].filter(Boolean).join(', ') || undefined
              }
            : undefined,
          startDate: review.performanceDate || undefined
        },
        reviewRating: typeof review.rating === 'number'
          ? {
              '@type': 'Rating',
              ratingValue: review.rating,
              bestRating: 5,
              worstRating: 0
            }
          : undefined
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'AJSEE',
            item: `${SITE_ORIGIN}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${SITE_ORIGIN}/blog`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Reviews',
            item: `${SITE_ORIGIN}/blog`
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: title,
            item: canonicalUrl
          }
        ]
      }
    ]
  };

  return JSON.parse(JSON.stringify(graph));
}

function buildHeadSeo(review, translation, lang = DEFAULT_LANG) {
  const slug = normalizeSlug(review.slug);
  const canonicalUrl = buildReviewCanonicalUrl(slug);
  const title = translation.seoTitle || translation.title || review.showTitle || slug;
  const description = truncate(translation.seoDescription || translation.excerpt || translation.body || title);
  const image = toAbsoluteUrl(review.cover) || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const imageAlt = review.coverAlt || translation.title || review.showTitle || 'AJSEE review';
  const jsonLd = buildJsonLd(review, translation, lang);

  return `
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="${lang === 'cs' ? 'cs_CZ' : `${lang}_${lang.toUpperCase()}`}" />
  <meta property="og:site_name" content="AJSEE" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}" />

  <script id="ajsee-review-jsonld" type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`;
}

function buildMetaRow(review, lang = DEFAULT_LANG) {
  const parts = [];

  const reviewDate = formatDate(review.publishedAt || review.reviewDate, lang);
  const performanceDate = formatDate(review.performanceDate, lang);

  if (reviewDate) parts.push(`<span>${escapeHtml(reviewDate)}</span>`);
  if (review.author) parts.push(`<span>${escapeHtml(review.author)}</span>`);
  if (review.rating !== null && review.rating !== undefined && review.rating !== '') {
    parts.push(`<span aria-label="Rating ${escapeAttr(review.rating)} out of 5">&#9733; ${escapeHtml(review.rating)}/5</span>`);
  }
  if (review.venue || review.city) {
    parts.push(`<span>${escapeHtml([review.venue, review.city].filter(Boolean).join(', '))}</span>`);
  }
  if (performanceDate) {
    parts.push(`<span>Seen ${escapeHtml(performanceDate)}</span>`);
  }

  return parts.join(' <span aria-hidden="true">&middot;</span> ');
}


const REVIEW_GALLERY_LABELS = {
  cs: 'Fotogalerie',
  en: 'Photo gallery',
  de: 'Fotogalerie',
  sk: 'Fotogal?ria',
  pl: 'Galeria zdj??',
  hu: 'Fot?gal?ria'
};

function buildReviewGalleryHtml(gallery, lang = DEFAULT_LANG) {
  const images = Array.isArray(gallery)
    ? gallery.filter((item) => item && item.image)
    : [];

  if (images.length === 0) {
    return '';
  }

  const galleryLabel =
    REVIEW_GALLERY_LABELS[normalizeLang(lang)] ||
    REVIEW_GALLERY_LABELS[DEFAULT_LANG];

  const itemsHtml = images
    .map((item) => {
      const image = String(item.image || '').trim();
      const alt = String(item.alt || '').trim();
      const credit = String(item.credit || '').trim();

      return `
              <figure class="review-gallery-item">
                <img
                  src="${escapeAttr(image)}"
                  alt="${escapeAttr(alt)}"
                  loading="lazy"
                  decoding="async"
                >
                ${credit ? `<figcaption>${escapeHtml(credit)}</figcaption>` : ''}
              </figure>
      `;
    })
    .join('');

  return `
          <section class="review-gallery" aria-labelledby="review-gallery-title">
            <h2 id="review-gallery-title" class="review-gallery-title">
              ${escapeHtml(galleryLabel)}
            </h2>

            <div class="review-gallery-grid">
              ${itemsHtml}
            </div>
          </section>
  `;
}

function buildReviewArticleHtml(review, translation, lang = DEFAULT_LANG) {
  const title = translation.title || review.showTitle || review.slug;
  const subtitle = translation.subtitle || '';
  const excerpt = translation.excerpt || '';
  const bodyHtml = markdownToHtml(translation.body || '');
  const galleryHtml = buildReviewGalleryHtml(review.gallery, lang);
  const cover = review.cover || '';
  const coverAlt = review.coverAlt || title;
  const coverCredit = review.coverCredit || '';
  const metaRow = buildMetaRow(review, lang);
  const ctaText = translation.ctaText || 'Check tickets';

  return `
        <article id="blogArticle" class="review-detail" data-static-blog-article="true" data-review-slug="${escapeAttr(review.slug)}">
          <header class="review-detail-hero">
            <p class="blog-card-meta">
              <span class="card-badge">Review</span>
              ${metaRow ? `<span>${metaRow}</span>` : ''}
            </p>

            <h1 class="blog-title">${escapeHtml(title)}</h1>

            ${subtitle ? `<p class="blog-lead">${escapeHtml(subtitle)}</p>` : ''}
            ${excerpt ? `<p class="review-excerpt">${escapeHtml(excerpt)}</p>` : ''}

            ${
              cover
                ? `<figure class="review-cover-figure">
                    <img class="blog-image review-cover" src="${escapeAttr(cover)}" alt="${escapeAttr(coverAlt)}" loading="eager" decoding="async">
                    ${coverCredit ? `<figcaption class="review-cover-credit">${escapeHtml(coverCredit)}</figcaption>` : ''}
                  </figure>`
                : ''
            }
          </header>

          <div class="blog-content review-content">
            ${bodyHtml}
          </div>

          ${galleryHtml}

          ${
            review.ticketUrl
              ? `<p class="review-cta"><a class="btn-primary" href="${escapeAttr(review.ticketUrl)}" target="_blank" rel="noopener sponsored">${escapeHtml(ctaText)}</a></p>`
              : ''
          }
        </article>
`;
}

function injectReviewArticle(template, review, translation, lang = DEFAULT_LANG) {
  const articleHtml = buildReviewArticleHtml(review, translation, lang);

  return template.replace(
    /<article id="blogArticle">[\s\S]*?<\/article>/i,
    articleHtml
  );
}

function applyStaticSeo(template, review, translation, lang = DEFAULT_LANG) {
  const cleaned = removeExistingSeo(template);
  const seo = buildHeadSeo(review, translation, lang);

  return cleaned.replace(/<meta charset="UTF-8"\s*\/?>/i, (match) => `${match}\n${seo}`);
}

function patchTemplateForReviews(html, review) {
  let next = html;

  next = next.replace(
    /<body\b([^>]*)\bdata-page="[^"]*"([^>]*)>/i,
    '<body$1data-page="review-detail"$2>'
  );

  next = next.replace(
    /<a href="\/blog\?lang=cs" class="back-link" data-i18n-key="blog-back">[\s\S]*?<\/a>/i,
    '<a href="/blog" class="back-link">&larr; Back to blog</a>'
  );

  // Remove only legacy dynamic blog renderers.
  next = next.replace(
    /<script type="module" src="\/src\/blog-detail-entry\.js"><\/script>\s*/gi,
    ''
  );

  next = next.replace(
    /<script type="module" src="\/src\/blog-detail\.js"><\/script>\s*/gi,
    ''
  );

  // Remove comments HTML block.
  next = next.replace(
    /<!-- COMMENTS: begin[\s\S]*?<!-- COMMENTS: end -->/i,
    ''
  );

  // Remove only script blocks related to comments.
  next = next.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, (block) => {
    const isCommentScript =
      block.includes('commentPostId') ||
      block.includes('commentPostType') ||
      block.includes('commentLang') ||
      block.includes('commentForm') ||
      block.includes('commentsList') ||
      block.includes('get-comments') ||
      block.includes('site-comments');

    return isCommentScript ? '' : block;
  });

  return next;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function cleanGeneratedReviewsDir() {
  await ensureDir(REVIEW_OUTPUT_DIR);

  const entries = await fs.readdir(REVIEW_OUTPUT_DIR, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(REVIEW_OUTPUT_DIR, entry.name, 'index.html');

    if (await fs.stat(indexPath).then(() => true).catch(() => false)) {
      await fs.rm(path.join(REVIEW_OUTPUT_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

async function writeReviewDetail(review, template) {
  const slug = normalizeSlug(review.slug);

  if (!slug || (!PREVIEW_MODE && !isPublishedReview(review))) return false;

  const localized = pickTranslation(review, DEFAULT_LANG);

  if (!hasTranslationContent(localized.data)) return false;

  let html = applyStaticSeo(template, review, localized.data, localized.lang);
  html = injectReviewArticle(html, review, localized.data, localized.lang);
  html = patchTemplateForReviews(html, review);

  const outDir = path.join(REVIEW_OUTPUT_DIR, slug);
  const outPath = path.join(outDir, 'index.html');

  await ensureDir(outDir);
  await fs.writeFile(outPath, html.trimEnd() + '\n', 'utf8');

  return true;
}

async function run() {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const files = await fs.readdir(REVIEWS_INPUT_DIR).catch(() => []);

  await cleanGeneratedReviewsDir();

  let count = 0;

  for (const file of files.filter((item) => item.endsWith('.json')).sort()) {
    const review = await readJson(path.join(REVIEWS_INPUT_DIR, file));

    if (await writeReviewDetail(review, template)) {
      count += 1;
    }
  }

  console.log(`${PREVIEW_MODE ? 'Local review preview pages' : 'Static review detail pages'} generated (${count} items).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
