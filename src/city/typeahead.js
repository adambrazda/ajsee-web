// src/city/typeahead.js
// ---------------------------------------------------------
// City typeahead (frontend UI binder)
// - volá suggestCities() (s CSV country-scope podporou)
// - zvýrazňuje shodu (diakritika-insensitive)
// - řeší race conditions (poslední dotaz vyhrává)
// - přístupnost: role="listbox"/"option", Enter/Arrows/Escape
//
// Závislosti:
//   - src/city/suggestClient.js (suggestCities, CITY_SUGGEST_SCOPE)
//   - t() předává volající přes options (fallbacky zajištěny)
// ---------------------------------------------------------

import { suggestCities, CITY_SUGGEST_SCOPE } from './suggestClient.js';

// --- utils: normalize & escape ---
function normalizeNoDia(s = '') {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// najdi rozsah shody (bez diakritiky) v původním labelu → [start,end)
function findNormalizedRange(label = '', query = '') {
  const ln = normalizeNoDia(label);
  const qn = normalizeNoDia(query);
  const pos = ln.indexOf(qn);
  if (pos < 0) return null;

  // mapování indexů z normalizovaného řetězce zpět na původní
  const map = [];
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    const cn = normalizeNoDia(c);
    if (cn.length > 0) {
      // většinou 1:1, pro jistotu push pro každý "norm" znak
      for (let k = 0; k < cn.length; k++) map.push(i);
    }
  }
  const start = map[pos] ?? 0;
  const end = (map[pos + qn.length - 1] ?? (label.length - 1)) + 1;
  return { start, end };
}
function highlightLabel(label = '', query = '') {
  if (!query) return escapeHtml(label);
  const r = findNormalizedRange(label, query);
  if (!r) return escapeHtml(label);
  return (
    escapeHtml(label.slice(0, r.start)) +
    '<mark>' + escapeHtml(label.slice(r.start, r.end)) + '</mark>' +
    escapeHtml(label.slice(r.end))
  );
}

// ---------------------------------------------------------
// Public API
// ---------------------------------------------------------
/**
 * Připojí k <input> městský typeahead.
 * @param {HTMLInputElement} inputEl
 * @param {Object} options
 * @param {string} options.locale - UI jazyk (ovlivní popisky)
 * @param {Function} options.t - překladová funkce (key, fallback) => string
 * @param {string[]|string} [options.countryCodes=CITY_SUGGEST_SCOPE] - CSV/pole kódů zemí
 * @param {number} [options.minChars=2]
 * @param {Function} [options.onChoose] - callback při výběru {city,countryCode,lat,lon}
 */
export function setupCityTypeahead(inputEl, {
  locale = 'cs',
  t = (k, f) => f ?? k,
  countryCodes = CITY_SUGGEST_SCOPE,
  minChars = 2,
  onChoose = () => {}
} = {}) {
  if (!inputEl) return;

  // panel
  const panel = document.createElement('div');
  panel.className = 'typeahead-panel';
  panel.setAttribute('role', 'listbox');
  panel.style.display = 'none';
  inputEl.parentElement.appendChild(panel);

  // stav
  let items = [];
  let activeIndex = -1;
  let lastToken = 0; // prevence race conditions

  const labels = {
    searching: t('filters.finding', 'Hledám…'),
    noResults: t('filters.noResults', 'Žádné výsledky')
  };

  const open = () => { panel.style.display = 'block'; };
  const close = () => { panel.style.display = 'none'; activeIndex = -1; };
  const isOpen = () => panel.style.display !== 'none';

  function renderLoading() {
    panel.innerHTML = `<div class="typeahead-loading">${escapeHtml(labels.searching)}</div>`;
  }
  function renderEmpty() {
    panel.innerHTML = `<div class="typeahead-empty">${escapeHtml(labels.noResults)}</div>`;
  }
  function renderList(query) {
    if (!items.length) { renderEmpty(); return; }
    panel.innerHTML = items.map((it, i) => {
      const meta = [it.countryCode].filter(Boolean).join(', ');
      const cls = i === activeIndex ? 'typeahead-item active' : 'typeahead-item';
      return `
        <div class="${cls}" role="option" data-index="${i}">
          <span class="ti-city">${highlightLabel(it.city, query)}</span>
          <span class="ti-meta">${escapeHtml(meta)}</span>
        </div>
      `;
    }).join('');
  }

  function choose(idx) {
    const it = items[idx];
    if (!it) return;
    inputEl.value = it.city;
    // vyvolej callback pro volající (může si vyčistit NearMe, nastavit filtry apod.)
    try { onChoose(it); } catch {}
    close();
  }

  // klik na item
  panel.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.typeahead-item');
    if (el) choose(parseInt(el.dataset.index, 10));
  });
  // klik mimo
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== inputEl) close();
  });

  // klávesy
  inputEl.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(0, items.length - 1));
      renderList(inputEl.value.trim());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList(inputEl.value.trim());
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) choose(activeIndex);
      else if (items.length > 0) choose(0); // implicitně první
      else close();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  // debounce
  let timer = null;
  function debounce(fn, wait = 180) {
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }

  // loader
  const load = debounce(async () => {
    const q = inputEl.value.trim();
    if (q.length < minChars) { close(); return; }

    renderLoading(); open();

    const myToken = ++lastToken;
    let list = [];
    try {
      list = await suggestCities({ locale, keyword: q, size: 80, countryCodes });
      // pokud mezitím přišel novější dotaz, ignoruj tento výsledek
      if (myToken !== lastToken) return;
    } catch {
      // ignore
    }

    // Převod na UI strukturu (suggestClient už sloučil synonyma)
    items = (list || []).map(c => ({
      city: c.city || c.name || c.label || '',
      countryCode: c.countryCode || '',
      lat: c.lat, lon: c.lon, score: c.score
    }));

    activeIndex = -1;
    renderList(q); open();
  }, 180);

  // vstup + focus
  inputEl.addEventListener('input', () => {
    // při psaní vždy resetuj výběr
    activeIndex = -1;
    load();
  });
  inputEl.addEventListener('focus', () => {
    const q = inputEl.value.trim();
    if (q.length >= minChars && items.length) { renderList(q); open(); }
  });

  // veřejná možnost zavřít panel (když se např. mění jazyk UI externě)
  inputEl.addEventListener('blur', () => {
    // necháme klik proběhnout (mousedown již vyřeší choose), drobná prodleva
    setTimeout(() => { if (!panel.matches(':hover')) close(); }, 120);
  });

  // helper pro programové zavření
  return {
    close,
    open: () => { renderList(inputEl.value.trim()); open(); },
    destroy: () => {
      close();
      panel.remove();
      inputEl.removeEventListener('keydown', () => {});
      inputEl.removeEventListener('input', () => {});
      inputEl.removeEventListener('focus', () => {});
      inputEl.removeEventListener('blur', () => {});
    }
  };
}
