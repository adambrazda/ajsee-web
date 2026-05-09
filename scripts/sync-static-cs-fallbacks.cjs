const fs = require('fs');
const path = require('path');

const root = process.cwd();
const reportDir = path.join(root, 'reports', 'i18n-runtime');
fs.mkdirSync(reportDir, { recursive: true });

const APPLY = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const LANG = 'cs';
const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'reports',
  '.netlify'
]);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(dir, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (ignoreDirs.has(item.name)) continue;
      walk(path.join(dir, item.name), out);
    } else if (item.isFile() && item.name.endsWith('.html')) {
      out.push(path.join(dir, item.name));
    }
  }

  return out;
}

function readJsonSafe(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function getByPath(obj, key) {
  if (String(key || '').includes('|')) {
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

  return String(key || '')
    .split('.')
    .reduce((acc, part) => (acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined), obj);
}

function routeForHtml(fileRel) {
  if (fileRel === 'index.html') return '/';

  if (fileRel.endsWith('/index.html')) {
    return '/' + fileRel.replace(/\/index\.html$/i, '/');
  }

  return '/' + fileRel.replace(/\.html$/i, '');
}

function pageNameForHtml(fileRel, html) {
  const bodyPage = html.match(/<body[^>]*\bdata-page="([^"]+)"/i)?.[1] || '';

  if (bodyPage && bodyPage !== 'home') {
    return String(bodyPage).trim();
  }

  const route = routeForHtml(fileRel);
  const normalizedRoute = String(route || '/').replace(/\/+$/g, '');

  if (!normalizedRoute || normalizedRoute === '/') return '';

  const parts = normalizedRoute.split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').replace(/\.html$/i, '');
}

function loadRuntimeCs(fileRel, html) {
  const base = readJsonSafe(path.join(root, 'public', 'locales', `${LANG}.json`));
  const pageName = pageNameForHtml(fileRel, html);

  const page = pageName
    ? readJsonSafe(path.join(root, 'public', 'locales', LANG, `${pageName}.json`))
    : {};

  return {
    dict: deepMerge(base, page),
    pageName
  };
}

function decodeBasicEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function normalizeText(value) {
  return decodeBasicEntities(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNestedMarkup(inner) {
  return /<\s*[a-z][\s\S]*?>/i.test(inner);
}

function shouldTreatAsHtml(value) {
  return /<\s*[a-z][\s\S]*?>/i.test(String(value || ''));
}

function replaceAttribute(openingTag, attrName, value) {
  const escaped = escapeAttr(value);
  const source = String(openingTag || '');
  const attrPattern = new RegExp(`(^|\\s)${attrName}="[^"]*"`, 'i');

  if (attrPattern.test(source)) {
    return source.replace(attrPattern, `$1${attrName}="${escaped}"`);
  }

  return source.replace(/>$/, ` ${attrName}="${escaped}">`);
}

const files = walk(root).sort();

const changes = [];
const skipped = [];
const touchedFiles = new Map();

for (const file of files) {
  const fileRel = rel(file);
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const { dict, pageName } = loadRuntimeCs(fileRel, html);

  function t(key) {
    const direct = getByPath(dict, key);
    if (direct !== undefined) return direct;

    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];

    return undefined;
  }

  // data-i18n-key inner content
  html = html.replace(
    /<([a-zA-Z0-9:-]+)([^>]*\sdata-i18n-key="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag, attrs, key, inner) => {
      const value = t(key);
      if (value === undefined || String(value).trim() === '') return match;

      const next = String(value);
      const currentText = normalizeText(inner);
      const nextText = normalizeText(next);

      if (currentText === nextText) return match;

      if (hasNestedMarkup(inner) && !shouldTreatAsHtml(next)) {
        skipped.push({
          file: fileRel,
          pageName,
          kind: 'data-i18n-key:nested-skip',
          key,
          current: currentText,
          next: nextText
        });
        return match;
      }

      changes.push({
        file: fileRel,
        pageName,
        kind: 'data-i18n-key',
        key,
        current: currentText,
        next: nextText
      });

      return `<${tag}${attrs}>${next}</${tag}>`;
    }
  );

  // data-i18n-content -> content attribute
  html = html.replace(/<([a-zA-Z0-9:-]+)([^>]*\sdata-i18n-content="([^"]+)"[^>]*)>/g, (match, tag, attrs, key) => {
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return match;

    const current = match.match(/\bcontent="([^"]*)"/i)?.[1] || '';
    if (decodeBasicEntities(current) === String(value)) return match;

    changes.push({
      file: fileRel,
      pageName,
      kind: 'data-i18n-content',
      key,
      current: decodeBasicEntities(current),
      next: String(value)
    });

    return `<${tag}${replaceAttribute(attrs + '>', 'content', value).slice(0, -1)}>`;
  });

  // data-i18n-placeholder -> placeholder attribute
  html = html.replace(/<([a-zA-Z0-9:-]+)([^>]*\sdata-i18n-placeholder="([^"]+)"[^>]*)>/g, (match, tag, attrs, key) => {
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return match;

    const current = match.match(/\bplaceholder="([^"]*)"/i)?.[1] || '';
    if (decodeBasicEntities(current) === String(value)) return match;

    changes.push({
      file: fileRel,
      pageName,
      kind: 'data-i18n-placeholder',
      key,
      current: decodeBasicEntities(current),
      next: String(value)
    });

    return `<${tag}${replaceAttribute(attrs + '>', 'placeholder', value).slice(0, -1)}>`;
  });

  // data-i18n-aria -> aria-label + title
  html = html.replace(/<([a-zA-Z0-9:-]+)([^>]*\sdata-i18n-aria="([^"]+)"[^>]*)>/g, (match, tag, attrs, key) => {
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return match;

    const current = match.match(/\baria-label="([^"]*)"/i)?.[1] || '';
    if (decodeBasicEntities(current) === String(value) && /\btitle="/i.test(match)) return match;

    changes.push({
      file: fileRel,
      pageName,
      kind: 'data-i18n-aria',
      key,
      current: decodeBasicEntities(current),
      next: String(value)
    });

    let nextAttrs = replaceAttribute(attrs + '>', 'aria-label', value).slice(0, -1);
    nextAttrs = replaceAttribute(nextAttrs + '>', 'title', value).slice(0, -1);

    return `<${tag}${nextAttrs}>`;
  });

  // data-i18n-alt -> alt attribute
  html = html.replace(/<([a-zA-Z0-9:-]+)([^>]*\sdata-i18n-alt="([^"]+)"[^>]*)>/g, (match, tag, attrs, key) => {
    const value = t(key);
    if (value === undefined || String(value).trim() === '') return match;

    const current = match.match(/\balt="([^"]*)"/i)?.[1] || '';
    if (decodeBasicEntities(current) === String(value)) return match;

    changes.push({
      file: fileRel,
      pageName,
      kind: 'data-i18n-alt',
      key,
      current: decodeBasicEntities(current),
      next: String(value)
    });

    return `<${tag}${replaceAttribute(attrs + '>', 'alt', value).slice(0, -1)}>`;
  });

  if (html !== original) {
    touchedFiles.set(fileRel, html);

    if (APPLY) {
      const backup = `${file}.bak-sync-static-cs-fallback-${stamp}`;
      fs.copyFileSync(file, backup);
      fs.writeFileSync(file, html, 'utf8');
    }
  }
}

const mdPath = path.join(reportDir, `static-cs-fallback-sync-${stamp}.md`);
const jsonPath = path.join(reportDir, `static-cs-fallback-sync-${stamp}.json`);

const byFile = new Map();
for (const change of changes) {
  const arr = byFile.get(change.file) || [];
  arr.push(change);
  byFile.set(change.file, arr);
}

const lines = [];
lines.push('# AJSEE static CS fallback sync');
lines.push('');
lines.push(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
lines.push(`Changes: ${changes.length}`);
lines.push(`Skipped nested: ${skipped.length}`);
lines.push(`Touched files: ${touchedFiles.size}`);
lines.push('');
lines.push('## Changes by file');
lines.push('');

for (const [file, items] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${file} — ${items.length}`);
  for (const item of items.slice(0, 80)) {
    lines.push(`- ${item.kind} :: ${item.key}`);
    lines.push(`  - current: ${item.current}`);
    lines.push(`  - next: ${item.next}`);
  }
  if (items.length > 80) lines.push(`- ... ${items.length - 80} more`);
  lines.push('');
}

if (skipped.length) {
  lines.push('## Skipped nested content');
  lines.push('');
  for (const item of skipped) {
    lines.push(`- ${item.file} :: ${item.key}`);
    lines.push(`  - current: ${item.current}`);
    lines.push(`  - next: ${item.next}`);
  }
}

fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
fs.writeFileSync(jsonPath, JSON.stringify({ apply: APPLY, changes, skipped }, null, 2), 'utf8');

console.log('\nAJSEE static CS fallback sync');
console.log('============================================================');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
console.log(`Changes: ${changes.length}`);
console.log(`Skipped nested: ${skipped.length}`);
console.log(`Touched files: ${touchedFiles.size}`);
console.log(`MD: ${rel(mdPath)}`);
console.log(`JSON: ${rel(jsonPath)}`);

console.log('\n===== Changes by file =====');
for (const [file, items] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${file}: ${items.length}`);
}

if (skipped.length) {
  console.log('\n===== Skipped nested content =====');
  for (const item of skipped.slice(0, 40)) {
    console.log(`${item.file} | ${item.key}`);
  }
}
