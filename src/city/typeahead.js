// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – verze B
// - desktop: elegantní dropdown pod polem
// - mobile: prémiový bottom sheet přes celou UI vrstvu
// - rychlá města + "V mém okolí"
// - ARIA, klávesnice, debounce, odolnost proti závodům
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

/** základní HTML escape */
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** zvýrazní první výskyt dotazu (bez diakritiky), zachová původní label */
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

/** jazykové fallbacky */
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
      default: return 'Loading…';
    }
  }

  if (key === 'noResults') {
    switch (L) {
      case 'cs': return 'Žádné výsledky';
      case 'sk': return 'Žiadne výsledky';
      case 'pl': return 'Brak wyników';
      case 'hu': return 'Nincs találat';
      case 'de': return 'Keine Treffer';
      default: return 'No results';
    }
  }

  if (key === 'resultsCount') {
    const nn = Number(n) || 0;
    switch (L) {
      case 'cs': return nn === 1 ? '1 výsledek' : pluralFew(nn) ? `${nn} výsledky` : `${nn} výsledků`;
      case 'sk': return nn === 1 ? '1 výsledok' : pluralFew(nn) ? `${nn} výsledky` : `${nn} výsledkov`;
      case 'pl': return nn === 1 ? '1 wynik' : pluralFew(nn) ? `${nn} wyniki` : `${nn} wyników`;
      case 'hu': return nn === 1 ? '1 találat' : `${nn} találat`;
      case 'de': return nn === 1 ? '1 Ergebnis' : `${nn} Ergebnisse`;
      default: return nn === 1 ? '1 result' : `${nn} results`;
    }
  }

  if (key === 'nearMe') {
    switch (L) {
      case 'cs': return 'V mém okolí';
      case 'sk': return 'V mojom okolí';
      case 'pl': return 'W mojej okolicy';
      case 'hu': return 'A közelemben';
      case 'de': return 'In meiner Nähe';
      default: return 'Near me';
    }
  }

  if (key === 'nearMeSearching') {
    switch (L) {
      case 'cs': return 'Hledám události ve vašem okolí…';
      case 'sk': return 'Hľadám podujatia vo vašom okolí…';
      case 'pl': return 'Szukam wydarzeń w Twojej okolicy…';
      case 'hu': return 'Események keresése a közeledben…';
      case 'de': return 'Suche Events in Ihrer Nähe…';
      default: return 'Looking for events near you…';
    }
  }

  if (key === 'nearMeDenied') {
    switch (L) {
      case 'cs': return 'Přístup k poloze byl odepřen.';
      case 'sk': return 'Prístup k polohe bol zamietnutý.';
      case 'pl': return 'Dostęp do lokalizacji został odrzucony.';
      case 'hu': return 'A helyhozzáférés megtagadva.';
      case 'de': return 'Standortzugriff verweigert.';
      default: return 'Location access denied.';
    }
  }

  if (key === 'nearMeUnsupported') {
    switch (L) {
      case 'cs': return 'Prohlížeč nepodporuje geolokaci.';
      case 'sk': return 'Prehliadač nepodporuje geolokáciu.';
      case 'pl': return 'Przeglądarka nie obsługuje geolokalizacji.';
      case 'hu': return 'A böngésző nem támogatja a helymeghatározást.';
      case 'de': return 'Browser unterstützt keine Geolokalisierung.';
      default: return 'Geolocation is not supported.';
    }
  }

  if (key === 'cityPickerTitle') {
    switch (L) {
      case 'cs': return 'Vyber město';
      case 'sk': return 'Vyber mesto';
      case 'pl': return 'Wybierz miasto';
      case 'hu': return 'Válassz várost';
      case 'de': return 'Stadt auswählen';
      default: return 'Choose a city';
    }
  }

  if (key === 'popularCities') {
    switch (L) {
      case 'cs': return 'Rychlá volba';
      case 'sk': return 'Rýchla voľba';
      case 'pl': return 'Szybki wybór';
      case 'hu': return 'Gyors választás';
      case 'de': return 'Schnellauswahl';
      default: return 'Quick picks';
    }
  }

  if (key === 'suggestionsTitle') {
    switch (L) {
      case 'cs': return 'Návrhy měst';
      case 'sk': return 'Návrhy miest';
      case 'pl': return 'Sugestie miast';
      case 'hu': return 'Városjavaslatok';
      case 'de': return 'Stadtvorschläge';
      default: return 'City suggestions';
    }
  }

  if (key === 'close') {
    switch (L) {
      case 'cs': return 'Zavřít';
      case 'sk': return 'Zavrieť';
      case 'pl': return 'Zamknij';
      case 'hu': return 'Bezárás';
      case 'de': return 'Schließen';
      default: return 'Close';
    }
  }

  return '';
}

/** bezpečný default překladače */
function defaultT(k, f) {
  return (typeof window !== 'undefined' && window.translations && (k in window.translations))
    ? window.translations[k]
    : f;
}

/** dedupe + jemná normalizace návrhů */
function normalizeAndDedupe(list = []) {
  const out = [];
  const seen = new Set();

  for (const it of list) {
    const city = (it && (it.city || it.name || it.label)) ? String(it.city || it.name || it.label) : '';
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

function getQuickCities(lang = 'cs') {
  const L = (lang || 'cs').toLowerCase();

  switch (L) {
    case 'en':
      return ['Prague', 'Brno', 'Ostrava', 'Pilsen'];
    case 'de':
      return ['Prag', 'Brünn', 'Ostrau', 'Pilsen'];
    case 'pl':
      return ['Praga', 'Brno', 'Ostrawa', 'Pilzno'];
    case 'hu':
      return ['Prága', 'Brno', 'Ostrava', 'Plzeň'];
    case 'sk':
    case 'cs':
    default:
      return ['Praha', 'Brno', 'Ostrava', 'Plzeň'];
  }
}

function uniqueByNormCity(list = []) {
  const seen = new Set();
  return list.filter((item) => {
    const key = norm(item.city || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function setupCityTypeahead(inputEl, opts = {}) {
  if (!inputEl) return;

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
  const onChoose = providedOnChoose || ((it) => { inputEl.value = (it && it.city) ? it.city : ''; });
  const onNearMe = providedOnNearMe || null;

  const MOBILE_BP = 720;
  const isMobileSheet = () => window.innerWidth <= MOBILE_BP;

  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.style.display = 'none';

  const uid = Math.random().toString(36).slice(2, 8);
  const panelId = `${inputEl.id || 'city-input'}-listbox-${uid}`;
  panel.id = panelId;

  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-haspopup', 'listbox');
  inputEl.setAttribute('aria-controls', panelId);
  inputEl.setAttribute('aria-expanded', 'false');
  inputEl.setAttribute('autocomplete', 'off');

  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'typeahead-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.display = 'none';

  const host = inputEl.parentElement || inputEl.closest('.input') || inputEl;
  host.appendChild(panel);
  host.appendChild(live);
  document.body.appendChild(backdrop);

  let items = [];
  let activeIndex = -1;
  let loading = false;
  let lastQuery = '';
  let includeNearMe = true;
  let lastLoadId = 0;

  const announce = (msg) => {
    live.textContent = msg || '';
  };

  const open = () => {
    panel.style.display = 'block';
    inputEl.setAttribute('aria-expanded', 'true');

    if (isMobileSheet()) {
      panel.classList.add('is-mobile-sheet');
      backdrop.style.display = 'block';
      document.body.classList.add('typeahead-sheet-open');
    } else {
      panel.classList.remove('is-mobile-sheet');
      backdrop.style.display = 'none';
      document.body.classList.remove('typeahead-sheet-open');
    }
  };

  const close = () => {
    panel.style.display = 'none';
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    panel.classList.remove('is-mobile-sheet');
    backdrop.style.display = 'none';
    document.body.classList.remove('typeahead-sheet-open');
    activeIndex = -1;
  };

  const isOpen = () => panel.style.display !== 'none';

  const setActive = (idx) => {
    activeIndex = idx;
    const activeEl = panel.querySelector(`.typeahead-item[data-index="${idx}"]`);

    if (activeEl) {
      inputEl.setAttribute('aria-activedescendant', activeEl.id);
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }

    panel.querySelectorAll('.typeahead-item').forEach((el) => el.classList.remove('active'));
    if (activeEl) activeEl.classList.add('active');
  };

  function chooseSuggestion(item) {
    if (!item) return;
    onChoose(item);
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

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
        close();
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

  function renderDesktop() {
    const desktopList = [];

    if (includeNearMe) {
      desktopList.push({
        __nearMe: true,
        id: `${panelId}-opt-nearme`,
        city: t('filters.nearMe', defaultText('nearMe', locale))
      });
    }

    desktopList.push(...items);

    if (loading) {
      panel.innerHTML = `<div class="typeahead-loading">${esc(t('filters.loading', defaultText('loading', locale)))}</div>`;
      return;
    }

    const onlyNearMe = includeNearMe && desktopList.length === 1 && desktopList[0].__nearMe;
    if (!items.length && !onlyNearMe) {
      panel.innerHTML = `<div class="typeahead-empty">${esc(t('filters.noResults', defaultText('noResults', locale)))}</div>`;
      return;
    }

    panel.innerHTML = desktopList.map((it, i) => {
      if (it.__nearMe) {
        const id = it.id || `${panelId}-opt-nearme`;
        return `
          <div id="${id}" class="typeahead-item nearme ${i === activeIndex ? 'active' : ''}"
               role="option"
               aria-selected="${i === activeIndex ? 'true' : 'false'}"
               data-index="${i}"
               data-kind="nearme">
            <span class="ti-city">${esc(it.city)}</span>
          </div>
        `;
      }

      const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
      const htmlLabel = highlight(it.city, lastQuery);
      const id = `${panelId}-opt-${i}`;

      return `
        <div id="${id}" class="typeahead-item ${i === activeIndex ? 'active' : ''}"
             role="option"
             aria-selected="${i === activeIndex ? 'true' : 'false'}"
             data-index="${i}"
             data-kind="city">
          <span class="ti-city">${htmlLabel}</span>
          ${meta ? `<span class="ti-meta">${esc(meta)}</span>` : ''}
        </div>
      `;
    }).join('');

    announce(defaultText('resultsCount', locale, items.length));
  }

  function renderMobile() {
    const closeLabel = defaultText('close', locale);
    const pickerTitle = defaultText('cityPickerTitle', locale);
    const quickTitle = defaultText('popularCities', locale);
    const suggestionsTitle = defaultText('suggestionsTitle', locale);
    const showQuickCities = !lastQuery || lastQuery.length < minChars;
    const quickCities = uniqueByNormCity(
      getQuickCities(locale).map((city) => ({ city }))
    );

    let bodyHtml = `
      <div class="typeahead-sheet-head">
        <div class="typeahead-sheet-copy">
          <div class="typeahead-sheet-kicker">${esc(t('filters.city', 'Město'))}</div>
          <div class="typeahead-sheet-title">${esc(pickerTitle)}</div>
        </div>
        <button type="button" class="typeahead-sheet-close" aria-label="${esc(closeLabel)}">×</button>
      </div>
      <div class="typeahead-sheet-body">
        <button type="button" class="typeahead-nearme-card" data-kind="nearme-card">
          <span class="typeahead-nearme-icon" aria-hidden="true">◎</span>
          <span class="typeahead-nearme-copy">
            <span class="typeahead-nearme-title">${esc(t('filters.nearMe', defaultText('nearMe', locale)))}</span>
          </span>
        </button>
    `;

    if (showQuickCities) {
      bodyHtml += `
        <div class="typeahead-section">
          <div class="typeahead-section-title">${esc(quickTitle)}</div>
          <div class="typeahead-quick-grid">
            ${quickCities.map((it) => `
              <button type="button" class="typeahead-quick-btn" data-quick-city="${esc(it.city)}">
                ${esc(it.city)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (loading) {
      bodyHtml += `<div class="typeahead-loading">${esc(t('filters.loading', defaultText('loading', locale)))}</div>`;
    } else if (items.length) {
      bodyHtml += `
        <div class="typeahead-section">
          <div class="typeahead-section-title">${esc(suggestionsTitle)}</div>
          <div class="typeahead-results">
            ${items.map((it, i) => {
              const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
              const htmlLabel = highlight(it.city, lastQuery);
              const id = `${panelId}-mob-opt-${i}`;

              return `
                <div id="${id}" class="typeahead-item ${i === activeIndex ? 'active' : ''}"
                     role="option"
                     aria-selected="${i === activeIndex ? 'true' : 'false'}"
                     data-index="${i}"
                     data-kind="city">
                  <span class="ti-city">${htmlLabel}</span>
                  ${meta ? `<span class="ti-meta">${esc(meta)}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (lastQuery.length >= minChars) {
      bodyHtml += `<div class="typeahead-empty">${esc(t('filters.noResults', defaultText('noResults', locale)))}</div>`;
    }

    bodyHtml += `</div>`;
    panel.innerHTML = bodyHtml;

    announce(defaultText('resultsCount', locale, items.length));
  }

  function render() {
    if (isMobileSheet()) {
      renderMobile();
    } else {
      renderDesktop();
    }
  }

  panel.addEventListener('pointerdown', (e) => {
    const closeBtn = e.target.closest('.typeahead-sheet-close');
    if (closeBtn) {
      e.preventDefault();
      close();
      return;
    }

    const nearMeCard = e.target.closest('[data-kind="nearme-card"]');
    if (nearMeCard) {
      e.preventDefault();
      handleNearMe();
      return;
    }

    const quickBtn = e.target.closest('.typeahead-quick-btn');
    if (quickBtn) {
      e.preventDefault();
      const city = quickBtn.getAttribute('data-quick-city');
      if (city) {
        chooseSuggestion({ city });
      }
      return;
    }

    const itemEl = e.target.closest('.typeahead-item');
    if (!itemEl) return;

    e.preventDefault();

    const kind = itemEl.getAttribute('data-kind');
    if (kind === 'nearme') {
      handleNearMe();
      return;
    }

    const idx = parseInt(itemEl.dataset.index || '', 10);
    if (!Number.isFinite(idx)) return;

    if (isMobileSheet()) {
      const item = items[idx];
      if (item) chooseSuggestion(item);
      return;
    }

    const desktopList = [];
    if (includeNearMe) {
      desktopList.push({
        __nearMe: true,
        city: t('filters.nearMe', defaultText('nearMe', locale))
      });
    }
    desktopList.push(...items);

    const item = desktopList[idx];
    if (!item) return;

    if (item.__nearMe) {
      handleNearMe();
      return;
    }

    chooseSuggestion(item);
  });

  panel.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.typeahead-item[data-kind="city"]');
    if (!el) return;

    const idx = parseInt(el.dataset.index || '', 10);
    if (Number.isFinite(idx) && idx !== activeIndex) {
      setActive(idx);
    }
  });

  backdrop.addEventListener('pointerdown', () => {
    close();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!panel.contains(e.target) && e.target !== inputEl && e.target !== backdrop) {
      close();
    }
  }, true);

  inputEl.addEventListener('keydown', (e) => {
    if (!isOpen()) return;

    const listLength = isMobileSheet() ? items.length : (items.length + (includeNearMe ? 1 : 0));
    const last = listLength - 1;

    if (listLength <= 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, last));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (activeIndex < 0) {
        close();
        return;
      }

      if (isMobileSheet()) {
        const item = items[activeIndex];
        if (item) chooseSuggestion(item);
        return;
      }

      if (includeNearMe && activeIndex === 0) {
        handleNearMe();
        return;
      }

      const item = items[includeNearMe ? activeIndex - 1 : activeIndex];
      if (item) chooseSuggestion(item);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  let timer = null;
  const debouncedLoad = () => {
    clearTimeout(timer);
    timer = setTimeout(load, debounceMs);
  };

  async function load() {
    const q = inputEl.value.trim();
    lastQuery = q;

    if (q.length < minChars) {
      items = [];
      loading = false;
      activeIndex = -1;
      render();
      open();
      return;
    }

    const myLoadId = ++lastLoadId;
    loading = true;
    activeIndex = -1;
    render();
    open();

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

      if (items.length) {
        setActive(0);
      }
    } catch {
      if (myLoadId !== lastLoadId) return;

      items = [];
      loading = false;
      activeIndex = -1;
      render();
    }
  }

  inputEl.addEventListener('input', () => {
    inputEl.removeAttribute('data-autofromnearme');
    debouncedLoad();
  });

  inputEl.addEventListener('focus', () => {
    if (!inputEl.value.trim()) {
      items = [];
      lastQuery = '';
      loading = false;
      activeIndex = -1;
    }

    render();
    open();
  });

  window.addEventListener('resize', () => {
    if (!isOpen()) return;
    render();
    open();
  });
}