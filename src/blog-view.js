import { blogCopy } from './blog-ui.js';

export function escapeBlogHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
// Keep one-letter Czech and Slovak prepositions with the following word.
export function blogTypography(value, lang) {
  return ['cs', 'sk'].includes(lang)
    ? String(value || '').replace(/(^|[\s(„“])([ksvzouaiKSVZOUAI])\s+(?=\S)/g, '$1$2\u00a0')
    : String(value || '');
}
export function blogText(value, lang) { return escapeBlogHtml(blogTypography(value, lang)); }
export const blogArrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const safeHref = (value = '') => /^\/(?!\/)/.test(value) ? escapeBlogHtml(value) : '/blog/';
const safeImage = (value = '') => /^(\/(?!\/)|https:\/\/)/.test(value) ? escapeBlogHtml(value) : '';

function dateMarkup(date, lang) {
  if (!date || !Number.isFinite(Date.parse(date))) return '';
  const label = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
  return `<time datetime="${escapeBlogHtml(date)}">${escapeBlogHtml(label)}</time>`;
}

export function renderBlogCard(card, lang, { featured = false } = {}) {
  const copy = blogCopy(lang), title = blogText(card.title, lang);
  const image = safeImage(card.image), href = safeHref(card.href);
  const badge = copy.badges[card.type] || copy.badges.article;
  const heading = featured ? 'h2' : 'h3';
  const metadata = [card.author ? blogText(card.author, lang) : '', dateMarkup(card.date, lang)].filter(Boolean);
  return `<article class="${featured ? 'blog-feature' : 'blog-card'}" data-type="${escapeBlogHtml(card.type)}" data-category="${escapeBlogHtml(card.category)}" data-slug="${escapeBlogHtml(card.slug)}">
    <a class="${featured ? 'blog-feature-link' : 'blog-card-link'}" href="${href}">
      <div class="blog-card-media">${image ? `<img src="${image}" alt="${escapeBlogHtml(card.coverAlt || card.title)}" width="960" height="640" loading="${featured ? 'eager' : 'lazy'}"${featured ? ' fetchpriority="high"' : ''} decoding="async">` : ''}</div>
      <div class="blog-card-body">
        <div class="blog-card-kicker"><span class="blog-card-badge">${escapeBlogHtml(badge)}</span>${copy.topics[card.category] ? `<span>${escapeBlogHtml(copy.topics[card.category])}</span>` : ''}</div>
        <${heading} class="blog-card-title">${title}</${heading}>
        <p class="blog-card-lead">${blogText(card.lead, lang)}</p>
        ${metadata.length ? `<p class="blog-card-meta">${metadata.join('<span aria-hidden="true">·</span>')}</p>` : ''}
        <span class="blog-card-read">${escapeBlogHtml(card.type === 'microguide' ? copy.readGuide : copy.readMore)}${blogArrow}</span>
      </div>
    </a>
  </article>`;
}

export function renderBlogResults(cards, lang) {
  const copy = blogCopy(lang);
  return {
    featured: cards.length ? renderBlogCard(cards[0], lang, { featured: true }) : '',
    grid: cards.length ? cards.slice(1).map((card) => renderBlogCard(card, lang)).join('\n') :
      `<div class="blog-empty"><h3>${escapeBlogHtml(copy.emptyTitle)}</h3><p>${escapeBlogHtml(copy.emptyText)}</p><button type="button" class="blog-reset" data-blog-reset>${escapeBlogHtml(copy.reset)}${blogArrow}</button></div>`,
  };
}
export function serializeBlogData(cards, lang) {
  return JSON.stringify({ lang, cards }).replace(/</g, '\\u003c');
}
