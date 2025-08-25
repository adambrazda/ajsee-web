// src/blog-mg-list.js
// Pozn.: Tento skript NERENDERUJE nic na /blog stránce.
// Karty blogu se tam komplet skládají v blog.js (vč. micro-guidů).
// Tohle ponecháváme jen pro legacy kontejnery na domovské stránce
// typu `.homepage-blog-cards` nebo `#homepage-blog-list`.

(async () => {
  // --- Kontext: blog stránka? Pak neběžíme, ať se nic nezdvojuje ---
  const isBlogPage =
    /\/blog(\.html)?$/i.test(location.pathname) ||
    !!document.querySelector('main#blog') ||
    !!document.querySelector('.blog-filters');

  if (isBlogPage) return;

  // Renderujeme jen v legacy kontejnerech pro homepage / jiných stránkách
  const grid = document.querySelector('.homepage-blog-cards, #homepage-blog-list');
  if (!grid) return;

  // --- Lang helpers --------------------------------------------------------
  const normalizeLang = (val) => {
    if (!val) return 'cs';
    let l = String(val).toLowerCase().split(/[-_]/)[0];
    if (l === 'cz') l = 'cs';
    return l;
  };
  const urlLang  = new URLSearchParams(location.search).get('lang');
  const htmlLang = document.documentElement.getAttribute('lang');
  const lang     = normalizeLang(urlLang || htmlLang || 'cs');

  // Lokální texty
  const dict = {
    badge:    { cs: 'Mikroprůvodce', en: 'Micro-guide', de: 'Mikro-Guide', sk: 'Mikro-sprievodca', pl: 'Mikroprzewodnik', hu: 'Mini útmutató' },
    readMore: { cs: 'Číst dál',      en: 'Read more',   de: 'Weiterlesen',  sk: 'Čítať ďalej',      pl: 'Czytaj dalej',   hu: 'Tovább' }
  };
  const t = (k) => (dict[k]?.[lang]) || dict[k]?.en || dict[k]?.cs || '';

  // --- Data: index micro-guidů (už připravený build-mg.mjs) ---------------
  let items = [];
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    if (r.ok) items = await r.json();
  } catch {
    items = [];
  }
  if (!Array.isArray(items) || !items.length) return;

  // Jazyk + publikované + deduplikace podle slugu
  const seen = new Set();
  const list = items
    .filter(it => (it.language || 'cs').toLowerCase() === lang)
    .filter(it => it.status === 'published')
    .filter(it => (seen.has(it.slug) ? false : seen.add(it.slug)));

  if (!list.length) return;

  // --- Render --------------------------------------------------------------
  // Než přidáme, smažeme případné staré micro-guide karty v gridu
  grid.querySelectorAll('.blog-card[data-type="microguide"], .blog-card.is-microguide')
     .forEach(n => n.remove());

  const placeholder = '/images/microguides/_placeholder.webp';
  const mgHref = (slug) => `/microguides/?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(lang)}`;
  const pickCover = (item) =>
    (item.cover && item.cover.trim()) ? item.cover : `/images/microguides/${item.slug}/cover.webp`;

  const frag = document.createDocumentFragment();

  for (const it of list) {
    const el = document.createElement('article');
    el.className = 'blog-card is-microguide';
    el.dataset.type = 'microguide';
    el.dataset.slug = it.slug;

    el.innerHTML = `
      <a class="card-link" href="${mgHref(it.slug)}" data-mg-link="true">
        ${pickCover(it) ? `
          <div class="card-media">
            <img class="card-img-cover" alt="" loading="lazy" width="640" height="360" />
            <span class="card-badge">${t('badge')}</span>
          </div>` : ''
        }
        <div class="blog-card-body">
          <h3 class="blog-card-title">${it.title || ''}</h3>
          <div class="blog-card-lead">${it.summary || ''}</div>
          <div class="blog-card-actions"><span class="blog-readmore">${t('readMore')}</span></div>
        </div>
      </a>
    `;

    const img = el.querySelector('img');
    if (img) {
      img.onerror = () => { img.src = placeholder; el.classList.add('has-placeholder'); };
      img.src = pickCover(it);
    }

    // Pojistka proti globálním preventDefault na kartách
    const link = el.querySelector('a.card-link');
    link?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      window.location.assign(link.href);
    }, { capture: true });

    frag.appendChild(el);
  }

  grid.appendChild(frag);
})();
