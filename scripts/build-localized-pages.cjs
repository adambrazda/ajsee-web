const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://ajsee.cz';

const LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const PREFIXED_LANGS = LANGS.filter((lang) => lang !== 'cs');
const CS_NO_TRAILING_CANONICAL_ROUTES = new Set([
  '/events/',
  '/accommodation/',
  '/partners/',
  '/about/',
  '/blog/',
  '/faq/',
  '/privacy-policy/',
  '/cookies-policy/'
]);

const LANG_META = {
  cs: { label: 'Čeština', flag: '/images/flags/cz.svg' },
  en: { label: 'English', flag: '/images/flags/gb.svg' },
  de: { label: 'Deutsch', flag: '/images/flags/de.svg' },
  sk: { label: 'Slovenčina', flag: '/images/flags/sk.svg' },
  pl: { label: 'Polski', flag: '/images/flags/pl.svg' },
  hu: { label: 'Magyar', flag: '/images/flags/hu.svg' }
};

const BLOG_READMORE_LABELS = {
  cs: 'Číst dál',
  en: 'Read more',
  de: 'Weiterlesen',
  sk: 'Čítať ďalej',
  pl: 'Czytaj dalej',
  hu: 'Tovább olvasom'
};

const SKIPPED_HTML_FILES = new Set([
  'test-ticketmaster.html',
  'ticketmaster-test.html',
  'admin/index.html',
  'public/admin/index.html'
]);

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

function getByPath(obj, key) {
  return String(key || '')
    .split('.')
    .reduce((acc, part) => {
      if (!acc || typeof acc !== 'object') return undefined;
      return Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined;
    }, obj);
}

function t(dict, key) {
  const parts = String(key || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const value = getByPath(dict, part) ?? dict[part];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return undefined;
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function shouldSkipHtml(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/');

  if (SKIPPED_HTML_FILES.has(normalized)) return true;

  if (normalized.startsWith('admin/')) return true;
  if (normalized.startsWith('public/admin/')) return true;

  return false;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(DIST, full).replace(/\\/g, '/');

    if (item.isDirectory()) {
      const first = rel.split('/')[0];

      if (PREFIXED_LANGS.includes(first)) continue;
      if (rel === 'assets' || rel === 'locales') continue;
      if (rel === 'admin' || rel.startsWith('admin/')) continue;
      if (rel === 'public/admin' || rel.startsWith('public/admin/')) continue;

      walk(full, out);
      continue;
    }

    if (!item.isFile() || !item.name.endsWith('.html')) continue;
    if (shouldSkipHtml(rel)) continue;

    out.push(full);
  }

  return out;
}

function cleanRouteFromDistFile(file) {
  const rel = path.relative(DIST, file).replace(/\\/g, '/');

  if (rel === 'index.html') return '/';

  if (rel.endsWith('/index.html')) {
    return '/' + rel.replace(/\/index\.html$/i, '/');
  }

  return '/' + rel.replace(/\.html$/i, '/');
}

function stripLangPrefix(pathname) {
  const input = String(pathname || '/');
  const parts = input.split('/').filter(Boolean);

  if (parts.length && PREFIXED_LANGS.includes(parts[0])) {
    const rest = parts.slice(1).join('/');
    return '/' + rest + (input.endsWith('/') && rest ? '/' : '');
  }

  return input || '/';
}

function normalizeRoute(route) {
  let out = String(route || '/');

  out = out.split('?')[0].split('#')[0];
  out = stripLangPrefix(out);

  if (!out.startsWith('/')) out = '/' + out;

  out = out.replace(/\/index\.html$/i, '/');
  out = out.replace(/\.html$/i, '/');

  if (out !== '/' && !out.endsWith('/')) out += '/';

  return out;
}

function localizedRoute(route, lang) {
  const clean = normalizeRoute(route);

  if (lang === 'cs') return clean;
  if (clean === '/') return `/${lang}/`;

  return `/${lang}${clean}`;
}


function routeForCanonical(route, lang) {
  const localized = localizedRoute(route, lang);

  if (lang === 'cs' && CS_NO_TRAILING_CANONICAL_ROUTES.has(localized)) {
    return localized.replace(/\/$/, '');
  }

  return localized;
}

function canonicalUrl(route, lang) {
  return ORIGIN + routeForCanonical(route, lang);
}

function targetFileForRoute(route, lang) {
  const localized = localizedRoute(route, lang).replace(/^\/+/, '');

  if (!localized) return path.join(DIST, 'index.html');

  return path.join(DIST, localized, 'index.html');
}

function getPageName(file, html) {
  const bodyMatch = html.match(/<body\b[^>]*\bdata-page="([^"]+)"/i);
  const bodyPage = bodyMatch ? String(bodyMatch[1] || '').trim() : '';

  if (bodyPage && bodyPage !== 'home') return bodyPage;

  const route = cleanRouteFromDistFile(file);
  const parts = route.split('/').filter(Boolean);

  if (!parts.length) return '';

  if (parts[0] === 'blog' && parts.length >= 2) return 'blog-detail';
  if (parts[0] === 'microguides') return 'microguides';
  if (parts[0] === 'coming-soon') return parts[1] || 'coming-soon';

  return parts[parts.length - 1] || '';
}

function loadDict(lang, pageName) {
  const base =
    readJson(path.join(ROOT, 'public', 'locales', `${lang}.json`), null) ||
    readJson(path.join(ROOT, 'src', 'locales', `${lang}.json`), {});

  const page = pageName
    ? (
        readJson(path.join(ROOT, 'public', 'locales', lang, `${pageName}.json`), null) ||
        readJson(path.join(ROOT, 'src', 'locales', lang, `${pageName}.json`), {})
      )
    : {};

  return deepMerge(base, page);
}

function replaceAttr(tag, attrName, value) {
  const escaped = escapeAttr(value);
  const re = new RegExp(`(^|\\s)${attrName}="[^"]*"`, 'i');

  if (re.test(tag)) {
    return tag.replace(re, `$1${attrName}="${escaped}"`);
  }

  return tag.replace(/>$/, ` ${attrName}="${escaped}">`);
}

function translateHtml(html, dict) {
  html = html.replace(
    /(<([a-zA-Z][\w:-]*)(?=[^>]*\bdata-i18n-key="([^"]+)")[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (full, open, tagName, key, inner, close) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      const rendered = /<[a-z][\s\S]*>/i.test(String(value))
        ? String(value)
        : escapeText(value);

      return `${open}${rendered}${close}`;
    }
  );

  html = html.replace(
    /<title\b([^>]*)\bdata-i18n-key="([^"]+)"([^>]*)>[\s\S]*?<\/title>/gi,
    (full, before, key, after) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      return `<title${before}data-i18n-key="${escapeAttr(key)}"${after}>${escapeText(value)}</title>`;
    }
  );

  html = html.replace(
    /<meta\b[^>]*\bdata-i18n-content="([^"]+)"[^>]*>/gi,
    (full, key) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      return replaceAttr(full, 'content', value);
    }
  );

  html = html.replace(
    /<[^>]+\bdata-i18n-placeholder="([^"]+)"[^>]*>/gi,
    (full, key) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      return replaceAttr(full, 'placeholder', value);
    }
  );

  html = html.replace(
    /<[^>]+\bdata-i18n-aria="([^"]+)"[^>]*>/gi,
    (full, key) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      return replaceAttr(replaceAttr(full, 'aria-label', value), 'title', value);
    }
  );

  html = html.replace(
    /<[^>]+\bdata-i18n-alt="([^"]+)"[^>]*>/gi,
    (full, key) => {
      const value = t(dict, key);
      if (value === undefined || String(value).trim() === '') return full;

      return replaceAttr(full, 'alt', value);
    }
  );

  return html;
}

function updateHtmlLang(html, lang) {
  if (/<html\b/i.test(html)) {
    return html.replace(/<html\b([^>]*)>/i, (full, attrs) => {
      let tag = `<html${attrs}>`;
      tag = replaceAttr(tag, 'lang', lang);
      return tag;
    });
  }

  return html;
}

function updateLangDropdown(html, lang) {
  const meta = LANG_META[lang] || LANG_META.cs;

  html = html.replace(
    /(<([a-zA-Z][\w:-]*)\b(?=[^>]*class="[^"]*\blang-current-label\b[^"]*")[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (full, open, tag, inner, close) => `${open}${escapeText(meta.label)}${close}`
  );

  html = html.replace(
    /<img\b(?=[^>]*class="[^"]*\blang-current-flag\b[^"]*")[^>]*>/gi,
    (full) => {
      let out = replaceAttr(full, 'src', meta.flag);
      out = replaceAttr(out, 'alt', meta.label);
      return out;
    }
  );

  return html;
}


function updateStaticGeneratedLabels(html, lang) {
  const blogReadMore = BLOG_READMORE_LABELS[lang] || BLOG_READMORE_LABELS.cs;

  html = html.replace(
    /(<a\b(?=[^>]*class="[^"]*\bblog-readmore\b[^"]*")[^>]*>)([\s\S]*?)(<\/a>)/gi,
    (full, open, inner, close) => {
      return `${open}${escapeText(blogReadMore)}${close}`;
    }
  );

  return html;
}


function updateStaticA11yLabels(html, dict, lang) {
  const homeLabel = t(dict, 'nav-home') || (LANG_META[lang]?.label || LANG_META.cs.label);

  html = html.replace(
    /<a\b(?=[^>]*class="[^"]*\blogo-link\b[^"]*")[^>]*>/gi,
    (full) => {
      let out = replaceAttr(full, 'aria-label', homeLabel);
      out = replaceAttr(out, 'title', homeLabel);
      return out;
    }
  );

  return html;
}

function isSkippableHref(href) {
  const value = String(href || '').trim();

  if (!value) return true;
  if (value.startsWith('#')) return true;
  if (/^(mailto:|tel:|javascript:)/i.test(value)) return true;
  if (/^\/\//.test(value)) return true;
  if (/\.(png|jpe?g|webp|avif|svg|gif|pdf|zip|css|js|json|xml|txt|ico)$/i.test(value.split('?')[0])) return true;

  return false;
}

function cleanSearch(url) {
  const params = new URLSearchParams(url.search);
  params.delete('lang');

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function localizeHref(href, currentLang, currentRoute, explicitTargetLang = null) {
  if (isSkippableHref(href)) return href;

  try {
    const targetLang = explicitTargetLang || currentLang;
    const baseUrl = ORIGIN + normalizeRoute(currentRoute);
    const url = new URL(href, baseUrl);

    if (url.origin !== ORIGIN) return href;

    const route = explicitTargetLang
      ? currentRoute
      : normalizeRoute(url.pathname);

    return localizedRoute(route, targetLang) + cleanSearch(url) + url.hash;
  } catch {
    return href;
  }
}

function rewriteLinks(html, lang, route) {
  return html.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/gi, (full, href) => {
    const langMatch =
      full.match(/\bdata-lang="(cs|en|de|sk|pl|hu)"/i) ||
      full.match(/\bdata-lang-code="(cs|en|de|sk|pl|hu)"/i);

    const explicitTargetLang = langMatch ? langMatch[1].toLowerCase() : null;
    const nextHref = localizeHref(href, lang, route, explicitTargetLang);

    return replaceAttr(full, 'href', nextHref);
  });
}

function updateExistingMetaUrl(html, canonical) {
  html = html.replace(
    /<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi,
    (full) => replaceAttr(full, 'content', canonical)
  );

  html = html.replace(
    /<meta\b(?=[^>]*\bname=["']twitter:url["'])[^>]*>/gi,
    (full) => replaceAttr(full, 'content', canonical)
  );

  return html;
}

function applySeoLinks(html, route, lang) {
  const canonical = canonicalUrl(route, lang);

  const alternateLinks = LANGS
    .map((itemLang) => {
      return `<link rel="alternate" hreflang="${itemLang}" href="${escapeAttr(canonicalUrl(route, itemLang))}" />`;
    })
    .join('\n  ');

  const seoBlock = [
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    alternateLinks,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl(route, 'cs'))}" />`
  ].join('\n  ');

  html = updateExistingMetaUrl(html, canonical);

  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=["'][^"']+["'][^>]*>\s*/gi, '');

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${seoBlock}\n</head>`);
  }

  return html;
}

function processPage(sourceHtml, file, lang) {
  const route = cleanRouteFromDistFile(file);
  const pageName = getPageName(file, sourceHtml);
  const dict = loadDict(lang, pageName);

  let html = sourceHtml;

  html = updateHtmlLang(html, lang);
  html = translateHtml(html, dict);
  html = updateLangDropdown(html, lang);
  html = updateStaticGeneratedLabels(html, lang);
  html = updateStaticA11yLabels(html, dict, lang);
  html = rewriteLinks(html, lang, route);
  html = applySeoLinks(html, route, lang);

  return html;
}

function removeOldLocalizedDirs() {
  for (const lang of PREFIXED_LANGS) {
    const dir = path.join(DIST, lang);

    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ does not exist. Run npm run build first.');
  }

  removeOldLocalizedDirs();

  const pages = walk(DIST).map((file) => ({
    file,
    route: cleanRouteFromDistFile(file),
    html: fs.readFileSync(file, 'utf8')
  }));

  let written = 0;

  for (const page of pages) {
    const csHtml = processPage(page.html, page.file, 'cs');
    fs.writeFileSync(page.file, csHtml, 'utf8');
    written++;

    for (const lang of PREFIXED_LANGS) {
      const localizedHtml = processPage(page.html, page.file, lang);
      const target = targetFileForRoute(page.route, lang);

      ensureDir(path.dirname(target));
      fs.writeFileSync(target, localizedHtml, 'utf8');
      written++;
    }
  }

  console.log('AJSEE localized static pages generated');
  console.log('============================================================');
  console.log(`Source pages: ${pages.length}`);
  console.log(`Languages: ${LANGS.join(', ')}`);
  console.log(`HTML files written: ${written}`);
}

main();