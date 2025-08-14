// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – používá suggestCities() a canonical mapování.
// UX vyladění (H5d):
// - diakriticky nezávislé zvýraznění shody (<mark>)
// - ARIA: role=listbox/option, aria-activedescendant, aria-live polite
// - klávesy: ↑/↓, Home/End, Enter, Escape; myš/dotyk (pointerdown)
// - loader stav, "no results", minimální flicker
// - lokalizované fallbacky (když chybí překlady v JSON)
// ---------------------------------------------------------

import { suggestCities } from './suggestClient.js';

/** diakriticky nezávislá normalizace (pro vyhledání shody) */
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** zvýrazní první výskyt dotazu (bez diakritiky), zachová původní label */
function highlight(label, query) {
  if (!label || !query) return label;
  const nl = norm(label);
  const nq = norm(query);
  const i = nl.indexOf(nq);
  if (i < 0) return label;
  const start = Array.from(label).slice(0, i).join('');
  const mid   = Array.from(label).slice(i, i + nq.length).join('');
  const end   = Array.from(label).slice(i + nq.length).join('');
  return `${start}<mark>${mid}</mark>${end}`;
}

/** jazykové fallbacky, když t(key) není k dispozici */
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
  return '';
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {{
 *   locale?: string,
 *   t?: (key:string, fallback?:string)=>string,
 *   countryCodes?: string[]|string,
 *   minChars?: number,
 *   debounceMs?: number,
 *   onChoose?: (item:{city:string,countryCode?:string,lat?:number,lon?:number,score?:number})=>void
 * }} opts
 */
export function setupCityTypeahead(inputEl, opts = {}) {
  if (!inputEl) return;

  const {
    locale = 'cs',
    t = (k, f) => (typeof window !== 'undefined' && window.translations && k in window.translations ? window.translations[k] : f),
    countryCodes = ['CZ', 'SK', 'PL', 'HU', 'DE', 'AT'],
    minChars = 2,
    debounceMs = 160,
    onChoose = (it) => { inputEl.value = it?.city || ''; }
  } = opts;

  // Panel + ARIA napojení
  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.style.display = 'none';
  const panelId = `${inputEl.id || 'city-input'}-listbox`;
  panel.id = panelId;
  inputEl.setAttribute('aria-controls', panelId);
  inputEl.setAttribute('aria-expanded', 'false');
  inputEl.setAttribute('autocomplete', 'off');

  // live region (oznámení počtu výsledků)
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const host = inputEl.parentElement || inputEl.closest('.input') || inputEl;
  host.appendChild(panel);
  host.appendChild(live);

  let items = [];
  let activeIndex = -1;
  let loading = false;
  let lastQuery = '';

  const open = () => { panel.style.display = 'block'; inputEl.setAttribute('aria-expanded', 'true'); };
  const close = () => {
    panel.style.display = 'none';
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };
  const isOpen = () => panel.style.display !== 'none';

  const announce = (msg) => { live.textContent = msg || ''; };

  const setActive = (idx) => {
    activeIndex = idx;
    const activeEl = panel.querySelector(`[data-index="${idx}"]`);
    if (activeEl) inputEl.setAttribute('aria-activedescendant', activeEl.id);
    panel.querySelectorAll('.typeahead-item').forEach(el => el.classList.remove('active'));
    if (activeEl) activeEl.classList.add('active');
  };

  const choose = (idx) => {
    const it = items[idx]; if (!it) return;
    onChoose(it);
    // vyvoláme change pro případné posluchače
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };

  const render = () => {
    if (loading) {
      panel.innerHTML = `<div class="typeahead-loading">${t('filters.loading', defaultText('loading', locale))}</div>`;
      return;
    }
    if (!items.length) {
      panel.innerHTML = `<div class="typeahead-empty">${t('filters.noResults', defaultText('noResults', locale))}</div>`;
      return;
    }

    panel.innerHTML = items.map((it, i) => {
      const meta = [it.state, it.countryCode].filter(Boolean).join(', ');
      const htmlLabel = highlight(it.city, lastQuery);
      const id = `${panelId}-opt-${i}`;
      return `
        <div id="${id}" class="typeahead-item ${i === activeIndex ? 'active' : ''}"
             role="option" aria-selected="${i === activeIndex ? 'true':'false'}"
             data-index="${i}">
          <span class="ti-city">${htmlLabel}</span>
          ${meta ? `<span class="ti-meta">${meta}</span>` : ''}
        </div>
      `;
    }).join('');

    // oznam jen do live-region (ne do UI), ať nezavazíme v panelu
    announce(defaultText('resultsCount', locale, items.length));
  };

  // výběr – pointerdown je spolehlivý i na mobilech
  panel.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;
    e.preventDefault(); // nevyvolá blur na inputu → neshodí panel dřív, než vybereme
    choose(parseInt(el.dataset.index, 10));
  });

  // hover = aktivní (myš)
  panel.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;
    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx) && idx !== activeIndex) setActive(idx);
  });

  // klik/pointer mimo panel → zavřít
  document.addEventListener('pointerdown', (e) => {
    if (!panel.contains(e.target) && e.target !== inputEl) close();
  });

  // klávesy
  inputEl.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(items.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) choose(activeIndex); else close();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  // debounce loader
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
      announce('');
      render();
      close();
      return;
    }

    loading = true;
    render();
    open();

    try {
      const list = await suggestCities({
        locale,
        keyword: q,
        size: 80,
        countryCodes
      });
      items = list;
      loading = false;
      render();
      // Aktivuj první položku kvůli Enter UX
      if (items.length) setActive(0);
    } catch {
      items = [];
      loading = false;
      render();
    }
  }

  // input změna
  inputEl.addEventListener('input', debouncedLoad);

  // fokus – když už jsou data, jen znovu otevři
  inputEl.addEventListener('focus', () => {
    if (inputEl.value.trim().length >= minChars && items.length) {
      render();
      open();
    }
  });
}
