import { blogArticles } from './blogArticles.js';

function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  return urlLang && ['cs','en','de','sk','pl','hu'].includes(urlLang) ? urlLang : 'cs';
}

function renderHomepageBlog() {
  const container = document.querySelector('.homepage-blog-cards');
  if (!container) return;
  const lang = detectLang();

  // Zobrazíme nejnovější 3 články
  const articles = blogArticles
    .slice() // kopie pole
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  container.innerHTML = articles.map(article => `
    <div class="blog-card blog-card-homepage">
      <img src="${article.image}" alt="${article.title[lang] || article.title['cs']}" class="blog-card-img">
      <div class="blog-card-body">
        <h3 class="blog-card-title">${article.title[lang] || article.title['cs']}</h3>
        <div class="blog-card-lead">${article.lead[lang] || article.lead['cs']}</div>
        <div class="blog-card-actions">
          <a href="blog-detail.html?slug=${article.slug}&lang=${lang}" class="blog-readmore" data-i18n-key="blog-read-more">Číst dál &rarr;</a>
        </div>
      </div>
    </div>
  `).join('');
}

// Spusť při načtení DOMU, ale jen na homepage
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.homepage-blog-cards')) {
    renderHomepageBlog();
  }
});
