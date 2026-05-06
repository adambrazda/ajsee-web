import { renderSharePanel } from './mg-share.js';
import { renderRelatedMicroguides } from './mg-related.js';

// --- constants ---
const SITE_ORIGIN = 'https://ajsee.cz';
const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const DEFAULT_LANG = 'cs';

const OG_LOCALE = {
  cs: 'cs_CZ',
  en: 'en_GB',
  de: 'de_DE',
  sk: 'sk_SK',
  pl: 'pl_PL',
  hu: 'hu_HU'
};

const LABELS = {
  cs: {
    backToBlog: 'Zpět na blog',
    breadcrumb: 'AJSEE vysvětluje',
    indexTitle: 'Mikroprůvodci pro koncerty, divadlo a akce | AJSEE',
    indexHeading: 'Mikroprůvodci AJSEE',
    indexDescription: 'Praktické mikroprůvodce pro výběr míst, nákup vstupenek, přípravu na akce a cestování za zážitky.',
    indexLead: 'Rychlé návody, které ti pomůžou rozhodnout se jistěji před nákupem vstupenek i před cestou na akci.',
    allGuides: 'Všechny mikroprůvodce',
    noGuides: 'Zatím tu nejsou žádné publikované mikroprůvodce.',
    readTime: 'min čtení',
    openGuide: 'Otevřít průvodce',
    waitlist: 'Chci na čekací listinu',
    prev: 'Předchozí',
    next: 'Další',
    notFoundTitle: 'Mikroprůvodce se nepodařilo načíst',
    notFoundText: 'Průvodce možná neexistuje, nebo zatím není publikovaný.',
    backToGuides: 'Zpět na mikroprůvodce'
  },
  en: {
    backToBlog: 'Back to blog',
    breadcrumb: 'AJSEE explains',
    indexTitle: 'Micro-guides for concerts, theatre and events | AJSEE',
    indexHeading: 'AJSEE Micro-guides',
    indexDescription: 'Practical micro-guides for choosing seats, buying tickets, preparing for events and travelling for experiences.',
    indexLead: 'Quick guides that help you make better decisions before buying tickets or travelling to an event.',
    allGuides: 'All micro-guides',
    noGuides: 'There are no published micro-guides yet.',
    readTime: 'min read',
    openGuide: 'Open guide',
    waitlist: 'Join the waitlist',
    prev: 'Previous',
    next: 'Next',
    notFoundTitle: 'The micro-guide could not be loaded',
    notFoundText: 'The guide may not exist, or it may not be published yet.',
    backToGuides: 'Back to micro-guides'
  },
  de: {
    backToBlog: 'Zurück zum Blog',
    breadcrumb: 'AJSEE erklärt',
    indexTitle: 'Micro-Guides für Konzerte, Theater und Events | AJSEE',
    indexHeading: 'AJSEE Micro-Guides',
    indexDescription: 'Praktische Micro-Guides zur Sitzplatzauswahl, zum Ticketkauf, zur Eventvorbereitung und zu Reisen für Erlebnisse.',
    indexLead: 'Kurze Guides, die dir helfen, vor dem Ticketkauf oder der Reise zu einem Event sicherer zu entscheiden.',
    allGuides: 'Alle Micro-Guides',
    noGuides: 'Noch keine veröffentlichten Micro-Guides.',
    readTime: 'Min. Lesezeit',
    openGuide: 'Guide öffnen',
    waitlist: 'Zur Warteliste',
    prev: 'Zurück',
    next: 'Weiter',
    notFoundTitle: 'Der Micro-Guide konnte nicht geladen werden',
    notFoundText: 'Der Guide existiert möglicherweise nicht oder ist noch nicht veröffentlicht.',
    backToGuides: 'Zurück zu den Micro-Guides'
  },
  sk: {
    backToBlog: 'Späť na blog',
    breadcrumb: 'AJSEE vysvetľuje',
    indexTitle: 'Mikropríručky pre koncerty, divadlo a akcie | AJSEE',
    indexHeading: 'Mikropríručky AJSEE',
    indexDescription: 'Praktické mikropríručky pre výber miest, nákup vstupeniek, prípravu na akcie a cestovanie za zážitkami.',
    indexLead: 'Rýchle návody, ktoré ti pomôžu rozhodovať sa istejšie pred nákupom vstupeniek aj pred cestou na akciu.',
    allGuides: 'Všetky mikropríručky',
    noGuides: 'Zatiaľ tu nie sú žiadne publikované mikropríručky.',
    readTime: 'min čítania',
    openGuide: 'Otvoriť príručku',
    waitlist: 'Chcem na čakaciu listinu',
    prev: 'Predchádzajúce',
    next: 'Ďalej',
    notFoundTitle: 'Mikropríručku sa nepodarilo načítať',
    notFoundText: 'Príručka možno neexistuje alebo zatiaľ nie je publikovaná.',
    backToGuides: 'Späť na mikropríručky'
  },
  pl: {
    backToBlog: 'Wróć do bloga',
    breadcrumb: 'AJSEE wyjaśnia',
    indexTitle: 'Mikroprzewodniki po koncertach, teatrze i wydarzeniach | AJSEE',
    indexHeading: 'Mikroprzewodniki AJSEE',
    indexDescription: 'Praktyczne mikroprzewodniki dotyczące wyboru miejsc, kupowania biletów, przygotowania do wydarzeń i podróży po doświadczenia.',
    indexLead: 'Krótkie poradniki, które pomagają podejmować lepsze decyzje przed zakupem biletów i wyjazdem na wydarzenie.',
    allGuides: 'Wszystkie mikroprzewodniki',
    noGuides: 'Nie ma jeszcze opublikowanych mikroprzewodników.',
    readTime: 'min czytania',
    openGuide: 'Otwórz przewodnik',
    waitlist: 'Dołącz do listy oczekujących',
    prev: 'Poprzedni',
    next: 'Następny',
    notFoundTitle: 'Nie udało się załadować mikroprzewodnika',
    notFoundText: 'Przewodnik może nie istnieć albo nie został jeszcze opublikowany.',
    backToGuides: 'Wróć do mikroprzewodników'
  },
  hu: {
    backToBlog: 'Vissza a bloghoz',
    breadcrumb: 'AJSEE magyaráz',
    indexTitle: 'Mikroútmutatók koncertekhez, színházhoz és eseményekhez | AJSEE',
    indexHeading: 'AJSEE mikroútmutatók',
    indexDescription: 'Gyakorlati mikroútmutatók ülőhelyválasztáshoz, jegyvásárláshoz, eseményekre való felkészüléshez és élményutazáshoz.',
    indexLead: 'Rövid útmutatók, amelyek segítenek magabiztosabban dönteni jegyvásárlás vagy eseményre utazás előtt.',
    allGuides: 'Összes mikroútmutató',
    noGuides: 'Még nincsenek publikált mikroútmutatók.',
    readTime: 'perc olvasás',
    openGuide: 'Útmutató megnyitása',
    waitlist: 'Feliratkozom a várólistára',
    prev: 'Előző',
    next: 'Következő',
    notFoundTitle: 'A mikroútmutató nem tölthető be',
    notFoundText: 'Az útmutató lehet, hogy nem létezik, vagy még nincs publikálva.',
    backToGuides: 'Vissza a mikroútmutatókhoz'
  }
};

// --- lang ---
const urlLang = new URLSearchParams(location.search).get('lang');
const rawLang = (
  urlLang ||
  window.AJSEE_LANG ||
  document.documentElement.getAttribute('lang') ||
  DEFAULT_LANG
)
  .toLowerCase()
  .split(/[-_]/)[0];

const lang = SUPPORTED_LANGS.includes(rawLang) ? rawLang : DEFAULT_LANG;

document.documentElement.setAttribute('lang', lang);

// --- helpers ---
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function label(key) {
  return LABELS[lang]?.[key] || LABELS.cs[key] || key;
}

function gEvent(action, extra = {}) {
  if (typeof window.dataLayer?.push === 'function') {
    window.dataLayer.push({ event: action, language: lang, ...extra });
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', action, { language: lang, ...extra });
  }
}

function safeDecode(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Dev i prod:
// 1) ?slug=...
// 2) /microguides/{slug}
function currentSlug() {
  const u = new URL(location.href);
  const q = (u.searchParams.get('slug') || '').trim();

  if (q) return safeDecode(q);

  const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  if (parts[0] === 'microguides' && parts[1]) {
    return safeDecode(parts[1]);
  }

  return '';
}

// Fallback pořadí: current → en → cs
async function loadGuide(slug, langCode) {
  const urls = [];
  const encodedSlug = encodeURIComponent(slug);

  const pushOnce = (path, resolvedLang) => {
    if (!urls.some((item) => item.path === path)) {
      urls.push({ path, resolvedLang });
    }
  };

  pushOnce(`/content/microguides/${encodedSlug}.${langCode}.json`, langCode);
  if (langCode !== 'en') pushOnce(`/content/microguides/${encodedSlug}.en.json`, 'en');
  if (langCode !== 'cs') pushOnce(`/content/microguides/${encodedSlug}.cs.json`, 'cs');

  const fetchJson = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    return response.json();
  };

  for (const item of urls) {
    try {
      const data = await fetchJson(item.path);

      return {
        data,
        resolvedLang: item.resolvedLang,
        source: item.path
      };
    } catch {
      // try next
    }
  }

  return null;
}

async function loadMicroguidesIndex() {
  try {
    const response = await fetch('/content/microguides/index.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.items;

    if (!Array.isArray(items)) {
      return [];
    }

    const bySlug = new Map();

    items
      .filter((item) => item && item.slug && (item.status || 'published') === 'published')
      .forEach((item) => {
        if (!bySlug.has(item.slug)) {
          bySlug.set(item.slug, item);
        }
      });

    return Array.from(bySlug.values());
  } catch {
    return [];
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

function stripHtml(value = '') {
  const el = document.createElement('div');
  el.innerHTML = String(value);
  return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(value = '') {
  if (!value) return '';

  try {
    return new URL(value, SITE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function sanitizeTrustedHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html);

  template.content
    .querySelectorAll('script, iframe, object, embed, style, link, meta')
    .forEach((node) => node.remove());

  template.content.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').trim().toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }

      if (
        ['href', 'src', 'xlink:href'].includes(name) &&
        value.startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

/**
 * Robustní převod jednoduchého MD.
 * Pokud body obsahuje interní HTML callouty z našich JSONů, zachová je,
 * ale před vložením odstraní rizikové tagy a event atributy.
 */
function mdToHtml(md = '') {
  const norm = String(md).replace(/\r\n?/g, '\n').trim();

  if (!norm) return '';

  if (/<\/?[a-z][\s\S]*>/i.test(norm)) {
    return sanitizeTrustedHtml(norm);
  }

  const escapeInline = (s) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const lines = norm.split('\n');
  const out = [];
  let list = [];

  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((item) => `<li>${escapeInline(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushList();
      out.push('');
      continue;
    }

    let m;

    if ((m = line.match(/^###\s+(.*)$/))) {
      flushList();
      out.push(`<h4>${escapeInline(m[1])}</h4>`);
      continue;
    }

    if ((m = line.match(/^##\s+(.*)$/))) {
      flushList();
      out.push(`<h3>${escapeInline(m[1])}</h3>`);
      continue;
    }

    if ((m = line.match(/^#\s+(.*)$/))) {
      flushList();
      out.push(`<h2>${escapeInline(m[1])}</h2>`);
      continue;
    }

    if (/^- /.test(line)) {
      list.push(line.replace(/^-+\s+/, '').trim());
      continue;
    }

    flushList();
    out.push(`<p>${escapeInline(line)}</p>`);
  }

  flushList();

  return out
    .filter((chunk, index, arr) => !(chunk === '' && arr[index - 1] === ''))
    .join('\n');
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

  el.scrollIntoView({
    behavior: prefersReduced() ? 'auto' : 'smooth',
    block: 'start'
  });
};

const cssEsc = (value) => {
  try {
    return window.CSS && CSS.escape
      ? CSS.escape(value)
      : String(value).replace(/"/g, '\\"');
  } catch {
    return String(value).replace(/"/g, '\\"');
  }
};

function upsertMeta(attr, value, content) {
  let meta = document.head.querySelector(`meta[${attr}="${cssEsc(value)}"]`);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, value);
    document.head.appendChild(meta);
  }

  if (typeof content === 'string') {
    meta.setAttribute('content', content);
  }
}

function upsertLink(rel, href) {
  let link = document.head.querySelector(`link[rel="${cssEsc(rel)}"]`);

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }

  link.setAttribute('href', href);
}

function upsertJsonLd(id, data) {
  let script = document.getElementById(id);

  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

function setPageMeta({
  title,
  description,
  canonicalUrl,
  robots = 'index, follow',
  type = 'website',
  image = `${SITE_ORIGIN}/images/logo-ajsee.png`,
  imageAlt = 'Logo AJSEE'
}) {
  const safeTitle = title || 'AJSEE';
  const safeDescription = description || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const safeCanonical = canonicalUrl || `${SITE_ORIGIN}/microguides/`;
  const safeImage = image || `${SITE_ORIGIN}/images/logo-ajsee.png`;

  document.title = safeTitle;

  upsertMeta('name', 'description', safeDescription);
  upsertMeta('name', 'robots', robots);

  upsertLink('canonical', safeCanonical);

  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:locale', OG_LOCALE[lang] || OG_LOCALE.cs);
  upsertMeta('property', 'og:site_name', 'AJSEE');
  upsertMeta('property', 'og:title', safeTitle);
  upsertMeta('property', 'og:description', safeDescription);
  upsertMeta('property', 'og:url', safeCanonical);
  upsertMeta('property', 'og:image', safeImage);
  upsertMeta('property', 'og:image:alt', imageAlt);

  upsertMeta('name', 'twitter:card', type === 'article' ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', safeTitle);
  upsertMeta('name', 'twitter:description', safeDescription);
  upsertMeta('name', 'twitter:image', safeImage);
  upsertMeta('name', 'twitter:image:alt', imageAlt);
}

function buildMicroguideCanonicalUrl(slug) {
  return `${SITE_ORIGIN}/microguides/${encodeURIComponent(slug)}/`;
}

function buildMicroguideArticleBody(data) {
  const parts = [];

  if (data?.summary) {
    parts.push(stripHtml(data.summary));
  }

  if (Array.isArray(data?.steps)) {
    data.steps.forEach((step) => {
      if (step?.heading) parts.push(stripHtml(step.heading));
      if (step?.body) parts.push(stripHtml(step.body));
    });
  }

  if (data?.ctaQuestion) {
    parts.push(stripHtml(data.ctaQuestion));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function cleanJson(data) {
  return JSON.parse(JSON.stringify(data));
}

function renderMicroguideStructuredData(data, langCode, slug) {
  if (!data || !slug) return;

  const canonicalUrl = buildMicroguideCanonicalUrl(slug);
  const title = data.title || slug;
  const description = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const image = toAbsoluteUrl(data.cover) || `${SITE_ORIGIN}/images/logo-ajsee.png`;
  const articleBody = buildMicroguideArticleBody(data);

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl
        },
        headline: title,
        description,
        image: [image],
        inLanguage: langCode,
        articleSection: data.category || undefined,
        articleBody: articleBody || undefined,
        datePublished: data.publishedAt || undefined,
        dateModified: data.updatedAt || data.publishedAt || undefined,
        author: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`
        },
        publisher: {
          '@type': 'Organization',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/images/logo-ajsee.png`
          }
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'AJSEE',
            item: `${SITE_ORIGIN}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Micro-guides',
            item: `${SITE_ORIGIN}/microguides/`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: canonicalUrl
          }
        ]
      }
    ]
  };

  upsertJsonLd('ajsee-microguide-jsonld', cleanJson(graph));
}

function renderMicroguidesIndexStructuredData(items = []) {
  const canonicalUrl = `${SITE_ORIGIN}/microguides/`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#collection`,
        url: canonicalUrl,
        name: label('indexHeading'),
        description: label('indexDescription'),
        inLanguage: lang,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AJSEE',
          url: `${SITE_ORIGIN}/`
        }
      },
      {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.title || item.slug,
          url: buildMicroguideCanonicalUrl(item.slug)
        }))
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'AJSEE',
            item: `${SITE_ORIGIN}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Micro-guides',
            item: canonicalUrl
          }
        ]
      }
    ]
  };

  upsertJsonLd('ajsee-microguides-index-jsonld', cleanJson(graph));
}

function hideComments() {
  const comments = $('#comments');
  if (comments) comments.hidden = true;
}

function setCommentsContext(slug) {
  const comments = $('#comments');
  if (comments) comments.hidden = false;

  const commentLang = $('#commentLang');
  const commentPostType = $('#commentPostType');
  const commentPostId = $('#commentPostId');

  if (commentLang) commentLang.value = lang;
  if (commentPostType) commentPostType.value = 'microguide';
  if (commentPostId) commentPostId.value = slug;
}

function renderNotFound(root, slug = '') {
  hideComments();

  setPageMeta({
    title: `${label('notFoundTitle')} | AJSEE`,
    description: label('notFoundText'),
    canonicalUrl: `${SITE_ORIGIN}/microguides/`,
    robots: 'noindex, follow',
    type: 'website'
  });

  root.innerHTML = `
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${withLang('/blog')}">${escapeHtml(label('backToBlog'))}</a>
      <span aria-hidden="true">/</span>
      <a href="${withLang('/microguides/')}">${escapeHtml(label('breadcrumb'))}</a>
    </nav>

    <section class="mg-content">
      <article class="mg-section">
        <h1>${escapeHtml(label('notFoundTitle'))}</h1>
        <p>${escapeHtml(label('notFoundText'))}</p>
        ${slug ? `<p><code>${escapeHtml(slug)}</code></p>` : ''}
        <p><a class="ib-cta" href="${withLang('/microguides/')}">${escapeHtml(label('backToGuides'))}</a></p>
      </article>
    </section>
  `;

  root.hidden = false;
}

function renderIndexCard(item) {
  const href = withLang(`/microguides/${encodeURIComponent(item.slug)}`);
  const title = item.title || item.slug;
  const summary = item.summary || '';
  const cover = item.cover || '';

  return `
    <article class="mg-card">
      <a class="mg-card-link" href="${href}" aria-label="${escapeHtml(label('openGuide'))}: ${escapeHtml(title)}">
        ${cover ? `
          <figure class="mg-card-media">
            <img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async">
          </figure>
        ` : ''}
        <div class="mg-card-body">
          <p class="mg-kicker">${escapeHtml(label('breadcrumb'))}</p>
          <h2>${escapeHtml(title)}</h2>
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
          <span class="mg-card-cta">${escapeHtml(label('openGuide'))}</span>
        </div>
      </a>
    </article>
  `;
}

async function renderIndex(root) {
  hideComments();

  const items = await loadMicroguidesIndex();

  setPageMeta({
    title: label('indexTitle'),
    description: label('indexDescription'),
    canonicalUrl: `${SITE_ORIGIN}/microguides/`,
    robots: 'index, follow',
    type: 'website'
  });

  renderMicroguidesIndexStructuredData(items);

  root.innerHTML = `
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${withLang('/blog')}">${escapeHtml(label('backToBlog'))}</a>
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(label('breadcrumb'))}</span>
    </nav>

    <section class="mg-hero mg-hero--index">
      <div class="mg-hero-text">
        <p class="mg-kicker">${escapeHtml(label('breadcrumb'))}</p>
        <h1 class="mg-title">${escapeHtml(label('indexHeading'))}</h1>
        <p class="mg-lead">${escapeHtml(label('indexLead'))}</p>
      </div>
    </section>

    <section class="mg-content mg-content--index" aria-labelledby="microguides-list-title">
      <header class="mg-section">
        <h2 id="microguides-list-title">${escapeHtml(label('allGuides'))}</h2>
      </header>

      ${
        items.length
          ? `<div class="mg-index-grid">${items.map(renderIndexCard).join('')}</div>`
          : `<p class="mg-empty">${escapeHtml(label('noGuides'))}</p>`
      }
    </section>
  `;

  root.hidden = false;

  gEvent('mg_index_view', {
    count: items.length
  });
}

function mountRelated(root, resolvedSlug) {
  const relatedMount = document.createElement('section');
  relatedMount.id = 'mg-related';

  const mobileNav = root.querySelector('.mg-mobile-nav');
  const contentEl = root.querySelector('.mg-content');

  if (mobileNav) {
    mobileNav.insertAdjacentElement('beforebegin', relatedMount);
  } else if (contentEl) {
    contentEl.insertAdjacentElement('afterend', relatedMount);
  }

  try {
    Promise.resolve(
      renderRelatedMicroguides({
        slug: resolvedSlug,
        language: lang,
        container: relatedMount,
        max: 3
      })
    ).catch(() => {});
  } catch {
    // noop
  }
}

function initProgress(root, resolvedSlug) {
  const links = $$('.mg-progress a', root);
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  let lastSentId = null;

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const id = entry.target.id;

          map.forEach((a) => a.removeAttribute('aria-current'));
          map.get(id)?.setAttribute('aria-current', 'true');

          if (lastSentId !== id) {
            lastSentId = id;
            gEvent('mg_step_view', {
              step_id: id,
              slug: resolvedSlug
            });
          }
        });
      }, {
        rootMargin: '-40% 0% -55% 0%',
        threshold: 0.01
      })
    : null;

  $$('.mg-section', root).forEach((section) => io?.observe(section));

  links.forEach((a) => {
    a.addEventListener('click', (event) => {
      event.preventDefault();

      const id = a.getAttribute('href').slice(1);
      const u = new URL(location.href);
      u.hash = id;

      history.replaceState(null, '', u.pathname + u.search + u.hash);
      scrollToId(id);
    });
  });
}

function initMobileNav(root, resolvedSlug) {
  const sections = $$('.mg-section', root);
  const ids = sections.map((section) => section.id).filter(Boolean);
  const prevBtn = $('.mg-prev', root);
  const nextBtn = $('.mg-next', root);
  const dots = $('.mg-dots', root);

  if (!ids.length || !prevBtn || !nextBtn || !dots) return;

  ids.forEach((id, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mg-dot';
    button.setAttribute('aria-label', `Step ${index + 1}`);
    button.addEventListener('click', () => scrollToId(id));
    dots.appendChild(button);
  });

  const activeIndex = () => {
    let index = 0;

    sections.forEach((section, sectionIndex) => {
      const rect = section.getBoundingClientRect();

      if (rect.top < window.innerHeight * 0.45) {
        index = sectionIndex;
      }
    });

    return index;
  };

  const updateNav = () => {
    const index = activeIndex();

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === ids.length - 1;

    $$('.mg-dot', dots).forEach((dot, dotIndex) => {
      dot.toggleAttribute('data-active', dotIndex === index);
    });
  };

  updateNav();

  window.addEventListener('scroll', updateNav, { passive: true });

  prevBtn.addEventListener('click', () => {
    const index = activeIndex();

    if (index > 0) {
      scrollToId(ids[index - 1]);
    }

    gEvent('mg_nav_prev', {
      from_step: ids[index],
      slug: resolvedSlug
    });
  });

  nextBtn.addEventListener('click', () => {
    const index = activeIndex();

    if (index < ids.length - 1) {
      scrollToId(ids[index + 1]);
    }

    gEvent('mg_nav_next', {
      from_step: ids[index],
      slug: resolvedSlug
    });
  });
}

async function renderDetail(root, slug) {
  const loaded = await loadGuide(slug, lang);

  if (!loaded?.data) {
    renderNotFound(root, slug);
    return;
  }

  const data = loaded.data;
  const resolvedSlug = data.slug || slug;
  const resolvedLang = loaded.resolvedLang || lang;
  const title = `${data.title || resolvedSlug} | AJSEE`;
  const desc = data.summary || 'AJSEE vysvětluje: praktické mikroprůvodce.';
  const canonicalUrl = buildMicroguideCanonicalUrl(resolvedSlug);
  const coverUrl = toAbsoluteUrl(data.cover);

  setPageMeta({
    title,
    description: desc,
    canonicalUrl,
    robots: 'index, follow',
    type: 'article',
    image: coverUrl || `${SITE_ORIGIN}/images/logo-ajsee.png`,
    imageAlt: data.coverAlt || data.title || 'AJSEE micro-guide'
  });

  renderMicroguideStructuredData(data, resolvedLang, resolvedSlug);
  setCommentsContext(resolvedSlug);

  const steps = Array.isArray(data.steps) ? data.steps : [];

  const heroMedia = `
    <figure class="mg-hero-media">
      ${
        data.cover
          ? `<img src="${escapeHtml(data.cover)}" alt="${escapeHtml(data.coverAlt || '')}" width="1280" height="720" loading="eager" decoding="async">`
          : ''
      }
    </figure>
  `;

  root.innerHTML = `
    <nav class="mg-breadcrumb" aria-label="Breadcrumb">
      <a href="${withLang('/blog')}" data-i18n="mg.backToBlog">${escapeHtml(label('backToBlog'))}</a>
      <span aria-hidden="true">/</span>
      <a href="${withLang('/microguides/')}" data-i18n="mg.breadcrumb">${escapeHtml(label('breadcrumb'))}</a>
    </nav>

    <article class="mg-article" itemscope itemtype="https://schema.org/Article">
      <header class="mg-hero">
        <div class="mg-hero-text">
          <p class="mg-kicker">${escapeHtml(label('breadcrumb'))}</p>
          <h1 class="mg-title" itemprop="headline">${escapeHtml(data.title || resolvedSlug)}</h1>
          <p class="mg-meta">
            <span>${Number(data.readingMinutes || 5)} ${escapeHtml(label('readTime'))}</span>
          </p>
          <div class="mg-actions"></div>
        </div>
        ${heroMedia}
      </header>

      ${
        steps.length
          ? `
            <aside class="mg-progress" aria-label="Postup průvodcem">
              <ol>
                ${steps.map((step) => `
                  <li>
                    <a href="#${escapeHtml(step.id)}">${escapeHtml(step.heading || '')}</a>
                  </li>
                `).join('')}
              </ol>
            </aside>
          `
          : ''
      }

      <div class="mg-content">
        ${steps.map((step) => `
          <section id="${escapeHtml(step.id)}" class="mg-section" aria-labelledby="${escapeHtml(step.id)}-title">
            <h2 id="${escapeHtml(step.id)}-title">${escapeHtml(step.heading || '')}</h2>
            ${mdToHtml(step.body || '')}
            ${
              step.image
                ? `
                  <figure class="mg-figure">
                    <div class="mg-media-frame">
                      <img src="${escapeHtml(step.image)}" alt="${escapeHtml(step.alt || '')}" loading="lazy" decoding="async">
                    </div>
                  </figure>
                `
                : ''
            }
          </section>
        `).join('')}

        <footer class="mg-footer-cta">
          ${data.ctaQuestion ? `<p>${escapeHtml(data.ctaQuestion)}</p>` : ''}
          <a class="ib-cta" href="${withLang('/coming-soon')}">${escapeHtml(label('waitlist'))}</a>
        </footer>
      </div>

      ${
        steps.length
          ? `
            <nav class="mg-mobile-nav" aria-label="Micro-guide navigation">
              <button class="mg-prev" type="button">${escapeHtml(label('prev'))}</button>
              <div class="mg-dots"></div>
              <button class="mg-next" type="button">${escapeHtml(label('next'))}</button>
            </nav>
          `
          : ''
      }
    </article>
  `;

  root.hidden = false;

  const actionsEl = root.querySelector('.mg-actions');

  if (actionsEl) {
    actionsEl.textContent = '';

    try {
      renderSharePanel({
        slug: resolvedSlug,
        language: lang,
        title: data.title,
        container: actionsEl,
        variant: 'inline'
      });
    } catch {
      // noop
    }
  }

  mountRelated(root, resolvedSlug);
  initProgress(root, resolvedSlug);
  initMobileNav(root, resolvedSlug);

  gEvent('mg_detail_view', {
    slug: resolvedSlug,
    guide_language: resolvedLang
  });
}

// --- boot ---
(async function init() {
  const root = $('#mgRoot');

  if (!root) return;

  const slug = currentSlug();

  if (!slug) {
    await renderIndex(root);
    return;
  }

  await renderDetail(root, slug);
})();