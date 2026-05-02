// /src/mg-related.js
// AJSEE – related micro-guides renderer

export async function renderRelatedMicroguides({ slug, language, container, max = 3 }) {
  if (!container) return;

  const lang = normalizeLang(language || document.documentElement.getAttribute('lang') || 'cs');

  const i18n = window.i18n ? window.i18n(lang) : (key) => key;

  const t = (key, fallback) => {
    try {
      const value = i18n(key);
      return !value || value === key ? fallback : value;
    } catch {
      return fallback;
    }
  };

  const readMore = t('blog-read-more', fallbackReadMore(lang));
  const relatedTitle = t('mg.relatedTitle', fallbackRelatedTitle(lang));

  const index = await loadIndex();

  const candidates = index
    .filter((item) => item && (!item.status || item.status === 'published'))
    .filter((item) => item.slug && item.slug !== slug)
    .slice(0, 24);

  async function loadLocalized(candidateSlug) {
    const urls = [
      `/content/microguides/${candidateSlug}.${lang}.json`,
      `/content/microguides/${candidateSlug}.en.json`,
      `/content/microguides/${candidateSlug}.cs.json`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });

        if (response.ok) {
          return await response.json();
        }
      } catch {
        /* try next */
      }
    }

    return null;
  }

  const chosen = [];

  for (const item of candidates) {
    if (chosen.length >= max) break;

    const data = await loadLocalized(item.slug);
    if (!data) continue;

    chosen.push({
      slug: item.slug,
      title: data.title || item.title || item.slug,
      summary: data.summary || item.summary || '',
      cover: data.cover || item.cover || '',
      coverAlt: data.coverAlt || item.coverAlt || '',
    });
  }

  if (!chosen.length) {
    container.remove();
    return;
  }

  container.className = 'mg-related';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-labelledby', 'mg-related-title');

  const grid = document.createElement('div');
  grid.className = 'mg-related__grid';

  const withLang = (candidateSlug) =>
  `/microguides/${encodeURIComponent(candidateSlug)}?lang=${encodeURIComponent(lang)}`;

  chosen.forEach((card) => {
    const link = document.createElement('a');
    link.className = 'mg-card';
    link.href = withLang(card.slug);
    link.setAttribute('aria-label', card.title);

    link.addEventListener('click', () => {
      const eventData = {
        event: 'mg_related_open',
        from_slug: slug,
        to_slug: card.slug,
        language: lang,
      };

      if (window.dataLayer?.push) window.dataLayer.push(eventData);
      if (window.gtag) window.gtag('event', 'mg_related_open', eventData);
    });

    link.innerHTML = `
      <figure class="mg-card__media">
        ${card.cover ? `<img src="${escapeHtml(card.cover)}" alt="${escapeHtml(card.coverAlt || '')}" loading="lazy" decoding="async">` : ''}
      </figure>

      <div class="mg-card__body">
        <h3 class="mg-card__title">${escapeHtml(card.title)}</h3>
        ${card.summary ? `<p class="mg-card__sum">${escapeHtml(card.summary)}</p>` : ''}
        <span class="mg-card__cta">${escapeHtml(readMore)}</span>
      </div>
    `;

    grid.appendChild(link);
  });

  container.innerHTML = `
    <h2 id="mg-related-title" class="mg-related__title">${escapeHtml(relatedTitle)}</h2>
  `;

  container.appendChild(grid);
}

async function loadIndex() {
  try {
    const response = await fetch('/content/microguides/index.json', {
      cache: 'no-store',
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.guides)) return data.guides;
    if (Array.isArray(data.microguides)) return data.microguides;

    return [];
  } catch {
    return [];
  }
}

function normalizeLang(value) {
  let lang = String(value || 'cs').trim().toLowerCase().split(/[-_]/)[0];

  if (lang === 'cz') lang = 'cs';

  return ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(lang) ? lang : 'cs';
}

function fallbackReadMore(lang) {
  const map = {
    cs: 'Číst dál',
    en: 'Read more',
    de: 'Weiterlesen',
    sk: 'Čítať ďalej',
    pl: 'Czytaj dalej',
    hu: 'Tovább',
  };

  return map[lang] || map.en;
}

function fallbackRelatedTitle(lang) {
  const map = {
    cs: 'Související mikroprůvodce',
    en: 'Related micro-guides',
    de: 'Ähnliche Mikro-Guides',
    sk: 'Súvisiaci mikro-sprievodcovia',
    pl: 'Powiązane mikroprzewodniki',
    hu: 'Kapcsolódó mini útmutatók',
  };

  return map[lang] || map.en;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
