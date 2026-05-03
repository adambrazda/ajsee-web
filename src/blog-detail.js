import { blogArticles } from './blogArticles.js';

// Podporované jazyky AJSEE
const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const DEFAULT_LANG = 'cs';
const SITE_ORIGIN = 'https://ajsee.cz';

// Funkce na získání parametrů z URL
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Funkce na získání slugu článku:
// 1) podporuje starý fallback /blog-detail?slug=...
// 2) podporuje novou SEO URL /blog/nazev-clanku
function getArticleSlug() {
  const querySlug = (getUrlParam('slug') || '').trim();
  if (querySlug) return querySlug;

  const match = window.location.pathname.match(/^\/blog\/([^/?#]+)\/?$/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return '';
}

// Detekce jazyka z URL (nebo fallback na cs)
function detectLang() {
  const lang = (getUrlParam('lang') || '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

// Bezpečné escapování textu do HTML
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Odstranění HTML pro JSON-LD articleBody / description
function stripHtml(value = '') {
  const el = document.createElement('div');
  el.innerHTML = String(value);
  return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

// Vložení / aktualizace JSON-LD scriptu
function upsertJsonLd(id, data) {
  let script = document.getElementById(id);

  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

// Vložení / aktualizace canonicalu
function upsertLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);

  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }

  el.setAttribute('href', href);
}

// Vložení / aktualizace meta name
function upsertMetaName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }

  el.setAttribute('content', content);
}

// Vložení / aktualizace meta property
function upsertMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }

  el.setAttribute('content', content);
}

function buildBlogCanonicalUrl(slug) {
  return `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`;
}

// Lehké sjednocení meta dat pro detail článku po načtení článku
function updateArticleMeta(article, lang) {
  if (!article?.slug) return;

  const canonicalUrl = buildBlogCanonicalUrl(article.slug);
  const title = article.title?.[lang] || article.title?.cs || article.slug;
  const description = article.lead?.[lang] || article.lead?.cs || '';
  const image = article.image || `${SITE_ORIGIN}/images/logo-ajsee.png`;

  document.title = `${title} | AJSEE`;

  upsertMetaName('description', description);
  upsertMetaName('robots', 'index, follow');

  upsertLink('canonical', canonicalUrl);

  upsertMetaProperty('og:type', 'article');
  upsertMetaProperty('og:title', `${title} | AJSEE`);
  upsertMetaProperty('og:description', description);
  upsertMetaProperty('og:url', canonicalUrl);
  upsertMetaProperty('og:image', image);

  upsertMetaName('twitter:card', 'summary_large_image');
  upsertMetaName('twitter:title', `${title} | AJSEE`);
  upsertMetaName('twitter:description', description);
  upsertMetaName('twitter:image', image);
}

// BlogPosting + BreadcrumbList JSON-LD
function renderBlogStructuredData(article, lang, categoryLabel) {
  if (!article?.slug) return;

  const canonicalUrl = buildBlogCanonicalUrl(article.slug);
  const title = article.title?.[lang] || article.title?.cs || article.slug;
  const description = article.lead?.[lang] || article.lead?.cs || '';
  const content = article.content?.[lang] || article.content?.cs || '';
  const image = article.image || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const publishedDate = article.date || undefined;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl
        },
        headline: title,
        description,
        image: [image],
        datePublished: publishedDate,
        dateModified: publishedDate,
        inLanguage: lang,
        articleSection: categoryLabel || article.category || undefined,
        articleBody: stripHtml(content) || undefined,
        author: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: SITE_ORIGIN + '/'
        },
        publisher: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: SITE_ORIGIN + '/',
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/images/logo-ajsee.png`
          }
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'AJSEE',
            item: SITE_ORIGIN + '/'
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${SITE_ORIGIN}/blog`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: canonicalUrl
          }
        ]
      }
    ]
  };

  // Odstraní undefined hodnoty, aby JSON-LD zůstal čistý.
  const cleanGraph = JSON.parse(JSON.stringify(graph));
  upsertJsonLd('ajsee-blog-article-jsonld', cleanGraph);
}

// Překlady kategorií
function getCategoryLabel(category, lang) {
  const categories = {
    concert: {
      cs: 'Koncert',
      en: 'Concert',
      de: 'Konzert',
      sk: 'Koncert',
      pl: 'Koncert',
      hu: 'Koncert'
    },
    festival: {
      cs: 'Festival',
      en: 'Festival',
      de: 'Festival',
      sk: 'Festival',
      pl: 'Festiwal',
      hu: 'Fesztivál'
    },
    theatre: {
      cs: 'Divadlo',
      en: 'Theatre',
      de: 'Theater',
      sk: 'Divadlo',
      pl: 'Teatr',
      hu: 'Színház'
    },
    sport: {
      cs: 'Sport',
      en: 'Sport',
      de: 'Sport',
      sk: 'Šport',
      pl: 'Sport',
      hu: 'Sport'
    },
    tip: {
      cs: 'Tip',
      en: 'Tip',
      de: 'Tipp',
      sk: 'Tip',
      pl: 'Wskazówka',
      hu: 'Tipp'
    },
    review: {
      cs: 'Recenze',
      en: 'Review',
      de: 'Rezension',
      sk: 'Recenzia',
      pl: 'Recenzja',
      hu: 'Értékelés'
    }
  };

  return categories[category]?.[lang] || categories[category]?.cs || category || '';
}

// Překlad tlačítka zpět
function updateBackLink(lang) {
  const backLink = document.querySelector('[data-i18n-key="blog-back"]');
  if (!backLink) return;

  const backKeys = {
    cs: '← Zpět na blog',
    en: '← Back to blog',
    de: '← Zurück zum Blog',
    sk: '← Späť na blog',
    pl: '← Wróć do bloga',
    hu: '← Vissza a bloghoz'
  };

  backLink.textContent = backKeys[lang] || backKeys.cs;
}

// Vykreslení článku do DOM
async function renderArticle() {
  const slug = getArticleSlug();
  const lang = detectLang();

  document.documentElement.setAttribute('lang', lang);

  // Najdi článek podle slug
  const article = blogArticles.find((item) => item.slug === slug);

  const container = document.getElementById('blogArticle');
  if (!container) return;

  if (!article) {
    container.innerHTML = `<div class="blog-404" data-i18n-key="blog-not-found">Článek nebyl nalezen.</div>`;
    upsertMetaName('robots', 'noindex, follow');
    upsertLink('canonical', `${SITE_ORIGIN}/blog`);
    return;
  }

  // Pokud překlad pro daný jazyk není, použije cs
  const title = article.title?.[lang] || article.title?.cs || article.slug;
  const lead = article.lead?.[lang] || article.lead?.cs || '';
  const content = article.content?.[lang] || article.content?.cs || '';
  const date = new Date(article.date).toLocaleDateString(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const categoryLabel = getCategoryLabel(article.category, lang);

  // SEO metadata + structured data
  updateArticleMeta(article, lang);
  renderBlogStructuredData(article, lang, categoryLabel);

  container.innerHTML = `
    <h1 class="blog-title">${escapeHtml(title)}</h1>
    <div class="blog-meta">
      <span class="blog-date">${escapeHtml(date)}</span> ·
      <span class="blog-category">${escapeHtml(categoryLabel)}</span>
    </div>
    <div class="blog-lead">${escapeHtml(lead)}</div>
    <img class="blog-image" src="${escapeHtml(article.image || '')}" alt="${escapeHtml(title)}" loading="eager" decoding="async">
    <div class="blog-content">${content}</div>
  `;

  updateBackLink(lang);
}

// Volání při načtení stránky
document.addEventListener('DOMContentLoaded', renderArticle);