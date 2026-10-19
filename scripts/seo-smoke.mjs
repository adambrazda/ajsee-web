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

const retiredSlugs = [
  'koncert-coldplay-praha-2025',
  'praha-shakespeare-divadlo-2025',
  'recenze-budapest-sziget-festival-2025',
];

const reviewSlugs = ['mamma-mia-from-abba-to-the-west-end', 'phantom-of-the-opera-2026', '10-west-end-musicals-worth-travelling-to-london-for'];

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
  for (const [file, marker, minimum] of [['index.html','homepage-blog-card',3],['blog.html','data-slug=',20]]) {
    const html = readDist(file), label = 'Published editorial links: ' + file;
    const count=html.split(marker).length-1;
    if(count >= minimum)pass(label,'has current static editorial links');
    else fail(label,'missing static editorial content');
    for(const slug of retiredSlugs)expectNoMatch(label,html,new RegExp(slug),'does not link to retired '+slug);
  }
}

function checkFaqContent() {
  const label = 'FAQ static content';
  const html = readDist('faq.html');
  if (!html) return;

  expectMatch(label, html, /"@type"\s*:\s*"FAQPage"/i, 'has FAQPage JSON-LD');
  expectMatch(label, html, /Jak AJSEE funguje\?/i, 'has visible question: Jak AJSEE funguje?');
  expectMatch(label, html, /<details\b[^>]*\bdata-faq-item/i, 'uses native, no-JS disclosures');
  expectMatch(label, html, /<summary\b[^>]*class=["']faq-question["']/i, 'has native question controls');
  expectMatch(label, html, /id=["']faq-delivery["']/i, 'has a linkable order-help answer');
  expectMatch(label, html, /data-faq-query/i, 'has progressive FAQ search');
}

function checkBlogDetails() {
  for (const slug of reviewSlugs) {
    const label = 'Published review: ' + slug, file = 'reviews/' + slug + '/index.html';
    checkBaseSeo({ label, file, canonical: 'https://ajsee.cz/reviews/' + slug + '/' });
    const html = readDist(file);
    expectMatch(label,html,/id=["']ajsee-review-jsonld["']/,'has review schema');
    expectMatch(label,html,/"@type"\s*:\s*"(?:Review|Article)"/,'has published editorial entity');
  }
  for(const slug of retiredSlugs) {
    if(!existsSync(path.join(distDir,'blog',slug,'index.html')))pass('Retired articles',slug+' is removed');
    else fail('Retired articles',slug+' is still published');
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
    ...reviewSlugs.map((slug) => `https://ajsee.cz/reviews/${slug}/`),
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
