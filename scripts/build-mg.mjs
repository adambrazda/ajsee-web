import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'content/microguides');       // lokalizované JSONy + index.json (CMS)
const OUT_DIR = path.join(ROOT, 'public/content/microguides'); // public výstup (runtime načítá odsud)

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function readJsonSafe(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}

async function run() {
  await ensureDir(OUT_DIR);

  // 1) všechny lokalizované JSONy (zkopírujeme do public)
  const allFiles = (await fs.readdir(SRC_DIR)).filter(f => f.endsWith('.json'));
  const localeFiles = allFiles.filter(f => f !== 'index.json');

  if (localeFiles.length === 0) {
    console.warn('No micro-guide locale files found in content/microguides');
  }

  await Promise.all(
    localeFiles.map(async (f) => {
      await fs.copyFile(path.join(SRC_DIR, f), path.join(OUT_DIR, f));
    })
  );

  // 2) načti CMS index (seznam karet) a postav public index seřazený DESC dle publishedAt
  const cmsIndex = await readJsonSafe(path.join(SRC_DIR, 'index.json'), { items: [] });
  const items = Array.isArray(cmsIndex?.items) ? cmsIndex.items : [];

  // helper: vyber titulek/perex/cover z preferované lokalizace (language), případně fallback
  async function pickLocalizedFields(slug, primaryLang) {
    const prefer = [
      `${slug}.${primaryLang}.json`,
      `${slug}.en.json`,
      `${slug}.cs.json`
    ];
    let file = prefer.find((f) => localeFiles.includes(f));
    if (!file) file = localeFiles.find(f => f.startsWith(`${slug}.`));
    if (!file) return { title: '', summary: '', cover: '' };

    const data = await readJsonSafe(path.join(SRC_DIR, file), {});
    return {
      title: data.title || '',
      summary: data.summary || '',
      cover: data.cover || ''
    };
  }

  const indexRecords = [];
  for (const it of items) {
    const status = it.status || 'draft';
    if (status !== 'published') continue;

    const slug = String(it.slug || '').trim();
    const language = String(it.language || 'cs').toLowerCase();
    if (!slug) continue;

    const { title, summary, cover } = await pickLocalizedFields(slug, language);

    const ts = Date.parse(it.publishedAt || 0) || 0; // 0 = spadne na konec
    indexRecords.push({
      slug,
      language,
      title,
      summary,
      cover,
      category: it.category || 'theatre',
      status,
      publishedAt: it.publishedAt || null,
      _ts: ts
    });
  }

  indexRecords.sort((a, b) => b._ts - a._ts);
  const finalIndex = indexRecords.map(({ _ts, ...rest }) => rest);

  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(finalIndex, null, 2));
  console.log(`Micro-guides index generated (${finalIndex.length} items, sorted desc).`);
}

run().catch(e => { console.error(e); process.exit(1); });
