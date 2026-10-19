import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { BLOG_LANGS, loadBlogCards } from '../src/blog-content.js';
import { blogCopy, articleCount } from '../src/blog-ui.js';
import { renderBlogResults, serializeBlogData, blogTypography } from '../src/blog-view.js';

export function renderStaticBlogPage(html, cards, lang) {
  const dom = new JSDOM(html), doc = dom.window.document, copy = blogCopy(lang);
  const results = renderBlogResults(cards, lang);
  doc.querySelectorAll('[data-blog-copy]').forEach((node) => {
    const value = copy[node.dataset.blogCopy];
    if (typeof value === 'string') node.textContent = blogTypography(value, lang);
  });
  doc.querySelectorAll('[data-blog-type]').forEach((button) => {
    button.textContent = blogTypography(copy.filters[button.dataset.blogType], lang);
  });
  doc.querySelectorAll('[data-blog-topic] option').forEach((option) => {
    option.textContent = option.value === 'all' ? copy.allTopics : copy.topics[option.value];
  });
  doc.querySelector('[data-blog-filters]').setAttribute('aria-label', copy.filtersLabel);
  doc.querySelector('[data-blog-feature]').innerHTML = results.featured;
  doc.querySelector('[data-blog-feature-section]').hidden = !cards.length;
  doc.querySelector('[data-blog-feature-label]').textContent = copy.latest;
  doc.querySelector('[data-blog-grid]').innerHTML = results.grid;
  doc.querySelector('[data-blog-list-section]').hidden = cards.length === 1;
  doc.querySelector('[data-blog-count]').textContent = articleCount(cards.length, lang);
  doc.getElementById('blog-initial-data')?.remove();
  const data = doc.createElement('script');
  data.type = 'application/json'; data.id = 'blog-initial-data';
  data.textContent = serializeBlogData(cards, lang);
  doc.body.appendChild(data);
  // Filtering needs JS, but every article link remains usable without it.
  doc.querySelector('[data-blog-nojs]')?.remove();
  const fallback = doc.createElement('noscript');
  fallback.setAttribute('data-blog-nojs', '');
  fallback.innerHTML = '<style>.blog-toolbar,.blog-reset{display:none}</style>';
  doc.querySelector('.blog-reading').prepend(fallback);
  const output = dom.serialize();
  dom.window.close();
  return output;
}

export async function renderBlogListings(root = process.cwd()) {
  const readJson = async (url) => JSON.parse(await fs.readFile(path.join(root, 'public', url), 'utf8'));
  for (const lang of BLOG_LANGS) {
    const cards = await loadBlogCards(lang, readJson, { strict: true });
    const files = lang === 'cs' ? ['blog.html', 'blog/index.html'] : [`${lang}/blog/index.html`];
    for (const file of files) {
      const target = path.join(root, 'dist', file);
      const html = await fs.readFile(target, 'utf8');
      await fs.writeFile(target, renderStaticBlogPage(html, cards, lang));
    }
    console.log(`[blog] ${lang}: ${cards.length} articles rendered in initial HTML`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await renderBlogListings();
