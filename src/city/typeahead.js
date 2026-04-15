// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – používá suggestCities() a canonical mapování.
// B2:
// - iOS/Safari safe: žádný fixed bottom sheet / overlay
// - mobil = prémiový anchored dropdown u inputu
// - smart flip nahoru, když dole není místo
// - diakriticky nezávislé zvýraznění shody
// - ARIA: role=combobox/listbox/option, aria-activedescendant, aria-live polite
// - klávesy: ↑/↓, Home/End, Enter, Escape
// - trvale dostupné „V mém okolí“
// - odolnost proti závodům (aplikuj jen poslední výsledek)
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

  if (key === 'nearMeHelper') {
    switch (L) {
      case 'cs': return 'Použít aktuální polohu';
      case 'sk': return 'Použiť aktuálnu polohu';
      case 'pl': return 'Użyj bieżącej lokalizacji';
      case 'hu': return 'Aktuális hely használata';
      case 'de': return 'Aktuellen Standort verwenden';
      default: return 'Use current location';
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

  return '';
}

/** bezpečný default překladače */
function defaultT(k, f) {
  return (typeof window !== 'undefined' &&
    window.translations &&
    (k in window.translations))
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
  const onChoose = providedOnChoose || ((it) => {
    inputEl.value = (it && it.city) ? it.city : '';
  });
  const onNearMe = providedOnNearMe || null;

  const MOBILE_BP = 720;
  const isMobile = () => window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;

  const host =
    inputEl.closest('.field') ||
    inputEl.parentElement ||
    inputEl;

  host.classList.add('has-typeahead');

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

  host.appendChild(panel);
  host.appendChild(live);

  let items = [];
  let activeIndex = -1;
  let loading = false;
  let lastQuery = '';
  let includeNearMe = true;
  let lastLoadId = 0;

  const announce = (msg) => {
    live.textContent = msg || '';
  };

  const isOpen = () => panel.style.display !== 'none';

  function syncPanelPosition() {
    if (!isOpen()) return;

    const rect = inputEl.getBoundingClientRect();
    const viewportH = window.visualViewport?.height || window.innerHeight;

    const spaceBelow = Math.max(120, Math.floor(viewportH - rect.bottom - 12));
    const spaceAbove = Math.max(120, Math.floor(rect.top - 12));
    const preferredHeight = isMobile() ? 320 : 360;

    panel.classList.toggle('is-mobile-card', isMobile());

    const shouldFlipUp = spaceBelow < 220 && spaceAbove > (spaceBelow + 48);
    panel.classList.toggle('is-flip-up', shouldFlipUp);

    const maxHeight = shouldFlipUp
      ? Math.min(spaceAbove, preferredHeight)
      : Math.min(spaceBelow, preferredHeight);

    panel.style.maxHeight = `${Math.max(160, maxHeight)}px`;
  }

  function open() {
    panel.style.display = 'block';
    inputEl.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(syncPanelPosition);
  }

  function close() {
    panel.style.display = 'none';
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    panel.classList.remove('is-flip-up');
  }

  function setActive(idx) {
    activeIndex = idx;

    const activeEl = panel.querySelector(`[data-index="${idx}"]`);
    if (activeEl) {
      inputEl.setAttribute('aria-activedescendant', activeEl.id);
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }

    panel.querySelectorAll('.typeahead-item').forEach((el) => {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    });

    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.setAttribute('aria-selected', 'true');
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function buildRenderList() {
    const arr = [];

    if (includeNearMe) {
      arr.push({
        __nearMe: true,
        id: `${panelId}-opt-nearme`,
        city: t('filters.nearMe', defaultText('nearMe', locale)),
        helper: defaultText('nearMeHelper', locale),
      });
    }

    return arr.concat(items || []);
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
    close();
  }

  function render() {
    const list = buildRenderList();
    const header = `
      <div class="typeahead-header">
        ${esc(defaultText('suggestionsTitle', locale))}
      </div>
    `;

    if (loading) {
      panel.innerHTML = `
        ${header}
        <div class="typeahead-status typeahead-loading">
          ${esc(t('filters.loading', defaultText('loading', locale)))}
        </div>
      `;
      syncPanelPosition();
      return;
    }

    const onlyNearMe = includeNearMe && list.length === 1 && list[0].__nearMe;

    if (!items.length && !onlyNearMe) {
      panel.innerHTML = `
        ${header}
        <div class="typeahead-status typeahead-empty">
          ${esc(t('filters.noResults', defaultText('noResults', locale)))}
        </div>
      `;
      syncPanelPosition();
      return;
    }

    const html = list.map((it, i) => {
      if (it.__nearMe) {
        const id = it.id || `${panelId}-opt-nearme`;
        return `
          <div
            id="${id}"
            class="typeahead-item nearme ${i === activeIndex ? 'active' : ''}"
            role="option"
            aria-selected="${i === activeIndex ? 'true' : 'false'}"
            data-index="${i}"
          >
            <div class="ti-copy">
              <span class="ti-city">${esc(it.city)}</span>
              <span class="ti-meta">${esc(it.helper || '')}</span>
            </div>
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
          data-index="${i}"
        >
          <div class="ti-copy">
            <span class="ti-city">${htmlLabel}</span>
            ${meta ? `<span class="ti-meta">${esc(meta)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      ${header}
      <div class="typeahead-list" role="presentation">
        ${html}
      </div>
    `;

    announce(defaultText('resultsCount', locale, items.length));
    syncPanelPosition();
  }

  panel.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    e.preventDefault();
    const idx = parseInt(el.dataset.index || '', 10);
    if (Number.isFinite(idx)) chooseCity(idx);
  });

  panel.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;

    const idx = parseInt(el.dataset.index || '', 10);
    if (Number.isFinite(idx) && idx !== activeIndex) {
      setActive(idx);
    }
  });

  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!panel.contains(target) && !host.contains(target) && target !== inputEl) {
      close();
    }
  }, true);

  inputEl.addEventListener('keydown', (e) => {
    if (!isOpen()) return;

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
      if (activeIndex >= 0) {
        chooseCity(activeIndex);
      } else {
        close();
      }
    } else if (e.key === 'Escape') {
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
      render();
      open();
      setActive(includeNearMe ? 0 : -1);
      return;
    }

    const myLoadId = ++lastLoadId;
    loading = true;
    render();
    open();

    try {
      const list = await suggestCities({
        locale,
        keyword: q,
        size: 80,
        countryCodes,
        countryCode: Array.isArray(countryCodes)
          ? countryCodes.join(',')
          : String(countryCodes || '')
      });

      if (myLoadId !== lastLoadId) return;

      items = normalizeAndDedupe(Array.isArray(list) ? list : []);
      loading = false;
      render();

      if (items.length) {
        setActive(includeNearMe ? 1 : 0);
      } else {
        setActive(includeNearMe ? 0 : -1);
      }
    } catch {
      if (myLoadId !== lastLoadId) return;

      items = [];
      loading = false;
      render();
      setActive(includeNearMe ? 0 : -1);
    }
  }

  inputEl.addEventListener('input', () => {
    inputEl.removeAttribute('data-autofromnearme');
    debouncedLoad();
  });

  inputEl.addEventListener('focus', () => {
    render();
    open();
    const hasCities = items.length > 0;
    setActive(includeNearMe ? 0 : (hasCities ? 0 : -1));
  });

  inputEl.addEventListener('blur', () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!panel.contains(active) && active !== inputEl) {
        close();
      }
    }, 140);
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

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', () => {
      if (isOpen()) syncPanelPosition();
    });
    vv.addEventListener('scroll', () => {
      if (isOpen()) syncPanelPosition();
    });
  }

  window.addEventListener('resize', () => {
    if (isOpen()) syncPanelPosition();
  });

  window.addEventListener('scroll', () => {
    if (isOpen()) syncPanelPosition();
  }, { passive: true });
}