import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { BLOG_LANGS, filterBlogCards, loadBlogCards, reviewCards } from '../src/blog-content.js';
import { BLOG_UI, articleCount } from '../src/blog-ui.js';
import { blogText, renderBlogResults, serializeBlogData } from '../src/blog-view.js';
import { renderStaticBlogPage } from '../scripts/render-blog-listing.mjs';

const fixture = (slug, overrides = {}) => ({
  slug, status: 'published', published: true, contentType: 'review', category: 'theatre',
  publishedAt: '2026-10-19', author: 'Oya Canli', cover: '/images/cover.webp',
  translations: { cs: { title: `Název ${slug}`, excerpt: 'Příběh z divadla.' }, en: { title: `Title ${slug}` } },
  ...overrides,
});

test('small labels and badges meet normal-text contrast in both themes', async () => {
  const css = await fs.readFile(new URL('../src/styles/partials/_blog-premium.scss', import.meta.url), 'utf8');
  const luminance = (hex) => {
    const channels = hex.match(/[\da-f]{2}/gi).map((x) => parseInt(x, 16) / 255)
      .map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  for (const theme of ['light', 'dark']) {
    const block = css.match(new RegExp(`@mixin blog-${theme} \\{([\\s\\S]*?)\\}`))[1];
    const color = (token) => luminance(block.match(new RegExp(`--blog-${token}: #([a-f\\d]{6})`))[1]);
    for (const [fg, bg] of [['muted', 'bg'], ['muted', 'soft'], ['badge-text', 'accent-soft'], ['text', 'soft']]) {
      const a = color(fg), b = color(bg);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${theme}: ${fg} on ${bg}`);
    }
  }
});

test('publication gate never confuses a future-event preview with an unpublished draft', () => {
  const cards = reviewCards({ items: [
    fixture('live'), fixture('future', { contentType: 'preview' }),
    fixture('draft', { status: 'draft', published: false }),
    fixture('approved', { status: 'approved', published: false }),
    fixture('inconsistent', { status: 'draft', published: true }),
    fixture('private-only', { status: 'approved', published: false, previewOnly: true }),
  ] }, 'en');
  assert.deepEqual(cards.map((card) => card.slug), ['live', 'future', 'private-only']);
  assert.equal(cards.find((card) => card.slug === 'future').type, 'preview');
  assert.equal(cards[1].href, '/en/reviews/future/');
  assert.equal(cards[0].title, 'Title live');
});

test('topic filters include reviews and guides, not only legacy articles', () => {
  const cards = [
    { type: 'review', category: 'theatre' }, { type: 'preview', category: 'theatre' },
    { type: 'microguide', category: 'theatre' }, { type: 'microguide', category: 'sport' },
    { type: 'article', category: 'concert' }, { type: 'article', category: 'tip' },
  ];
  assert.equal(filterBlogCards(cards, 'all', 'theatre').length, 3);
  assert.equal(filterBlogCards(cards, 'review', 'theatre').length, 1);
  assert.equal(filterBlogCards(cards, 'review', 'sport').length, 0);
  assert.equal(filterBlogCards(cards, 'microguide').length, 3);
  assert.equal(filterBlogCards(cards, 'preview')[0].type, 'preview');
  assert.equal(filterBlogCards(cards).length, cards.length);
});

test('all languages have complete interface copy and correct count grammar', () => {
  const keys = Object.keys(BLOG_UI.cs);
  for (const lang of BLOG_LANGS) {
    assert.deepEqual(Object.keys(BLOG_UI[lang]), keys, lang);
    for (const key of keys) assert.ok(BLOG_UI[lang][key], `${lang}: ${key}`);
    for (const count of [0, 1, 2, 5, 12, 23]) assert.ok(articleCount(count, lang).startsWith(String(count)));
  }
  assert.equal(articleCount(1, 'cs'), '1 článek');
  assert.equal(articleCount(3, 'cs'), '3 články');
  assert.equal(articleCount(23, 'cs'), '23 článků');
  assert.equal(articleCount(1, 'en'), '1 article');
  assert.equal(articleCount(2, 'en'), '2 articles');
  assert.equal(articleCount(22, 'pl'), '22 artykuły');
});

test('single-letter prepositions stay with the next word without injecting HTML', () => {
  assert.equal(blogText('Muzikály v Londýně a tipy k výletu', 'cs'), 'Muzikály v\u00a0Londýně a\u00a0tipy k\u00a0výletu');
  assert.equal(blogText('<script>alert(1)</script>', 'cs'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('featured article is rendered once; entire cards are accessible native links', () => {
  const cards = reviewCards([fixture('one'), fixture('two', { contentType: 'preview' })], 'de');
  const view = renderBlogResults(cards, 'de');
  const dom = new JSDOM(view.featured + view.grid), doc = dom.window.document;
  assert.equal(doc.querySelectorAll('article').length, 2);
  assert.equal(doc.querySelectorAll('[data-slug="one"]').length, 1);
  assert.equal(doc.querySelectorAll('article > a[href]').length, 2);
  assert.equal(doc.querySelectorAll('a a').length, 0);
  assert.equal(doc.querySelector('.blog-feature img').loading || doc.querySelector('.blog-feature img').getAttribute('loading'), 'eager');
  assert.equal(doc.querySelector('.blog-card img').getAttribute('loading'), 'lazy');
  assert.equal(doc.querySelector('[data-type="preview"] .blog-card-badge').textContent, 'Vorschau');
  assert.equal(doc.querySelector('[data-type="preview"] a').getAttribute('href'), '/de/reviews/two/');
  dom.window.close();
});

test('untrusted strings cannot break out of links, HTML or embedded JSON', () => {
  const card = { type: 'review', category: 'theatre', slug: 'unsafe', title: '</script><script>alert(1)</script>', lead: '<b>text</b>',
    href: 'javascript:alert(1)', image: 'javascript:alert(2)', date: 'not a date' };
  const view = renderBlogResults([card], 'en');
  const dom = new JSDOM(view.featured), doc = dom.window.document;
  assert.equal(doc.querySelectorAll('script,img').length, 0);
  assert.equal(doc.querySelector('a').getAttribute('href'), '/blog/');
  const serialized = serializeBlogData([card], 'en');
  assert.ok(!serialized.includes('</script>'));
  assert.equal(JSON.parse(serialized).cards[0].title, card.title);
  dom.window.close();
});

test('build loader keeps all sources, sorts newest first, deduplicates guides and falls back by language', async () => {
  const sources = {
    '/content/reviews/index.json': { items: [fixture('new-review')] },
    '/content/microguides/index.json': { items: [
      { slug: 'guide', status: 'published', publishedAt: '2026-09-01', category: 'sport', title: 'Index title' },
      { slug: 'guide', status: 'published' }, { slug: 'hidden', status: 'draft' },
    ] },
    '/content/microguides/guide.en.json': { title: 'English guide', summary: 'Guide text', cover: '/cover.webp' },
  };
  const cards = await loadBlogCards('de', async (url) => {
    if (!(url in sources)) throw new Error('Not found');
    return sources[url];
  }, { strict: true });
  assert.equal(cards[0].slug, 'new-review');
  assert.equal(cards.filter((card) => card.type === 'microguide').length, 1);
  assert.equal(cards.find((card) => card.type === 'microguide').title, 'English guide');
  assert.equal(cards.find((card) => card.type === 'microguide').href, '/de/microguides/guide/');
  assert.ok(cards.some((card) => card.type === 'article'));
  await assert.rejects(loadBlogCards('cs', async () => { throw new Error('Missing source'); }, { strict: true }), /Missing source/);
});

test('initial static HTML includes current localized content, not stale placeholder cards', async () => {
  const html = await fs.readFile(new URL('../blog.html', import.meta.url), 'utf8');
  for (const lang of BLOG_LANGS) {
    const cards = reviewCards([fixture('latest'), fixture('second')], lang);
    const dom = new JSDOM(renderStaticBlogPage(html, cards, lang)), doc = dom.window.document;
    assert.equal(doc.querySelector('h1').textContent.replace(/\u00a0/g, ' '), BLOG_UI[lang].headline);
    assert.equal(doc.querySelectorAll('article').length, 2);
    assert.equal(doc.querySelector('.blog-feature .blog-card-title').textContent.replace(/\u00a0/g, ' '), cards[0].title);
    assert.equal(doc.querySelector('[data-blog-topic] option').textContent, BLOG_UI[lang].allTopics);
    assert.equal(JSON.parse(doc.getElementById('blog-initial-data').textContent).lang, lang);
    assert.equal(doc.querySelector('.footer-contact a').getAttribute('href'), 'mailto:info@ajsee.cz');
    assert.ok(doc.querySelector('.footer-copy').textContent.includes('2026'));
    dom.window.close();
  }
});

test('runtime reuses embedded cards and keeps empty states and reset filters functional', async () => {
  const html = await fs.readFile(new URL('../blog.html', import.meta.url), 'utf8');
  const cards = reviewCards([fixture('runtime-one'), fixture('runtime-two', { contentType: 'preview' })], 'cs');
  const dom = new JSDOM(renderStaticBlogPage(html, cards, 'cs'), { url: 'https://ajsee.cz/blog/', pretendToBeVisual: true });
  const saved = {};
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    fetch: async () => { throw new Error('Initial rendering must not fetch content'); } })) {
    saved[key] = globalThis[key]; globalThis[key] = value;
  }
  const rendered = () => new Promise((resolve) => dom.window.addEventListener('ajsee:blog-rendered', resolve, { once: true }));
  try {
    const initial = rendered();
    await import(`../src/blog.js?test=${Date.now()}`);
    await initial;
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('article').length, 2);
    let next = rendered(); doc.querySelector('[data-blog-type="preview"]').click(); await next;
    assert.equal(doc.querySelectorAll('article').length, 1);
    assert.equal(doc.querySelector('article').dataset.type, 'preview');
    assert.equal(doc.querySelector('[data-blog-list-section]').hidden, true);
    assert.equal(doc.querySelector('[data-blog-type="preview"]').getAttribute('aria-pressed'), 'true');
    next = rendered(); const select = doc.querySelector('[data-blog-topic]'); select.value = 'sport';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await next;
    assert.equal(doc.querySelector('[data-blog-feature-section]').hidden, true);
    assert.ok(doc.querySelector('[data-blog-reset]'));
    next = rendered(); doc.querySelector('[data-blog-reset]').click(); await next;
    assert.equal(doc.querySelectorAll('article').length, 2);
    assert.equal(select.value, 'all');
  } finally {
    dom.window.close();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
