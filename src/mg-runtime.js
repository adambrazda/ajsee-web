import { renderSharePanel } from './mg-share.js';
import { renderRelatedMicroguides } from './mg-related.js';

// --- helpers ---
const urlLang = new URLSearchParams(location.search).get('lang');
const lang = (urlLang || document.documentElement.getAttribute('lang') || 'cs').toLowerCase();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function gEvent(action, extra = {}) {
  if (typeof window.dataLayer?.push === 'function') {
    window.dataLayer.push({ event: action, language: lang, ...extra });
  }
  if (typeof window.gtag === 'function') {
    gtag('event', action, { language: lang, ...extra });
  }
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

// Fallback pořadí: current → en → cs
async function loadGuide(slug, langCode) {
  const urls = [];
  const pushOnce = (p) => { if (!urls.includes(p)) urls.push(p); };

  pushOnce(`/content/microguides/${slug}.${langCode}.json`);
  if (langCode !== 'en') pushOnce(`/content/microguides/${slug}.en.json`);
  if (langCode !== 'cs') pushOnce(`/content/microguides/${slug}.cs.json`);

  const fetchJson = async (url) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };

  for (const url of urls) {
    try { return await fetchJson(url); } catch { /* try next */ }
  }
  return null;
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

// Bezpečné vytvoření/aktualizace <meta>
const cssEsc = (v) => {
  try { return (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/"/g, '\\"'); }
  catch { return String(v).replace(/"/g, '\\"'); }
};
function upsertMeta(attr, value, content) {
  let m = document.head.querySelector(`meta[${attr}="${cssEsc(value)}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute(attr, value);
    document.head.appendChild(m);
  }
  if (typeof content === 'string') m.setAttribute('content', content);
}

// --- render ---
(async function init() {
  const slug = currentSlug();
  if (!slug) { location.href = withLang('/blog.html'); return; }

  const data = await loadGuide(slug, lang);
  if (!data) { location.href = withLang('/blog.html'); return; }

  // <head> – titulek/OG
  const title = `${data.title} – AJSEE`;
  const desc = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  document.title = title;
  upsertMeta('name', 'description', desc);
  upsertMeta('property', 'og:title', data.title);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:image', data.cover || '');

  // skeleton DOM
  const root = $('#mgRoot');
  if (!root) return;

  const heroMedia = `
    <figure class="mg-hero-media">
      ${data.cover ? `<img src="${data.cover}" alt="${escapeHtml(data.coverAlt || '')}" width="1280" height="720" loading="eager">` : ''}
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
          <div class="mg-actions"></div>
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

  // --- SHARE (inline v hero actions, bez duplicit) ---
  const actionsEl = root.querySelector('.mg-actions');
  if (actionsEl) {
    actionsEl.textContent = '';
    renderSharePanel({
      slug: data.slug || slug,
      language: lang,
      title: data.title,
      container: actionsEl,
      variant: 'inline'
    });
  }

  // --- RELATED (pod content/footer CTA, před mobile nav) ---
  const relatedMount = document.createElement('section');
  relatedMount.id = 'mg-related';
  const mobileNav = root.querySelector('.mg-mobile-nav');
  const contentEl = root.querySelector('.mg-content');
  if (mobileNav) mobileNav.insertAdjacentElement('beforebegin', relatedMount);
  else if (contentEl) contentEl.insertAdjacentElement('afterend', relatedMount);
  renderRelatedMicroguides({
    slug: data.slug || slug,
    language: lang,
    container: relatedMount,
    max: 3
  });

  // --- progress highlight ---
  const links = $$('.mg-progress a', root);
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  let lastSentId = null;

  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const id = e.target.id;
            map.forEach(a => a.removeAttribute('aria-current'));
            map.get(id)?.setAttribute('aria-current', 'true');
            if (lastSentId !== id) {
              lastSentId = id;
              gEvent('mg_step_view', { step_id: id, slug: data.slug || slug });
            }
          }
        });
      }, { rootMargin: '-40% 0% -55% 0%', threshold: 0.01 })
    : null;

  $$('.mg-section', root).forEach(sec => io?.observe(sec));

  // progress clicks
  links.forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const id = a.getAttribute('href').slice(1);
      history.replaceState(null, '', `#${id}`);
      scrollToId(id);
    });
  });

  // mobile nav + dots
  const sections = $$('.mg-section', root);
  const ids = sections.map(s => s.id);
  const prevBtn = $('.mg-prev', root);
  const nextBtn = $('.mg-next', root);
  const dots = $('.mg-dots', root);

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
    gEvent('mg_nav_prev', { from_step: ids[i], slug: data.slug || slug });
  });

  nextBtn?.addEventListener('click', () => {
    const i = activeIndex();
    if (i < ids.length - 1) scrollToId(ids[i + 1]);
    gEvent('mg_nav_next', { from_step: ids[i], slug: data.slug || slug });
  });
})();
