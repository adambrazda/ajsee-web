// /src/blog.js
import { getSortedBlogArticles } from './blogArticles.js';

// --- jazyk ---
function normalizeLang(val) {
  if (!val) return 'cs';
  let l = String(val).toLowerCase().split(/[-_]/)[0];
  return l === 'cz' ? 'cs' : l;
}

function getLang() {
  // 1) URL ?lang=
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang) return normalizeLang(urlLang);

  // 2) pokud si main.js někam ukládá jazyk (safe pokusy)
  const w = window;
  const maybe =
    w.__ajsee?.lang ||
    w.__ajsee?.i18n?.lang ||
    w.currentLang ||
    w.lang;

  if (maybe) return normalizeLang(maybe);

  // 3) localStorage fallback (pokud někde ukládáš)
  try {
    const ls = localStorage.getItem('ajsee_lang') || localStorage.getItem('lang');
    if (ls) return normalizeLang(ls);
  } catch {}

  // 4) <html lang>
  return normalizeLang(document.documentElement.getAttribute('lang') || 'cs');
}

// --- lokální texty (read more / badge / filtry) ---
const i18n = {
  readMore: { cs: 'Číst dál', en: 'Read more', de: 'Weiterlesen', sk: 'Čítať ďalej', pl: 'Czytaj dalej', hu: 'Tovább' },
  badge:    { cs: 'Mikroprůvodce', en: 'Micro-guide', de: 'Mikro-Guide', sk: 'Mikro-sprievodca', pl: 'Mikroprzewodnik', hu: 'Mini útmutató' },
  filters: {
    all: { cs:'Vše', en:'All', de:'Alle', sk:'Všetko', pl:'Wszystko', hu:'Mind' },
    concert:{ cs:'Koncerty', en:'Concerts', de:'Konzerte', sk:'Koncerty', pl:'Koncerty', hu:'Koncertek' },
    theatre:{ cs:'Divadlo', en:'Theatre', de:'Theater', sk:'Divadlo', pl:'Teatr', hu:'Színház' },
    festival:{ cs:'Festivaly', en:'Festivals', de:'Festivals', sk:'Festivaly', pl:'Festiwale', hu:'Fesztiválok' },
    sport:{ cs:'Sport', en:'Sport', de:'Sport', sk:'Šport', pl:'Sport', hu:'Sport' },
    tip:{ cs:'Tipy', en:'Tips', de:'Tipps', sk:'Tipy', pl:'Wskazówki', hu:'Tippek' },
    review:{ cs:'Recenze', en:'Reviews', de:'Rezensionen', sk:'Recenzie', pl:'Recenzje', hu:'Vélemények' },
    microguide:{ cs:'Průvodce', en:'Guides', de:'Leitfäden', sk:'Sprievodcovia', pl:'Poradniki', hu:'Útmutatók' }
  }
};

const tReadMore = (lang) => i18n.readMore[lang] || i18n.readMore.cs;
const tBadge    = (lang) => i18n.badge[lang]    || i18n.badge.cs;
const tFilter   = (key, lang) => (i18n.filters[key] && (i18n.filters[key][lang] || i18n.filters[key].cs)) || '';

const gridEl = () => document.querySelector('.blog-cards');

function setReadMoreTexts(lang) {
  document.querySelectorAll('.blog-readmore').forEach(el => (el.textContent = tReadMore(lang)));
}

function ensureMicroguideFilter(lang) {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;

  let btn = wrap.querySelector('button[data-category="microguide"]');
  if (!btn) {
    btn = document.createElement('button');
    btn.setAttribute('data-category', 'microguide');
    wrap.appendChild(btn);
  }
  btn.textContent = tFilter('microguide', lang);
}

function translateExistingFilters(lang) {
  document.querySelectorAll('.filter-categories button').forEach((btn) => {
    const cat = btn.getAttribute('data-category');
    if (i18n.filters[cat]) btn.textContent = tFilter(cat, lang);
  });
}

/** ——— robustní loader micro-guidů (více cest, normalizace, fallbacky) ——— */
async function loadMicroguideCards(lang) {
  const tryPaths = ['/content/microguides/index.json', '/public/content/microguides/index.json'];
  let raw = [];
  for (const p of tryPaths) {
    try {
      const r = await fetch(p, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      raw = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
      if (raw.length) break;
    } catch {/* continue */}
  }
  if (!raw.length) return [];

  const L = lang;
  const seen = new Set();
  return raw
    .filter(it => !it.status || String(it.status).toLowerCase() === 'published')
    .filter(it => normalizeLang(it.language || 'cs') === L)
    .filter(it => it.slug && (seen.has(it.slug) ? false : (seen.add(it.slug), true)))
    .map(it => ({
      type: 'microguide',
      slug: it.slug,
      lang: normalizeLang(it.language || L),
      title: it.title || '',
      lead: it.summary || '',
      image: it.cover || '',
      category: 'microguide',
      ts: Date.parse(it.publishedAt || 0) || 0
    }));
}

/** sjednoť články i průvodce a seřaď DESC */
async function loadAllCards(lang) {
  const mg = await loadMicroguideCards(lang);
  const arts = getSortedBlogArticles(lang).map(a => ({
    type: 'article',
    slug: a.slug,
    lang,
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

/** render – micro-guidy bez <a> kolem celé karty (kompatibilní s CSS) */
function renderCards(cards, lang) {
  const grid = gridEl();
  if (!grid) return;

  const html = cards.map(card => {
    const titleEsc = (card.title || '').replace(/"/g, '&quot;');

    if (card.type === 'microguide') {
      return `
        <article class="blog-card is-microguide" data-type="microguide" data-href="${cardHref(card)}">
          <div class="card-media">
            ${card.image ? `<img src="${card.image}" alt="${titleEsc}">` : ''}
            <span class="card-badge">${tBadge(lang)}</span>
          </div>
          <div class="blog-card-body">
            <h3 class="blog-card-title">${card.title}</h3>
            <div class="blog-card-lead">${card.lead || ''}</div>
            <div class="blog-card-actions">
              <a class="blog-readmore" href="${cardHref(card)}">${tReadMore(lang)}</a>
            </div>
          </div>
        </article>`;
    }

    return `
      <article class="blog-card" data-type="article">
        <div class="card-media">
          ${card.image ? `<img src="${card.image}" alt="${titleEsc}">` : ''}
        </div>
        <div class="blog-card-body">
          <h3 class="blog-card-title">${card.title}</h3>
          <div class="blog-card-lead">${card.lead || ''}</div>
          <div class="blog-card-actions">
            <a class="blog-readmore" href="${cardHref(card)}">${tReadMore(lang)}</a>
          </div>
        </div>
      </article>`;
  }).join('');

  grid.innerHTML = html;

  // klik na celou micro-guide kartu (mimo explicitní odkazy) – bind jen jednou
  if (!grid.dataset.mgClickBound) {
    grid.dataset.mgClickBound = '1';
    grid.addEventListener('click', (ev) => {
      const card = ev.target.closest('.blog-card.is-microguide[data-href]');
      if (!card) return;
      if (ev.target.closest('a')) return;
      window.location.assign(card.dataset.href);
    });
  }

  setReadMoreTexts(lang);

  // kdyby se do karet někdy přidaly data-i18n-key texty, tak se přeloží taky
  if (typeof window.applyTranslations === 'function') {
    try { window.applyTranslations(lang); } catch {}
  }
}

// cache podle jazyka, aby přepínání bylo svižné
const ALL_CARDS_BY_LANG = {};
let ACTIVE_CATEGORY = 'all';

async function renderBlogArticles(category = 'all') {
  const lang = getLang();
  ACTIVE_CATEGORY = category;

  if (!ALL_CARDS_BY_LANG[lang]) {
    ALL_CARDS_BY_LANG[lang] = await loadAllCards(lang);
  }

  let list = [...ALL_CARDS_BY_LANG[lang]];
  if (category !== 'all') {
    if (category === 'microguide') list = list.filter(c => c.type === 'microguide');
    else list = list.filter(c => c.category === category && c.type === 'article');
  }

  renderCards(list, lang);
}

function setupCategoryFilters() {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;

  const lang = getLang();
  ensureMicroguideFilter(lang);
  translateExistingFilters(lang);

  wrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-category]');
    if (!btn) return;
    wrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBlogArticles(btn.getAttribute('data-category'));
  });
}

function refreshUiForLang() {
  const lang = getLang();
  ensureMicroguideFilter(lang);
  translateExistingFilters(lang);
  setReadMoreTexts(lang);

  // přerender karet v aktuální kategorii
  renderBlogArticles(ACTIVE_CATEGORY);
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = getLang();
  ensureMicroguideFilter(lang);
  translateExistingFilters(lang);

  await renderBlogArticles('all');
  setupCategoryFilters();

  // 1) změna <html lang> (main.js ji často přepíná)
  const mo = new MutationObserver(() => refreshUiForLang());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // 2) změna URL (např. historie / popstate)
  window.addEventListener('popstate', () => refreshUiForLang());

  // 3) klik na jazykové tlačítko (pokud to přepíná bez reloadu)
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.lang-btn[data-lang]');
    if (!b) return;
    // necháme proběhnout logiku v main.js a pak přerender
    setTimeout(refreshUiForLang, 0);
  });
});
