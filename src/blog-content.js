import { getSortedBlogArticles } from './blogArticles.js';

export const BLOG_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
export function normalizeBlogLang(value) {
  const lang = String(value || '').toLowerCase().split(/[-_]/)[0].replace(/^cz$/, 'cs');
  return BLOG_LANGS.includes(lang) ? lang : 'cs';
}
export function localizedBlogPath(path, lang) {
  return (normalizeBlogLang(lang) === 'cs' ? '' : `/${normalizeBlogLang(lang)}`) + path;
}
const itemsOf = (data) => Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
const timestamp = (date) => Date.parse(date || '') || 0;

export function reviewCards(payload, lang) {
  const previewBadge = {
    cs: 'Preview', en: 'Preview', de: 'Vorschau', sk: 'Preview', pl: 'Zapowiedź', hu: 'Előzetes',
  };
  return itemsOf(payload).filter((item) => item?.slug).filter((item) => {
    const isPublished =
      String(item.status || '').toLowerCase() === 'published' && item.published === true;
    // previewOnly is emitted solely by the existing private preview build.
    return isPublished || item.previewOnly === true;
  }).map((item) => {
    const resolved = [...new Set([lang, 'en', 'cs'])].find((code) => item.translations?.[code]?.title) || lang;
    const data = item.translations?.[resolved] || {};
    const contentType = item.contentType === 'preview' || item.type === 'preview' ? 'preview' : 'review';
    const date = item.publishedAt || item.reviewDate || item.sortDate || '';
    return {
      type: contentType, slug: item.slug, category: item.category || 'theatre',
      title: data.title || item.showTitle || item.slug,
      lead: data.excerpt || data.subtitle || item.productionTitle || '',
      image: item.cover || '/images/fallbacks/concert0.jpg',
      coverAlt: data.coverAlt || item.coverAlt || data.title || item.showTitle || '',
      author: item.author || '', date, ts: timestamp(date),
      href: localizedBlogPath(`/reviews/${encodeURIComponent(item.slug)}/`, lang),
      badge: contentType === 'preview' ? previewBadge[lang] : '',
    };
  });
}

export function microguideCard(item, data, lang) {
  const merged = { ...item, ...data }, date = merged.publishedAt || merged.date || '';
  return {
    type: 'microguide', slug: item.slug, category: merged.category || '',
    title: merged.title || item.slug, lead: merged.summary || merged.lead || '',
    image: merged.cover || merged.image || '/images/fallbacks/concert0.jpg',
    coverAlt: merged.coverAlt || merged.alt || merged.title || '',
    author: merged.author || '', date, ts: timestamp(date),
    href: localizedBlogPath(`/microguides/${encodeURIComponent(item.slug)}/`, lang),
  };
}

// Works with HTTP in the browser and local JSON during the build.
export async function loadBlogCards(lang, readJson, { strict = false } = {}) {
  lang = normalizeBlogLang(lang);
  const optional = async (path) => { try { return await readJson(path); } catch { return null; } };
  const [reviewIndex, guideIndex] = await Promise.all([
    strict ? readJson('/content/reviews/index.json') : optional('/content/reviews/index.json'),
    strict ? readJson('/content/microguides/index.json') : optional('/content/microguides/index.json'),
  ]);
  const seen = new Set();
  const guideItems = itemsOf(guideIndex).filter((item) => {
    const slug = String(item?.slug || '').trim();
    if (!slug || seen.has(slug) || (item.status && item.status !== 'published')) return false;
    seen.add(slug); return true;
  });
  const guides = await Promise.all(guideItems.map(async (item) => {
    let data;
    for (const code of new Set([lang, 'en', 'cs'])) {
      data = await optional(`/content/microguides/${encodeURIComponent(item.slug)}.${code}.json`);
      if (data) break;
    }
    return microguideCard(item, data || {}, lang);
  }));
  const articles = getSortedBlogArticles(lang).map((item) => ({
    type: 'article', slug: item.slug, category: item.category || '',
    title: item.titleText, lead: item.leadText, image: item.image, coverAlt: item.titleText,
    author: item.author || '', date: item.date || '', ts: item._ts,
    href: localizedBlogPath(`/blog/${encodeURIComponent(item.slug)}/`, lang),
  }));
  return [...reviewCards(reviewIndex, lang), ...guides, ...articles].sort((a, b) => b.ts - a.ts);
}

export function filterBlogCards(cards, type = 'all', topic = 'all') {
  return cards.filter((card) => {
    const typeMatch = type === 'all' || card.type === type ||
      (type === 'microguide' && card.type === 'article' && card.category === 'tip');
    return typeMatch && (topic === 'all' || card.category === topic);
  });
}
