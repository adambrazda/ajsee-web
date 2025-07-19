// /src/blog.js
import { blogArticles } from './blogArticles.js';

// Zjisti jazyk z URL (?lang=cs apod.)
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  return urlLang && ['cs','en','de','sk','pl','hu'].includes(urlLang) ? urlLang : 'cs';
}

// Vykresli seznam článků do .blog-cards
function renderBlogArticles(category = 'all') {
  const container = document.querySelector('.blog-cards');
  if (!container) return;
  const lang = detectLang();

  // Filtruj podle kategorie, pokud není 'all'
  let filtered = blogArticles;
  if (category !== 'all') {
    filtered = blogArticles.filter(a => a.category === category);
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="no-articles" data-i18n-key="blog-empty">Žádné články pro tuto kategorii.</div>`;
    return;
  }

  container.innerHTML = filtered.map(article => `
    <div class="blog-card">
      <img src="${article.image}" alt="${article.title[lang] || article.title['cs']}" class="blog-card-img" />
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

// Eventy pro filtry
function setupCategoryFilters() {
  document.querySelectorAll('.filter-categories button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-categories button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const cat = this.getAttribute('data-category');
      renderBlogArticles(cat);
    });
  });
}

// Načti při startu
document.addEventListener('DOMContentLoaded', () => {
  renderBlogArticles();      // Defaultně vše
  setupCategoryFilters();    // Filtry
});
