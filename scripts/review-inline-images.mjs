import { localizeCoverCredit } from './review-cover-credit.mjs';

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Optional editorial photos inserted before numbered H2 headings, without
// changing approved markdown, or affecting reviews with no inline images.
export function insertReviewInlineImages(html, images, localizedAlts, lang) {
  if (!Array.isArray(images) || !images.length) return html;
  const groups = new Map();
  images.forEach((item, index) => {
    if (!Number.isInteger(item?.beforeHeading) || item.beforeHeading < 1 ||
        !/^\/uploads\/reviews\/[a-z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(item.image || '') ||
        !Number.isInteger(item.width) || item.width <= 0 ||
        !Number.isInteger(item.height) || item.height <= 0) return;
    const alt = String(localizedAlts?.[index] || item.alt || '').trim();
    if (!alt) return;
    const credit = localizeCoverCredit(item.credit, lang);
    const figure = '<figure class="review-inline-photo"><img src="' + escape(item.image) +
      '" alt="' + escape(alt) + '" width="' + item.width + '" height="' + item.height +
      '" loading="lazy" decoding="async">' +
      (credit ? '<figcaption class="review-cover-credit">' + escape(credit) + '</figcaption>' : '') +
      '</figure>';
    const group = groups.get(item.beforeHeading) || [];
    group.push(figure);
    groups.set(item.beforeHeading, group);
  });
  let heading = 0;
  return html.replace(/<h2>/g, match => (groups.get(++heading) || []).join('\n') + match);
}
