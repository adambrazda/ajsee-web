// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – desktop dropdown + premium mobile bottom sheet
// ---------------------------------------------------------

import { suggestCities } from './suggestClient.js';

const STYLE_ID = 'ajsee-city-typeahead-inline-styles';

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.city-picker-open {
      position: fixed;
      inset: 0;
      width: 100%;
      overflow: hidden;
      touch-action: none;
    }

    .typeahead-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: var(--ajsee-popover-z, 10020);
      background: #fff;
      border: 1px solid rgba(157, 177, 205, 0.32);
      border-radius: 20px;
      box-shadow: 0 22px 64px rgba(16, 32, 68, 0.16);
      overflow: hidden;
      max-height: min(420px, 56vh);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      backdrop-filter: blur(18px);
    }

    .typeahead-loading,
    .typeahead-empty {
      padding: 16px 18px;
      color: #667085;
      font-size: 15px;
      line-height: 1.45;
    }

    .typeahead-section-title {
      padding: 14px 18px 8px;
      color: #667085;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .typeahead-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 14px 18px;
      cursor: pointer;
      transition: background-color .16s ease;
      border-top: 1px solid rgba(157, 177, 205, 0.14);
    }

    .typeahead-item:first-of-type {
      border-top: 0;
    }

    .typeahead-item:hover,
    .typeahead-item.active {
      background: linear-gradient(180deg, rgba(239, 247, 255, 0.92), rgba(245, 250, 255, 0.92));
    }

    .typeahead-item.nearme {
      background: linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(241, 248, 255, 0.98));
    }

    .typeahead-item.nearme .ti-city {
      color: #2f5fd0;
      font-weight: 800;
    }

    .ti-city {
      color: #0f172a;
      font-size: 17px;
      font-weight: 700;
      line-height: 1.28;
    }

    .ti-meta,
    .ti-sub {
      color: #667085;
      font-size: 13px;
      line-height: 1.4;
    }

    .ti-city mark,
    .city-sheet__option-city mark {
      background: rgba(46, 94, 217, 0.10);
      color: inherit;
      font-weight: 800;
      border-radius: 6px;
      padding: 0 .08em;
    }

    .city-sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: calc(var(--ajsee-popover-z, 10020) + 4);
      background: rgba(11, 16, 32, 0.28);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      opacity: 0;
      pointer-events: none;
      transition: opacity .22s ease;
      display: flex;
      align-items: flex-end;
      justify-content: stretch;
    }

    .city-sheet-backdrop.is-open {
      opacity: 1;
      pointer-events: auto;
    }

    .city-sheet {
      width: 100%;
      max-height: min(78svh, calc(var(--city-sheet-vh, 100vh) - 16px));
      min-height: min(420px, 62svh);
      background: rgba(255, 255, 255, 0.98);
      border-radius: 30px 30px 0 0;
      border: 1px solid rgba(157, 177, 205, 0.28);
      box-shadow: 0 -18px 60px rgba(8, 24, 56, 0.16);
      padding: 12px 22px calc(20px + env(safe-area-inset-bottom, 0px));
      transform: translateY(22px);
      transition: transform .22s ease;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .city-sheet-backdrop.is-open .city-sheet {
      transform: translateY(0);
    }

    .city-sheet__grab {
      width: 56px;
      height: 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.16);
      margin: 6px auto 18px;
      flex: 0 0 auto;
    }

    .city-sheet__header {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      flex: 0 0 auto;
    }

    .city-sheet__title {
      margin: 0;
      color: #0b1734;
      font-size: clamp(22px, 5vw, 30px);
      line-height: 1.08;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .city-sheet__subtitle {
      margin: 8px 0 0;
      color: #667085;
      font-size: 15px;
      line-height: 1.45;
      font-weight: 600;
    }

    .city-sheet__close {
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(157, 177, 205, 0.22);
      border-radius: 999px;
      background: rgba(246, 248, 252, 0.92);
      color: #344054;
      font-size: 18px;
      cursor: pointer;
    }

    .city-sheet__search-wrap {
      position: relative;
      margin-bottom: 14px;
      flex: 0 0 auto;
    }

    .city-sheet__search {
      width: 100%;
      height: 60px;
      border-radius: 20px;
      border: 1px solid rgba(157, 177, 205, 0.34);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
      padding: 0 18px;
      color: #0f172a;
      font-size: 18px;
      font-weight: 700;
      outline: none;
    }

    .city-sheet__search::placeholder {
      color: #98a2b3;
      font-weight: 700;
    }

    .city-sheet__search:focus {
      border-color: rgba(77, 122, 233, 0.52);
      box-shadow: 0 0 0 4px rgba(46, 94, 217, 0.10);
    }

    .city-sheet__content {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1 1 auto;
    }

    .city-sheet__nearme {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      width: 100%;
      border-radius: 22px;
      border: 1px solid rgba(109, 154, 234, 0.44);
      background: linear-gradient(180deg, rgba(244, 250, 255, 0.96), rgba(237, 246, 255, 0.96));
      padding: 16px 18px;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 10px 26px rgba(57, 93, 170, 0.08);
      flex: 0 0 auto;
    }

    .city-sheet__nearme-title {
      color: #2f5fd0;
      font-size: 18px;
      line-height: 1.25;
      font-weight: 800;
    }

    .city-sheet__nearme-sub {
      color: #667085;
      font-size: 15px;
      line-height: 1.35;
      font-weight: 700;
    }

    .city-sheet__section-title {
      margin-top: 6px;
      color: #667085;
      font-size: 12px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      flex: 0 0 auto;
    }

    .city-sheet__results {
      min-height: 0;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 10px;
    }

    .city-sheet__option,
    .city-sheet__state,
    .city-sheet__skeleton {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 15px 6px;
      text-align: left;
      background: transparent;
      border: 0;
      border-bottom: 1px solid rgba(157, 177, 205, 0.18);
    }

    .city-sheet__option:last-child {
      border-bottom: 0;
    }

    .city-sheet__option-city {
      color: #0f172a;
      font-size: 18px;
      line-height: 1.3;
      font-weight: 750;
    }

    .city-sheet__option-meta,
    .city-sheet__state small {
      color: #667085;
      font-size: 14px;
      line-height: 1.42;
      font-weight: 600;
    }

    .city-sheet__state {
      color: #667085;
      font-size: 15px;
      line-height: 1.5;
      padding-left: 0;
      padding-right: 0;
      pointer-events: none;
    }

    .city-sheet__state strong {
      color: #344054;
      font-weight: 800;
    }

    .city-sheet__skeleton {
      gap: 10px;
      padding-left: 0;
      padding-right: 0;
      pointer-events: none;
    }

    .city-sheet__skeleton-line {
      display: block;
      height: 12px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(226,232,240,0.85), rgba(241,245,249,1), rgba(226,232,240,0.85));
      background-size: 240px 100%;
      animation: citySheetShimmer 1.1s linear infinite;
    }

    .city-sheet__skeleton-line.is-main { width: 48%; height: 16px; }
    .city-sheet__skeleton-line.is-sub { width: 28%; }

    @keyframes citySheetShimmer {
      from { background-position: -240px 0; }
      to { background-position: 240px 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .city-sheet-backdrop,
      .city-sheet,
      .city-sheet__skeleton-line {
        transition: none !important;
        animation: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}

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

  if (key === 'noResultsHelp') {
    switch (L) {
      case 'cs': return 'Zkus jiný název města nebo použij aktuální polohu.';
      case 'sk': return 'Skús iný názov mesta alebo použi aktuálnu polohu.';
      case 'pl': return 'Spróbuj innej nazwy miasta lub użyj bieżącej lokalizacji.';
      case 'hu': return 'Próbálj másik városnevet, vagy használd az aktuális helyed.';
      case 'de': return 'Versuchen Sie einen anderen Stadtnamen oder verwenden Sie Ihren aktuellen Standort.';
      default:   return 'Try another city name or use your current location.';
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
      case 'cs': return 'Začni psát nebo použij aktuální polohu';
      case 'sk': return 'Začni písať alebo použi aktuálnu polohu';
      case 'pl': return 'Zacznij pisać lub użyj bieżącej lokalizacji';
      case 'hu': return 'Kezdj gépelni vagy használd az aktuális helyed';
      case 'de': return 'Beginnen Sie zu tippen oder verwenden Sie Ihren aktuellen Standort';
      default:   return 'Start typing or use your current location';
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

  if (key === 'popularCities') {
    switch (L) {
      case 'cs': return 'Oblíbená města';
      case 'sk': return 'Obľúbené mestá';
      case 'pl': return 'Popularne miasta';
      case 'hu': return 'Népszerű városok';
      case 'de': return 'Beliebte Städte';
      default:   return 'Popular cities';
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

function defaultT(k, fallback) {
  return (typeof window !== 'undefined'
      && window.translations
      && (k in window.translations))
    ? window.translations[k]
    : fallback;
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

    out.push({
      city,
      state,
      countryCode: cc || undefined,
      lat: typeof it.lat === 'number' ? it.lat : (typeof it.latitude === 'number' ? it.latitude : undefined),
      lon: typeof it.lon === 'number' ? it.lon : (typeof it.longitude === 'number' ? it.longitude : undefined),
      score: typeof it.score === 'number' ? it.score : undefined
    });
  }

  return out;
}

const DEFAULT_CITY_PRESETS = {
  prague:     { cs: 'Praha', en: 'Prague', de: 'Prag', sk: 'Praha', pl: 'Praga', hu: 'Prága' },
  brno:       { cs: 'Brno', en: 'Brno', de: 'Brünn', sk: 'Brno', pl: 'Brno', hu: 'Brünn' },
  ostrava:    { cs: 'Ostrava', en: 'Ostrava', de: 'Ostrau', sk: 'Ostrava', pl: 'Ostrawa', hu: 'Ostrava' },
  plzen:      { cs: 'Plzeň', en: 'Pilsen', de: 'Pilsen', sk: 'Plzeň', pl: 'Pilzno', hu: 'Plzeň' },
  liberec:    { cs: 'Liberec', en: 'Liberec', de: 'Reichenberg', sk: 'Liberec', pl: 'Liberec', hu: 'Liberec' },
  olomouc:    { cs: 'Olomouc', en: 'Olomouc', de: 'Olmütz', sk: 'Olomouc', pl: 'Ołomuniec', hu: 'Olmütz' },
  bratislava: { cs: 'Bratislava', en: 'Bratislava', de: 'Pressburg', sk: 'Bratislava', pl: 'Bratysława', hu: 'Pozsony' },
  wien:       { cs: 'Vídeň', en: 'Vienna', de: 'Wien', sk: 'Viedeň', pl: 'Wiedeń', hu: 'Bécs' }
};

function getPresetCity(slug, lang = 'cs') {
  const row = DEFAULT_CITY_PRESETS[slug];
  return row?.[lang] || row?.cs || slug;
}

function getDefaultCityItems(lang = 'cs') {
  const order = ['prague', 'brno', 'ostrava', 'plzen', 'liberec', 'olomouc'];
  return order.map((slug) => ({
    city: getPresetCity(slug, lang),
    state: '',
    countryCode: 'CZ'
  }));
}

function filterDefaultCityItems(query, lang = 'cs') {
  const q = norm(query);
  const base = getDefaultCityItems(lang);
  if (!q) return base;
  return base.filter((it) => norm(it.city).includes(q));
}

export function setupCityTypeahead(inputEl, opts = {}) {
  if (!inputEl) return;

  injectStylesOnce();

  if (typeof inputEl.__ajseeTypeaheadCleanup === 'function') {
    try { inputEl.__ajseeTypeaheadCleanup(); } catch {}
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
  const { signal } = controller;
  const on = (el, evt, handler, options = {}) => {
    if (!el) return;
    el.addEventListener(evt, handler, { ...options, signal });
  };

  const mobileMq = window.matchMedia('(max-width: 720px)');
  const isMobile = () => mobileMq.matches;

  const fieldEl = inputEl.closest('.field') || inputEl.parentElement || inputEl;
  const groupEl = inputEl.closest('.filter-group') || fieldEl;

  // ---------- desktop dropdown ----------
  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.hidden = true;
  panel.dataset.cityTa = '1';

  const uid = Math.random().toString(36).slice(2, 8);
  const panelId = `${inputEl.id || 'city-input'}-listbox-${uid}`;
  panel.id = panelId;

  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-controls', panelId);
  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('aria-expanded', 'false');

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
  let sheetSectionTitle = null;
  let sheetOpen = false;
  let sheetPointerStartY = null;
  let cleanupViewport = null;
  let previousFocus = null;
  let scrollYBeforeLock = 0;

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

  function getCurrentSearchValue() {
    if (isMobile() && sheetOpen && sheetSearch) {
      return (sheetSearch.value || '').trim();
    }
    return (inputEl.value || '').trim();
  }

  function setActive(idx) {
    activeIndex = idx;

    const activeEl = panel.querySelector(`[data-index="${idx}"]`);
    if (activeEl) inputEl.setAttribute('aria-activedescendant', activeEl.id);
    else inputEl.removeAttribute('aria-activedescendant');

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

  function getMobileSectionTitle() {
    const q = getCurrentSearchValue();
    return q.length >= minChars
      ? t('filters.suggestionsTitle', defaultText('suggestionsTitle', locale))
      : t('filters.popularCities', defaultText('popularCities', locale));
  }

  function renderSkeletonRows() {
    return Array.from({ length: 4 }).map(() => `
      <div class="city-sheet__skeleton" aria-hidden="true">
        <span class="city-sheet__skeleton-line is-main"></span>
        <span class="city-sheet__skeleton-line is-sub"></span>
      </div>
    `).join('');
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
            placeholder="${esc(t('filters.searchPlaceholder', defaultText('searchPlaceholder', locale)))}"
            autocomplete="off"
            autocapitalize="words"
            spellcheck="false"
            enterkeyhint="search"
          />
        </div>

        <div class="city-sheet__content">
          <button type="button" class="city-sheet__nearme">
            <span class="city-sheet__nearme-title">${esc(t('filters.nearMe', defaultText('nearMe', locale)))}</span>
            <span class="city-sheet__nearme-sub">${esc(t('filters.nearMeSubtitle', defaultText('nearMeSubtitle', locale)))}</span>
          </button>

          <div class="city-sheet__section-title">${esc(getMobileSectionTitle())}</div>

          <div class="city-sheet__results" role="listbox" aria-label="${esc(t('filters.suggestionsTitle', defaultText('suggestionsTitle', locale)))}"></div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    sheet = backdrop.querySelector('.city-sheet');
    sheetSearch = backdrop.querySelector('.city-sheet__search');
    sheetResults = backdrop.querySelector('.city-sheet__results');
    sheetNearMe = backdrop.querySelector('.city-sheet__nearme');
    sheetSectionTitle = backdrop.querySelector('.city-sheet__section-title');

    const closeBtn = backdrop.querySelector('.city-sheet__close');

    on(backdrop, 'click', (e) => {
      if (e.target === backdrop) closeMobile();
    });

    on(closeBtn, 'click', () => {
      closeMobile();
    });

    on(sheetNearMe, 'click', () => {
      handleNearMe();
    });

    on(sheetResults, 'click', (e) => {
      const btn = e.target.closest('[data-city-index]');
      if (!btn) return;

      const idx = parseInt(btn.getAttribute('data-city-index'), 10);
      if (!Number.isFinite(idx)) return;

      chooseCity(idx);
    });

    on(sheetSearch, 'input', () => {
      debouncedLoad(() => sheetSearch.value.trim());
    });

    on(sheetSearch, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobile();
      }
    });

    on(sheet, 'keydown', (e) => {
      if (e.key !== 'Tab') return;
      trapFocus(e);
    });

    on(sheet, 'pointerdown', (e) => {
      const rect = sheet.getBoundingClientRect();
      if (e.clientY > rect.top + 48) return;
      sheetPointerStartY = e.clientY;
    });

    on(sheet, 'pointerup', (e) => {
      if (sheetPointerStartY == null) return;
      const delta = e.clientY - sheetPointerStartY;
      sheetPointerStartY = null;
      if (delta > 70) closeMobile();
    });

    on(sheet, 'pointercancel', () => {
      sheetPointerStartY = null;
    });
  }

  function getFocusableInsideSheet() {
    if (!sheet) return [];
    return Array.from(sheet.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter((el) => !el.hasAttribute('hidden'));
  }

  function trapFocus(e) {
    const nodes = getFocusableInsideSheet();
    if (!nodes.length) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const current = document.activeElement;

    if (e.shiftKey && current === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function updateViewportVars() {
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--city-sheet-vh', `${vh}px`);
  }

  function lockBodyScroll() {
    scrollYBeforeLock = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('city-picker-open');
    document.body.style.top = `-${scrollYBeforeLock}px`;
  }

  function unlockBodyScroll() {
    document.body.classList.remove('city-picker-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollYBeforeLock);
  }

  function bindViewportListeners() {
    cleanupViewport?.();
    cleanupViewport = null;

    if (!window.visualViewport) {
      const onResize = () => updateViewportVars();
      window.addEventListener('resize', onResize, { signal });
      cleanupViewport = () => {};
      return;
    }

    const vv = window.visualViewport;
    const onResize = () => updateViewportVars();
    vv.addEventListener('resize', onResize, { signal });
    vv.addEventListener('scroll', onResize, { signal });
    cleanupViewport = () => {};
  }

  function openMobile() {
    ensureMobileSheet();
    closeDesktop();

    previousFocus = document.activeElement;
    updateViewportVars();
    bindViewportListeners();
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

    if (lastQuery.length >= minChars) {
      void load(() => sheetSearch.value.trim());
    } else {
      items = filterDefaultCityItems(lastQuery, locale);
      loading = false;
      renderMobile();
    }

    setTimeout(() => {
      try {
        sheetSearch.focus({ preventScroll: true });
        const len = sheetSearch.value.length;
        sheetSearch.setSelectionRange(len, len);
      } catch {}
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
    cleanupViewport?.();
    cleanupViewport = null;

    try {
      const target = previousFocus && typeof previousFocus.focus === 'function' ? previousFocus : inputEl;
      target.focus({ preventScroll: true });
    } catch {}
  }

  function renderDesktop() {
    const list = buildRenderList();
    const q = getCurrentSearchValue();

    if (loading) {
      panel.innerHTML = `<div class="typeahead-loading">${esc(t('filters.loading', defaultText('loading', locale)))}</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="typeahead-section-title">${esc(
        q.length >= minChars
          ? t('filters.suggestionsTitle', defaultText('suggestionsTitle', locale))
          : t('filters.popularCities', defaultText('popularCities', locale))
      )}</div>
      ${list.map((it, i) => {
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
              <span class="ti-sub">${esc(it.subtitle || '')}</span>
            </div>
          `;
        }

        const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
        const htmlLabel = highlight(it.city, q);
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
      }).join('')}
    `;

    announce(defaultText('resultsCount', locale, items.length));
  }

  function renderMobile() {
    if (!sheetOpen || !sheetResults || !sheetSectionTitle) return;

    const q = getCurrentSearchValue();
    const list = buildRenderList().filter((it) => !it.__nearMe);

    sheetSectionTitle.textContent = getMobileSectionTitle();

    if (loading) {
      sheetResults.innerHTML = renderSkeletonRows();
      return;
    }

    if (!list.length) {
      sheetResults.innerHTML = `
        <div class="city-sheet__state">
          <strong>${esc(t('filters.noResults', defaultText('noResults', locale)))}</strong>
          <small>${esc(t('filters.noResultsHelp', defaultText('noResultsHelp', locale)))}</small>
        </div>
      `;
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

  on(panel, 'pointerdown', (e) => {
    if (isMobile()) return;

    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    e.preventDefault();

    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx)) chooseCity(idx);
  });

  on(panel, 'mousemove', (e) => {
    if (isMobile()) return;

    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx) && idx !== activeIndex) {
      setActive(idx);
    }
  });

  on(document, 'pointerdown', (e) => {
    if (isMobile()) return;
    if (!panel.contains(e.target) && e.target !== inputEl) {
      closeDesktop();
    }
  }, true);

  on(inputEl, 'keydown', (e) => {
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
      : getCurrentSearchValue();

    lastQuery = q;

    if (q.length < minChars) {
      items = filterDefaultCityItems(q, locale);
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

  on(inputEl, 'input', () => {
    if (isMobile()) return;
    debouncedLoad(() => inputEl.value.trim());
  });

  on(inputEl, 'focus', () => {
    if (isMobile()) {
      inputEl.blur();
      openMobile();
      return;
    }

    items = filterDefaultCityItems(inputEl.value.trim(), locale);
    loading = false;
    renderDesktop();
    openDesktop();

    const hasCities = items.length > 0;
    setActive(includeNearMe ? 0 : (hasCities ? 0 : -1));
  });

  on(inputEl, 'click', (e) => {
    if (!isMobile()) return;
    e.preventDefault();
    openMobile();
  });

  on(inputEl, 'pointerdown', (e) => {
    if (!isMobile()) return;
    e.preventDefault();
    openMobile();
  });

  function handleNearMe() {
    announce(defaultText('nearMeSearching', locale));

    const emit = (geo) => {
      if (typeof onNearMe === 'function') {
        onNearMe(geo || {});
      } else {
        try {
          window.dispatchEvent(new CustomEvent('AJSEE:NearMe:coords', { detail: geo || {} }));
          window.dispatchEvent(new CustomEvent('ajsee:nearme:coords', { detail: geo || {} }));
        } catch {}
      }
    };

    if (!navigator.geolocation) {
      announce(defaultText('nearMeUnsupported', locale));
      try {
        window.dispatchEvent(new CustomEvent('AJSEE:NearMe:unsupported'));
      } catch {}
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
        } catch {}
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function handleMediaChange() {
    applyMode();
    if (!isMobile()) {
      items = filterDefaultCityItems(inputEl.value.trim(), locale);
    }
  }

  if (typeof mobileMq.addEventListener === 'function') {
    mobileMq.addEventListener('change', handleMediaChange, { signal });
  } else if (typeof mobileMq.addListener === 'function') {
    mobileMq.addListener(handleMediaChange);
  }

  applyMode();

  inputEl.__ajseeTypeaheadCleanup = () => {
    controller.abort();
    clearTimeout(timer);
    cleanupViewport?.();
    cleanupViewport = null;

    try { closeMobile(); } catch {}
    try { closeDesktop(); } catch {}

    if (panel.parentNode) panel.parentNode.removeChild(panel);
    if (live.parentNode) live.parentNode.removeChild(live);
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);

    if (typeof mobileMq.removeListener === 'function') {
      try { mobileMq.removeListener(handleMediaChange); } catch {}
    }

    delete inputEl.__ajseeTypeaheadCleanup;
  };
}
