const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PUBLIC_SITEMAP = path.join(ROOT, 'public', 'sitemap.xml');
const DIST_SITEMAP = path.join(DIST, 'sitemap.xml');

const ORIGIN = 'https://ajsee.cz';
const LANG_PREFIX_RE = /^\/(en|de|sk|pl|hu)(?=\/|$)/i;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      walk(full, out);
      continue;
    }

    if (item.isFile() && item.name.toLowerCase().endsWith('.html')) {
      out.push(full);
    }
  }

  return out;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeIfChanged(file, content) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (prev === content) return false;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function getAttr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  return tag.match(re)?.[1] || '';
}

function robotsContent(html) {
  const tag = html.match(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i)?.[0] || '';
  return getAttr(tag, 'content').toLowerCase();
}

function isNoindex(html) {
  return /\bnoindex\b/i.test(robotsContent(html));
}

function canonicalHref(html) {
  const tag = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i)?.[0] || '';
  return getAttr(tag, 'href').trim();
}

function normalizeCanonical(raw) {
  if (!raw) return '';

  try {
    const url = new URL(raw, ORIGIN);
    if (url.origin !== ORIGIN) return '';

    url.hash = '';
    url.search = '';

    let pathname = url.pathname || '/';
    pathname = pathname.replace(/\/index\.html$/i, '/');

    if (pathname !== '/' && pathname.endsWith('/')) {
      // Czech canonical routes in project intentionally use no trailing slash for main pages,
      // while localized routes and generated content often keep slash. Preserve what canonical says.
    }

    return url.origin + pathname;
  } catch {
    return '';
  }
}

function canonicalPath(url) {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '';
  }
}

function isLocalizedBlogArticle(pathname) {
  return /^\/(en|de|sk|pl|hu)\/blog\/[^/]+\/?$/i.test(pathname);
}

function shouldInclude(url) {
  const pathname = canonicalPath(url);

  if (!pathname) return false;

  // Technical / fallback / non-search pages.
  if (/\/admin(\/|$)/i.test(pathname)) return false;
  if (/\/blog-detail\/?$/i.test(pathname)) return false;
  if (/\/coming-soon(\/|$)/i.test(pathname)) return false;
  if (/\/thank-you\/?$/i.test(pathname)) return false;

  // Important: localized blog article clones currently reuse Czech article content.
  // Keep only Czech blog article URLs in sitemap until real translated article content exists.
  if (isLocalizedBlogArticle(pathname)) return false;

  return true;
}

function readExistingLastmods() {
  const map = new Map();

  for (const file of [PUBLIC_SITEMAP, DIST_SITEMAP]) {
    if (!fs.existsSync(file)) continue;

    const xml = fs.readFileSync(file, 'utf8');
    const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];

    for (const block of blocks) {
      const loc = block.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
      const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim();

      if (loc && lastmod && !map.has(loc)) {
        map.set(loc, lastmod);
      }
    }
  }

  return map;
}

function priorityFor(pathname) {
  const clean = pathname.replace(/\/+$/g, '') || '/';
  const withoutLang = clean.replace(LANG_PREFIX_RE, '') || '/';

  if (clean === '/') return '1.0';
  if (/^\/(en|de|sk|pl|hu)$/i.test(clean)) return '0.8';

  if (withoutLang === '/events') return '0.9';
  if (withoutLang === '/accommodation') return '0.8';
  if (withoutLang === '/partners') return '0.8';
  if (withoutLang === '/about') return '0.7';
  if (withoutLang === '/blog') return '0.7';
  if (/^\/blog\/[^/]+$/i.test(withoutLang)) return '0.6';
  if (withoutLang === '/faq') return '0.6';
  if (withoutLang === '/microguides') return '0.6';
  if (/^\/microguides\/[^/]+$/i.test(withoutLang)) return '0.5';
  if (withoutLang === '/privacy-policy' || withoutLang === '/cookies-policy') return '0.3';

  return '0.5';
}

function changefreqFor(pathname) {
  const clean = pathname.replace(/\/+$/g, '') || '/';
  const withoutLang = clean.replace(LANG_PREFIX_RE, '') || '/';

  if (withoutLang === '/') return 'weekly';
  if (withoutLang === '/events') return 'daily';
  if (withoutLang === '/blog') return 'weekly';
  if (withoutLang === '/microguides') return 'weekly';
  if (withoutLang === '/privacy-policy' || withoutLang === '/cookies-policy') return 'yearly';

  return 'monthly';
}

function sortRank(url) {
  const pathname = canonicalPath(url);
  const clean = pathname.replace(/\/+$/g, '') || '/';
  const withoutLang = clean.replace(LANG_PREFIX_RE, '') || '/';
  const langWeight = LANG_PREFIX_RE.test(clean) ? 1 : 0;

  let section = 90;

  if (withoutLang === '/') section = 0;
  else if (withoutLang === '/events') section = 10;
  else if (withoutLang === '/accommodation') section = 20;
  else if (withoutLang === '/partners') section = 30;
  else if (withoutLang === '/about') section = 40;
  else if (withoutLang === '/blog') section = 50;
  else if (/^\/blog\/[^/]+$/i.test(withoutLang)) section = 55;
  else if (withoutLang === '/faq') section = 60;
  else if (withoutLang === '/microguides') section = 70;
  else if (/^\/microguides\/[^/]+$/i.test(withoutLang)) section = 75;
  else if (withoutLang === '/privacy-policy' || withoutLang === '/cookies-policy') section = 95;

  return `${String(section).padStart(3, '0')}-${langWeight}-${url}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSitemap(urls, lastmods) {
  const fallbackLastmod = todayISO();

  const body = urls.map((url) => {
    const pathname = canonicalPath(url);
    const lastmod = lastmods.get(url) || fallbackLastmod;

    return [
      '  <url>',
      `    <loc>${escapeXml(url)}</loc>`,
      `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
      `    <changefreq>${changefreqFor(pathname)}</changefreq>`,
      `    <priority>${priorityFor(pathname)}</priority>`,
      '  </url>'
    ].join('\n');
  }).join('\n\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    ''
  ].join('\n');
}

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist neexistuje. Nejdřív spusť npm run build.');
  }

  const lastmods = readExistingLastmods();
  const urls = new Map();

  for (const file of walk(DIST)) {
    const html = read(file);

    if (isNoindex(html)) continue;

    const canonical = normalizeCanonical(canonicalHref(html));
    if (!canonical) continue;
    if (!shouldInclude(canonical)) continue;

    if (!urls.has(canonical)) {
      urls.set(canonical, path.relative(DIST, file));
    }
  }

  const sortedUrls = [...urls.keys()].sort((a, b) => sortRank(a).localeCompare(sortRank(b)));
  const xml = buildSitemap(sortedUrls, lastmods);

  const wrotePublic = writeIfChanged(PUBLIC_SITEMAP, xml);
  const wroteDist = writeIfChanged(DIST_SITEMAP, xml);

  console.log('AJSEE sitemap generated');
  console.log('============================================================');
  console.log(`URLs: ${sortedUrls.length}`);
  console.log(`public/sitemap.xml: ${wrotePublic ? 'updated' : 'unchanged'}`);
  console.log(`dist/sitemap.xml: ${wroteDist ? 'updated' : 'unchanged'}`);
}

main();
