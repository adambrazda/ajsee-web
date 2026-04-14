// /src/utils/lang-dropdown.js
// AJSEE – language dropdown for current <details class="lang-dropdown"> markup
// Supports desktop + mobile dropdowns and preserves current page URL with ?lang=

const LANG_META = {
  cs: { label: 'Čeština', flag: '/images/flags/cz.svg' },
  en: { label: 'English', flag: '/images/flags/gb.svg' },
  de: { label: 'Deutsch', flag: '/images/flags/de.svg' },
  sk: { label: 'Slovenčina', flag: '/images/flags/sk.svg' },
  pl: { label: 'Polski', flag: '/images/flags/pl.svg' },
  hu: { label: 'Magyar', flag: '/images/flags/hu.svg' },
};

function detectLang() {
  const url = new URL(window.location.href);
  const fromUrl = (url.searchParams.get('lang') || '').toLowerCase();
  if (fromUrl && LANG_META[fromUrl]) return fromUrl;

  const fromHtml = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  if (fromHtml && LANG_META[fromHtml]) return fromHtml;

  return 'cs';
}

function goToLang(lang) {
  const url = new URL(window.location.href);

  if (lang === 'cs') {
    url.searchParams.delete('lang');
  } else {
    url.searchParams.set('lang', lang);
  }

  window.location.assign(url.toString());
}

function getDropdownRoots() {
  const roots = new Set();

  document.querySelectorAll('details.lang-dropdown').forEach((el) => roots.add(el));
  document.querySelectorAll('[data-lang-dropdown]').forEach((el) => roots.add(el));

  return Array.from(roots);
}

function closeDetailsDropdown(root) {
  if (!(root instanceof HTMLElement)) return;
  if (root.tagName.toLowerCase() === 'details') {
    root.removeAttribute('open');
  }

  const trigger =
    root.querySelector('.lang-current') ||
    root.querySelector('.lang-trigger');

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }
}

function openDetailsDropdown(root) {
  if (!(root instanceof HTMLElement)) return;
  if (root.tagName.toLowerCase() === 'details') {
    root.setAttribute('open', '');
  }

  const trigger =
    root.querySelector('.lang-current') ||
    root.querySelector('.lang-trigger');

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function setSelectedUIForRoot(root, lang) {
  const meta = LANG_META[lang] || LANG_META.cs;

  const currentLabel =
    root.querySelector('.lang-current-label') ||
    root.querySelector('[data-lang-current]');

  const currentFlag =
    root.querySelector('.lang-current-flag') ||
    root.querySelector('img.flag');

  if (currentLabel) currentLabel.textContent = meta.label;
  if (currentFlag) {
    currentFlag.src = meta.flag;
    currentFlag.alt = meta.label;
  }

  root.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    const isSelected = (btn.dataset.lang || '').toLowerCase() === lang;
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

function syncAllDropdowns(lang) {
  getDropdownRoots().forEach((root) => setSelectedUIForRoot(root, lang));
}

export function initLangDropdown() {
  const roots = getDropdownRoots();
  if (!roots.length) return;

  const initialLang = detectLang();
  syncAllDropdowns(initialLang);

  roots.forEach((root) => {
    const trigger =
      root.querySelector('.lang-current') ||
      root.querySelector('.lang-trigger');

    const menu = root.querySelector('.lang-menu');
    const options = Array.from(root.querySelectorAll('.lang-btn[data-lang]'));

    if (!trigger || !menu || !options.length) return;

    trigger.setAttribute(
      'aria-expanded',
      root.tagName.toLowerCase() === 'details' && root.hasAttribute('open') ? 'true' : 'false'
    );

    if (root.tagName.toLowerCase() === 'details') {
      root.addEventListener('toggle', () => {
        trigger.setAttribute('aria-expanded', root.hasAttribute('open') ? 'true' : 'false');
      });
    }

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailsDropdown(root);
        trigger.focus({ preventScroll: true });
      }

      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        openDetailsDropdown(root);

        const current = options.find(
          (btn) => (btn.dataset.lang || '').toLowerCase() === detectLang()
        );

        window.requestAnimationFrame(() => {
          (current || options[0])?.focus?.({ preventScroll: true });
        });
      }
    });

    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailsDropdown(root);
        trigger.focus({ preventScroll: true });
      }
    });

    options.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        const lang = (btn.dataset.lang || 'cs').toLowerCase();
        if (!LANG_META[lang]) return;

        syncAllDropdowns(lang);
        roots.forEach((item) => closeDetailsDropdown(item));

        if (lang === detectLang()) return;

        goToLang(lang);
      });
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;

    roots.forEach((root) => {
      if (!root.contains(target)) {
        closeDetailsDropdown(root);
      }
    });
  });
}