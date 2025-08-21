// /src/blog.js
import { blogArticles } from './blogArticles.js';

// --- jazyk ---
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  return (urlLang || document.documentElement.getAttribute('lang') || 'cs').toLowerCase();
}
const LANG = detectLang();

// --- překlady ---
const i18n = {
  readMore: {
    cs: 'Číst dál',
    en: 'Read more',
    de: 'Weiterlesen',
    sk: 'Čítať ďalej',
    pl: 'Czytaj dalej',
    hu: 'Tovább'
  },
  filters: {
    all:        { cs: 'Vše',       en: 'All',       de: 'Alle',          sk: 'Všetko',       pl: 'Wszystko',   hu: 'Mind' },
    concert:    { cs: 'Koncerty',  en: 'Concerts',  de: 'Konzerte',      sk: 'Koncerty',     pl: 'Koncerty',   hu: 'Koncertek' },
    theatre:    { cs: 'Divadlo',   en: 'Theatre',   de: 'Theater',       sk: 'Divadlo',      pl: 'Teatr',      hu: 'Színház' },
    festival:   { cs: 'Festivaly', en: 'Festivals', de: 'Festivals',     sk: 'Festivaly',    pl: 'Festiwale',  hu: 'Fesztiválok' },
    sport:      { cs: 'Sport',     en: 'Sport',     de: 'Sport',         sk: 'Šport',        pl: 'Sport',      hu: 'Sport' },
    tip:        { cs: 'Tipy',      en: 'Tips',      de: 'Tipps',         sk: 'Tipy',         pl: 'Wskazówki',  hu: 'Tippek' },
    review:     { cs: 'Recenze',   en: 'Reviews',   de: 'Rezensionen',   sk: 'Recenzie',     pl: 'Recenzje',   hu: 'Vélemények' },
    microguide: { cs: 'Průvodce',  en: 'Guides',    de: 'Leitfäden',     sk: 'Sprievodcovia', pl: 'Poradniki', hu: 'Útmutatók' }
  }
};

const tReadMore = () => i18n.readMore[LANG] || i18n.readMore.cs;
const tFilter  = (key) => (i18n.filters[key] && (i18n.filters[key][LANG] || i18n.filters[key].cs)) || '';

const gridEl = () => document.querySelector('.blog-cards');
const microguideCards = () => Array.from((gridEl() || document).querySelectorAll('.blog-card[data-type="microguide"]'));

function setReadMoreTexts() {
  document.querySelectorAll('.blog-readmore').forEach(el => { el.textContent = tReadMore(); });
}

function ensureMicroguideFilter() {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;
  let btn = wrap.querySelector('button[data-category="microguide"]');
  if (!btn) {
    btn = document.createElement('button');
    btn.setAttribute('data-category', 'microguide');
    wrap.appendChild(btn);
  }
  btn.textContent = tFilter('microguide');
}

function translateExistingFilters() {
  document.querySelectorAll('.filter-categories button').forEach((btn) => {
    const cat = btn.getAttribute('data-category');
    if (i18n.filters[cat]) btn.textContent = tFilter(cat);
  });
}

// --- render článků tak, aby se micro-guides nesmazaly ---
function renderBlogArticles(category = 'all') {
  const grid = gridEl();
  if (!grid) return;

  // Micro-guidy jen schovat/ukázat
  const mgCards = microguideCards();
  const showMG = category === 'all' || category === 'microguide';
  mgCards.forEach((n) => { n.style.display = showMG ? '' : 'none'; });

  // Odstraň jen NE-microguide karty
  grid.querySelectorAll('.blog-card:not([data-type="microguide"])').forEach((n) => n.remove());

  // Pokud filtrujeme jen „Průvodce“, máme hotovo
  if (category === 'microguide') {
    setReadMoreTexts();
    return;
  }

  let filtered = blogArticles;
  if (category !== 'all') filtered = blogArticles.filter((a) => a.category === category);

  if (!filtered.length) {
    grid.insertAdjacentHTML(
      'beforeend',
      `<div class="no-articles" data-i18n-key="blog-empty">Žádné články pro tuto kategorii.</div>`
    );
    setReadMoreTexts();
    return;
  }

  const frag = document.createDocumentFragment();
  for (const article of filtered) {
    const el = document.createElement('div');
    el.className = 'blog-card';
    // S J E D N O C E N Ý   M A R K U P   O B R Á Z K U  (stejný jako u micro-guides)
    el.innerHTML = `
      <div class="card-media">
        <img src="${article.image}" alt="${(article.title && (article.title[LANG] || article.title['cs'])) || ''}">
      </div>
      <div class="blog-card-body">
        <h3 class="blog-card-title">${article.title[LANG] || article.title['cs']}</h3>
        <div class="blog-card-lead">${article.lead[LANG] || article.lead['cs']}</div>
        <div class="blog-card-actions">
          <a href="blog-detail.html?slug=${article.slug}&lang=${LANG}" class="blog-readmore">${tReadMore()}</a>
        </div>
      </div>
    `;
    frag.appendChild(el);
  }
  grid.appendChild(frag);

  setReadMoreTexts();
}

function setupCategoryFilters() {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;

  ensureMicroguideFilter();
  translateExistingFilters();

  wrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-category]');
    if (!btn) return;
    wrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.getAttribute('data-category');
    renderBlogArticles(cat);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureMicroguideFilter();
  translateExistingFilters();
  renderBlogArticles('all');
  setupCategoryFilters();
  setReadMoreTexts();
});
