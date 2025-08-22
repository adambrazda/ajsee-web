// --- helpers ---------------------------------------------------------------
const urlLang = new URLSearchParams(location.search).get('lang');
const lang = (urlLang || document.documentElement.getAttribute('lang') || 'cs')
  .toLowerCase().split(/[-_]/)[0];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function gEvent(action, extra = {}) {
  if (window.gtag) gtag('event', action, { language: lang, ...extra });
}

function currentSlug() {
  const u = new URL(location.href);
  const q = (u.searchParams.get('slug') || '').trim();
  if (q) return decodeURIComponent(q);
  const parts = u.pathname.replace(/\/+$/, '').split('/');
  if (parts[1] === 'microguides' && parts[2]) return decodeURIComponent(parts[2]);
  return '';
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function loadGuide(slug, langCode) {
  const primary  = `/content/microguides/${slug}.${langCode}.json`;
  const fallbacks = [
    `/content/microguides/${slug}.en.json`,
    `/content/microguides/${slug}.cs.json`,
  ];
  try { return await fetchJson(primary); }
  catch {
    for (const f of fallbacks) {
      try { return await fetchJson(f); } catch {}
    }
    return null;
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mdToHtml(md = '') {
  const e = escapeHtml(md.trim());
  return e
    .replace(/^### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<h\d|<ul|<p|<\/p>)(.+)$/gm, '<p>$1</p>');
}

function withLang(url) {
  try {
    const u = new URL(url, location.origin);
    u.searchParams.set('lang', lang);
    return u.pathname + u.search + u.hash;
  } catch { return url; }
}

const prefersReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
};

function openPopup(url, w = 620, h = 540) {
  const y = window.top.outerHeight / 2 + window.top.screenY - ( h / 2);
  const x = window.top.outerWidth  / 2 + window.top.screenX - ( w / 2);
  return window.open(url, '_blank', `width=${w},height=${h},left=${x},top=${y},noopener`);
}

// --- UI builders -----------------------------------------------------------
function renderSharePanel({title, summary}) {
  const url = location.href;
  const enc = encodeURIComponent;

  const xUrl  = `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;

  const el = document.createElement('div');
  el.className = 'mg-sharepanel';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Sdílet');

  el.innerHTML = `
    <button type="button" class="sp-btn sp-copy" aria-label="Kopírovat odkaz">
      <span>🔗</span><span class="sp-label">Kopírovat</span>
    </button>
    <a class="sp-btn sp-x"   href="${xUrl}"  target="_blank" rel="noopener" aria-label="Sdílet na X">
      <span>𝕏</span><span class="sp-label">X</span>
    </a>
    <a class="sp-btn sp-fb"  href="${fbUrl}" target="_blank" rel="noopener" aria-label="Sdílet na Facebook">
      <span>f</span><span class="sp-label">Facebook</span>
    </a>
  `;

  const copyBtn = el.querySelector('.sp-copy');
  copyBtn?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove();
      }
      copyBtn.classList.add('is-done');
      copyBtn.querySelector('.sp-label').textContent = 'Zkopírováno';
      setTimeout(()=>{ copyBtn.classList.remove('is-done'); copyBtn.querySelector('.sp-label').textContent = 'Kopírovat'; }, 1200);
      gEvent('mg_share_click', { channel: 'copy' });
    } catch {}
  });

  el.querySelector('.sp-x')?.addEventListener('click', () => gEvent('mg_share_click', { channel: 'x'  }));
  el.querySelector('.sp-fb')?.addEventListener('click', () => gEvent('mg_share_click', { channel: 'fb' }));

  return el;
}

function renderCta(linkHref) {
  const wrap = document.createElement('div');
  wrap.className = 'mg-cta';
  wrap.innerHTML = `
    <a class="ib-cta" href="${linkHref}" id="mgCta">Sleduj novinky</a>
  `;
  return wrap;
}

async function loadRelated(slug, category, lang) {
  // 1) ideálně blog, 2) fallback – jiné microguidy
  let blog = [];
  try {
    blog = await fetchJson('/content/blog/index.json');
  } catch {}

  if (Array.isArray(blog) && blog.length) {
    // prefer stejné kategorie; jinak cokoliv
    let rel = blog.filter(b => b.category === category && b.slug !== slug);
    if (rel.length < 3) {
      rel = [...rel, ...blog.filter(b => b.slug !== slug)]
        .filter((v, i, a) => a.findIndex(x => x.slug === v.slug) === i);
    }
    return rel.slice(0, 3).map(b => ({
      href: withLang(`/blog-detail?slug=${encodeURIComponent(b.slug)}`),
      title: b.title, cover: b.cover
    }));
  }

  // fallback – microguides
  try {
    const mg = await fetchJson('/content/microguides/index.json');
    let rel = mg.filter(x => x.slug !== slug && x.category === category);
    if (rel.length < 3) rel = [...rel, ...mg.filter(x => x.slug !== slug)];
    return rel.slice(0, 3).map(x => ({
      href: withLang(`/microguides/?slug=${encodeURIComponent(x.slug)}`),
      title: x.title || x.slug, cover: x.cover || `/images/microguides/${x.slug}/cover.webp`
    }));
  } catch { return []; }
}

function renderRelated(list) {
  if (!list.length) return '';
  return `
    <section class="mg-related" aria-label="Z blogu">
      <h3>Souvisí z blogu</h3>
      <ul class="mg-related-list">
        ${list.map(item => `
          <li class="mg-related-item">
            <a class="mg-related-link" href="${item.href}">
              <div class="mg-related-media">
                <img src="${item.cover}" alt="" loading="lazy">
              </div>
              <div class="mg-related-title">${escapeHtml(item.title)}</div>
            </a>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

// --- main render ------------------------------------------------------------
(async function init() {
  const slug = currentSlug();
  if (!slug) { location.href = withLang('/blog'); return; }

  const data = await loadGuide(slug, lang);
  if (!data) { location.href = withLang('/blog'); return; }

  // <head> meta / OG / LD
  document.title = `${data.title} – AJSEE`;
  const desc = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const ensureMeta = (sel, attr, val) => {
    let m = document.querySelector(sel);
    if (!m) { m = document.createElement('meta'); const [a, v] = sel.split('='); m.setAttribute(a, v.replace(/"/g,'')); document.head.appendChild(m); }
    m.setAttribute(attr, val);
  };
  ensureMeta('meta[name="description"]', 'content', desc);
  ensureMeta('meta[property="og:title"]', 'content', data.title);
  ensureMeta('meta[property="og:description"]', 'content', desc);
  ensureMeta('meta[property="og:image"]', 'content', data.cover || '');

  // canonical + alternates
  const canon = document.createElement('link');
  canon.rel = 'canonical';
  canon.href = location.origin + `/microguides/?slug=${encodeURIComponent(slug)}&lang=${lang}`;
  document.head.appendChild(canon);
  ['cs','en','de','sk','pl','hu'].forEach(hreflang=>{
    const ln = document.createElement('link');
    ln.rel = 'alternate';
    ln.hreflang = hreflang;
    ln.href = location.origin + `/microguides/?slug=${encodeURIComponent(slug)}&lang=${hreflang}`;
    document.head.appendChild(ln);
  });

  // JSON-LD Article
  const ld = {
    "@context":"https://schema.org",
    "@type":"Article",
    "headline": data.title,
    "description": desc,
    "image": data.cover || undefined,
    "inLanguage": lang,
    "author": { "@type":"Organization", "name":"AJSEE" },
    "publisher": { "@type":"Organization", "name":"AJSEE" },
    "datePublished": new Date().toISOString()
  };
  const ldS = document.createElement('script');
  ldS.type = 'application/ld+json'; ldS.textContent = JSON.stringify(ld);
  document.head.appendChild(ldS);

  // skeleton
  const root = $('#mgRoot');
  if (!root) return;

  const heroMedia = `
    <figure class="mg-hero-media"${data.cover ? '':' hidden'}>
      ${data.cover ? `<img src="${data.cover}" alt="${escapeHtml(data.coverAlt || '')}" width="1280" height="720" loading="eager">` : ''}
    </figure>`;

  // CTA A/B – varianta A (nad foldem) vs B (ve footeru)
  const stored = localStorage.getItem('mg_cta_variant');
  const variant = stored === 'A' || stored === 'B' ? stored : (Math.random() < 0.5 ? 'A' : 'B');
  localStorage.setItem('mg_cta_variant', variant);
  gEvent('mg_ab_assign', { experiment: 'cta_position', variant });

  root.innerHTML = `
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${withLang('/blog')}" data-i18n="mg.backToBlog">Zpět na blog</a>
      <span aria-hidden="true">/</span>
      <span data-i18n="mg.breadcrumb">AJSEE vysvětluje</span>
    </nav>

    <article class="mg-article" itemscope itemtype="https://schema.org/Article">
      <header class="mg-hero">
        <div class="mg-hero-text">
          <p class="mg-kicker">AJSEE vysvětluje</p>
          <h1 class="mg-title" itemprop="headline">${escapeHtml(data.title)}</h1>
          <p class="mg-meta"><span>${Number(data.readingMinutes || 5)} min čtení</span></p>
          <div class="mg-sharepanel-slot"></div>
          <div class="mg-actions mg-cta-slot ${variant === 'A' ? '' : 'is-hidden'}"></div>
        </div>
        ${heroMedia}
      </header>

      <aside class="mg-progress" aria-label="Postup průvodcem">
        <ol>${(data.steps || []).map(s => `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.heading)}</a></li>`).join('')}</ol>
      </aside>

      <div class="mg-content">
        ${(data.steps || []).map(s => `
          <section id="${escapeHtml(s.id)}" class="mg-section" aria-labelledby="${escapeHtml(s.id)}-title">
            <h2 id="${escapeHtml(s.id)}-title">${escapeHtml(s.heading)}</h2>
            ${mdToHtml(s.body || '')}
            ${s.image ? `
              <figure class="mg-figure">
                <div class="mg-media-frame">
                  <img src="${s.image}" alt="${escapeHtml(s.alt || '')}" loading="lazy">
                </div>
              </figure>` : ``}
          </section>
        `).join('')}

        <footer class="mg-footer-cta ${variant === 'B' ? '' : 'is-hidden'}">
          ${data.ctaQuestion ? `<p>${escapeHtml(data.ctaQuestion)}</p>` : ``}
          <div class="mg-cta-slot"></div>
        </footer>
      </div>

      <nav class="mg-mobile-nav" aria-label="Micro-guide navigation">
        <button class="mg-prev">Předchozí</button>
        <div class="mg-dots"></div>
        <button class="mg-next">Další</button>
      </nav>
    </article>
  `;
  root.hidden = false;

  // Share panel
  $('.mg-sharepanel-slot')?.appendChild(
    renderSharePanel({ title: data.title, summary: data.summary })
  );

  // CTA (A/B) – render a vlož
  const ctaEl = renderCta(withLang('/coming-soon'));
  $('.mg-cta-slot')?.appendChild(ctaEl);

  // CTA – view/click měření
  const cta = $('#mgCta');
  if (cta) {
    const ioCta = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (e.isIntersecting) {
          gEvent('mg_cta_view', { variant });
          ioCta.disconnect();
        }
      });
    }, { rootMargin: '0px 0px -30% 0px', threshold: 0.01 });
    ioCta.observe(cta);
    cta.addEventListener('click', () => gEvent('mg_cta_click', { variant }));
  }

  // progress highlight
  const links = $$('.mg-progress a');
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  let lastSentId = null;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        map.forEach(a => a.removeAttribute('aria-current'));
        map.get(id)?.setAttribute('aria-current', 'true');
        if (lastSentId !== id) {
          lastSentId = id;
          gEvent('mg_step_view', { step_id: id, slug: data.slug });
        }
      }
    });
  }, { rootMargin: '-40% 0% -55% 0%', threshold: 0.01 });

  $$('.mg-section').forEach(sec => io.observe(sec));

  // progress clicks
  links.forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const id = a.getAttribute('href').slice(1);
      history.replaceState(null, '', `#${id}`);
      scrollToId(id);
    });
  });

  // mobile nav + dots (lepší ARIA)
  const sections = $$('.mg-section');
  const ids = sections.map(s => s.id);
  const prevBtn = $('.mg-prev');
  const nextBtn = $('.mg-next');
  const dots = $('.mg-dots');

  ids.forEach((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mg-dot';
    const heading = sections[i]?.querySelector('h2')?.textContent?.trim() || `Krok ${i+1}`;
    b.setAttribute('aria-label', `Přejít na: ${heading}`);
    b.addEventListener('click', () => scrollToId(id));
    dots.appendChild(b);
  });

  const activeIndex = () => {
    let idx = 0;
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top < innerHeight * 0.45) idx = i;
    });
    return idx;
  };

  const updateNav = () => {
    const i = activeIndex();
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.disabled = i === ids.length - 1;
    $$('.mg-dot', dots).forEach((d, di) => d.toggleAttribute('data-active', di === i));
  };

  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  prevBtn?.addEventListener('click', () => {
    const i = activeIndex();
    if (i > 0) scrollToId(ids[i - 1]);
    gEvent('mg_nav_prev', { from_step: ids[i], slug: data.slug });
  });

  nextBtn?.addEventListener('click', () => {
    const i = activeIndex();
    if (i < ids.length - 1) scrollToId(ids[i + 1]);
    gEvent('mg_nav_next', { from_step: ids[i], slug: data.slug });
  });

  // Deep-link posun (když přijdu s #id)
  if (location.hash) {
    const id = location.hash.slice(1);
    setTimeout(() => scrollToId(id), 80);
  }

  // Related (blog/microguides)
  try {
    const related = await loadRelated(slug, data.category, lang);
    if (related.length) {
      const host = document.createElement('div');
      host.innerHTML = renderRelated(related);
      $('.mg-content')?.appendChild(host.firstElementChild);
    }
  } catch {}

})();
