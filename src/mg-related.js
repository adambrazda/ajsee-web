// /src/mg-related.js
export async function renderRelatedMicroguides({ slug, language, container, max = 3 }) {
  if (!container) return;

  // i18n helper
  const i18n = window.i18n ? window.i18n(language) : (k) => k;
  const t = (key, fallback) => {
    try { const v = i18n(key); return !v || v === key ? fallback : v; } catch { return fallback; }
  };
  const readMore = t('blog-read-more', 'Read more');
  const relatedTitle = t('mg.relatedTitle', 'Related micro-guides');

  // načti index mikro-průvodců
  let index = [];
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    index = r.ok ? await r.json() : [];
  } catch { /* noop */ }

  // vyber kandidáty: publikované, bez aktuálního slugu
  const candidates = index.filter(it => it && it.status === 'published' && it.slug !== slug).slice(0, 24);

  // helper: načíst lokalizaci konkrétního průvodce s fallbackem lang -> en -> cs
  async function loadLocalized(sl) {
    const urls = [
      `/content/microguides/${sl}.${language}.json`,
      `/content/microguides/${sl}.en.json`,
      `/content/microguides/${sl}.cs.json`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch { /* try next */ }
    }
    return null;
  }

  // získej detail max N kusů
  const chosen = [];
  for (const it of candidates) {
    if (chosen.length >= max) break;
    const data = await loadLocalized(it.slug);
    if (!data) continue;
    chosen.push({
      slug: it.slug,
      title: data.title || it.title || it.slug,
      summary: data.summary || '',
      cover: data.cover || it.cover || '',
      coverAlt: data.coverAlt || '',
    });
  }
  if (!chosen.length) { container.remove(); return; }

  // mount
  container.className = 'mg-related';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-labelledby', 'mg-related-title');

  const grid = document.createElement('div');
  grid.className = 'mg-related__grid';

  // util: link s jazykem
  const withLang = (sl) => `/microguides/?slug=${encodeURIComponent(sl)}&lang=${encodeURIComponent(language)}`;

  chosen.forEach(card => {
    const a = document.createElement('a');
    a.className = 'mg-card';
    a.href = withLang(card.slug);
    a.setAttribute('aria-label', `${card.title}`);

    // analytics (volitelné)
    a.addEventListener('click', () => {
      const evt = { event: 'mg_related_open', from_slug: slug, to_slug: card.slug, language };
      if (window.dataLayer?.push) window.dataLayer.push(evt);
      if (window.gtag) window.gtag('event', 'mg_related_open', evt);
    });

    a.innerHTML = `
      <figure class="mg-card__media">
        ${card.cover ? `<img src="${card.cover}" alt="${escapeHtml(card.coverAlt || '')}" loading="lazy">` : ''}
      </figure>
      <div class="mg-card__body">
        <h3 class="mg-card__title">${escapeHtml(card.title)}</h3>
        ${card.summary ? `<p class="mg-card__sum">${escapeHtml(card.summary)}</p>` : ``}
        <span class="mg-card__cta">${readMore}</span>
      </div>
    `;
    grid.appendChild(a);
  });

  container.innerHTML = `
    <h2 id="mg-related-title" class="mg-related__title">${relatedTitle}</h2>
  `;
  container.appendChild(grid);

  // --- helpers ---
  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
