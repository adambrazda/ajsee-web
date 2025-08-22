// src/blog-mg-list.js
(async () => {
  const grid = document.querySelector('.blog-cards, .homepage-blog-cards, #homepage-blog-list');
  if (!grid) return;

  // --- Lang helpers --------------------------------------------------------
  const normalizeLang = (val) => {
    if (!val) return 'cs';
    let l = String(val).toLowerCase().split(/[-_]/)[0];
    if (l === 'cz') l = 'cs';
    return l;
  };
  const urlLang = new URLSearchParams(location.search).get('lang');
  const htmlLang = document.documentElement.getAttribute('lang');
  const lang = normalizeLang(urlLang || htmlLang || 'cs');

  // Lokální texty
  const dict = {
    badge: { cs:'Mikroprůvodce', en:'Micro-guide', de:'Mikro-Guide', sk:'Mikro-sprievodca', pl:'Mikroprzewodnik', hu:'Mini útmutató' },
    readMore: { cs:'Číst dál', en:'Read more', de:'Weiterlesen', sk:'Čítať ďalej', pl:'Czytaj dalej', hu:'Tovább' }
  };
  const t = (k) => (dict[k]?.[lang]) || dict[k]?.en || dict[k]?.cs || '';

  // --- fetch helpers -------------------------------------------------------
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
  } catch {}
  if (!Array.isArray(list) || !list.length) return;

  const placeholder = '/images/microguides/_placeholder.webp';

  // absolutní, robustní URL (funguje i bez clean-URL přepisů)
  const mgHref = (slug) => `/microguides/?slug=${encodeURIComponent(slug)}&lang=${lang}`;

  const pickCover = (item) => {
    if (item.cover && item.cover.trim()) return item.cover;
    return `/images/microguides/${item.slug}/cover.webp`;
  };

  // fallback lang: aktuální -> en -> cs
  async function loadLocalized(slug) {
    const candidates = Array.from(new Set([normalizeLang(lang), 'en', 'cs']));
    for (const l of candidates) {
      try { return await fetchJSON(`/content/microguides/${slug}.${l}.json`); }
      catch {}
    }
    return null;
  }

  // --- render --------------------------------------------------------------
  const published = list.filter(x => x.status === 'published');
  const fragment = document.createDocumentFragment();

  for (const item of published) {
    const localized = await loadLocalized(item.slug);
    const title = (localized && localized.title) || item.title || '';
    const summary = (localized && localized.summary) || item.summary || '';
    const href = mgHref(item.slug);

    const el = document.createElement('article');
    el.className = 'blog-card is-microguide';
    el.dataset.category = 'microguide';
    el.dataset.type = 'microguide';

    el.innerHTML = `
      <a class="card-link" href="${href}" data-mg-link="true">
        <div class="card-media">
          <img class="card-img-cover" alt="" loading="lazy" width="640" height="360" />
          <span class="card-badge">${t('badge')}</span>
        </div>
        <div class="blog-card-body">
          <h3 class="blog-card-title">${title}</h3>
          <div class="blog-card-lead">${summary || ''}</div>
          <div class="blog-card-actions">
            <span class="blog-readmore">${t('readMore')}</span>
          </div>
        </div>
      </a>
    `;

    const img = el.querySelector('img');
    img.onerror = () => { img.src = placeholder; el.classList.add('has-placeholder'); };
    img.src = pickCover(item);

    // 💡 Přinutit navigaci i když globální script přepíše kliky na kartách:
    const link = el.querySelector('a.card-link');
    link.addEventListener('click', (ev) => {
      // některé bundly dělají preventDefault na blog kartách – tady to zastavíme
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      window.location.assign(link.href);
    }, { capture: true });

    fragment.appendChild(el);
  }

  grid.appendChild(fragment);
})();
