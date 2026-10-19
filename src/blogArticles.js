// Legacy demo articles were removed after the editorial audit (19 October 2026).
// Keep the public API for future reviewed, complete editorial articles.
export const blogArticles = [];

/** Normalizace a řazení článků podle data (DESC) */
export function getSortedBlogArticles(lang = 'cs') {
  const pick = (map) => (map?.[lang] || map?.cs || Object.values(map || {})[0] || '');
  return blogArticles
    .map(a => ({
      ...a,
      _ts: Date.parse(a.date || 0) || 0,
      titleText: pick(a.title),
      leadText: pick(a.lead)
    }))
    .sort((a, b) => b._ts - a._ts);
}
