// /src/blog.js
import { blogArticles, getSortedBlogArticles } from './blogArticles.js';

// --- jazyk ---
function normalizeLang(val) {
  if (!val) return 'cs';
  let l = String(val).toLowerCase().split(/[-_]/)[0];
  return l === 'cz' ? 'cs' : l;
}
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  return normalizeLang(urlLang || document.documentElement.getAttribute('lang') || 'cs');
}
const LANG = detectLang();

// --- překlady ---
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
const tReadMore = () => i18n.readMore[LANG] || i18n.readMore.cs;
const tBadge    = () => i18n.badge[LANG]    || i18n.badge.cs;
const tFilter   = (key) => (i18n.filters[key] && (i18n.filters[key][LANG] || i18n.filters[key].cs)) || '';

const gridEl = () => document.querySelector('.blog-cards');

function setReadMoreTexts(){ document.querySelectorAll('.blog-readmore').forEach(el => el.textContent = tReadMore()); }
function ensureMicroguideFilter(){
  const wrap = document.querySelector('.filter-categories'); if(!wrap) return;
  let btn = wrap.querySelector('button[data-category="microguide"]');
  if(!btn){ btn = document.createElement('button'); btn.setAttribute('data-category','microguide'); wrap.appendChild(btn); }
  btn.textContent = tFilter('microguide');
}
function translateExistingFilters(){
  document.querySelectorAll('.filter-categories button').forEach((btn)=>{
    const cat = btn.getAttribute('data-category'); if(i18n.filters[cat]) btn.textContent = tFilter(cat);
  });
}

/** ——— robustní loader micro-guidů (více cest, normalizace, fallbacky) ——— */
async function loadMicroguideCards(){
  const tryPaths = ['/content/microguides/index.json','/public/content/microguides/index.json'];
  let raw = [];
  for(const p of tryPaths){
    try{
      const r = await fetch(p, { cache:'no-store' });
      if(!r.ok) continue;
      const j = await r.json();
      raw = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
      if(raw.length) break;
    }catch{/* continue */}
  }
  if(!raw.length) return [];

  const L = LANG;
  const seen = new Set();
  return raw
    .filter(it => !it.status || String(it.status).toLowerCase() === 'published')
    .filter(it => normalizeLang(it.language || 'cs') === L)
    .filter(it => it.slug && (seen.has(it.slug) ? false : (seen.add(it.slug), true)))
    .map(it => ({
      type:'microguide',
      slug: it.slug,
      lang: normalizeLang(it.language || L),
      title: it.title || '',
      lead: it.summary || '',
      image: it.cover || '',
      category:'microguide',
      ts: Date.parse(it.publishedAt || 0) || 0
    }));
}

/** sjednoť články i průvodce a seřaď DESC */
async function loadAllCards(){
  const mg   = await loadMicroguideCards();
  const arts = getSortedBlogArticles(LANG).map(a=>({
    type:'article', slug:a.slug, lang:LANG, title:a.titleText, lead:a.leadText, image:a.image,
    category:a.category || '', ts:a._ts
  }));
  return [...mg, ...arts].sort((a,b)=> b.ts - a.ts);
}

function cardHref(card){
  return card.type==='microguide'
    ? `/microguides/?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`
    : `/blog-detail.html?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`;
}

/** render – micro-guidy bez <a> kolem celé karty (kompatibilní s CSS) */
function renderCards(cards){
  const grid = gridEl(); if(!grid) return;
  const html = cards.map(card=>{
    const titleEsc = (card.title||'').replace(/"/g,'&quot;');
    if(card.type==='microguide'){
      return `
        <article class="blog-card is-microguide" data-type="microguide" data-href="${cardHref(card)}">
          <div class="card-media">
            ${card.image ? `<img src="${card.image}" alt="${titleEsc}">` : ''}
            <span class="card-badge">${tBadge()}</span>
          </div>
          <div class="blog-card-body">
            <h3 class="blog-card-title">${card.title}</h3>
            <div class="blog-card-lead">${card.lead || ''}</div>
            <div class="blog-card-actions">
              <a class="blog-readmore" href="${cardHref(card)}">${tReadMore()}</a>
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
            <a class="blog-readmore" href="${cardHref(card)}">${tReadMore()}</a>
          </div>
        </div>
      </article>`;
  }).join('');
  grid.innerHTML = html;

  // klik na celou micro-guide kartu (mimo explicitní odkazy)
  grid.addEventListener('click', (ev)=>{
    const card = ev.target.closest('.blog-card.is-microguide[data-href]');
    if(!card) return;
    if(ev.target.closest('a')) return;
    window.location.assign(card.dataset.href);
  });

  setReadMoreTexts();
}

let ALL_CARDS = [];
async function renderBlogArticles(category='all'){
  if(!ALL_CARDS.length) ALL_CARDS = await loadAllCards();
  let list = [...ALL_CARDS];
  if(category!=='all'){
    if(category==='microguide') list = list.filter(c=>c.type==='microguide');
    else list = list.filter(c=>c.category===category && c.type==='article');
  }
  renderCards(list);
}
function setupCategoryFilters(){
  const wrap = document.querySelector('.filter-categories'); if(!wrap) return;
  ensureMicroguideFilter(); translateExistingFilters();
  wrap.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button[data-category]'); if(!btn) return;
    wrap.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderBlogArticles(btn.getAttribute('data-category'));
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  ensureMicroguideFilter();
  translateExistingFilters();
  await renderBlogArticles('all');
  setupCategoryFilters();
  setReadMoreTexts();
});
