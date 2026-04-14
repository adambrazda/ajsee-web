import '../../identity-init.js';

import { detectLang, applyTranslations } from '../../i18n.js';
import { initNav } from '../../nav-core.js';
import { initLangDropdown } from '../../utils/lang-dropdown.js';
import { ensureRuntimeStyles, updateHeaderOffset } from '../../runtime-style.js';

function setDocumentLang() {
  try {
    const lang = detectLang();
    if (lang) {
      document.documentElement.lang = lang;
    }
    return lang || 'cs';
  } catch {
    document.documentElement.lang = 'cs';
    return 'cs';
  }
}

async function initI18n() {
  const lang = setDocumentLang();

  try {
    await applyTranslations(lang);
  } catch (error) {
    console.warn('[privacy-policy] i18n init failed:', error);
  }
}

function initPageAnchors() {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  if (!anchorLinks.length) return;

  anchorLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });

      history.replaceState(null, '', href);
    });
  });
}

function initActiveTocState() {
  const tocLinks = Array.from(document.querySelectorAll('.legal-toc a[href^="#"]'));
  if (!tocLinks.length) return;

  const sections = tocLinks
    .map((link) => {
      const id = link.getAttribute('href');
      if (!id) return null;
      const section = document.querySelector(id);
      if (!section) return null;
      return { link, section };
    })
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (activeId) => {
    sections.forEach(({ link, section }) => {
      const isActive = `#${section.id}` === activeId;
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
      link.classList.toggle('is-active', isActive);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (!visible.length) return;

      const topSection = visible[0].target;
      setActive(`#${topSection.id}`);
    },
    {
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0.1, 0.25, 0.4, 0.6],
    }
  );

  sections.forEach(({ section }) => observer.observe(section));

  const initialHash = window.location.hash;
  if (initialHash) {
    setActive(initialHash);
  } else if (sections[0]) {
    setActive(`#${sections[0].section.id}`);
  }
}

function initFooterYear() {
  const yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }
}

function initPage() {
  ensureRuntimeStyles?.();
  updateHeaderOffset?.();

  initNav?.();
  initLangDropdown?.();

  initFooterYear();
  initPageAnchors();
  initActiveTocState();

  window.addEventListener(
    'resize',
    () => {
      updateHeaderOffset?.();
    },
    { passive: true }
  );
}

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  initPage();
});