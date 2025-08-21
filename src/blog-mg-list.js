// src/blog-mg-list.js
(async () => {
  const grid = document.querySelector('.blog-cards');
  if (!grid) return;

  // --- Lang helpers --------------------------------------------------------
  const normalizeLang = (val) => {
    if (!val) return 'cs';
    let l = String(val).toLowerCase();
    l = l.split(/[-_]/)[0];     // "de-DE" -> "de"
    if (l === 'cz') l = 'cs';   // občas se používá "cz"
    return l;
  };

  const urlLang  = new URLSearchParams(location.search).get('lang');
  const htmlLang = document.documentElement.getAttribute('lang');
  const lang     = normalizeLang(urlLang || htmlLang || 'cs');

  // --- Načtení i18n slovníků ----------------------------------------------
  // Pozn.: JSONy máš ve /src/locales/<lang>.json (stejně jako i18n.js)
  const LOCALES_DIR = '/src/locales';

  const fetchJSON = async (path) => {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  };

  // pořadí fallbacků pro texty
  const langCandidates = Array.from(new Set([lang, 'en', 'cs']));
  const dictionaries = {};

  for (const l of langCandidates) {
    try {
      dictionaries[l] = await fetchJSON(`${LOCALES_DIR}/${l}.json`);
    } catch {
      dictionaries[l] = null;
    }
  }

  // bezpečné čtení hodnoty podle "a.b.c"
  const pick = (obj, path) =>
    path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

  // překladač s fallbackem přes kandidátní jazyky
  const tr = (key, fallback = '') => {
    for (const l of langCandidates) {
      const d = dictionaries[l];
      if (!d) continue;
      const v = pick(d, key);
      if (typeof v === 'string' && v.trim()) return v;
    }
    return fallback;
  };

  // --- Data micro-guidů ----------------------------------------------------
  let list = [];
  try {
    const r = await fetch('/content/microguides/index.json', { cache: 'no-store' });
    if (r.ok) list = await r.json();
  } catch { /* ignore */ }
  if (!Array.isArray(list) || !list.length) return;

  // Obrázky
  const placeholder = '/images/microguides/_placeholder.webp';
  const pickCover = (item) =>
    (item.cover && item.cover.trim())
      ? item.cover
      : `/images/microguides/${item.slug}/cover.webp`;

  // Texty badge a tlačítka z i18n (s rozumnými defaulty)
  const badgeLabel   = tr('mg.card.badge', 'Mikroprůvodce');
  const readMoreText = tr('blog-read-more', 'Číst dál');

  // --- Render --------------------------------------------------------------
  const published = list.filter((x) => x.status === 'published');
  const fragment = document.createDocumentFragment();

  for (const item of published) {
    // Titul a perex z i18n podle slug
    const title   = tr(`mg.guides.${item.slug}.title`,   item.title || '');
    const summary = tr(`mg.guides.${item.slug}.summary`, item.summary || '');

    const href = `/microguides/index.html?slug=${encodeURIComponent(item.slug)}&lang=${lang}`;

    const el = document.createElement('article');
    el.className = 'blog-card is-microguide';
    el.dataset.category = 'microguide';
    el.dataset.type = 'microguide';

    el.innerHTML = `
      <a class="card-link" href="${href}">
        <div class="card-media">
          <img class="card-img-cover" alt="" loading="lazy" width="640" height="360" />
          <span class="card-badge">${badgeLabel}</span>
        </div>
        <div class="blog-card-body">
          <h3 class="blog-card-title">${title}</h3>
          <div class="blog-card-lead">${summary || ''}</div>
          <div class="blog-card-actions">
            <span class="blog-readmore">${readMoreText}</span>
          </div>
        </div>
      </a>
    `;

    const img = el.querySelector('img');
    img.onerror = () => { img.src = placeholder; el.classList.add('has-placeholder'); };
    img.src = pickCover(item);

    fragment.appendChild(el);
  }

  grid.appendChild(fragment);
})();
