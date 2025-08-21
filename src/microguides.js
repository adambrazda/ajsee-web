// src/microguides.js
// AJSEE Micro-guide renderer (hero, progress, sections, mobile nav)
// – čte JSON z /content/microguides/<slug>.<lang>.json
// – fallback pořadí: lang -> en -> cs

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const normalizeLang = (val) => {
  if (!val) return "cs";
  let l = String(val).toLowerCase();
  l = l.split(/[-_]/)[0]; // "de-DE" -> "de"
  if (l === "cz") l = "cs";
  return l;
};

const params = new URLSearchParams(location.search);
const slug = params.get("slug") || "";
const urlLang = params.get("lang");
const htmlLang = document.documentElement.getAttribute("lang");
const lang = normalizeLang(urlLang || htmlLang || "cs");

const t = (key, fallback = "") => {
  // Zkusíme několik možných i18n API, ale fallback vždy funguje
  try {
    if (window.i18n?.t) return window.i18n.t(key) || fallback;
    if (window.i18n?.get) return window.i18n.get(key) || fallback;
    if (window.I18N?.t) return window.I18N.t(key) || fallback;
  } catch (_) {}
  return fallback;
};

const fetchJSON = async (path) => {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
};

async function loadGuide(slug, lang) {
  if (!slug) throw new Error("Missing ?slug");
  const candidates = Array.from(new Set([normalizeLang(lang), "en", "cs"]));
  for (const l of candidates) {
    try {
      return await fetchJSON(`/content/microguides/${slug}.${l}.json`);
    } catch {
      // try next
    }
  }
  throw new Error(`Guide not found for slug="${slug}"`);
}

function escHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Render helpers ------------------------------------------------------------

function renderBreadcrumb(root, data) {
  const crumbLabel = t("mg.breadcrumb", "AJSEE vysvětluje");
  const backLabel = t("mg.backToBlog", "Zpět na blog");
  const langParam = `?lang=${encodeURIComponent(lang)}`;

  const wrap = document.createElement("nav");
  wrap.className = "mg-breadcrumb";
  wrap.setAttribute("aria-label", "breadcrumb");
  wrap.innerHTML = `
    <a href="/blog.html${lang ? langParam : ""}">${escHtml(backLabel)}</a>
    <span aria-hidden="true"> · </span>
    <span>${escHtml(crumbLabel)}</span>
  `;
  root.appendChild(wrap);
}

function renderHero(root, data) {
  const hero = document.createElement("section");
  hero.className = "mg-hero";
  const minutes = data.readingMinutes ? `${data.readingMinutes} min` : "";
  const cat = data.category || "";
  hero.innerHTML = `
    <div class="mg-hero-text">
      <div class="mg-kicker">${escHtml(t("mg.breadcrumb", "AJSEE vysvětluje"))}</div>
      <h1 class="mg-title">${escHtml(data.title || "")}</h1>
      <div class="mg-meta">
        ${cat ? `#${escHtml(cat)}` : ""} ${minutes ? ` · ${escHtml(minutes)}` : ""}
      </div>
      <div class="mg-actions">
        <button class="btn-share" type="button" aria-label="Share">${escHtml(t("share", "Sdílet"))}</button>
      </div>
    </div>
    <figure class="mg-hero-media">
      <img src="${data.cover || ""}" alt="${escHtml(data.coverAlt || "")}" loading="eager" />
    </figure>
  `;
  root.appendChild(hero);

  // Optional: Native share
  const btn = $(".btn-share", hero);
  if (btn && navigator.share) {
    btn.addEventListener("click", () => {
      navigator
        .share({
          title: data.title || document.title,
          text: data.summary || "",
          url: location.href,
        })
        .catch(() => {});
    });
  }
}

function renderProgress(root, steps) {
  const sec = document.createElement("aside");
  sec.className = "mg-progress";
  const items = steps
    .map(
      (s) =>
        `<li><a href="#${encodeURIComponent(s.id)}" data-step="${escHtml(
          s.id
        )}">${escHtml(s.heading || "")}</a></li>`
    )
    .join("");
  sec.innerHTML = `<ol>${items}</ol>`;
  root.appendChild(sec);
}

function renderContent(root, data) {
  const wrap = document.createElement("article");
  wrap.className = "mg-article";

  const content = document.createElement("div");
  content.className = "mg-content";

  (data.steps || []).forEach((step, idx) => {
    const sec = document.createElement("section");
    sec.className = "mg-section";
    sec.id = step.id;

    // Text
    const h = document.createElement("h2");
    h.textContent = step.heading || "";
    const p = document.createElement("div");
    p.className = "mg-body";

    // Podporujeme HTML v body (kvůli calloutům). Obsah je z našich JSONů.
    // Pokud by hrozil cizí obsah, tady by byla sanitizace.
    p.innerHTML = (step.body || "").trim();

    // Obrázek / ikona
    let fig = null;
    if (step.image) {
      fig = document.createElement("figure");
      fig.className = "mg-figure";
      fig.innerHTML = `
        <div class="mg-media-frame">
          <img src="${step.image}" alt="${escHtml(step.alt || "")}" loading="lazy" />
        </div>
      `;
    }

    sec.appendChild(h);
    sec.appendChild(p);
    if (fig) sec.appendChild(fig);
    content.appendChild(sec);
  });

  wrap.appendChild(content);
  root.appendChild(wrap);
}

function renderMobileNav(root, steps) {
  const nav = document.createElement("div");
  nav.className = "mg-mobile-nav";
  nav.innerHTML = `
    <button class="mg-prev" type="button" disabled>←</button>
    <div class="mg-dots">
      ${steps
        .map((_, i) => `<button class="mg-dot" type="button" data-index="${i}"></button>`)
        .join("")}
    </div>
    <button class="mg-next" type="button"${steps.length > 1 ? "" : " disabled"}>→</button>
  `;
  root.appendChild(nav);

  const sections = $$(".mg-section");
  const dots = $$(".mg-dot", nav);
  const prev = $(".mg-prev", nav);
  const next = $(".mg-next", nav);

  let active = 0;
  const scrollToIndex = (i) => {
    i = Math.max(0, Math.min(sections.length - 1, i));
    sections[i].scrollIntoView({ behavior: "smooth", block: "start" });
  };

  prev.addEventListener("click", () => scrollToIndex(active - 1));
  next.addEventListener("click", () => scrollToIndex(active + 1));
  dots.forEach((d) =>
    d.addEventListener("click", () => scrollToIndex(parseInt(d.dataset.index, 10)))
  );

  // Sync aktivní tečky + tlačítek
  const updateNav = (i) => {
    active = i;
    dots.forEach((d, idx) => d.toggleAttribute("data-active", idx === i));
    prev.disabled = i <= 0;
    next.disabled = i >= sections.length - 1;
  };

  // IO: zvýraznění aktivní sekce + progress nahoře
  const links = $$(".mg-progress a");
  const markLink = (id) => {
    links.forEach((a) => a.removeAttribute("aria-current"));
    const current = links.find((a) => a.dataset.step === id);
    if (current) current.setAttribute("aria-current", "true");
  };

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      const topId = visible[0].target.id;
      const idx = sections.findIndex((s) => s.id === topId);
      if (idx >= 0) {
        updateNav(idx);
        markLink(topId);
      }
    },
    { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.2, 0.5, 0.75, 1] }
  );

  sections.forEach((s) => io.observe(s));
}

function enableSmoothProgressLinks() {
  $$(".mg-progress a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// Boot ----------------------------------------------------------------------

(async () => {
  const root = document.querySelector('[data-mg-root]');
  if (!root) return;

  try {
    const data = await loadGuide(slug, lang);

    // vyprázdnit root a postupně skládat
    root.innerHTML = "";

    renderBreadcrumb(root, data);
    renderHero(root, data);

    const steps = Array.isArray(data.steps) ? data.steps : [];
    if (steps.length) renderProgress(root, steps);
    renderContent(root, data);
    if (steps.length) renderMobileNav(root, steps);

    enableSmoothProgressLinks();
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <div class="mg-content">
        <p>${escHtml(t("mg.notFound", "Průvodce se nepodařilo načíst."))}</p>
        <p><a href="/blog.html?lang=${encodeURIComponent(lang)}">${escHtml(t("mg.backToBlog", "Zpět na blog"))}</a></p>
      </div>
    `;
  }
})();
