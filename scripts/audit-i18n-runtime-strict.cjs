const fs = require('fs');
const path = require('path');

const root = process.cwd();
const supportedLangs = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const normalized = full.replace(/\\/g, '/');

    if (item.isDirectory()) {
      if (
        normalized.includes('/node_modules/') ||
        normalized.includes('/dist/') ||
        normalized.includes('/reports/') ||
        normalized.includes('/.git/')
      ) continue;

      walk(full, out);
      continue;
    }

    if (
      item.isFile() &&
      item.name.endsWith('.html') &&
      !item.name.includes('.bak-') &&
      !normalized.includes('/public/admin/')
    ) {
      out.push(full);
    }
  }

  return out;
}

function readJson(file, fallback = {}) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function deepMerge(a = {}, b = {}) {
  const out = { ...a };

  for (const [key, value] of Object.entries(b || {})) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(out[key] || {}, value)
        : value;
  }

  return out;
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&copy;/gi, '©')
    .replace(/&#169;/g, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&#174;/g, '®')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]*>/g, '');
}

function normalizeText(value = '') {
  return decodeHtml(stripTags(value))
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getByPath(obj, key) {
  if (!key) return undefined;

  if (String(key).includes('|')) {
    const parts = String(key)
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const value = getByPath(obj, part);
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }

    return undefined;
  }

  return String(key)
    .split('.')
    .reduce((acc, part) => (
      acc && Object.prototype.hasOwnProperty.call(acc, part)
        ? acc[part]
        : undefined
    ), obj);
}

function t(dict, key) {
  return getByPath(dict, key) ?? dict[key];
}

function getPageName(file, html) {
  const bodyMatch = html.match(/<body\b[^>]*\bdata-page="([^"]+)"/i);
  const bodyPage = bodyMatch ? String(bodyMatch[1] || '').trim() : '';

  if (bodyPage && bodyPage !== 'home') return bodyPage;

  const rel = path.relative(root, file).replace(/\\/g, '/');

  if (rel === 'index.html') return '';
  if (rel === 'coming-soon/index.html') return 'coming-soon';

  if (rel.startsWith('blog/') && rel.endsWith('/index.html')) return 'blog-detail';
  if (rel.startsWith('microguides/') && rel.endsWith('/index.html')) return 'microguides';

  const base = path.basename(file, '.html');
  return base === 'index' ? '' : base;
}

function loadRuntimeDict(lang, pageName) {
  const base =
    readJson(path.join(root, 'public', 'locales', `${lang}.json`), null) ||
    readJson(path.join(root, 'src', 'locales', `${lang}.json`), {});

  const page =
    pageName
      ? (
          readJson(path.join(root, 'public', 'locales', lang, `${pageName}.json`), null) ||
          readJson(path.join(root, 'src', 'locales', lang, `${pageName}.json`), {})
        )
      : {};

  return deepMerge(base, page);
}

function extractAttr(tag, attrName) {
  const re = new RegExp(`(?:^|\\s)${attrName}="([^"]*)"`, 'i');
  const match = tag.match(re);
  return match ? match[1] : '';
}

function extractUses(html) {
  const uses = [];

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)\bdata-i18n-key="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    uses.push({
      type: 'text',
      tag: match[1].toLowerCase(),
      key: match[3],
      current: match[5]
    });
  }

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)\bdata-i18n-content="([^"]+)"([^>]*)>/g)) {
    uses.push({
      type: 'content',
      tag: match[1].toLowerCase(),
      key: match[3],
      current: extractAttr(match[0], 'content')
    });
  }

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)\bdata-i18n-placeholder="([^"]+)"([^>]*)>/g)) {
    uses.push({
      type: 'placeholder',
      tag: match[1].toLowerCase(),
      key: match[3],
      current: extractAttr(match[0], 'placeholder')
    });
  }

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)\bdata-i18n-aria="([^"]+)"([^>]*)>/g)) {
    uses.push({
      type: 'aria',
      tag: match[1].toLowerCase(),
      key: match[3],
      current: extractAttr(match[0], 'aria-label')
    });
  }

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)\bdata-i18n-alt="([^"]+)"([^>]*)>/g)) {
    uses.push({
      type: 'alt',
      tag: match[1].toLowerCase(),
      key: match[3],
      current: extractAttr(match[0], 'alt')
    });
  }

  return uses;
}

const htmlFiles = walk(root).sort();
const results = {
  files: htmlFiles.length,
  uses: 0,
  csMismatches: [],
  missing: []
};

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const pageName = getPageName(file, html);
  const uses = extractUses(html);

  results.uses += uses.length;

  for (const lang of supportedLangs) {
    const dict = loadRuntimeDict(lang, pageName);

    for (const use of uses) {
      const expected = t(dict, use.key);

      if (expected === undefined || expected === null || String(expected).trim() === '') {
        results.missing.push({
          file: rel,
          pageName,
          lang,
          type: use.type,
          key: use.key
        });
        continue;
      }

      if (lang === 'cs') {
        const currentNorm = normalizeText(use.current);
        const expectedNorm = normalizeText(expected);

        if (currentNorm !== expectedNorm) {
          results.csMismatches.push({
            file: rel,
            pageName,
            type: use.type,
            tag: use.tag,
            key: use.key,
            current: currentNorm,
            expected: expectedNorm
          });
        }
      }
    }
  }
}

const reportDir = path.join(root, 'reports', 'i18n-runtime');
fs.mkdirSync(reportDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const jsonPath = path.join(reportDir, `runtime-i18n-strict-${stamp}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

console.log('AJSEE strict runtime i18n audit');
console.log('============================================================');
console.log(`HTML files scanned: ${results.files}`);
console.log(`i18n uses found: ${results.uses}`);
console.log(`Runtime CS mismatches: ${results.csMismatches.length}`);
console.log(`Runtime missing translations: ${results.missing.length}`);
console.log(`JSON report: ${path.relative(root, jsonPath)}`);

if (results.csMismatches.length) {
  console.log('\n===== CS mismatches =====');
  for (const item of results.csMismatches.slice(0, 80)) {
    console.log(`\n${item.file} | ${item.key}`);
    console.log(`current:  ${item.current}`);
    console.log(`expected: ${item.expected}`);
  }
}

if (results.missing.length) {
  console.log('\n===== Missing translations =====');
  for (const item of results.missing.slice(0, 80)) {
    console.log(`${item.file} | lang=${item.lang} | page=${item.pageName || '(none)'} | ${item.key}`);
  }
}
