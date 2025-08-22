// src/blog-mg-list.js
(async () => {
  const grid = document.querySelector('.blog-cards');
  if (!grid) return;

  // --- Lang helpers --------------------------------------------------------
  const normalizeLang = (val) => {
    if (!val) return 'cs';
    let l = String(val).toLowerCase();
    l = l.split(/[-_]/)[0];     // "de-DE" -> "de"
    if (l === 'cz') l = 'cs';
    return l;
  };

  const urlLang = new URLSearchParams(location.search).get('lang');
  const htmlLang = document.documentElement.getAttribute('lang');
  const lang = normalizeLang(urlLang || htmlLang || 'cs');

  // Lokální překlady (badge + tlačítko)
  const dict = {
    badge: {
      cs: 'Mikroprůvodce',
      en: 'Micro-guide',
      de: 'Mikro-Guide',
      sk: 'Mikro-sprievodca',
      pl: 'Mikroprzewodnik',
      hu: 'Mini útmutató'
    },
    readMore: {
      cs: 'Číst dál',
      en: 'Read more',
      de: 'Weiterlesen',
      sk: 'Čítať ďalej',
      pl: 'Czytaj dalej',
      hu: 'Tovább'
    }
  };
  const t = (key) => (dict[key]?.[lang]) || dict[key]?.en || dict[key]?.cs || '';

  // --- Data fetch ----------------------------------------------------------
  const fetchJSON = async (path) => {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  };

  // Načti index micro-guidů
  let list = [];
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    if (r.ok) list = await r.json();
  } catch { /* no-op */ }
  if (!Array.isArray(list) || !list.length) return;

  const placeholder = '/images/microguides/_placeholder.webp';

  // Pomůcka pro cover
  const pickCover = (item) => {
    if (item.cover && item.cover.trim()) return item.cover;
    return `/images/microguides/${item.slug}/cover.webp`;
  };

  // Načti lokalizovaný JSON s fallbackem lang -> en -> cs
  async function loadLocalized(slug) {
    const candidates = Array.from(new Set([normalizeLang(lang), 'en', 'cs']));
    for (const l of candidates) {
      try {
        return await fetchJSON(`/content/microguides/${slug}.${l}.json`);
      } catch { /* try next */ }
    }
    return null;
  }

  // --- Render --------------------------------------------------------------
  const published = list.filter((x) => x.status === 'published');
  const fragment = document.createDocumentFragment();

  for (const item of published) {
    const localized = await loadLocalized(item.slug);
    const title = (localized && localized.title) || item.title || '';
    const summary = (localized && localized.summary) || item.summary || '';

    // Použijeme explicitní index.html (funguje v dev i na hostingu se statickým indexem)
    const href = `/microguides/index.html?slug=${encodeURIComponent(item.slug)}&lang=${encodeURIComponent(lang)}`;

    const el = document.createElement('article');
    el.className = 'blog-card is-microguide';
    el.dataset.category = 'microguide';
    el.dataset.type = 'microguide'; // aby blog.js věděl, že je nemá mazat

    el.innerHTML = `
      <a class="card-link" href="${href}" data-no-intercept="1">
        <div class="card-media">
          <img class="card-img-cover" alt="" loading="lazy" width="640" height="360" />
          <span class="card-badge">${t('badge')}</span>
        </div>
        <div class="blog-card-body">
          <h3 class="blog-card-title">${title}</h3>
          <div class="blog-card-lead">${summary || ''}</div>
          <div class="blog-card-actions">
            <span class="blog-readmore" aria-hidden="true">${t('readMore')}</span>
          </div>
        </div>
      </a>
    `;

    // 1) Obrázek + fallback
    const img = el.querySelector('img');
    img.onerror = () => { img.src = placeholder; el.classList.add('has-placeholder'); };
    img.src = pickCover(item);

    // 2) **Klik štít** – zastavíme propagaci v capture fázi,
    //    aby delegované handlery z blogu nezměnily cílovou URL na "/".
    const link = el.querySelector('a.card-link');
    if (link) {
      const stop = (ev) => ev.stopPropagation();
      ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(type => {
        link.addEventListener(type, stop, true); // capture phase
      });
      // pro jistotu i na samotný target ještě 'stopImmediatePropagation'
      link.addEventListener('click', (ev) => ev.stopImmediatePropagation());
    }

    fragment.appendChild(el);
  }

  grid.appendChild(fragment);
})();
link.addEventListener('click', () => {
  if (window.gtag) window.gtag('event', 'mg_card_click', { slug: item.slug, location: 'blog_list' });
});
