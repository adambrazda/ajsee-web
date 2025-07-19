import { blogArticles } from './blogArticles.js';

// Funkce na získání parametrů z URL
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Detekce jazyka z URL (nebo fallback na cs)
function detectLang() {
  const lang = getUrlParam('lang');
  return lang && ['cs','en','de','sk','pl','hu'].includes(lang) ? lang : 'cs';
}

// Vykreslení článku do DOM
async function renderArticle() {
  const slug = getUrlParam('slug');
  const lang = detectLang();

  // Najdi článek podle slug
  const article = blogArticles.find(a => a.slug === slug);

  const container = document.getElementById('blogArticle');
  if (!container) return;

  if (!article) {
    container.innerHTML = `<div class="blog-404" data-i18n-key="blog-not-found">Článek nebyl nalezen.</div>`;
    return;
  }

  // Pokud překlad pro daný jazyk není, použije cs
  const title = article.title[lang] || article.title['cs'];
  const lead = article.lead[lang] || article.lead['cs'];
  const content = article.content[lang] || article.content['cs'];
  const date = new Date(article.date).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });

  // Volitelná: překlad názvu kategorie
  const categories = {
    concert: {
      cs: 'Koncert', en: 'Concert', de: 'Konzert', sk: 'Koncert', pl: 'Koncert', hu: 'Koncert'
    },
    festival: {
      cs: 'Festival', en: 'Festival', de: 'Festival', sk: 'Festival', pl: 'Festiwal', hu: 'Fesztivál'
    },
    theatre: {
      cs: 'Divadlo', en: 'Theatre', de: 'Theater', sk: 'Divadlo', pl: 'Teatr', hu: 'Színház'
    },
    review: {
      cs: 'Recenze', en: 'Review', de: 'Rezension', sk: 'Recenzia', pl: 'Recenzja', hu: 'Értékelés'
    }
  };
  const category = (categories[article.category] && categories[article.category][lang]) || article.category;

  container.innerHTML = `
    <h1 class="blog-title">${title}</h1>
    <div class="blog-meta">
      <span class="blog-date">${date}</span> ·
      <span class="blog-category">${category}</span>
    </div>
    <div class="blog-lead">${lead}</div>
    <img class="blog-image" src="${article.image}" alt="${title}">
    <div class="blog-content">${content}</div>
  `;

  // Zpětný překlad tlačítka zpět
  if (document.querySelector('[data-i18n-key="blog-back"]')) {
    const backKeys = {
      cs: '← Zpět na blog',
      en: '← Back to blog',
      de: '← Zurück zum Blog',
      sk: '← Späť na blog',
      pl: '← Wróć do bloga',
      hu: '← Vissza a bloghoz'
    };
    document.querySelector('[data-i18n-key="blog-back"]').textContent = backKeys[lang] || backKeys['cs'];
  }
}

// Volání při načtení stránky
document.addEventListener('DOMContentLoaded', renderArticle);
