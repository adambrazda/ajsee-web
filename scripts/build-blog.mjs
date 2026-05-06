// scripts/build-blog.mjs
// ---------------------------------------------------------
// AJSEE – static blog detail pages generator
// ---------------------------------------------------------
// Generuje /blog/<slug>/index.html z blog-detail.html + src/blogArticles.js.
// Cíl: SEO-ready server HTML pro blog detail URL:
// - title / description / canonical
// - OG / Twitter
// - H1 + článek v HTML
// - BlogPosting + BreadcrumbList JSON-LD
// ---------------------------------------------------------

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://ajsee.cz';
const DEFAULT_LANG = 'cs';

const TEMPLATE_PATH = path.join(ROOT, 'blog-detail.html');
const ARTICLES_PATH = path.join(ROOT, 'src', 'blogArticles.js');
const BLOG_OUT_DIR = path.join(ROOT, 'blog');

function pick(value, lang = DEFAULT_LANG) {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    return value[lang] || value.cs || value.en || Object.values(value).find(Boolean) || '';
  }

  return '';
}

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

function toAbsoluteUrl(value = '') {
  if (!value) return '';

  try {
    return new URL(value, SITE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function getCategoryLabel(category, lang = DEFAULT_LANG) {
  const categories = {
    concert: {
      cs: 'Koncert',
      en: 'Concert',
      de: 'Konzert',
      sk: 'Koncert',
      pl: 'Koncert',
      hu: 'Koncert'
    },
    theatre: {
      cs: 'Divadlo',
      en: 'Theatre',
      de: 'Theater',
      sk: 'Divadlo',
      pl: 'Teatr',
      hu: 'Színház'
    },
    festival: {
      cs: 'Festival',
      en: 'Festival',
      de: 'Festival',
      sk: 'Festival',
      pl: 'Festiwal',
      hu: 'Fesztivál'
    },
    sport: {
      cs: 'Sport',
      en: 'Sport',
      de: 'Sport',
      sk: 'Šport',
      pl: 'Sport',
      hu: 'Sport'
    }
  };

  return categories[category]?.[lang] || categories[category]?.cs || category || '';
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

function normalizeSlug(slug = '') {
  return String(slug).trim().replace(/^\/+|\/+$/g, '');
}

function buildBlogCanonicalUrl(slug) {
  return `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}/`;
}

function cleanJson(data) {
  return JSON.parse(JSON.stringify(data));
}

function buildBlogJsonLd(article, lang = DEFAULT_LANG) {
  const slug = normalizeSlug(article.slug);
  const canonicalUrl = buildBlogCanonicalUrl(slug);
  const title = pick(article.title, lang) || slug;
  const lead = pick(article.lead, lang);
  const content = pick(article.content, lang);
  const description = truncate(lead || content || title);
  const image = toAbsoluteUrl(article.image) || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const categoryLabel = getCategoryLabel(article.category, lang);

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl
        },
        headline: title,
        description,
        image: [image],
        datePublished: article.date || undefined,
        dateModified: article.date || undefined,
        inLanguage: lang,
        articleSection: categoryLabel || article.category || undefined,
        articleBody: stripHtml(content) || undefined,
        author: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`
        },
        publisher: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/images/logo-ajsee.png`
          }
        }
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
            name: title,
            item: canonicalUrl
          }
        ]
      }
    ]
  };

  return cleanJson(graph);
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

function buildHeadSeo(article, lang = DEFAULT_LANG) {
  const slug = normalizeSlug(article.slug);
  const canonicalUrl = buildBlogCanonicalUrl(slug);
  const titleText = pick(article.title, lang) || slug;
  const lead = pick(article.lead, lang);
  const content = pick(article.content, lang);
  const description = truncate(lead || content || titleText);
  const image = toAbsoluteUrl(article.image) || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const imageAlt = titleText;
  const jsonLd = buildBlogJsonLd(article, lang);

  return `
  <title>${escapeHtml(titleText)} | AJSEE</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="cs_CZ" />
  <meta property="og:site_name" content="AJSEE" />
  <meta property="og:title" content="${escapeAttr(titleText)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(titleText)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}" />

  <script id="ajsee-blog-article-jsonld" type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`;
}

function buildStaticArticleHtml(article, lang = DEFAULT_LANG) {
  const slug = normalizeSlug(article.slug);
  const title = pick(article.title, lang) || slug;
  const lead = pick(article.lead, lang);
  const content = pick(article.content, lang);
  const image = article.image || '';
  const date = formatDate(article.date, lang);
  const categoryLabel = getCategoryLabel(article.category, lang);

  return `
        <h1 class="blog-title">${escapeHtml(title)}</h1>
        <div class="blog-meta">
          ${date ? `<span class="blog-date">${escapeHtml(date)}</span>` : ''}
          ${date && categoryLabel ? ' · ' : ''}
          ${categoryLabel ? `<span class="blog-category">${escapeHtml(categoryLabel)}</span>` : ''}
        </div>
        ${lead ? `<div class="blog-lead">${escapeHtml(lead)}</div>` : ''}
        ${
          image
            ? `<img class="blog-image" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="eager" decoding="async">`
            : ''
        }
        <div class="blog-content">${content}</div>
`;
}

function injectStaticArticle(template, article, lang = DEFAULT_LANG) {
  const staticArticle = buildStaticArticleHtml(article, lang);

  return template.replace(
    /<article id="blogArticle">[\s\S]*?<\/article>/i,
    `<article id="blogArticle" data-static-blog-article="true">
${staticArticle}
      </article>`
  );
}

function applyStaticSeo(template, article, lang = DEFAULT_LANG) {
  const cleaned = removeExistingSeo(template);
  const seo = buildHeadSeo(article, lang);

  return cleaned.replace(/<meta charset="UTF-8"\s*\/?>/i, (match) => `${match}\n${seo}`);
}

async function importBlogArticles() {
  const mod = await import(pathToFileURL(ARTICLES_PATH).href);
  const articles = mod.blogArticles || mod.default || [];

  if (!Array.isArray(articles)) {
    throw new Error('src/blogArticles.js does not export blogArticles array.');
  }

  return articles;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeBlogDetail(article, template) {
  const slug = normalizeSlug(article.slug);

  if (!slug) return false;

  let html = applyStaticSeo(template, article, DEFAULT_LANG);
  html = injectStaticArticle(html, article, DEFAULT_LANG);

  const outDir = path.join(BLOG_OUT_DIR, slug);
  const outPath = path.join(outDir, 'index.html');

  await ensureDir(outDir);
  await fs.writeFile(outPath, html.trimEnd() + '\n', 'utf8');

  return true;
}

async function run() {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const articles = await importBlogArticles();

  let count = 0;

  for (const article of articles) {
    if (await writeBlogDetail(article, template)) {
      count += 1;
    }
  }

  console.log(`Static blog detail pages generated (${count} items).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
