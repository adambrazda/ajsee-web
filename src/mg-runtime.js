// --- helpers ---
const urlLang = new URLSearchParams(location.search).get('lang');
const lang = (urlLang || document.documentElement.getAttribute('lang') || 'cs').toLowerCase();

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function dlEvent(action, extra = {}) {
  // Google Tag Manager dataLayer
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: action, language: lang, ...extra });
  } catch {}
}

function gEvent(action, extra = {}) {
  // GA4 (gtag) + dataLayer
  try { if (window.gtag) gtag('event', action, { language: lang, ...extra }); } catch {}
  dlEvent(action, extra);
}

// Dev i prod: 1) ?slug=..., 2) /microguides/{slug}
function currentSlug() {
  const u = new URL(location.href);
  const q = (u.searchParams.get('slug') || '').trim();
  if (q) return decodeURIComponent(q);
  const parts = u.pathname.replace(/\/+$/, '').split('/');
  if (parts[1] === 'microguides' && parts[2]) return decodeURIComponent(parts[2]);
  return '';
}

async function loadGuide(slug, langCode) {
  const primary  = `/content/microguides/${slug}.${langCode}.json`;
  const fallback = `/content/microguides/${slug}.cs.json`;

  const fetchJson = async (url) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };

  try { return await fetchJson(primary); }
  catch {
    try { return await fetchJson(fallback); }
    catch { return null; }
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mdToHtml(md = '') {
  // velmi lehký, bezpečný převod – nejdřív escape, pak základní markdown
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
  } catch {
    return url;
  }
}

const prefersReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
};

// --- render ---
(async function init() {
  const slug = currentSlug();
  if (!slug) { location.href = withLang('/blog.html'); return; }

  const data = await loadGuide(slug, lang);
  if (!data) { location.href = withLang('/blog.html'); return; }

  // <head> doplnit titulek/OG (runtime – OK pro sdílení)
  document.title = `${data.title} – AJSEE`;
  const desc = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const setMeta = (p, c) => {
    let m = document.querySelector(`meta[${p}]`);
    if (!m) {
      m = document.createElement('meta');
      const [attr, val] = p.split('=');
      m.setAttribute(attr, val.replace(/"/g, ''));
      document.head.appendChild(m);
    }
    m.setAttribute('content', c);
  };
  setMeta('name="description"', desc);
  setMeta('property="og:title"', data.title);
  setMeta('property="og:description"', desc);
  setMeta('property="og:image"', data.cover || '');

  // skeleton DOM
  const root = $('#mgRoot');
  if (!root) return;

  const coverImgTag = data.cover
    ? `<img src="${data.cover}"
            alt="${escapeHtml(data.coverAlt || '')}"
            width="1280" height="720"
            loading="eager" decoding="async" fetchpriority="high"
            sizes="(max-width: 860px) 100vw, 980px">`
    : '';

  const heroMedia = `
    <figure class="mg-hero-media">
      ${coverImgTag}
    </figure>`;

  root.innerHTML = `
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${withLang('/blog.html')}" data-i18n="mg.backToBlog">Zpět na blog</a>
      <span aria-hidden="true">/</span>
      <span data-i18n="mg.breadcrumb">AJSEE vysvětluje</span>
    </nav>

    <article class="mg-article" itemscope itemtype="https://schema.org/Article">
      <header class="mg-hero">
        <div class="mg-hero-text">
          <p class="mg-kicker">AJSEE vysvětluje</p>
          <h1 class="mg-title" itemprop="headline">${escapeHtml(data.title)}</h1>
          <p class="mg-meta"><span>${Number(data.readingMinutes || 5)} min čtení</span></p>
          <div class="mg-actions">
            <button class="btn-share" type="button" data-label="Sdílet" data-copied="Zkopírováno">Sdílet</button>
          </div>
        </div>
        ${heroMedia}
      </header>

      <aside class="mg-progress" aria-label="Postup průvodcem">
        <ol>${(data.steps || [])
          .map((s, i) => `<li><a href="#${escapeHtml(s.id)}"${i === 0 ? ' aria-current="true"' : ''}>${escapeHtml(s.heading)}</a></li>`)
          .join('')}
        </ol>
      </aside>

      <div class="mg-content">
        ${(data.steps || []).map(s => `
          <section id="${escapeHtml(s.id)}" class="mg-section" aria-labelledby="${escapeHtml(s.id)}-title">
            <h2 id="${escapeHtml(s.id)}-title">${escapeHtml(s.heading)}</h2>
            ${mdToHtml(s.body || '')}
            ${s.image ? `
              <figure class="mg-figure">
                <div class="mg-media-frame">
                  <img src="${s.image}"
                       alt="${escapeHtml(s.alt || '')}"
                       loading="lazy" decoding="async" fetchpriority="low"
                       width="640" height="480"
                       sizes="(max-width: 860px) 100vw, 38vw">
                </div>
              </figure>` : ``}
          </section>
        `).join('')}

        <footer class="mg-footer-cta">
          ${data.ctaQuestion ? `<p>${escapeHtml(data.ctaQuestion)}</p>` : ``}
          <a class="ib-cta" href="${withLang('/coming-soon')}">Chci na čekací listinu</a>
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

  // pokud je v URL hash, po renderu na něj sjeď
  if (location.hash) {
    const id = location.hash.slice(1);
    requestAnimationFrame(() => setTimeout(() => scrollToId(id), 50));
  }

  // progress highlight (throttle duplicit)
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

  // progress clicks (smooth scroll & keep hash)
  links.forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const id = a.getAttribute('href').slice(1);
      history.replaceState(null, '', `#${id}`);
      scrollToId(id);
    });
  });

  // mobile nav + dots
  const sections = $$('.mg-section');
  const ids = sections.map(s => s.id);
  const prevBtn = $('.mg-prev');
  const nextBtn = $('.mg-next');
  const dots = $('.mg-dots');

  ids.forEach((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mg-dot';
    b.setAttribute('aria-label', `Step ${i + 1}`);
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

  // share
  const shareBtn = $('.btn-share');
  shareBtn?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: data.title, text: data.summary, url: location.href });
      } else {
        await navigator.clipboard.writeText(location.href);
        const orig = shareBtn.textContent;
        shareBtn.textContent = shareBtn.dataset?.copied || 'Zkopírováno';
        setTimeout(() => { shareBtn.textContent = shareBtn.dataset?.label || orig || 'Sdílet'; }, 1200);
      }
      gEvent('mg_share', { slug: data.slug });
    } catch {}
  });
})();
