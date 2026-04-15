// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – desktop dropdown + mobile bottom sheet
// ---------------------------------------------------------

import { suggestCities } from './suggestClient.js';

/** diakriticky nezávislá normalizace */
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** HTML escape */
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** zvýrazní první výskyt dotazu */
function highlight(label, query) {
  const raw = String(label || '');
  if (!raw || !query) return esc(raw);

  const nl = norm(raw);
  const nq = norm(query);
  const i = nl.indexOf(nq);

  if (i < 0) return esc(raw);

  const chars = Array.from(raw);
  const start = esc(chars.slice(0, i).join(''));
  const mid = esc(chars.slice(i, i + nq.length).join(''));
  const end = esc(chars.slice(i + nq.length).join(''));

  return `${start}<mark>${mid}</mark>${end}`;
}

/** nested lookup */
function getByPath(obj, path) {
  return String(path || '')
    .split('.')
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

/** fallback texty */
function defaultText(key, lang = 'en', n = 0) {
  const L = (lang || 'en').toLowerCase();
  const pluralFew = (x) =>
    (x % 10 >= 2 && x % 10 <= 4) && !(x % 100 >= 12 && x % 100 <= 14);

  if (key === 'loading') {
    switch (L) {
      case 'cs': return 'Načítám…';
      case 'sk': return 'Načítavam…';
      case 'pl': return 'Wczytywanie…';
      case 'hu': return 'Betöltés…';
      case 'de': return 'Lade…';
      default:   return 'Loading…';
    }
  }

  if (key === 'noResults') {
    switch (L) {
      case 'cs': return 'Žádné výsledky';
      case 'sk': return 'Žiadne výsledky';
      case 'pl': return 'Brak wyników';
      case 'hu': return 'Nincs találat';
      case 'de': return 'Keine Treffer';
      default:   return 'No results';
    }
  }

  if (key === 'resultsCount') {
    const nn = Number(n) || 0;
    switch (L) {
      case 'cs': return nn === 1 ? '1 výsledek' : pluralFew(nn) ? `${nn} výsledky` : `${nn} výsledků`;
      case 'sk': return nn === 1 ? '1 výsledok' : pluralFew(nn) ? `${nn} výsledky` : `${nn} výsledkov`;
      case 'pl': return nn === 1 ? '1 wynik'    : pluralFew(nn) ? `${nn} wyniki`   : `${nn} wyników`;
      case 'hu': return nn === 1 ? '1 találat'  : `${nn} találat`;
      case 'de': return nn === 1 ? '1 Ergebnis' : `${nn} Ergebnisse`;
      default:   return nn === 1 ? '1 result'   : `${nn} results`;
    }
  }

  if (key === 'nearMe') {
    switch (L) {
      case 'cs': return 'V mém okolí';
      case 'sk': return 'V mojom okolí';
      case 'pl': return 'W mojej okolicy';
      case 'hu': return 'A közelemben';
      case 'de': return 'In meiner Nähe';
      default:   return 'Near me';
    }
  }

  if (key === 'nearMeSubtitle') {
    switch (L) {
      case 'cs': return 'Použít aktuální polohu';
      case 'sk': return 'Použiť aktuálnu polohu';
      case 'pl': return 'Użyć bieżącej lokalizacji';
      case 'hu': return 'Aktuális hely használata';
      case 'de': return 'Aktuellen Standort verwenden';
      default:   return 'Use current location';
    }
  }

  if (key === 'pickerTitle') {
    switch (L) {
      case 'cs': return 'Vyber město';
      case 'sk': return 'Vyber mesto';
      case 'pl': return 'Wybierz miasto';
      case 'hu': return 'Válassz várost';
      case 'de': return 'Stadt wählen';
      default:   return 'Choose city';
    }
  }

  if (key === 'pickerSubtitle') {
    switch (L) {
      case 'cs': return 'Začni psát nebo použij svou polohu';
      case 'sk': return 'Začni písať alebo použi svoju polohu';
      case 'pl': return 'Zacznij pisać lub użyj swojej lokalizacji';
      case 'hu': return 'Kezdj gépelni vagy használd a polohu';
      case 'de': return 'Beginnen Sie zu tippen oder verwenden Sie Ihren Standort';
      default:   return 'Start typing or use your location';
    }
  }

  if (key === 'searchPlaceholder') {
    switch (L) {
      case 'cs': return 'Hledat město…';
      case 'sk': return 'Hľadať mesto…';
      case 'pl': return 'Szukaj miasta…';
      case 'hu': return 'Város keresése…';
      case 'de': return 'Stadt suchen…';
      default:   return 'Search city…';
    }
  }

  if (key === 'suggestionsTitle') {
    switch (L) {
      case 'cs': return 'Návrhy měst';
      case 'sk': return 'Návrhy miest';
      case 'pl': return 'Sugestie miast';
      case 'hu': return 'Városjavaslatok';
      case 'de': return 'Städtevorschläge';
      default:   return 'City suggestions';
    }
  }

  if (key === 'startTyping') {
    switch (L) {
      case 'cs': return 'Začni psát název města.';
      case 'sk': return 'Začni písať názov mesta.';
      case 'pl': return 'Zacznij wpisywać nazwę miasta.';
      case 'hu': return 'Kezdd el begépelni a város nevét.';
      case 'de': return 'Beginnen Sie, den Stadtnamen einzugeben.';
      default:   return 'Start typing a city name.';
    }
  }

  if (key === 'close') {
    switch (L) {
      case 'cs': return 'Zavřít';
      case 'sk': return 'Zavrieť';
      case 'pl': return 'Zamknij';
      case 'hu': return 'Bezárás';
      case 'de': return 'Schließen';
      default:   return 'Close';
    }
  }

  if (key === 'nearMeSearching') {
    switch (L) {
      case 'cs': return 'Hledám události ve vašem okolí…';
      case 'sk': return 'Hľadám podujatia vo vašom okolí…';
      case 'pl': return 'Szukam wydarzeń w Twojej okolicy…';
      case 'hu': return 'Események keresése a közeledben…';
      case 'de': return 'Suche Events in Ihrer Nähe…';
      default:   return 'Looking for events near you…';
    }
  }

  if (key === 'nearMeDenied') {
    switch (L) {
      case 'cs': return 'Přístup k poloze byl odepřen.';
      case 'sk': return 'Prístup k polohe bol zamietnutý.';
      case 'pl': return 'Dostęp do lokalizacji został odrzucony.';
      case 'hu': return 'A helyhozzáférés megtagadva.';
      case 'de': return 'Standortzugriff verweigert.';
      default:   return 'Location access denied.';
    }
  }

  if (key === 'nearMeUnsupported') {
    switch (L) {
      case 'cs': return 'Prohlížeč nepodporuje geolokaci.';
      case 'sk': return 'Prehliadač nepodporuje geolokáciu.';
      case 'pl': return 'Przeglądarka nie obsługuje geolokalizacji.';
      case 'hu': return 'A böngésző nem támogatja a helymeghatározást.';
      case 'de': return 'Browser unterstützt keine Geolokalisierung.';
      default:   return 'Geolocation is not supported.';
    }
  }

  return '';
}

function defaultT(key, fallback) {
  if (typeof window === 'undefined' || !window.translations) return fallback;
  const nested = getByPath(window.translations, key);
  if (nested !== undefined) return nested;
  if (window.translations[key] !== undefined) return window.translations[key];
  return fallback;
}

function normalizeAndDedupe(list = []) {
  const out = [];
  const seen = new Set();

  for (const it of list) {
    const city = (it && (it.city || it.name || it.label))
      ? String(it.city || it.name || it.label)
      : '';

    if (!city) continue;

    const state = it.state || it.region || '';
    const cc = it.countryCode || it.country || '';
    const key = `${norm(city)}|${norm(state)}|${norm(cc)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const latRaw = it.lat ?? it.latitude;
    const lonRaw = it.lon ?? it.longitude;
    const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
    const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw);

    out.push({
      city,
      state,
      countryCode: cc || undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      score: typeof it.score === 'number' ? it.score : undefined
    });
  }

  return out;
}

export function setupCityTypeahead(inputEl, opts = {}) {
  if (!inputEl) return;

  // cleanup previous instance on same input
  const prev = inputEl.__ajseeCityTypeahead;
  if (prev && typeof prev.destroy === 'function') {
    try { prev.destroy(); } catch { /* noop */ }
  }

  const {
    locale = 'cs',
    t: providedT,
    countryCodes = ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'],
    minChars = 2,
    debounceMs = 160,
    onChoose: providedOnChoose,
    onNearMe: providedOnNearMe,
  } = opts;

  const t = providedT || defaultT;
  const onChoose = providedOnChoose || ((it) => {
    inputEl.value = (it && it.city) ? it.city : '';
  });
  const onNearMe = providedOnNearMe || null;

  const controller = new AbortController();
  const listen = (target, type, handler, options = {}) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, { ...options, signal: controller.signal });
  };

  const mobileMq = window.matchMedia('(max-width: 720px)');
  const isMobile = () => mobileMq.matches;

  const fieldEl = inputEl.closest('.field') || inputEl.parentElement || inputEl;
  const groupEl = inputEl.closest('.filter-group') || fieldEl;

  // ---------- desktop dropdown ----------
  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('data-city-ta', '1');
  panel.hidden = true;

  const uid = Math.random().toString(36).slice(2, 8);
  const panelId = `${inputEl.id || 'city-input'}-listbox-${uid}`;
  panel.id = panelId;

  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-controls', panelId);
  inputEl.setAttribute('autocomplete', 'off');

  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  fieldEl.appendChild(panel);
  fieldEl.appendChild(live);

  let items = [];
  let activeIndex = -1;
  let loading = false;
  let lastQuery = '';
  let includeNearMe = true;
  let lastLoadId = 0;

  // ---------- mobile sheet ----------
  let backdrop = null;
  let sheet = null;
  let sheetSearch = null;
  let sheetResults = null;
  let sheetNearMe = null;
  let sheetHint = null;
  let sheetOpen = false;
  let scrollYBeforeLock = 0;
  let prevBodyStyles = null;

  const vv = window.visualViewport || null;

  function announce(msg) {
    live.textContent = msg || '';
  }

  function buildRenderList() {
    const arr = [];
    if (includeNearMe) {
      arr.push({
        __nearMe: true,
        id: `${panelId}-opt-nearme`,
        city: t('filters.nearMe', defaultText('nearMe', locale)),
        subtitle: t('filters.nearMeSubtitle', defaultText('nearMeSubtitle', locale))
      });
    }
    return arr.concat(items || []);
  }

  function setActive(idx) {
    activeIndex = idx;

    const activeEl = panel.querySelector(`[data-index="${idx}"]`);
    if (activeEl) inputEl.setAttribute('aria-activedescendant', activeEl.id);

    panel.querySelectorAll('.typeahead-item').forEach((el) => {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    });

    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.setAttribute('aria-selected', 'true');
    }
  }

  function openDesktop() {
    panel.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
    inputEl.setAttribute('aria-haspopup', 'listbox');
  }

  function closeDesktop() {
    panel.hidden = true;
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function isDesktopOpen() {
    return !panel.hidden;
  }

  function ensureMobileSheet() {
    if (backdrop) return;

    backdrop = document.createElement('div');
    backdrop.className = 'city-sheet-backdrop';
    backdrop.hidden = true;

    backdrop.innerHTML = `
      <div class="city-sheet" role="dialog" aria-modal="true" aria-labelledby="city-sheet-title-${uid}">
        <div class="city-sheet__grab" aria-hidden="true"></div>

        <div class="city-sheet__header">
          <div class="city-sheet__header-copy">
            <h3 class="city-sheet__title" id="city-sheet-title-${uid}">
              ${esc(t('filters.pickerTitle', defaultText('pickerTitle', locale)))}
            </h3>
            <p class="city-sheet__subtitle">
              ${esc(t('filters.pickerSubtitle', defaultText('pickerSubtitle', locale)))}
            </p>
          </div>

          <button type="button" class="city-sheet__close" aria-label="${esc(t('filters.close', defaultText('close', locale)))}">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="city-sheet__search-wrap">
          <input
            type="search"
            class="city-sheet__search"
            placeholder="${esc(t('filters.searchPlaceholder', defaultText('searchPlaceholder', locale)))}
            "
            autocomplete="off"
            autocapitalize="words"
            spellcheck="false"
          />
        </div>

        <div class="city-sheet__content">
          <button type="button" class="city-sheet__nearme">
            <span class="city-sheet__nearme-title">${esc(t('filters.nearMe', defaultText('nearMe', locale)))}</span>
            <span class="city-sheet__nearme-sub">${esc(t('filters.nearMeSubtitle', defaultText('nearMeSubtitle', locale)))}</span>
          </button>

          <div class="city-sheet__section-title">
            ${esc(t('filters.suggestionsTitle', defaultText('suggestionsTitle', locale)))}
          </div>

          <div class="city-sheet__hint">
            ${esc(t('filters.startTyping', defaultText('startTyping', locale)))}
          </div>

          <div class="city-sheet__results" role="listbox" aria-label="${esc(t('filters.suggestionsTitle', defaultText('suggestionsTitle', locale)))}"></div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    sheet = backdrop.querySelector('.city-sheet');
    sheetSearch = backdrop.querySelector('.city-sheet__search');
    sheetResults = backdrop.querySelector('.city-sheet__results');
    sheetNearMe = backdrop.querySelector('.city-sheet__nearme');
    sheetHint = backdrop.querySelector('.city-sheet__hint');

    const closeBtn = backdrop.querySelector('.city-sheet__close');

    listen(backdrop, 'click', (e) => {
      if (e.target === backdrop) closeMobile();
    });

    listen(closeBtn, 'click', () => {
      closeMobile();
    });

    listen(sheetNearMe, 'click', () => {
      handleNearMe();
    });

    listen(sheetResults, 'click', (e) => {
      const btn = e.target.closest('[data-city-index]');
      if (!btn) return;

      const idx = parseInt(btn.getAttribute('data-city-index'), 10);
      if (!Number.isFinite(idx)) return;

      chooseCity(idx);
    });

    listen(sheetSearch, 'input', () => {
      debouncedLoad(() => sheetSearch.value.trim());
    });

    listen(sheetSearch, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobile();
      }
    });
  }

  function updateViewportVars() {
    const vh = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--city-sheet-vh', `${vh}px`);
  }

  function lockBodyScroll() {
    const body = document.body;
    scrollYBeforeLock = window.scrollY || window.pageYOffset || 0;

    prevBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      touchAction: body.style.touchAction
    };

    body.classList.add('city-picker-open');
    body.style.position = 'fixed';
    body.style.top = `-${scrollYBeforeLock}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
  }

  function unlockBodyScroll() {
    const body = document.body;

    body.classList.remove('city-picker-open');

    if (prevBodyStyles) {
      body.style.position = prevBodyStyles.position || '';
      body.style.top = prevBodyStyles.top || '';
      body.style.left = prevBodyStyles.left || '';
      body.style.right = prevBodyStyles.right || '';
      body.style.width = prevBodyStyles.width || '';
      body.style.overflow = prevBodyStyles.overflow || '';
      body.style.touchAction = prevBodyStyles.touchAction || '';
    } else {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      body.style.touchAction = '';
    }

    window.scrollTo(0, scrollYBeforeLock);
  }

  function openMobile() {
    if (sheetOpen) return;

    ensureMobileSheet();
    closeDesktop();

    updateViewportVars();
    lockBodyScroll();

    backdrop.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
    });

    sheetOpen = true;
    inputEl.setAttribute('aria-expanded', 'true');
    inputEl.setAttribute('aria-haspopup', 'dialog');

    const currentValue = inputEl.dataset.autofromnearme === '1' ? '' : (inputEl.value || '');
    sheetSearch.value = currentValue;
    lastQuery = currentValue.trim();

    renderMobile();

    if (lastQuery.length >= minChars) {
      void load(() => sheetSearch.value.trim());
    }

    setTimeout(() => {
      try {
        sheetSearch.focus({ preventScroll: true });
        const len = sheetSearch.value.length;
        sheetSearch.setSelectionRange(len, len);
      } catch { /* noop */ }
    }, 40);
  }

  function closeMobile() {
    if (!backdrop || !sheetOpen) return;

    backdrop.classList.remove('is-open');
    sheetOpen = false;

    inputEl.setAttribute('aria-expanded', 'false');

    setTimeout(() => {
      if (backdrop) backdrop.hidden = true;
    }, 180);

    unlockBodyScroll();
  }

  function renderDesktop() {
    const list = buildRenderList();

    if (loading) {
      panel.innerHTML = `<div class="typeahead-loading">${esc(t('filters.loading', defaultText('loading', locale)))}</div>`;
      return;
    }

    const onlyNearMe = includeNearMe && list.length === 1 && list[0].__nearMe;
    if (!items.length && !onlyNearMe && lastQuery.length >= minChars) {
      panel.innerHTML = `<div class="typeahead-empty">${esc(t('filters.noResults', defaultText('noResults', locale)))}</div>`;
      return;
    }

    panel.innerHTML = list.map((it, i) => {
      if (it.__nearMe) {
        const id = it.id || `${panelId}-opt-nearme`;
        return `
          <div
            id="${id}"
            class="typeahead-item nearme ${i === activeIndex ? 'active' : ''}"
            role="option"
            aria-selected="${i === activeIndex ? 'true' : 'false'}"
            data-index="${i}">
            <span class="ti-city">${esc(it.city)}</span>
          </div>
        `;
      }

      const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
      const htmlLabel = highlight(it.city, lastQuery);
      const id = `${panelId}-opt-${i}`;

      return `
        <div
          id="${id}"
          class="typeahead-item ${i === activeIndex ? 'active' : ''}"
          role="option"
          aria-selected="${i === activeIndex ? 'true' : 'false'}"
          data-index="${i}">
          <span class="ti-city">${htmlLabel}</span>
          ${meta ? `<span class="ti-meta">${esc(meta)}</span>` : ''}
        </div>
      `;
    }).join('');

    announce(defaultText('resultsCount', locale, items.length));
  }

  function renderMobile() {
    if (!sheetOpen || !sheetResults || !sheetHint) return;

    const q = sheetSearch ? sheetSearch.value.trim() : '';
    const list = buildRenderList().filter((it) => !it.__nearMe);

    if (loading) {
      sheetHint.hidden = true;
      sheetResults.innerHTML = `<div class="city-sheet__state">${esc(t('filters.loading', defaultText('loading', locale)))}</div>`;
      return;
    }

    if (q.length < minChars) {
      sheetResults.innerHTML = '';
      sheetHint.hidden = false;
      return;
    }

    sheetHint.hidden = true;

    if (!list.length) {
      sheetResults.innerHTML = `<div class="city-sheet__state">${esc(t('filters.noResults', defaultText('noResults', locale)))}</div>`;
      return;
    }

    sheetResults.innerHTML = list.map((it, idx) => {
      const listIndex = includeNearMe ? idx + 1 : idx;
      const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
      const htmlLabel = highlight(it.city, q);

      return `
        <button
          type="button"
          class="city-sheet__option"
          role="option"
          aria-selected="false"
          data-city-index="${listIndex}">
          <span class="city-sheet__option-city">${htmlLabel}</span>
          ${meta ? `<span class="city-sheet__option-meta">${esc(meta)}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function render() {
    if (isMobile() && sheetOpen) {
      renderMobile();
    } else {
      renderDesktop();
    }
  }

  function chooseCity(idx) {
    const list = buildRenderList();
    const it = list[idx];
    if (!it) return;

    if (it.__nearMe) {
      handleNearMe();
      return;
    }

    inputEl.removeAttribute('data-autofromnearme');
    onChoose(it);
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    closeDesktop();
    closeMobile();
  }

  listen(panel, 'pointerdown', (e) => {
    if (isMobile()) return;

    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    e.preventDefault();

    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx)) chooseCity(idx);
  });

  listen(panel, 'mousemove', (e) => {
    if (isMobile()) return;

    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx) && idx !== activeIndex) {
      setActive(idx);
    }
  });

  listen(document, 'pointerdown', (e) => {
    if (isMobile()) return;
    if (!panel.contains(e.target) && e.target !== inputEl) {
      closeDesktop();
    }
  }, true);

  listen(inputEl, 'keydown', (e) => {
    if (isMobile()) return;
    if (!isDesktopOpen()) return;

    const list = buildRenderList();
    const last = list.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, last));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) chooseCity(activeIndex);
      else closeDesktop();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDesktop();
    }
  });

  let timer = null;
  function debouncedLoad(getQueryFn) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void load(getQueryFn);
    }, debounceMs);
  }

  async function load(getQueryFn) {
    const q = typeof getQueryFn === 'function'
      ? getQueryFn()
      : inputEl.value.trim();

    lastQuery = q;

    if (q.length < minChars) {
      items = [];
      loading = false;
      render();

      if (!isMobile()) {
        openDesktop();
        setActive(includeNearMe ? 0 : -1);
      }

      return;
    }

    const myLoadId = ++lastLoadId;
    loading = true;

    if (!isMobile()) openDesktop();
    render();

    try {
      const list = await suggestCities({
        locale,
        keyword: q,
        size: 80,
        countryCodes,
        countryCode: Array.isArray(countryCodes) ? countryCodes.join(',') : String(countryCodes || '')
      });

      if (myLoadId !== lastLoadId) return;

      items = normalizeAndDedupe(Array.isArray(list) ? list : []);
      loading = false;
      render();

      if (!isMobile()) {
        if (items.length) setActive(includeNearMe ? 1 : 0);
        else setActive(includeNearMe ? 0 : -1);
      }
    } catch {
      if (myLoadId !== lastLoadId) return;

      items = [];
      loading = false;
      render();

      if (!isMobile()) {
        setActive(includeNearMe ? 0 : -1);
      }
    }
  }

  function applyMode() {
    if (isMobile()) {
      inputEl.setAttribute('readonly', 'readonly');
      inputEl.setAttribute('inputmode', 'none');
      inputEl.classList.add('is-city-trigger');
      inputEl.setAttribute('aria-haspopup', 'dialog');
      closeDesktop();
    } else {
      inputEl.removeAttribute('readonly');
      inputEl.removeAttribute('inputmode');
      inputEl.classList.remove('is-city-trigger');
      inputEl.setAttribute('aria-haspopup', 'listbox');
      closeMobile();
    }
  }

  listen(inputEl, 'input', () => {
    if (isMobile()) return;
    debouncedLoad(() => inputEl.value.trim());
  });

  listen(inputEl, 'focus', () => {
    if (isMobile()) {
      inputEl.blur();
      openMobile();
      return;
    }

    renderDesktop();
    openDesktop();

    const hasCities = items.length > 0;
    setActive(includeNearMe ? 0 : (hasCities ? 0 : -1));
  });

  listen(inputEl, 'click', (e) => {
    if (!isMobile()) return;
    e.preventDefault();
    openMobile();
  });

  listen(inputEl, 'pointerdown', (e) => {
    if (!isMobile()) return;
    e.preventDefault();
    openMobile();
  });

  listen(inputEl, 'touchstart', (e) => {
    if (!isMobile()) return;
    e.preventDefault();
    openMobile();
  }, { passive: false });

  function handleNearMe() {
    announce(defaultText('nearMeSearching', locale));

    const emit = (geo) => {
      if (typeof onNearMe === 'function') {
        onNearMe(geo || {});
      } else {
        try {
          window.dispatchEvent(new CustomEvent('AJSEE:NearMe:coords', { detail: geo || {} }));
          window.dispatchEvent(new CustomEvent('ajsee:nearme:coords', { detail: geo || {} }));
        } catch { /* noop */ }
      }
    };

    if (!navigator.geolocation) {
      announce(defaultText('nearMeUnsupported', locale));
      try {
        window.dispatchEvent(new CustomEvent('AJSEE:NearMe:unsupported'));
      } catch { /* noop */ }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = pos && pos.coords ? pos.coords : {};
        const lat = coords.latitude;
        const lon = coords.longitude;
        const accuracy = coords.accuracy;

        inputEl.value = t('filters.nearMe', defaultText('nearMe', locale));
        inputEl.setAttribute('data-autofromnearme', '1');
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        emit({ lat, lon, accuracy });

        closeDesktop();
        closeMobile();
      },
      () => {
        announce(defaultText('nearMeDenied', locale));
        try {
          window.dispatchEvent(new CustomEvent('AJSEE:NearMe:error'));
        } catch { /* noop */ }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function handleViewportResize() {
    if (sheetOpen) updateViewportVars();
  }

  if (vv) {
    vv.addEventListener('resize', handleViewportResize);
    vv.addEventListener('scroll', handleViewportResize);
  }

  const mediaChangeHandler = () => {
    applyMode();
  };

  if (typeof mobileMq.addEventListener === 'function') {
    mobileMq.addEventListener('change', mediaChangeHandler);
  } else if (typeof mobileMq.addListener === 'function') {
    mobileMq.addListener(mediaChangeHandler);
  }

  applyMode();

  function destroy() {
    clearTimeout(timer);
    closeDesktop();
    closeMobile();

    try { controller.abort(); } catch { /* noop */ }

    if (vv) {
      try { vv.removeEventListener('resize', handleViewportResize); } catch { /* noop */ }
      try { vv.removeEventListener('scroll', handleViewportResize); } catch { /* noop */ }
    }

    if (typeof mobileMq.removeEventListener === 'function') {
      try { mobileMq.removeEventListener('change', mediaChangeHandler); } catch { /* noop */ }
    } else if (typeof mobileMq.removeListener === 'function') {
      try { mobileMq.removeListener(mediaChangeHandler); } catch { /* noop */ }
    }

    try { panel.remove(); } catch { /* noop */ }
    try { live.remove(); } catch { /* noop */ }
    try { backdrop?.remove(); } catch { /* noop */ }

    inputEl.removeAttribute('aria-activedescendant');
    inputEl.removeAttribute('aria-expanded');
    inputEl.removeAttribute('readonly');
    inputEl.removeAttribute('inputmode');
    inputEl.classList.remove('is-city-trigger');

    delete inputEl.__ajseeCityTypeahead;
  }

  inputEl.__ajseeCityTypeahead = { destroy };
}