// Server-rendered reciprocal editorial links. Never link to an unpublished target on the public site.
const LANGS = new Set(['cs', 'en', 'sk', 'de', 'pl', 'hu']);
const HEADING = {
  cs: 'Související čtení',
  en: 'Related reading',
  sk: 'Súvisiace čítanie',
  de: 'Weiterlesen',
  pl: 'Powiązane artykuły',
  hu: 'Kapcsolódó cikkek'
};

function safeLang(value) {
  const lang = String(value || '').toLowerCase().split(/[-_]/)[0];
  return LANGS.has(lang) ? lang : 'cs';
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isPublished(item) {
  return item?.published === true && item?.status === 'published';
}

export function buildRelatedReadingHtml(source, lang, reviewBySlug, {
  previewMode = false, deployPreview = false
} = {}) {
  const language = safeLang(lang);
  const sourceSlugs = Array.isArray(source?.relatedSlugs) ? source.relatedSlugs : [];
  const seen = new Set();
  const items = [];

  for (const candidate of sourceSlugs) {
    const slug = String(candidate || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === source?.slug || seen.has(slug)) continue;
    seen.add(slug);
    const target = reviewBySlug?.get(slug);
    if (!target || (!previewMode && !isPublished(target))) continue;
    const available = target.translations || {};
    const targetLang = available[language]?.title
      ? language
      : available.cs?.title ? 'cs' : available.en?.title ? 'en' : '';
    if (!targetLang) continue;

    // Netlify deploy previews render only Czech draft routes, even for other locales.
    const hrefLang = deployPreview && !isPublished(target) ? 'cs' : targetLang;
    const path = (hrefLang === 'cs' ? '' : '/' + hrefLang) + '/reviews/' + slug + '/';
    items.push('<li><a href="' + escapeHtml(path) + '">' +
      escapeHtml(available[targetLang].title) + '</a></li>');
  }

  if (!items.length) return '';
  return '<aside class="review-related-reading" aria-labelledby="review-related-reading-title">' +
    '<h2 id="review-related-reading-title">' + escapeHtml(HEADING[language]) + '</h2>' +
    '<ul>' + items.join('') + '</ul></aside>';
}
