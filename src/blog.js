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
const tFilter  = (key) => (i18n.filters[key] && (i18n.filters[key][LANG] || i18n.filters[key].cs)) || '';

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

/** Načti micro-guides index z public a normalizuj na karty (aktuální jazyk) */
async function loadMicroguideCards() {
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const arr = await r.json();

    const seen = new Set(); // deduplikace slugů
    return (Array.isArray(arr) ? arr : [])
      .filter(it => (it.language || 'cs').toLowerCase() === LANG)
      .filter(it => it.status === 'published')
      .filter(it => (seen.has(it.slug) ? false : seen.add(it.slug)))
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

/** Sjednoť články i průvodce, deduplikuj a seřaď DESC */
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

  // unikátní kombinace type|slug|lang
  const uniq = [];
  const seen = new Set();
  for (const c of [...mg, ...arts]) {
    const key = `${c.type}|${c.slug}|${c.lang}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(c); }
  }
  return uniq.sort((a, b) => b.ts - a.ts);
}

function cardHref(card) {
  return card.type === 'microguide'
    ? `/microguides/?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`
    : `/blog-detail.html?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`;
}

function renderCards(cards) {
  const grid = gridEl();
  if (!grid) return;

  const badge = i18n.badge[LANG] || i18n.badge.en || i18n.badge.cs;
  const placeholder = '/images/microguides/_placeholder.webp';

  grid.innerHTML = cards.map(card => {
    if (card.type === 'microguide') {
      // ⬇ přesně ten markup, který očekává CSS pro micro-guidy
      return `
        <article class="blog-card is-microguide" data-type="microguide" data-slug="${card.slug}">
          <a class="card-link" href="${cardHref(card)}" data-mg-link="true">
            <div class="card-media">
              <img class="card-img-cover" src="${card.image || ''}" alt="" loading="lazy" width="640" height="360" />
              <span class="card-badge">${badge}</span>
            </div>
            <div class="blog-card-body">
              <h3 class="blog-card-title">${card.title}</h3>
              <div class="blog-card-lead">${card.lead}</div>
              <div class="blog-card-actions"><span class="blog-readmore">${tReadMore()}</span></div>
            </div>
          </a>
        </article>
      `;
    }
    // běžný blogový článek – původní markup
    return `
      <div class="blog-card" data-type="article">
        <a href="${cardHref(card)}">
          ${card.image ? `<div class="card-media"><img src="${card.image}" alt=""></div>` : ''}
          <div class="blog-card-body">
            <h3 class="blog-card-title">${card.title}</h3>
            <div class="blog-card-lead">${card.lead}</div>
            <div class="blog-card-actions"><span class="blog-readmore">${tReadMore()}</span></div>
          </div>
        </a>
      </div>
    `;
  }).join('');

  // placeholdery + pojistka navigace pro micro-guidy
  grid.querySelectorAll('.blog-card.is-microguide img').forEach(img => {
    img.addEventListener('error', () => {
      img.src = placeholder;
      img.closest('.blog-card')?.classList.add('has-placeholder');
    });
  });
  grid.querySelectorAll('.blog-card.is-microguide a.card-link').forEach(link => {
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      window.location.assign(link.href);
    }, { capture: true });
  });

  setReadMoreTexts();
}

let ALL_CARDS = [];

async function renderBlogArticles(category = 'all') {
  if (!ALL_CARDS.length) ALL_CARDS = await loadAllCards();

  let list = [...ALL_CARDS];
  if (category !== 'all') {
    if (category === 'microguide') {
      list = list.filter(c => c.type === 'microguide');
    } else {
      list = list.filter(c => c.type === 'article' && c.category === category);
    }
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
  await renderBlogArticles('all');   // sjednocený seznam, seřazený dle data (DESC)
  setupCategoryFilters();
  setReadMoreTexts();
});
