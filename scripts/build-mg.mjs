import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();

const SITE_ORIGIN = 'https://ajsee.cz';

const SRC_DIR = path.join(ROOT, 'content/microguides');        // vstup (CMS i lok. soubory)
const OUT_DIR = path.join(ROOT, 'public/content/microguides'); // výstup pro runtime

// Zdrojová HTML šablona microguides stránky.
// Primárně očekáváme /microguides/index.html.
const STATIC_PAGE_ROOT = path.join(ROOT, 'microguides');
const TEMPLATE_CANDIDATES = [
  path.join(ROOT, 'microguides/index.html'),
  path.join(ROOT, 'microguides.html')
];

const GENERATED_MARKER = '<!-- AJSEE GENERATED MICROGUIDE DETAIL -->';

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const DEFAULT_LANG = 'cs';

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readJsonSafe(p, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readTextSafe(p, fallback = '') {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return fallback;
  }
}

function normalizeLang(value) {
  const lang = String(value || '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  if (lang === 'cz') return 'cs';

  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

function normalizeSlug(value) {
  return String(value || '').trim();
}

function isSafeSlug(slug) {
  return /^[a-z0-9][a-z0-9-]*$/i.test(slug);
}

function getSlugFromFilename(file) {
  // např. "fees-refund.cs.json" -> "fees-refund"
  return String(file)
    .replace(/\.([a-z]{2})\.json$/i, '')
    .replace(/\.json$/i, '');
}

function getLangFromFilename(file) {
  // např. "fees-refund.cs.json" -> "cs"
  const m = String(file).match(/\.([a-z]{2})\.json$/i);
  return m ? normalizeLang(m[1]) : null;
}

async function fileStatTs(filePath) {
  try {
    const st = await fs.stat(filePath);
    return st.mtimeMs || st.mtime?.getTime() || 0;
  } catch {
    return 0;
  }
}

function toIsoDate(ts) {
  if (!ts) return null;

  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch {
    return null;
  }
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
  const text = String(value).replace(/\s+/g, ' ').trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function toAbsoluteUrl(value = '') {
  if (!value) return '';

  try {
    return new URL(value, SITE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Vybere nejlepší lokalizovaný soubor pro daný slug.
 * Preferenční pořadí: primaryLang -> en -> cs -> cokoliv existujícího
 */
function pickBestLocaleFile(localeFiles, slug, primaryLang = DEFAULT_LANG) {
  const lang = normalizeLang(primaryLang);

  const prefer = [
    `${slug}.${lang}.json`,
    `${slug}.en.json`,
    `${slug}.cs.json`
  ];

  let file = prefer.find((f) => localeFiles.includes(f));

  if (!file) {
    file = localeFiles.find((f) => f.startsWith(`${slug}.`));
  }

  return file || null;
}

/**
 * Načte title/summary/cover z nejlepšího existujícího lokalizačního souboru.
 */
async function pickLocalizedFields(srcDir, localeFiles, slug, primaryLang, cmsFallback = {}) {
  const best = pickBestLocaleFile(localeFiles, slug, primaryLang);

  if (!best) {
    return {
      title: cmsFallback.title || '',
      summary: cmsFallback.summary || '',
      cover: cmsFallback.cover || ''
    };
  }

  const data = await readJsonSafe(path.join(srcDir, best), {});

  return {
    title: data.title || cmsFallback.title || '',
    summary: data.summary || cmsFallback.summary || '',
    cover: data.cover || cmsFallback.cover || ''
  };
}

/**
 * Načte celý lokalizovaný mikroprůvodce.
 */
async function readLocalizedGuide(localeFiles, slug, primaryLang = DEFAULT_LANG) {
  const best = pickBestLocaleFile(localeFiles, slug, primaryLang);

  if (!best) return null;

  const data = await readJsonSafe(path.join(SRC_DIR, best), null);

  if (!data) return null;

  return {
    file: best,
    lang: getLangFromFilename(best) || normalizeLang(primaryLang),
    data
  };
}

/**
 * Určí timestamp „publikace“.
 * 1) CMS -> publishedAt
 * 2) lokalizovaný JSON -> publishedAt
 * 3) mtime vybraného souboru
 */
async function resolvePublishedTs(srcDir, localeFiles, slug, primaryLang, cmsPublishedAt = null) {
  if (cmsPublishedAt) {
    const ts = Date.parse(cmsPublishedAt);
    if (!Number.isNaN(ts)) return ts;
  }

  const best =
    pickBestLocaleFile(localeFiles, slug, primaryLang) ||
    pickBestLocaleFile(localeFiles, slug, 'en') ||
    pickBestLocaleFile(localeFiles, slug, 'cs');

  if (best) {
    const p = path.join(srcDir, best);
    const j = await readJsonSafe(p, {});
    const tsFromJson = Date.parse(j.publishedAt || 0);

    if (!Number.isNaN(tsFromJson) && tsFromJson > 0) {
      return tsFromJson;
    }

    return await fileStatTs(p);
  }

  return 0;
}

async function findTemplatePath() {
  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      const st = await fs.stat(candidate);

      if (st.isFile()) {
        return candidate;
      }
    } catch {
      // try next
    }
  }

  return null;
}

/**
 * Smaže pouze dříve generované detail stránky.
 * Nikdy nemaže /microguides/index.html.
 */
async function cleanGeneratedStaticPages() {
  let entries = [];

  try {
    entries = await fs.readdir(STATIC_PAGE_ROOT, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return;

      const dirPath = path.join(STATIC_PAGE_ROOT, entry.name);
      const indexPath = path.join(dirPath, 'index.html');
      const html = await readTextSafe(indexPath, '');

      if (html.includes(GENERATED_MARKER)) {
        await fs.rm(dirPath, { recursive: true, force: true });
      }
    })
  );
}

function mdToHtml(md = '') {
  const norm = String(md).replace(/\r\n?/g, '\n').trim();

  if (!norm) return '';

  const escapeInline = (s) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const lines = norm.split('\n');
  const out = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;

    out.push(
      `<ul>${list.map((item) => `<li>${escapeInline(item)}</li>`).join('')}</ul>`
    );

    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushList();
      out.push('');
      continue;
    }

    let m;

    if ((m = line.match(/^###\s+(.*)$/))) {
      flushList();
      out.push(`<h4>${escapeInline(m[1])}</h4>`);
      continue;
    }

    if ((m = line.match(/^##\s+(.*)$/))) {
      flushList();
      out.push(`<h3>${escapeInline(m[1])}</h3>`);
      continue;
    }

    if ((m = line.match(/^#\s+(.*)$/))) {
      flushList();
      out.push(`<h2>${escapeInline(m[1])}</h2>`);
      continue;
    }

    if (/^- /.test(line)) {
      list.push(line.replace(/^-+\s+/, '').trim());
      continue;
    }

    flushList();
    out.push(`<p>${escapeInline(line)}</p>`);
  }

  flushList();

  return out
    .filter((chunk, i, arr) => !(chunk === '' && arr[i - 1] === ''))
    .join('\n');
}

/**
 * Obsah mikroprůvodců je interní/repo-controlled.
 * Pokud body obsahuje HTML callouty, necháme je projít, aby se zachoval vizuální formát.
 * Pokud jde o prostý text/Markdown, převedeme ho na HTML.
 */
function contentToHtml(value = '') {
  const raw = String(value || '').trim();

  if (!raw) return '';

  const containsHtml = /<\/?[a-z][\s\S]*>/i.test(raw);

  if (containsHtml) {
    return raw;
  }

  return mdToHtml(raw);
}

function buildArticleBody(data) {
  const parts = [];

  if (data?.summary) {
    parts.push(stripHtml(data.summary));
  }

  if (Array.isArray(data?.steps)) {
    data.steps.forEach((step) => {
      if (step?.heading) parts.push(stripHtml(step.heading));
      if (step?.body) parts.push(stripHtml(step.body));
    });
  }

  if (data?.ctaQuestion) {
    parts.push(stripHtml(data.ctaQuestion));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function buildJsonLd(data, langCode, slug, ts = 0) {
  const canonicalUrl = `${SITE_ORIGIN}/microguides/${encodeURIComponent(slug)}/`;
  const title = data.title || slug;
  const description = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const image = toAbsoluteUrl(data.cover) || `${SITE_ORIGIN}/images/logo-ajsee.png`;

  const datePublished =
    data.publishedAt ||
    data.datePublished ||
    toIsoDate(ts) ||
    undefined;

  const dateModified =
    data.updatedAt ||
    data.dateModified ||
    toIsoDate(ts) ||
    undefined;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl
        },
        headline: title,
        description,
        image: [image],
        inLanguage: normalizeLang(langCode),
        articleSection: data.category || undefined,
        articleBody: buildArticleBody(data) || undefined,
        datePublished,
        dateModified,
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
            name: 'Micro-guides',
            item: `${SITE_ORIGIN}/microguides/`
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

  return JSON.parse(JSON.stringify(graph));
}

function removeHeadTag(html, pattern) {
  return html.replace(pattern, '');
}

function applyStaticSeoToTemplate(template, data, langCode, slug, ts = 0) {
  const canonicalUrl = `${SITE_ORIGIN}/microguides/${encodeURIComponent(slug)}/`;
  const title = `${data.title || slug} | AJSEE`;
  const description = truncate(
    data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.',
    170
  );
  const image = toAbsoluteUrl(data.cover) || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const imageAlt = data.coverAlt || data.title || 'AJSEE micro-guide';
  const jsonLd = buildJsonLd(data, langCode, slug, ts);

  let html = template;

  html = html.replace(/<html\b([^>]*)>/i, `<html lang="${escapeAttr(normalizeLang(langCode))}">`);

  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  } else {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n  <title>${escapeHtml(title)}</title>`);
  }

  // Odebereme duplicitní SEO tagy, které budou nahrazeny statickou verzí.
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi);

  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:type["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:locale["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:site_name["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:title["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:description["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:image["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bproperty=["']og:image:alt["'])[^>]*>\s*/gi);

  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']twitter:card["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']twitter:title["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']twitter:description["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']twitter:image["'])[^>]*>\s*/gi);
  html = removeHeadTag(html, /<meta\b(?=[^>]*\bname=["']twitter:image:alt["'])[^>]*>\s*/gi);

  html = removeHeadTag(
    html,
    /<script\b(?=[^>]*\bid=["']ajsee-microguide-jsonld["'])(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi
  );

  const seoBlock = `
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="${normalizeLang(langCode) === 'cs' ? 'cs_CZ' : escapeAttr(normalizeLang(langCode))}" />
  <meta property="og:site_name" content="AJSEE" />
  <meta property="og:title" content="${escapeAttr(data.title || slug)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(data.title || slug)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}" />

  <script id="ajsee-microguide-jsonld" type="application/ld+json">${safeJsonLd(jsonLd)}</script>
`;

  html = html.replace(/<\/title>/i, `</title>${seoBlock}`);

  return html;
}

function buildStaticMain(data, langCode, slug) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const readingMinutes = Number(data.readingMinutes || 5);
  const blogHref = `/blog?lang=${encodeURIComponent(normalizeLang(langCode))}`;
  const comingSoonHref = `/coming-soon?lang=${encodeURIComponent(normalizeLang(langCode))}`;

  const progressItems = steps
    .map((step) => `
          <li><a href="#${escapeAttr(step.id || '')}">${escapeHtml(step.heading || '')}</a></li>`)
    .join('');

  const sectionItems = steps
    .map((step) => {
      const id = step.id || '';
      const heading = step.heading || '';

      return `
          <section id="${escapeAttr(id)}" class="mg-section" aria-labelledby="${escapeAttr(id)}-title">
            <h2 id="${escapeAttr(id)}-title">${escapeHtml(heading)}</h2>
            ${contentToHtml(step.body || '')}
            ${step.image ? `
            <figure class="mg-figure">
              <div class="mg-media-frame">
                <img src="${escapeAttr(step.image)}" alt="${escapeAttr(step.alt || '')}" loading="lazy" decoding="async">
              </div>
            </figure>` : ''}
          </section>`;
    })
    .join('');

  return `
  <main class="mg" id="mgRoot" data-mg-root>
    ${GENERATED_MARKER}
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${escapeAttr(blogHref)}" data-i18n="mg.backToBlog">Zpět na blog</a>
      <span aria-hidden="true">/</span>
      <span data-i18n="mg.breadcrumb">AJSEE vysvětluje</span>
    </nav>

    <article class="mg-article" itemscope itemtype="https://schema.org/Article">
      <header class="mg-hero">
        <div class="mg-hero-text">
          <p class="mg-kicker">AJSEE vysvětluje</p>
          <h1 class="mg-title" itemprop="headline">${escapeHtml(data.title || slug)}</h1>
          <p class="mg-meta"><span>${readingMinutes} min čtení</span></p>
          <div class="mg-actions"></div>
        </div>

        <figure class="mg-hero-media">
          ${data.cover ? `<img src="${escapeAttr(data.cover)}" alt="${escapeAttr(data.coverAlt || '')}" width="1280" height="720" loading="eager" decoding="async">` : ''}
        </figure>
      </header>

      ${steps.length ? `
      <aside class="mg-progress" aria-label="Postup průvodcem">
        <ol>${progressItems}
        </ol>
      </aside>` : ''}

      <div class="mg-content">
        ${sectionItems}

        <footer class="mg-footer-cta">
          ${data.ctaQuestion ? `<p>${escapeHtml(data.ctaQuestion)}</p>` : ''}
          <a class="ib-cta" href="${escapeAttr(comingSoonHref)}">Chci na čekací listinu</a>
        </footer>
      </div>

      <nav class="mg-mobile-nav" aria-label="Micro-guide navigation">
        <button class="mg-prev" type="button">Předchozí</button>
        <div class="mg-dots"></div>
        <button class="mg-next" type="button">Další</button>
      </nav>
    </article>

    <div id="mg-share" aria-hidden="true"></div>
  </main>`;
}

function replaceMain(html, staticMain) {
  const mainPattern = /<main\b(?=[^>]*\bid=["']mgRoot["'])[\s\S]*?<\/main>/i;

  if (mainPattern.test(html)) {
    return html.replace(mainPattern, staticMain);
  }

  return html.replace(/<body\b[^>]*>/i, (match) => `${match}\n${staticMain}`);
}

async function writeStaticMicroguidePages(records, localeFiles) {
  const templatePath = await findTemplatePath();

  if (!templatePath) {
    console.warn('Microguide HTML template not found. Static microguide detail pages were not generated.');
    return;
  }

  await cleanGeneratedStaticPages();

  const template = await fs.readFile(templatePath, 'utf8');
  let generatedCount = 0;

  for (const record of records) {
    const slug = normalizeSlug(record.slug);

    if (!slug || !isSafeSlug(slug)) {
      console.warn(`Static page skipped: unsafe microguide slug "${record.slug}"`);
      continue;
    }

    const guide = await readLocalizedGuide(localeFiles, slug, record.language || DEFAULT_LANG);

    if (!guide?.data) {
      console.warn(`Static page skipped: microguide data not found for slug "${slug}"`);
      continue;
    }

    const data = {
      ...guide.data,
      slug
    };

    const langCode = normalizeLang(guide.lang || record.language || DEFAULT_LANG);

    let html = template;

    html = applyStaticSeoToTemplate(html, data, langCode, slug, record._ts);
    html = replaceMain(html, buildStaticMain(data, langCode, slug));

    const targetDir = path.join(STATIC_PAGE_ROOT, slug);
    const targetFile = path.join(targetDir, 'index.html');

    await ensureDir(targetDir);
    await fs.writeFile(targetFile, html.trimEnd() + '\n', 'utf8');

    generatedCount += 1;
  }

  console.log(`Static microguide detail pages generated (${generatedCount} items).`);
}

async function run() {
  await ensureDir(OUT_DIR);

  // 1) Seznam všech .json ve zdroji + oddělení CMS indexu
  const allFiles = (await fs.readdir(SRC_DIR)).filter((f) => f.endsWith('.json'));
  const localeFiles = allFiles.filter((f) => f !== 'index.json');

  // 1a) Zkopíruj všechny lokalizované JSONy do public/
  if (localeFiles.length === 0) {
    console.warn('No micro-guide locale files found in content/microguides');
  }

  await Promise.all(
    localeFiles.map(async (f) => {
      await fs.copyFile(path.join(SRC_DIR, f), path.join(OUT_DIR, f)).catch(() => {});
    })
  );

  // 2) Načti CMS index (pokud existuje) – očekává { items: [...] }
  const cmsIndex = await readJsonSafe(path.join(SRC_DIR, 'index.json'), { items: [] });
  const items = Array.isArray(cmsIndex?.items) ? cmsIndex.items : [];

  const indexRecords = [];

  // 2a) Primárně stavíme z CMS indexu (jen published)
  for (const it of items) {
    try {
      const status = it.status || 'draft';

      if (status !== 'published') continue;

      const slug = normalizeSlug(it.slug);

      if (!slug) continue;

      const language = normalizeLang(it.language || DEFAULT_LANG);
      const category = it.category || 'theatre';

      const fields = await pickLocalizedFields(SRC_DIR, localeFiles, slug, language, {
        title: it.title || '',
        summary: it.summary || '',
        cover: it.cover || ''
      });

      const ts = await resolvePublishedTs(SRC_DIR, localeFiles, slug, language, it.publishedAt || null);

      indexRecords.push({
        slug,
        language,
        title: fields.title,
        summary: fields.summary,
        cover: fields.cover,
        category,
        status: 'published',
        publishedAt: it.publishedAt || null,
        _ts: ts
      });
    } catch (e) {
      console.warn('Index build warning (CMS item skipped):', e?.message || e);
    }
  }

  // 2b) Fallback – když CMS index chybí / nic nevrátil (postavíme z existujících souborů)
  if (indexRecords.length === 0 && localeFiles.length > 0) {
    const bySlug = new Map();

    for (const f of localeFiles) {
      const slug = getSlugFromFilename(f);
      const lang = getLangFromFilename(f) || DEFAULT_LANG;

      // preferovaný jazyk: cs -> en -> ostatní
      const prev = bySlug.get(slug);
      const preferRank = (l) => (l === 'cs' ? 2 : l === 'en' ? 1 : 0);

      if (!prev || preferRank(lang) > preferRank(prev.lang)) {
        bySlug.set(slug, { file: f, lang });
      }
    }

    for (const [slug, info] of bySlug.entries()) {
      try {
        const p = path.join(SRC_DIR, info.file);
        const data = await readJsonSafe(p, {});
        const tsJson = Date.parse(data.publishedAt || 0);
        const tsStat = await fileStatTs(p);
        const ts = (!Number.isNaN(tsJson) && tsJson > 0) ? tsJson : tsStat;

        indexRecords.push({
          slug,
          language: normalizeLang(info.lang || DEFAULT_LANG),
          title: data.title || '',
          summary: data.summary || '',
          cover: data.cover || '',
          category: data.category || 'theatre',
          status: 'published',
          publishedAt: data.publishedAt || null,
          _ts: ts
        });
      } catch (e) {
        console.warn('Index fallback warning (file skipped):', info?.file, e?.message || e);
      }
    }
  }

  // 3) Seřadit DESC podle _ts
  indexRecords.sort((a, b) => b._ts - a._ts);

  // 4) Vygenerovat statické detail stránky pro crawlery i přímé URL
  await writeStaticMicroguidePages(indexRecords, localeFiles);

  // 5) Zapsat public runtime index
  const finalIndex = indexRecords.map(({ _ts, ...rest }) => rest);

  await fs.writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(finalIndex, null, 2),
    'utf8'
  );

  console.log(`Micro-guides index generated (${finalIndex.length} items, sorted desc).`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
