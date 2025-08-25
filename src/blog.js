// /src/blog.js
import { blogArticles, getSortedBlogArticles } from './blogArticles.js';

// --- jazyk ---
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  return (urlLang || document.documentElement.getAttribute('lang') || 'cs').toLowerCase();
}
const LANG = detectLang();

// --- překlady ---
const i18n = {
  readMore: { cs: 'Číst dál', en: 'Read more', de: 'Weiterlesen', sk: 'Čítať ďalej', pl: 'Czytaj dalej', hu: 'Tovább' },
  badge:    { cs: 'Mikroprůvodce', en: 'Micro-guide', de: 'Mikro-Guide', sk: 'Mikro-sprievodca', pl: 'Mikroprzewodnik', hu: 'Mini útmutató' },
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
const tBadge    = () => i18n.badge[LANG]    || i18n.badge.cs;
const tFilter   = (key) => (i18n.filters[key] && (i18n.filters[key][LANG] || i18n.filters[key].cs)) || '';

const gridEl = () => document.querySelector('.blog-cards');

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

/** Načti micro-guides index z public a normalizuj na karty */
async function loadMicroguideCards() {
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const arr = await r.json();  // array
    return (Array.isArray(arr) ? arr : [])
      .filter(it => (it.language || 'cs').toLowerCase() === LANG)
      .map(it => ({
        type: 'microguide',
        slug: it.slug,
        lang: it.language || LANG,
        title: it.title || '',
        lead: it.summary || '',
        image: it.cover || '',
        category: 'microguide',
        ts: Date.parse(it.publishedAt || 0) || 0
      }));
  } catch {
    return [];
  }
}

/** Sjednoť články i průvodce a seřaď DESC */
async function loadAllCards() {
  const mg = await loadMicroguideCards();
  const arts = getSortedBlogArticles(LANG).map(a => ({
    type: 'article',
    slug: a.slug,
    lang: LANG,
    title: a.titleText,
    lead: a.leadText,
    image: a.image,
    category: a.category || '',
    ts: a._ts
  }));
  return [...mg, ...arts].sort((a, b) => b.ts - a.ts);
}

function cardHref(card) {
  return card.type === 'microguide'
    ? `/microguides/?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`
    : `/blog-detail.html?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`;
}

// === DŮLEŽITÉ: markup přizpůsobený tvým stylům (body je SOUROZENEC media, ne uvnitř <a>) ===
function renderCards(cards) {
  const grid = gridEl();
  if (!grid) return;

  grid.innerHTML = cards.map(card => `
    <article class="blog-card" data-type="${card.type}">
      <div class="card-media">
        ${card.image ? `<img src="${card.image}" alt="${card.title ? card.title.replace(/"/g,'&quot;') : ''}">` : ''}
        ${card.type === 'microguide' ? `<span class="card-badge">${tBadge()}</span>` : ''}
      </div>
      <div class="blog-card-body">
        <h3 class="blog-card-title">${card.title}</h3>
        <div class="blog-card-lead">${card.lead}</div>
        <div class="blog-card-actions">
          <a href="${cardHref(card)}" class="blog-readmore">${tReadMore()}</a>
        </div>
      </div>
    </article>
  `).join('');

  setReadMoreTexts();
}

let ALL_CARDS = [];

async function renderBlogArticles(category = 'all') {
  if (!ALL_CARDS.length) ALL_CARDS = await loadAllCards();

  let list = [...ALL_CARDS];
  if (category !== 'all') {
    if (category === 'microguide') list = list.filter(c => c.type === 'microguide');
    else list = list.filter(c => c.category === category && c.type === 'article');
  }
  renderCards(list);
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

document.addEventListener('DOMContentLoaded', async () => {
  ensureMicroguideFilter();
  translateExistingFilters();
  await renderBlogArticles('all');   // načte, sjednotí, seřadí DESC
  setupCategoryFilters();
  setReadMoreTexts();
});
