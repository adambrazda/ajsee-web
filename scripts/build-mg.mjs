import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'content/microguides');
const OUT = path.join(ROOT, 'public/content/microguides');

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function run() {
  await ensureDir(OUT);

  const files = (await fs.readdir(SRC)).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.warn('No micro-guide files found in content/microguides');
    await fs.writeFile(path.join(OUT, 'index.json'), '[]');
    return;
  }

  // zkopíruj všechny JSON do public (aby je mohl načítat runtime)
  await Promise.all(
    files.map(async (f) => {
      await fs.copyFile(path.join(SRC, f), path.join(OUT, f));
    })
  );

  // poskládej index ze cs mutace (fallback na první existující)
  const slugs = [...new Set(files.map(f => f.split('.').shift()))];

  const index = [];
  for (const slug of slugs) {
    const csName = `${slug}.cs.json`;
    let fileName = files.includes(csName) ? csName : null;
    if (!fileName) {
      const any = files.find(x => x.startsWith(slug + '.'));
      if (!any) {
        console.warn(`No locale files for slug "${slug}", skipping in index.`);
        continue;
      }
      fileName = any;
    }
    const raw = await fs.readFile(path.join(SRC, fileName), 'utf8');
    const data = JSON.parse(raw);

    index.push({
      slug: data.slug,
      title: data.title,
      summary: data.summary || '',
      cover: data.cover || '',
      status: data.status || 'draft'
    });
  }

  await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`Micro-guides index generated (${index.length} items).`);
}

run().catch(e => { console.error(e); process.exit(1); });
