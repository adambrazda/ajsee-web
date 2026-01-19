// /src/utils/lang-dropdown.js
// AJSEE – desktop language dropdown (open/close + switch lang via URL param)

const LANG_META = {
  cs: { label: 'Čeština', flag: '/images/flags/cz.svg' },
  en: { label: 'English',  flag: '/images/flags/gb.svg' },
  de: { label: 'Deutsch',  flag: '/images/flags/de.svg' },
  sk: { label: 'Slovenčina', flag: '/images/flags/sk.svg' },
  pl: { label: 'Polski',   flag: '/images/flags/pl.svg' },
  hu: { label: 'Magyar',   flag: '/images/flags/hu.svg' },
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

  // default = cs => čistá URL bez parametru
  if (lang === 'cs') url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);

  // přesměruj (spolehlivé pro events fetch / locale)
  window.location.assign(url.toString());
}

export function initLangDropdown() {
  const root = document.querySelector('[data-lang-dropdown]');
  if (!root) return;

  const trigger = root.querySelector('.lang-trigger');
  const menu = root.querySelector('.lang-menu');
  const currentText = root.querySelector('[data-lang-current]');
  const currentFlag = trigger?.querySelector('img.flag');

  if (!trigger || !menu) return;

  const options = Array.from(menu.querySelectorAll('.lang-btn[data-lang]'));
  if (!options.length) return;

  let open = false;

  const setSelectedUI = (lang) => {
    const meta = LANG_META[lang] || LANG_META.cs;

    if (currentText) currentText.textContent = meta.label;
    if (currentFlag) currentFlag.src = meta.flag;

    options.forEach((btn) => {
      const is = (btn.dataset.lang || '').toLowerCase() === lang;
      btn.setAttribute('aria-selected', is ? 'true' : 'false');
    });
  };

  const closeMenu = () => {
    if (!open) return;
    open = false;
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  };

  const openMenu = () => {
    if (open) return;
    open = true;
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;

    const current = options.find(b => (b.dataset.lang || '').toLowerCase() === detectLang());
    (current || options[0]).focus({ preventScroll: true });
  };

  const toggleMenu = () => (open ? closeMenu() : openMenu());

  // Init UI state
  const initialLang = detectLang();
  setSelectedUI(initialLang);
  trigger.setAttribute('aria-expanded', 'false');
  menu.hidden = true;

  // Trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu();
  });

  // Keyboard
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      trigger.focus({ preventScroll: true });
    }
  });

  // Click outside closes
  document.addEventListener('click', (e) => {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (!root.contains(target)) closeMenu();
  });

  // Options click = switch lang
  options.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = (btn.dataset.lang || 'cs').toLowerCase();
      if (!LANG_META[lang]) return;

      setSelectedUI(lang);
      closeMenu();

      // když user klikne na aktuální jazyk, nic nedělej
      if (lang === detectLang()) return;

      goToLang(lang);
    });
  });
}
