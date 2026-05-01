// /src/utils/lang-dropdown.js
// AJSEE – language dropdown for current <details class="lang-dropdown"> markup
// Desktop + mobile dropdowns, live language switching without full page reload.
// Keeps URL, cookie, localStorage and <html lang=""> in sync.
// v2: capture-phase language click guard + scroll preservation.

const LANG_META = {
  cs: { label: 'Čeština', flag: '/images/flags/cz.svg' },
  en: { label: 'English', flag: '/images/flags/gb.svg' },
  de: { label: 'Deutsch', flag: '/images/flags/de.svg' },
  sk: { label: 'Slovenčina', flag: '/images/flags/sk.svg' },
  pl: { label: 'Polski', flag: '/images/flags/pl.svg' },
  hu: { label: 'Magyar', flag: '/images/flags/hu.svg' },
};

const SUPPORTED_LANGS = Object.keys(LANG_META);
const STORAGE_KEY = 'ajsee.lang';
const COOKIE_KEY = 'aj_lang';

const wiredRoots = new WeakSet();

let documentClickWired = false;
let captureLangClickWired = false;
let globalSyncWired = false;
let htmlLangObserverInstalled = false;

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(lang) ? lang : null;
}

function getCookieLang() {
  try {
    const raw = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${COOKIE_KEY}=`));

    if (!raw) return null;

    return normalizeLang(decodeURIComponent(raw.split('=')[1] || ''));
  } catch {
    return null;
  }
}

function setCookieLang(lang) {
  const normalized = normalizeLang(lang) || 'cs';

  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(normalized)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  } catch {
    /* noop */
  }
}

function getStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function setStoredLang(lang) {
  const normalized = normalizeLang(lang) || 'cs';

  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* noop */
  }
}

function getPathLang() {
  try {
    const match = window.location.pathname.match(/^\/(cs|en|de|sk|pl|hu)(?:\/|$)/i);
    return normalizeLang(match && match[1]);
  } catch {
    return null;
  }
}

function detectLang() {
  let fromUrl = null;

  try {
    const url = new URL(window.location.href);
    fromUrl = normalizeLang(url.searchParams.get('lang'));
  } catch {
    fromUrl = null;
  }

  const fromPath = getPathLang();
  const fromCookie = getCookieLang();
  const fromStorage = getStoredLang();
  const fromHtml = normalizeLang(document.documentElement.getAttribute('lang'));

  // Sjednocené pořadí s main.js:
  // URL -> path -> cookie -> localStorage -> <html lang> -> cs
  return fromUrl || fromPath || fromCookie || fromStorage || fromHtml || 'cs';
}

function updateUrlLang(lang) {
  const normalized = normalizeLang(lang) || 'cs';

  try {
    const url = new URL(window.location.href);

    if (normalized === 'cs') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', normalized);
    }

    if (url.toString() !== window.location.href) {
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

function persistLang(lang) {
  const normalized = normalizeLang(lang) || 'cs';

  setCookieLang(normalized);
  setStoredLang(normalized);
  updateUrlLang(normalized);

  try {
    document.documentElement.setAttribute('lang', normalized);
  } catch {
    /* noop */
  }
}

function dispatchLangEvents(lang, previousLang) {
  const normalized = normalizeLang(lang) || 'cs';

  const detail = {
    lang: normalized,
    previousLang: normalizeLang(previousLang) || null,
    source: 'lang-dropdown',
  };

  try {
    window.dispatchEvent(new CustomEvent('AJSEE:langChanged', { detail }));
  } catch {
    /* noop */
  }

  try {
    window.dispatchEvent(new CustomEvent('ajsee:lang-changed', { detail }));
  } catch {
    /* noop */
  }
}

async function runDirectI18nFallback(lang) {
  // main.js poslouchá AJSEE:langChanged a překlady aplikuje sám.
  // Přímý fallback pouštíme jen na stránkách, kde main.js neběží.
  const hasMainRuntime = Boolean(window.__ajsee?.flags?.mainInitialized);

  if (hasMainRuntime) return;

  if (typeof window.applyTranslations !== 'function') return;

  try {
    await window.applyTranslations(lang);
  } catch {
    /* noop */
  }
}

function getScrollSnapshot() {
  return {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0,
  };
}

function restoreScroll(snapshot) {
  if (!snapshot) return;

  const x = Number.isFinite(snapshot.x) ? snapshot.x : 0;
  const y = Number.isFinite(snapshot.y) ? snapshot.y : 0;

  // Po změně textů se může lehce změnit výška stránky.
  // Proto scroll vracíme ve více snímcích, ale bez animace.
  const restore = () => {
    try {
      window.scrollTo({ left: x, top: y, behavior: 'auto' });
    } catch {
      window.scrollTo(x, y);
    }
  };

  restore();
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
}

async function goToLang(lang, options = {}) {
  const nextLang = normalizeLang(lang);
  if (!nextLang) return;

  const previousLang = detectLang();

  if (nextLang === previousLang) {
    syncAllDropdowns(nextLang);
    return;
  }

  const shouldPreserveScroll = options.preserveScroll !== false;
  const scrollSnapshot = shouldPreserveScroll ? getScrollSnapshot() : null;

  persistLang(nextLang);
  syncAllDropdowns(nextLang);
  dispatchLangEvents(nextLang, previousLang);

  await runDirectI18nFallback(nextLang);

  if (shouldPreserveScroll) {
    restoreScroll(scrollSnapshot);
  }
}

function getDropdownRoots() {
  const roots = new Set();

  document.querySelectorAll('details.lang-dropdown').forEach((el) => roots.add(el));
  document.querySelectorAll('[data-lang-dropdown]').forEach((el) => roots.add(el));

  return Array.from(roots);
}

function getTrigger(root) {
  if (!(root instanceof HTMLElement)) return null;

  return (
    root.querySelector('summary.lang-current') ||
    root.querySelector('.lang-current') ||
    root.querySelector('.lang-trigger') ||
    root.querySelector('[data-lang-trigger]')
  );
}

function isLanguageOptionTarget(target) {
  if (!(target instanceof Element)) return null;

  const btn = target.closest('.lang-btn[data-lang]');
  if (!btn) return null;

  // Zachytáváme jen jazykové volby uvnitř AJSEE dropdownu,
  // aby se neblokovaly jiné případné .lang-btn mimo header.
  const dropdown = btn.closest('details.lang-dropdown, [data-lang-dropdown]');
  if (!dropdown) return null;

  return btn;
}

function closeDetailsDropdown(root) {
  if (!(root instanceof HTMLElement)) return;

  if (root.tagName.toLowerCase() === 'details') {
    root.removeAttribute('open');
  }

  const trigger = getTrigger(root);

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }
}

function openDetailsDropdown(root) {
  if (!(root instanceof HTMLElement)) return;

  if (root.tagName.toLowerCase() === 'details') {
    root.setAttribute('open', '');
  }

  const trigger = getTrigger(root);

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function setSelectedUIForRoot(root, lang) {
  if (!(root instanceof HTMLElement)) return;

  const normalized = normalizeLang(lang) || 'cs';
  const meta = LANG_META[normalized] || LANG_META.cs;

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
    const optionLang = normalizeLang(btn.dataset.lang);
    const isSelected = optionLang === normalized;

    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    if (isSelected) {
      btn.setAttribute('aria-current', 'true');
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

function syncAllDropdowns(lang) {
  const normalized = normalizeLang(lang) || detectLang();

  getDropdownRoots().forEach((root) => {
    setSelectedUIForRoot(root, normalized);
  });
}

function focusCurrentOption(options) {
  const currentLang = detectLang();
  const current = options.find((btn) => normalizeLang(btn.dataset.lang) === currentLang);

  window.requestAnimationFrame(() => {
    (current || options[0])?.focus?.({ preventScroll: true });
  });
}

function wireRoot(root, roots) {
  if (!(root instanceof HTMLElement)) return;
  if (wiredRoots.has(root)) return;

  const trigger = getTrigger(root);
  const menu = root.querySelector('.lang-menu');
  const options = Array.from(root.querySelectorAll('.lang-btn[data-lang]'));

  if (!trigger || !menu || !options.length) return;

  wiredRoots.add(root);

  trigger.setAttribute(
    'aria-expanded',
    root.tagName.toLowerCase() === 'details' && root.hasAttribute('open') ? 'true' : 'false'
  );

  if (root.tagName.toLowerCase() === 'details') {
    root.addEventListener('toggle', () => {
      trigger.setAttribute('aria-expanded', root.hasAttribute('open') ? 'true' : 'false');
    });
  }

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDetailsDropdown(root);
      trigger.focus?.({ preventScroll: true });
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetailsDropdown(root);
      focusCurrentOption(options);
    }
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDetailsDropdown(root);
      trigger.focus?.({ preventScroll: true });
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const enabledOptions = options.filter((option) => !option.disabled);
      const activeIndex = enabledOptions.indexOf(document.activeElement);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        activeIndex === -1
          ? 0
          : (activeIndex + direction + enabledOptions.length) % enabledOptions.length;

      enabledOptions[nextIndex]?.focus?.({ preventScroll: true });
    }

    if (event.key === 'Home') {
      event.preventDefault();
      options.find((option) => !option.disabled)?.focus?.({ preventScroll: true });
    }

    if (event.key === 'End') {
      event.preventDefault();
      [...options].reverse().find((option) => !option.disabled)?.focus?.({ preventScroll: true });
    }
  });

  // Běžný click fallback. Hlavní ochranu proti starým listenerům řeší capture listener níže.
  options.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const lang = normalizeLang(btn.dataset.lang || 'cs');
      if (!lang) return;

      syncAllDropdowns(lang);
      roots.forEach((item) => closeDetailsDropdown(item));

      if (lang === detectLang()) return;

      void goToLang(lang, { preserveScroll: true });
    });
  });
}

function wireCaptureLangClick() {
  if (captureLangClickWired) return;
  captureLangClickWired = true;

  // Capture fáze je důležitá: na partners.html může existovat starší listener,
  // který na stejný click dělá window.location / anchor navigaci a tím posílá stránku nahoru.
  document.addEventListener('click', (event) => {
    const btn = isLanguageOptionTarget(event.target);
    if (!btn) return;

    const lang = normalizeLang(btn.dataset.lang || 'cs');
    if (!lang) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const roots = getDropdownRoots();

    syncAllDropdowns(lang);
    roots.forEach((item) => closeDetailsDropdown(item));

    if (lang === detectLang()) return;

    void goToLang(lang, { preserveScroll: true });
  }, true);
}

function wireDocumentClick() {
  if (documentClickWired) return;
  documentClickWired = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;

    getDropdownRoots().forEach((root) => {
      if (!root.contains(target)) {
        closeDetailsDropdown(root);
      }
    });
  });
}

function wireGlobalSync() {
  if (globalSyncWired) return;
  globalSyncWired = true;

  const syncFromEvent = (event) => {
    const lang = normalizeLang(event?.detail?.lang) || detectLang();
    syncAllDropdowns(lang);
  };

  window.addEventListener('AJSEE:langChanged', syncFromEvent);
  window.addEventListener('ajsee:lang-changed', syncFromEvent);
  window.addEventListener('popstate', () => syncAllDropdowns(detectLang()));
}

function installHtmlLangObserver() {
  if (htmlLangObserverInstalled) return;
  htmlLangObserverInstalled = true;

  try {
    const observer = new MutationObserver(() => {
      syncAllDropdowns(detectLang());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
  } catch {
    /* noop */
  }
}

export function initLangDropdown() {
  const roots = getDropdownRoots();
  if (!roots.length) return;

  const initialLang = detectLang();
  syncAllDropdowns(initialLang);

  wireCaptureLangClick();
  roots.forEach((root) => wireRoot(root, roots));

  wireDocumentClick();
  wireGlobalSync();
  installHtmlLangObserver();
}
