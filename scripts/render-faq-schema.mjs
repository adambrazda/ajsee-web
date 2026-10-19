import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { syncFaqSchema } from '../src/faq-schema.js';

export function renderFaqSchema(html) {
  const dom = new JSDOM(html), doc = dom.window.document;
  const schema = syncFaqSchema(doc);
  if (!schema.mainEntity.length || schema.mainEntity.length !== doc.querySelectorAll('[data-faq-item]').length) throw new Error('Incomplete FAQ content');
  const output = dom.serialize(); dom.window.close(); return output;
}
export async function renderFaqPages(root = process.cwd()) {
  for (const file of ['faq.html','faq/index.html',...['en','de','sk','pl','hu'].map((lang) => lang + '/faq/index.html')]) {
    const target = path.join(root, 'dist', file);
    await fs.writeFile(target, renderFaqSchema(await fs.readFile(target, 'utf8')));
  }
  console.log('[faq] Matching FAQPage schema generated in all six languages');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await renderFaqPages();
