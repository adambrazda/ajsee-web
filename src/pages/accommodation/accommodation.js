// /src/pages/accommodation/accommodation.js
import '../../identity-init.js';

import { initNav } from '../../nav-core.js';
import { applyTranslations, detectLang } from '../../i18n.js';

const SUPPORTED = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const LANG_META = {
  cs: { label: 'Čeština', flag: '/images/flags/cz.svg', alt: 'Čeština' },
  en: { label: 'English', flag: '/images/flags/gb.svg', alt: 'English' },
  de: { label: 'Deutsch', flag: '/images/flags/de.svg', alt: 'Deutsch' },
  sk: { label: 'Slovenčina', flag: '/images/flags/sk.svg', alt: 'Slovenčina' },
  pl: { label: 'Polski', flag: '/images/flags/pl.svg', alt: 'Polski' },
  hu: { label: 'Magyar', flag: '/images/flags/hu.svg', alt: 'Magyar' },
};

function normLang(l) {
  const v = String(l || '').toLowerCase().trim();
  return SUPPORTED.includes(v) ? v : 'cs';
}

function syncYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
}

function syncLangDropdownUI(lang) {
  const l = normLang(lang);
  const meta = LANG_META[l] || LANG_META.cs;

  document.querySelectorAll('details.lang-dropdown').forEach((dd) => {
    const flag = dd.querySelector('.lang-current-flag');
    const label = dd.querySelector('.lang-current-label');
    const summary = dd.querySelector('summary');
    const menu = dd.querySelector('.lang-menu');

    if (flag) {
      flag.src = meta.flag;
      flag.alt = meta.alt;
    }
    if (label) label.textContent = meta.label;

    if (summary) summary.setAttribute('aria-expanded', dd.open ? 'true' : 'false');
    if (menu) {
      if (dd.open) menu.removeAttribute('hidden');
      else menu.setAttribute('hidden', '');
    }
  });

  document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    const b = normLang(btn.getAttribute('data-lang'));
    const isActive = b === l;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

function closeAllLangDropdowns() {
  document.querySelectorAll('details.lang-dropdown[open]').forEach((dd) => {
    dd.open = false;
    const summary = dd.querySelector('summary');
    const menu = dd.querySelector('.lang-menu');
    if (summary) summary.setAttribute('aria-expanded', 'false');
    if (menu) menu.setAttribute('hidden', '');
  });
}

function initLangDropdown() {
  // init hidden state + aria
  document.querySelectorAll('details.lang-dropdown').forEach((dd) => {
    const summary = dd.querySelector('summary');
    const menu = dd.querySelector('.lang-menu');

    const syncOpen = () => {
      if (!summary || !menu) return;
      summary.setAttribute('aria-expanded', dd.open ? 'true' : 'false');
      if (dd.open) menu.removeAttribute('hidden');
      else menu.setAttribute('hidden', '');
    };

    if (summary && menu) {
      syncOpen();
      dd.addEventListener('toggle', syncOpen);
    }
  });

  // close on outside click (capture)
  document.addEventListener(
    'click',
    (e) => {
      const openDropdowns = Array.from(document.querySelectorAll('details.lang-dropdown[open]'));
      if (!openDropdowns.length) return;

      for (const dd of openDropdowns) {
        if (dd.contains(e.target)) return;
      }
      closeAllLangDropdowns();
    },
    true
  );

  // close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAllLangDropdowns();
  });

  // ✅ Delegace – přežije změny DOMu po initNav()
  document.addEventListener(
    'click',
    async (e) => {
      const btn = e.target?.closest?.('.lang-btn[data-lang]');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const l = normLang(btn.getAttribute('data-lang'));

      // přelož stránku (včetně meta, nav, atd.)
      await applyTranslations(l);

      // po překladu se footer innerHTML přepíše -> vrať rok
      syncYear();

      // UI dropdown
      syncLangDropdownUI(l);
      closeAllLangDropdowns();

      try {
        const dd = btn.closest('details.lang-dropdown');
        dd?.querySelector('summary')?.focus?.();
      } catch {}
    },
    true
  );
}

function initCtaTracking() {
  const links = Array.from(document.querySelectorAll('a[href*="trustedstays.co.uk/book-a-home"]'));
  if (!links.length) return;

  links.forEach((a) => {
    const source = (() => {
      if (a.id === 'trustedstaysCta') return 'hero_primary';
      if (a.closest('#support')) return 'support';
      if (a.closest('#final')) return 'final';
      return 'accommodation_page';
    })();

    a.addEventListener('click', () => {
      try {
        if (window.gtag) {
          window.gtag('event', 'click_accommodation_trustedstays', {
            source,
            href: a.getAttribute('href') || a.href,
          });
        }
      } catch {}
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = detectLang();

  // 1) nav nejdřív (aby se přeložilo i to, co initNav domontuje)
  initNav({ lang });

  // 2) dropdown handlers
  initLangDropdown();

  // 3) tracking
  initCtaTracking();

  // 4) až teď překlady
  await applyTranslations(lang);
  syncLangDropdownUI(lang);

  // 5) rok po překladu (protože překlad footeru přepíše HTML)
  syncYear();
});
