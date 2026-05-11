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


function optimizeCardImageUrl(url = '') {
  return String(url)
    .replace('w=700', 'w=480')
    .replace('q=80', 'q=70');
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
  const currentLang = normalizeLang(lang || getLang());
  const paths = [
    '/content/microguides/index.json',
    '/public/content/microguides/index.json',
  ];

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    return response.json();
  }

  let raw = [];

  for (const path of paths) {
    try {
      const json = await fetchJson(path);
      raw = Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);

      if (raw.length) break;
    } catch {
      // Try next path.
    }
  }

  if (!raw.length) return [];

  const seen = new Set();

  const publishedItems = raw
    .filter((item) => !item.status || String(item.status).toLowerCase() === 'published')
    .filter((item) => {
      const slug = String(item?.slug || '').trim();

      if (!slug || seen.has(slug)) return false;

      seen.add(slug);
      return true;
    });

  const localizedHref = (slug) => {
    const basePath = '/microguides/' + encodeURIComponent(slug) + '/';
    return currentLang === DEFAULT_LANG ? basePath : '/' + currentLang + basePath;
  };

  const loadLocalizedGuide = async (slug) => {
    const encodedSlug = encodeURIComponent(slug);
    const candidates = [];

    const pushCandidate = (langCode) => {
      const normalized = normalizeLang(langCode);

      if (!normalized || candidates.includes(normalized)) return;

      candidates.push(normalized);
    };

    pushCandidate(currentLang);
    pushCandidate('en');
    pushCandidate('cs');

    for (const candidate of candidates) {
      try {
        const data = await fetchJson('/content/microguides/' + encodedSlug + '.' + candidate + '.json');

        return {
          data,
          resolvedLang: candidate
        };
      } catch {
        // Try next fallback language.
      }
    }

    return null;
  };

  const cards = await Promise.all(
    publishedItems.map(async (item) => {
      const slug = String(item?.slug || '').trim();

      if (!slug) return null;

      const localized = await loadLocalizedGuide(slug);
      const data = localized?.data || {};
      const merged = {
        ...item,
        ...data
      };

      const title = merged.title || item.title || slug;
      const summary = merged.summary || merged.lead || item.summary || item.lead || '';
      const image = merged.image || merged.cover || item.image || item.cover || '/images/fallbacks/concert0.jpg';
      const date = merged.publishedAt || item.publishedAt || merged.date || item.date || '';
      const ts = Date.parse(date || 0) || 0;
      const href = localizedHref(slug);

      return {
        ...merged,
        type: 'microguide',
        kind: 'microguide',
        contentType: 'microguide',
        slug,
        lang: localized?.resolvedLang || currentLang,
        language: localized?.resolvedLang || currentLang,
        category: 'microguide',
        dataCategory: 'microguide',
        title,
        titleText: title,
        lead: summary,
        leadText: summary,
        summary,
        excerpt: summary,
        image,
        cover: merged.cover || image,
        coverAlt: merged.coverAlt || merged.alt || title,
        date,
        publishedAt: date,
        href,
        url: href,
        link: href,
        path: href,
        _ts: ts
      };
    })
  );

  return cards
    .filter(Boolean)
    .sort((a, b) => (b._ts || 0) - (a._ts || 0));
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

function withLangPath(path, lang) {
  const normalizedLang = normalizeLang(lang);

  try {
    const url = new URL(path || '/', window.location.origin);

    let pathname = url.pathname || '/';

    pathname = pathname.replace(/^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i, '');

    if (!pathname.startsWith('/')) {
      pathname = '/' + pathname;
    }

    pathname = pathname.replace(/\/{2,}/g, '/');

    if (pathname !== '/' && !pathname.endsWith('/')) {
      pathname += '/';
    }

    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    url.searchParams.delete('hl');

    const localizedPath = normalizedLang === DEFAULT_LANG
      ? pathname
      : '/' + normalizedLang + pathname;

    return localizedPath + url.search + url.hash;
  } catch {
    const cleanPath = String(path || '/');

    if (normalizedLang === DEFAULT_LANG) {
      return cleanPath;
    }

    return '/' + normalizedLang + (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath);
  }
}

function cardHref(card, uiLang = getLang()) {
  const lang = normalizeLang(uiLang);
  const slug = encodeURIComponent(card.slug || '');

  if (!slug) {
    return withLangPath('/blog/', lang);
  }

  if (card.type === 'microguide') {
    return withLangPath(card.href || card.url || card.link || card.path || '/microguides/' + slug + '/', lang);
  }

  return withLangPath(card.href || card.url || card.link || card.path || '/blog/' + slug + '/', lang);
}

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
    const href = cardHref(card, lang);
    const title = escapeHtml(card.title || '');
    const lead = escapeHtml(card.lead || '');
    const image = escapeHtml(optimizeCardImageUrl(card.image || ''));
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
