import { promises as fs } from 'fs';
import path from 'path';

const ROOT    = process.cwd();
const SRC_DIR = path.join(ROOT, 'content/microguides');        // vstup (CMS i lok. soubory)
const OUT_DIR = path.join(ROOT, 'public/content/microguides'); // výstup pro runtime

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function readJsonSafe(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}

function getSlugFromFilename(file) {
  // např. "fees-refund.cs.json" -> "fees-refund"
  return String(file).replace(/\.([a-z]{2})\.json$/i, '').replace(/\.json$/i, '');
}
function getLangFromFilename(file) {
  // např. "fees-refund.cs.json" -> "cs"
  const m = String(file).match(/\.([a-z]{2})\.json$/i);
  return m ? m[1].toLowerCase() : null;
}

async function fileStatTs(filePath) {
  try {
    const st = await fs.stat(filePath);
    return st.mtimeMs || st.mtime?.getTime() || 0;
  } catch { return 0; }
}

/**
 * Vybere nejlepší lokalizovaný soubor pro daný slug
 * Preferenční pořadí: primaryLang -> en -> cs -> cokoliv existujícího
 */
function pickBestLocaleFile(localeFiles, slug, primaryLang = 'cs') {
  const prefer = [
    `${slug}.${primaryLang}.json`,
    `${slug}.en.json`,
    `${slug}.cs.json`
  ];
  let file = prefer.find((f) => localeFiles.includes(f));
  if (!file) file = localeFiles.find(f => f.startsWith(`${slug}.`));
  return file || null;
}

/**
 * Načte title/summary/cover z nejlepšího existujícího lokalizačního souboru
 */
async function pickLocalizedFields(SRC_DIR, localeFiles, slug, primaryLang, cmsFallback = {}) {
  const best = pickBestLocaleFile(localeFiles, slug, primaryLang);
  if (!best) {
    return {
      title: cmsFallback.title || '',
      summary: cmsFallback.summary || '',
      cover: cmsFallback.cover || ''
    };
  }
  const data = await readJsonSafe(path.join(SRC_DIR, best), {});
  return {
    title: data.title || cmsFallback.title || '',
    summary: data.summary || cmsFallback.summary || '',
    cover: data.cover || cmsFallback.cover || ''
  };
}

/**
 * Určí timestamp „publikace“
 * 1) CMS -> publishedAt
 * 2) lokalizovaný JSON -> publishedAt
 * 3) mtime vybraného souboru
 */
async function resolvePublishedTs(SRC_DIR, localeFiles, slug, primaryLang, cmsPublishedAt = null) {
  if (cmsPublishedAt) {
    const ts = Date.parse(cmsPublishedAt);
    if (!Number.isNaN(ts)) return ts;
  }
  const best = pickBestLocaleFile(localeFiles, slug, primaryLang) ||
               pickBestLocaleFile(localeFiles, slug, 'en') ||
               pickBestLocaleFile(localeFiles, slug, 'cs');
  if (best) {
    const p = path.join(SRC_DIR, best);
    const j = await readJsonSafe(p, {});
    const tsFromJson = Date.parse(j.publishedAt || 0);
    if (!Number.isNaN(tsFromJson) && tsFromJson > 0) return tsFromJson;
    return await fileStatTs(p);
  }
  return 0;
}

async function run() {
  await ensureDir(OUT_DIR);

  // 1) Seznam všech .json ve zdroji + oddělení CMS indexu
  const allFiles = (await fs.readdir(SRC_DIR)).filter(f => f.endsWith('.json'));
  const localeFiles = allFiles.filter(f => f !== 'index.json');

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

      const slug = String(it.slug || '').trim();
      if (!slug) continue;

      const language = String(it.language || 'cs').toLowerCase();
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
    const bySlug = new Map(); // slug -> pref file
    for (const f of localeFiles) {
      const slug = getSlugFromFilename(f);
      const lang = getLangFromFilename(f) || 'cs';
      // vyber preferovaný jazyk: cs -> en -> ostatní
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
          language: info.lang || 'cs',
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

  // 3) Seřadit DESC podle _ts a zapsat public index
  indexRecords.sort((a, b) => b._ts - a._ts);
  const finalIndex = indexRecords.map(({ _ts, ...rest }) => rest);

  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(finalIndex, null, 2));
  console.log(`Micro-guides index generated (${finalIndex.length} items, sorted desc).`);
}

run().catch(e => { console.error(e); process.exit(1); });
