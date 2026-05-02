// /src/blog.js
// ---------------------------------------------------------
// AJSEE – blog listing page
// Renders blog articles + micro-guides into .blog-cards.
// Language switching is handled centrally by main.js + lang-dropdown.js.
// This file only reacts to language changes and re-renders blog cards.
// ---------------------------------------------------------

import { getSortedBlogArticles } from './blogArticles.js';

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const DEFAULT_LANG = 'cs';

function normalizeLang(value) {
  if (!value) return DEFAULT_LANG;

  let lang = String(value).trim().toLowerCase().split(/[-_]/)[0];
  if (lang === 'cz') lang = 'cs';

  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

function getCookie(name) {
  try {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`))
      ?.split('=')[1] || '';
  } catch {
    return '';
  }
}

function getLang() {
  const params = new URLSearchParams(window.location.search);

  const fromUrl = params.get('lang');
  if (fromUrl) return normalizeLang(fromUrl);

  const fromHtml = document.documentElement.getAttribute('lang');
  if (fromHtml) return normalizeLang(fromHtml);

  const fromCookie = getCookie('aj_lang');
  if (fromCookie) return normalizeLang(decodeURIComponent(fromCookie));

  try {
    const fromStorage =
      localStorage.getItem('ajsee.lang') ||
      localStorage.getItem('ajsee_lang') ||
      localStorage.getItem('lang');

    if (fromStorage) return normalizeLang(fromStorage);
  } catch {
    /* noop */
  }

  return DEFAULT_LANG;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Local blog UI texts ---------------------------------------------------

const i18n = {
  readMore: {
    cs: 'Číst dál',
    en: 'Read more',
    de: 'Weiterlesen',
    sk: 'Čítať ďalej',
    pl: 'Czytaj dalej',
    hu: 'Tovább',
  },
  badge: {
    cs: 'Mikroprůvodce',
    en: 'Micro-guide',
    de: 'Mikro-Guide',
    sk: 'Mikro-sprievodca',
    pl: 'Mikroprzewodnik',
    hu: 'Mini útmutató',
  },
  filters: {
    all: {
      cs: 'Vše',
      en: 'All',
      de: 'Alle',
      sk: 'Všetko',
      pl: 'Wszystko',
      hu: 'Mind',
    },
    concert: {
      cs: 'Koncerty',
      en: 'Concerts',
      de: 'Konzerte',
      sk: 'Koncerty',
      pl: 'Koncerty',
      hu: 'Koncertek',
    },
    theatre: {
      cs: 'Divadlo',
      en: 'Theatre',
      de: 'Theater',
      sk: 'Divadlo',
      pl: 'Teatr',
      hu: 'Színház',
    },
    festival: {
      cs: 'Festivaly',
      en: 'Festivals',
      de: 'Festivals',
      sk: 'Festivaly',
      pl: 'Festiwale',
      hu: 'Fesztiválok',
    },
    sport: {
      cs: 'Sport',
      en: 'Sport',
      de: 'Sport',
      sk: 'Šport',
      pl: 'Sport',
      hu: 'Sport',
    },
    tip: {
      cs: 'Tipy',
      en: 'Tips',
      de: 'Tipps',
      sk: 'Tipy',
      pl: 'Wskazówki',
      hu: 'Tippek',
    },
    review: {
      cs: 'Recenze',
      en: 'Reviews',
      de: 'Rezensionen',
      sk: 'Recenzie',
      pl: 'Recenzje',
      hu: 'Vélemények',
    },
    microguide: {
      cs: 'Průvodce',
      en: 'Guides',
      de: 'Leitfäden',
      sk: 'Sprievodcovia',
      pl: 'Poradniki',
      hu: 'Útmutatók',
    },
  },
};

function tReadMore(lang) {
  return i18n.readMore[lang] || i18n.readMore[DEFAULT_LANG];
}

function tBadge(lang) {
  return i18n.badge[lang] || i18n.badge[DEFAULT_LANG];
}

function tFilter(key, lang) {
  return i18n.filters[key]?.[lang] || i18n.filters[key]?.[DEFAULT_LANG] || '';
}

function getGrid() {
  return document.querySelector('.blog-list .blog-cards') || document.querySelector('.blog-cards');
}

// --- Filters ---------------------------------------------------------------

function ensureMicroguideFilter(lang) {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;

  let btn = wrap.querySelector('button[data-category="microguide"]');

  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-category', 'microguide');
    wrap.appendChild(btn);
  }

  btn.textContent = tFilter('microguide', lang);
}

function translateExistingFilters(lang) {
  document.querySelectorAll('.filter-categories button[data-category]').forEach((btn) => {
    const category = btn.getAttribute('data-category');

    if (i18n.filters[category]) {
      btn.textContent = tFilter(category, lang);
    }
  });
}

function getActiveCategory() {
  const active = document.querySelector('.filter-categories button.active[data-category]');
  return active?.getAttribute('data-category') || 'all';
}

function setActiveCategory(category) {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap) return;

  wrap.querySelectorAll('button[data-category]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
}

// --- Micro-guide loading ---------------------------------------------------

async function loadMicroguideCards(lang) {
  const paths = [
    '/content/microguides/index.json',
    '/public/content/microguides/index.json',
  ];

  let raw = [];

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) continue;

      const json = await response.json();
      raw = Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);

      if (raw.length) break;
    } catch {
      /* try next path */
    }
  }

  if (!raw.length) return [];

  const seen = new Set();

  return raw
    .filter((item) => !item.status || String(item.status).toLowerCase() === 'published')
    .filter((item) => normalizeLang(item.language || DEFAULT_LANG) === lang)
    .filter((item) => {
      if (!item.slug || seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    })
    .map((item) => ({
      type: 'microguide',
      slug: item.slug,
      lang: normalizeLang(item.language || lang),
      title: item.title || '',
      lead: item.summary || '',
      image: item.cover || '',
      category: 'microguide',
      ts: Date.parse(item.publishedAt || 0) || 0,
    }));
}

async function loadAllCards(lang) {
  const microguides = await loadMicroguideCards(lang);

  const articles = getSortedBlogArticles(lang).map((article) => ({
    type: 'article',
    slug: article.slug,
    lang,
    title: article.titleText,
    lead: article.leadText,
    image: article.image,
    category: article.category || '',
    ts: article._ts,
  }));

  return [...microguides, ...articles].sort((a, b) => b.ts - a.ts);
}

function cardHref(card) {
  if (card.type === 'microguide') {
    return `/microguides/?slug=${encodeURIComponent(card.slug)}&lang=${encodeURIComponent(card.lang)}`;
  }

return `/blog/${encodeURIComponent(card.slug)}?lang=${encodeURIComponent(card.lang)}`;}

// --- Render ----------------------------------------------------------------

const cardsCache = new Map();
let activeCategory = 'all';
let lastRenderSignature = '';
let renderInProgress = false;
let queuedRender = false;

function renderEmptyState(grid, lang) {
  const fallback = lang === 'en'
    ? 'No articles found.'
    : lang === 'de'
      ? 'Keine Artikel gefunden.'
      : lang === 'sk'
        ? 'Nenašli sa žiadne články.'
        : lang === 'pl'
          ? 'Nie znaleziono artykułów.'
          : lang === 'hu'
            ? 'Nem találhatók cikkek.'
            : 'Nenašli jsme žádné články.';

  grid.innerHTML = `<p class="blog-empty">${escapeHtml(fallback)}</p>`;
}

function renderCards(cards, lang) {
  const grid = getGrid();
  if (!grid) return;

  // Pojistka proti případným legacy třídám z homepage rendereru.
  grid.classList.add('blog-cards');
  grid.classList.remove('homepage-blog-cards');

  if (!cards.length) {
    renderEmptyState(grid, lang);
    return;
  }

  grid.innerHTML = cards.map((card) => {
    const href = cardHref(card);
    const title = escapeHtml(card.title || '');
    const lead = escapeHtml(card.lead || '');
    const image = escapeHtml(card.image || '');
    const readMore = escapeHtml(tReadMore(lang));

    if (card.type === 'microguide') {
      return `
        <article class="blog-card is-microguide" data-type="microguide" data-href="${escapeHtml(href)}">
          <div class="card-media">
            ${image ? `<img src="${image}" alt="${title}" loading="lazy" decoding="async">` : ''}
            <span class="card-badge">${escapeHtml(tBadge(lang))}</span>
          </div>

          <div class="blog-card-body">
            <h3 class="blog-card-title">${title}</h3>
            <div class="blog-card-lead">${lead}</div>
            <div class="blog-card-actions">
              <a class="blog-readmore" href="${escapeHtml(href)}">${readMore}</a>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="blog-card" data-type="article">
        <div class="card-media">
          ${image ? `<img src="${image}" alt="${title}" loading="lazy" decoding="async">` : ''}
        </div>

        <div class="blog-card-body">
          <h3 class="blog-card-title">${title}</h3>
          <div class="blog-card-lead">${lead}</div>
          <div class="blog-card-actions">
            <a class="blog-readmore" href="${escapeHtml(href)}">${readMore}</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (!grid.dataset.blogCardClickBound) {
    grid.dataset.blogCardClickBound = '1';

    grid.addEventListener('click', (event) => {
      const microguideCard = event.target.closest('.blog-card.is-microguide[data-href]');
      if (!microguideCard) return;
      if (event.target.closest('a')) return;

      window.location.assign(microguideCard.dataset.href);
    });
  }

  window.dispatchEvent(new CustomEvent('ajsee:blog-rendered', {
    detail: { lang, count: cards.length },
  }));
}

async function renderBlogArticles(category = activeCategory) {
  if (renderInProgress) {
    queuedRender = true;
    activeCategory = category;
    return;
  }

  renderInProgress = true;

  try {
    const lang = getLang();
    activeCategory = category;

    ensureMicroguideFilter(lang);
    translateExistingFilters(lang);
    setActiveCategory(activeCategory);

    const signature = `${lang}:${activeCategory}`;

    if (signature === lastRenderSignature) {
      return;
    }

    if (!cardsCache.has(lang)) {
      cardsCache.set(lang, await loadAllCards(lang));
    }

    let list = [...cardsCache.get(lang)];

    if (activeCategory !== 'all') {
      if (activeCategory === 'microguide') {
        list = list.filter((card) => card.type === 'microguide');
      } else {
        list = list.filter((card) => card.type === 'article' && card.category === activeCategory);
      }
    }

    renderCards(list, lang);
    lastRenderSignature = signature;
  } finally {
    renderInProgress = false;

    if (queuedRender) {
      queuedRender = false;
      const nextCategory = activeCategory;
      lastRenderSignature = '';
      void renderBlogArticles(nextCategory);
    }
  }
}

function setupCategoryFilters() {
  const wrap = document.querySelector('.filter-categories');
  if (!wrap || wrap.dataset.blogFiltersBound === '1') return;

  wrap.dataset.blogFiltersBound = '1';

  wrap.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-category]');
    if (!btn) return;

    const category = btn.getAttribute('data-category') || 'all';
    activeCategory = category;
    lastRenderSignature = '';

    setActiveCategory(category);
    void renderBlogArticles(category);
  });
}

function refreshForLanguageChange() {
  lastRenderSignature = '';
  void renderBlogArticles(activeCategory);
}

function setupLanguageListeners() {
  let scheduled = false;

  const scheduleRefresh = () => {
    if (scheduled) return;

    scheduled = true;

    window.requestAnimationFrame(() => {
      scheduled = false;
      refreshForLanguageChange();
    });
  };

  window.addEventListener('AJSEE:langChanged', scheduleRefresh);
  window.addEventListener('ajsee:lang-changed', scheduleRefresh);
  window.addEventListener('popstate', scheduleRefresh);

  try {
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
  } catch {
    /* noop */
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (document.body?.dataset?.page !== 'blog') return;

  activeCategory = getActiveCategory();

  setupCategoryFilters();
  setupLanguageListeners();

  await renderBlogArticles(activeCategory);
});
