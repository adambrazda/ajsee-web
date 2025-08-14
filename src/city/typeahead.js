// src/city/typeahead.js
// ---------------------------------------------------------
// City Typeahead UI – používá suggestCities() a canonical mapování.
// UX vyladění (H5d):
// - diakriticky nezávislé zvýraznění shody (<mark>)
// - ARIA: role=listbox/option, aria-activedescendant, aria-live polite
// - klávesy: ↑/↓, Enter, Escape, Home/End, myš, focus reopen
// - loader stav, "no results", minimální flicker
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
    t = (k, f) => f || k,
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
    close();
  };

  const render = () => {
    if (loading) {
      panel.innerHTML = `<div class="typeahead-loading">${t('filters.loading','Načítám…')}</div>`;
      return;
    }
    if (!items.length) {
      panel.innerHTML = `<div class="typeahead-empty">${t('filters.noResults','Žádné výsledky')}</div>`;
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
  };

  // klik myší
  panel.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;
    e.preventDefault(); // nepropadne blur na inputu
    choose(parseInt(el.dataset.index, 10));
  });

  // hover = aktivní
  panel.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (!el) return;
    const idx = parseInt(el.dataset.index, 10);
    if (Number.isFinite(idx) && idx !== activeIndex) setActive(idx);
  });

  // click mimo → zavřít
  document.addEventListener('click', (e) => {
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
      announce(
        items.length
          ? t('filters.resultsCount', `${items.length} výsledků`).replace('%COUNT%', String(items.length))
          : t('filters.noResults','Žádné výsledky')
      );
      // auto-aktivovat 1. položku (lepší Enter UX)
      if (items.length) setActive(0);
    } catch {
      items = [];
      loading = false;
      render();
      announce(t('filters.noResults','Žádné výsledky'));
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
