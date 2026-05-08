// scripts/seo-smoke.mjs
// ---------------------------------------------------------
// AJSEE – SEO smoke test
// Runs against built /dist output.
// Goal: catch SEO regressions before deploy.
// ---------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

const blogSlugs = [
  'koncert-coldplay-praha-2025',
  'praha-shakespeare-divadlo-2025',
  'recenze-budapest-sziget-festival-2025',
];

const microguideSlugs = [
  'fees-refund',
  'seating-map',
  'set-times-merch',
  'stadium-entry',
  'theatre-last-minute',
  'when-to-buy',
];

const results = [];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relPath(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

function readDist(relativePath) {
  const filePath = path.join(distDir, relativePath);

  if (!existsSync(filePath)) {
    fail(relativePath, `Missing file: ${relPath(filePath)}`);
    return '';
  }

  return readFileSync(filePath, 'utf8');
}

function pass(scope, message) {
  results.push({ ok: true, scope, message });
}

function fail(scope, message) {
  results.push({ ok: false, scope, message });
}

function expectMatch(scope, html, regex, message) {
  if (regex.test(html)) {
    pass(scope, message);
  } else {
    fail(scope, message);
  }
}

function expectNoMatch(scope, html, regex, message) {
  if (!regex.test(html)) {
    pass(scope, message);
  } else {
    fail(scope, message);
  }
}

function countMatches(html, regex) {
  return [...String(html).matchAll(regex)].length;
}

function checkBaseSeo({ label, file, canonical }) {
  const html = readDist(file);
  if (!html) return;

  expectMatch(
    label,
    html,
    /<title[^>]*>[\s\S]{8,}?<\/title>/i,
    'has <title>',
  );

  expectMatch(
    label,
    html,
    /<meta\s+name=["']description["'][\s\S]*?content=["'][^"']{30,}["'][^>]*>/i,
    'has meta description',
  );

  expectMatch(
    label,
    html,
    new RegExp(
      `<link\\s+rel=["']canonical["'][^>]*href=["']${escapeRegExp(canonical)}["'][^>]*>`,
      'i',
    ),
    `has canonical ${canonical}`,
  );

  expectNoMatch(
    label,
    html,
    /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i,
    'is not noindex',
  );

  const h1Count = countMatches(html, /<h1\b/gi);
  if (h1Count === 1) {
    pass(label, 'has exactly one H1');
  } else {
    fail(label, `expected exactly one H1, found ${h1Count}`);
  }
}

function checkMainPages() {
  const pages = [
    { label: 'Home', file: 'index.html', canonical: 'https://ajsee.cz/' },
    { label: 'Events', file: 'events.html', canonical: 'https://ajsee.cz/events' },
    { label: 'Accommodation', file: 'accommodation.html', canonical: 'https://ajsee.cz/accommodation' },
    { label: 'Partners', file: 'partners.html', canonical: 'https://ajsee.cz/partners' },
    { label: 'About', file: 'about.html', canonical: 'https://ajsee.cz/about' },
    { label: 'Blog index', file: 'blog.html', canonical: 'https://ajsee.cz/blog' },
    { label: 'FAQ', file: 'faq.html', canonical: 'https://ajsee.cz/faq' },
    { label: 'Privacy policy', file: 'privacy-policy.html', canonical: 'https://ajsee.cz/privacy-policy' },
    { label: 'Cookies policy', file: 'cookies-policy.html', canonical: 'https://ajsee.cz/cookies-policy' },
  ];

  pages.forEach(checkBaseSeo);
}

function checkStaticBlogLinks() {
  const targets = [
    { label: 'Home static blog links', file: 'index.html' },
    { label: 'Blog index static blog links', file: 'blog.html' },
  ];

  for (const target of targets) {
    const html = readDist(target.file);
    if (!html) continue;

    expectMatch(
      target.label,
      html,
      /data-static-blog-list=["']true["']/i,
      'has static blog fallback marker',
    );

    const articleCount = countMatches(html, /<article\s+class=["'][^"']*\bblog-card\b/gi);

    if (articleCount >= 3) {
      pass(target.label, `has at least 3 blog cards (${articleCount})`);
    } else {
      fail(target.label, `expected at least 3 blog cards, found ${articleCount}`);
    }

    for (const slug of blogSlugs) {
      expectMatch(
        target.label,
        html,
        new RegExp(`/blog/${escapeRegExp(slug)}/`, 'i'),
        `links to /blog/${slug}/`,
      );
    }
  }
}

function checkFaqContent() {
  const label = 'FAQ static content';
  const html = readDist('faq.html');
  if (!html) return;

  expectMatch(label, html, /"@type"\s*:\s*"FAQPage"/i, 'has FAQPage JSON-LD');
  expectMatch(label, html, /Co je AJSEE\?/i, 'has visible question: Co je AJSEE?');
  expectMatch(label, html, /faq-answer-1/i, 'has faq-answer-1');
  expectMatch(label, html, /aria-controls=["']faq-answer-1["']/i, 'has aria-controls for answer 1');
  expectMatch(label, html, /aria-controls=["']faq-answer-2["']/i, 'has aria-controls for answer 2');
  expectMatch(label, html, /aria-controls=["']faq-answer-3["']/i, 'has aria-controls for answer 3');
  expectMatch(label, html, /aria-controls=["']faq-answer-4["']/i, 'has aria-controls for answer 4');
}

function checkBlogDetails() {
  for (const slug of blogSlugs) {
    const label = `Blog detail: ${slug}`;
    const file = `blog/${slug}/index.html`;
    const canonical = `https://ajsee.cz/blog/${slug}/`;

    checkBaseSeo({ label, file, canonical });

    const html = readDist(file);
    if (!html) continue;

    expectMatch(label, html, /property=["']og:type["']\s+content=["']article["']/i, 'has og:type article');
    expectMatch(label, html, /name=["']twitter:card["']\s+content=["']summary_large_image["']/i, 'has Twitter summary_large_image');
    expectMatch(label, html, /id=["']ajsee-blog-article-jsonld["']/i, 'has blog article JSON-LD id');
    expectMatch(label, html, /"@type"\s*:\s*"BlogPosting"/i, 'has BlogPosting JSON-LD');
  }
}

function checkMicroguides() {
  const indexFile = 'microguides/index.html';

  if (existsSync(path.join(distDir, indexFile))) {
    checkBaseSeo({
      label: 'Microguides index',
      file: indexFile,
      canonical: 'https://ajsee.cz/microguides/',
    });
  }

  for (const slug of microguideSlugs) {
    const label = `Microguide detail: ${slug}`;
    const file = `microguides/${slug}/index.html`;
    const canonical = `https://ajsee.cz/microguides/${slug}/`;

    if (!existsSync(path.join(distDir, file))) {
      fail(label, `missing microguide detail file ${file}`);
      continue;
    }

    checkBaseSeo({ label, file, canonical });

    const html = readDist(file);
    if (!html) continue;

    expectMatch(label, html, /application\/ld\+json/i, 'has JSON-LD');
    expectMatch(label, html, /"@type"\s*:\s*"Article"/i, 'has Article JSON-LD');
    expectMatch(label, html, /"@type"\s*:\s*"BreadcrumbList"/i, 'has BreadcrumbList JSON-LD');
  }
}

function checkSitemap() {
  const label = 'Sitemap';
  const sitemapPath = path.join(distDir, 'sitemap.xml');

  if (!existsSync(sitemapPath)) {
    fail(label, 'missing dist/sitemap.xml');
    return;
  }

  const xml = readFileSync(sitemapPath, 'utf8');

  const expectedUrls = [
    'https://ajsee.cz/',
    'https://ajsee.cz/events',
    'https://ajsee.cz/accommodation',
    'https://ajsee.cz/partners',
    'https://ajsee.cz/about',
    'https://ajsee.cz/blog',
    'https://ajsee.cz/faq',
    'https://ajsee.cz/privacy-policy',
    'https://ajsee.cz/cookies-policy',
    ...blogSlugs.map((slug) => `https://ajsee.cz/blog/${slug}/`),
    'https://ajsee.cz/microguides/',
    ...microguideSlugs.map((slug) => `https://ajsee.cz/microguides/${slug}/`),
  ];

  for (const url of expectedUrls) {
    expectMatch(
      label,
      xml,
      new RegExp(`<loc>${escapeRegExp(url)}</loc>`, 'i'),
      `contains ${url}`,
    );
  }
}

function printResults() {
  const passed = results.filter((item) => item.ok);
  const failed = results.filter((item) => !item.ok);

  console.log('\nAJSEE SEO smoke test');
  console.log('='.repeat(60));

  for (const item of results) {
    const icon = item.ok ? '✓' : '✗';
    console.log(`${icon} [${item.scope}] ${item.message}`);
  }

  console.log('='.repeat(60));
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length) {
    console.log('\nSEO smoke test failed. Fix the failed checks before deploy.');
    process.exitCode = 1;
    return;
  }

  console.log('\nSEO smoke test passed.');
}

if (!existsSync(distDir)) {
  console.error('Missing /dist directory. Run `npm run build` first.');
  process.exit(1);
}

checkMainPages();
checkStaticBlogLinks();
checkFaqContent();
checkBlogDetails();
checkMicroguides();
checkSitemap();
printResults();