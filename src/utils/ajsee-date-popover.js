// /src/utils/ajsee-date-popover.js
/*! AJSEE – Ticketmaster-like date range popover
   - Anchor = #date-combo-button
   - 2-month grid (range selection)
   - Highlights today
   - Disables past days + disables navigation to past months
   - No page scroll lock / no overlay
   - Outside-click handled via document (capturing)
   - Emits `AJSEE:date-popover:apply` with { mode, from, to, dateFrom, dateTo }
*/

(function () {
  const WIN = window;
  const DOC = document;
  const GLOBAL_KEY = '__AJSEE_DATE_POPOVER_MINI__';

  // HMR / multi-load guard
  if (WIN[GLOBAL_KEY]) return;
  WIN[GLOBAL_KEY] = true;

  const CONFIG = {
    SAFE: 12,
    GAP: 8,
    MAX_W: 720,
    MAX_H: 520,
    Z: 10040
  };

  // ✅ Doplněno: dateLabel (label buňky "Datum")
  const STRINGS = {
    cs: { anytime: 'Kdykoliv', today: 'Dnes', start: 'Od', end: 'Do', apply: 'Použít', clear: 'Vymazat', cancel: 'Zrušit', dateLabel: 'Datum' },
    en: { anytime: 'Anytime', today: 'Today', start: 'Start Date', end: 'End date', apply: 'Apply', clear: 'Reset', cancel: 'Cancel', dateLabel: 'Date' },
    de: { anytime: 'Beliebig', today: 'Heute', start: 'Von', end: 'Bis', apply: 'Übernehmen', clear: 'Löschen', cancel: 'Abbrechen', dateLabel: 'Datum' },
    sk: { anytime: 'Kedykoľvek', today: 'Dnes', start: 'Od', end: 'Do', apply: 'Použiť', clear: 'Vymazať', cancel: 'Zrušiť', dateLabel: 'Dátum' },
    pl: { anytime: 'Kiedykolwiek', today: 'Dzisiaj', start: 'Od', end: 'Do', apply: 'Zastosuj', clear: 'Wyczyść', cancel: 'Anuluj', dateLabel: 'Data' },
    hu: { anytime: 'Bármikor', today: 'Ma', start: 'Tól', end: 'Ig', apply: 'Alkalmaz', clear: 'Törlés', cancel: 'Mégse', dateLabel: 'Dátum' }
  };

  function esc (s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLang (l) {
    const k = String(l || '').toLowerCase().slice(0, 2);
    return STRINGS[k] ? k : 'cs';
  }

  // ✅ Robustnější detekce jazyka (nejen <html lang>)
  function currentLang (forced) {
    if (forced) return normalizeLang(forced);

    try {
      const html = DOC.documentElement;

      const htmlLang = (html.getAttribute('lang') || '').trim();
      if (htmlLang) return normalizeLang(htmlLang);

      const htmlDataLang = (html.getAttribute('data-lang') || (html.dataset && html.dataset.lang) || '').trim();
      if (htmlDataLang) return normalizeLang(htmlDataLang);

      const body = DOC.body;
      if (body) {
        const bodyLang = (body.getAttribute('lang') || body.getAttribute('data-lang') || (body.dataset && body.dataset.lang) || '').trim();
        if (bodyLang) return normalizeLang(bodyLang);
      }

      const winLang = (WIN.AJSEE_LANG || WIN.__AJSEE_LANG__ || WIN.lang || '').trim();
      if (winLang) return normalizeLang(winLang);

      try {
        const ls = WIN.localStorage;
        const lsLang = (ls && (ls.getItem('ajsee:lang') || ls.getItem('ajsee_lang') || ls.getItem('lang') || ls.getItem('locale'))) || '';
        if (lsLang) return normalizeLang(lsLang);
      } catch {}

      try {
        const path = (WIN.location && WIN.location.pathname) ? WIN.location.pathname : '';
        const m = path.match(/^\/(cs|en|de|sk|pl|hu)(\/|$)/i);
        if (m && m[1]) return normalizeLang(m[1]);

        const qs = WIN.location && WIN.location.search ? WIN.location.search : '';
        if (qs) {
          const q = new URLSearchParams(qs);
          const qp = q.get('lang') || q.get('locale');
          if (qp) return normalizeLang(qp);
        }
      } catch {}
    } catch {}

    return 'cs';
  }

  function txt (forcedLang) {
    return STRINGS[currentLang(forcedLang)] || STRINGS.cs;
  }

  // ✅ robustní: vrať všechny možné "date combo" buttony (id / data attr / fallback class)
  function getDateComboButtons () {
    const out = new Set();

    const byId = DOC.getElementById('date-combo-button');
    if (byId) out.add(byId);

    DOC.querySelectorAll('[data-ajsee-date-combo]').forEach((el) => {
      if (!el) return;
      if (el.tagName === 'BUTTON') out.add(el);
      else {
        const b = el.querySelector('button, .combo-button');
        if (b) out.add(b);
      }
    });

    DOC.querySelectorAll('.date-combo .combo-button').forEach((b) => out.add(b));

    return Array.from(out);
  }

  function findLabelForDateComboButton (btn) {
    if (!btn) return null;

    // 1) label[for="id"] (nejjistější)
    const id = (btn.id || btn.getAttribute('id') || '').trim();
    if (id) {
      const safeId = (WIN.CSS && CSS.escape) ? CSS.escape(id) : id;
      const byFor = DOC.querySelector(`label[for="${safeId}"]`);
      if (byFor) return byFor;
    }

    // 2) typicky: <label>...</label> <div class="date-combo"> ... <button>...</button>
    const combo = btn.closest('.date-combo') || btn.closest('[data-ajsee-date-combo]');
    if (combo) {
      const prev = combo.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') return prev;

      const p = combo.parentElement;
      if (p && p.children) {
        const direct = Array.from(p.children).find(ch => ch && ch.tagName === 'LABEL');
        if (direct) return direct;
      }
    }

    // 3) nejbližší wrapper, ve kterém je label jako přímé dítě (nejčistší pro vaše inline labely)
    const wrappers = [
      btn.closest('.filter-group'),
      combo && combo.closest('.filter-group'),
      btn.closest('.filters-field'),
      btn.closest('.form-field'),
      btn.closest('.field'),
      btn.closest('[class*="filter"]')
    ].filter(Boolean);

    for (const w of wrappers) {
      if (!w || !w.children) continue;
      const direct = Array.from(w.children).filter(ch => ch && ch.tagName === 'LABEL');
      if (direct.length) return direct[0];
    }

    // 4) fallback: jakýkoliv label v nejbližším wrapperu (mimo popover)
    for (const w of wrappers) {
      if (!w) continue;
      const any = w.querySelector('label');
      if (any) return any;
    }

    return null;
  }

  // ✅ NOVÉ: synchronizace labelu "Datum" v UI (mimo popover)
  function syncDateComboLabel (forcedLang) {
    const t = txt(forcedLang);
    const labelText = t.dateLabel || 'Date';

    const btns = getDateComboButtons();

    // když ani button není, zkus aspoň label[for="date-combo-button"]
    if (!btns.length) {
      const direct = DOC.querySelector('label[for="date-combo-button"]');
      if (direct) direct.textContent = labelText;
      return;
    }

    btns.forEach((btn) => {
      const lbl = findLabelForDateComboButton(btn);
      if (lbl) lbl.textContent = labelText;

      // a11y (volitelně)
      try { btn.setAttribute('aria-label', labelText); } catch {}
    });
  }

  // ✅ Sleduj změny lang/data-lang (když se jazyk mění bez AJSEE:langChanged)
  function observeLangChanges () {
    if (!WIN.MutationObserver) return;

    try {
      const mo = new MutationObserver(() => {
        // microtask/RAF: aby se nepřebilo jiným renderem v tom samém ticku
        WIN.requestAnimationFrame(() => syncDateComboLabel());
      });

      const root = DOC.documentElement;
      if (root) {
        mo.observe(root, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
      }
      if (DOC.body) {
        mo.observe(DOC.body, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
      }
    } catch {}
  }

  function pad2 (n) { return String(n).padStart(2, '0'); }
  function todayISO () {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function parseISO (iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    // midday to avoid TZ edge cases
    return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
  }
  function toISO (d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function monthIndex (d) { return d.getFullYear() * 12 + d.getMonth(); }
  function fromMonthIndex (idx) { return new Date(Math.floor(idx / 12), idx % 12, 1, 12, 0, 0, 0); }

  function weekStartsOn (lang) {
    // Ticketmaster-like looks like Sun-start in EN; for EU keep Monday.
    return (lang === 'en') ? 0 : 1; // 0=Sun, 1=Mon
  }

  function weekdayLabels (lang) {
    const start = weekStartsOn(lang);
    // Use a fixed base week where 2024-01-07 was Sunday
    const baseSun = new Date(2024, 0, 7, 12, 0, 0, 0);
    const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseSun);
      d.setDate(baseSun.getDate() + ((start + i) % 7));
      out.push(fmt.format(d));
    }
    return out;
  }

  function formatDisplay (iso, lang) {
    const d = parseISO(iso);
    if (!d) return '';
    // mimic TM input vibe; keep EU as DD.MM.YYYY
    if (lang === 'en') {
      return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
    }
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function monthTitle (d, lang) {
    try {
      return new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(d);
    } catch {
      return `${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }

  // ---------- helpers pro hidden inputy (main.js je čte) ----------
  function readCurrentHiddenInputs () {
    const fromField = DOC.querySelector('#filter-date-from, #events-date-from');
    const toField = DOC.querySelector('#filter-date-to, #events-date-to');
    return {
      from: (fromField && fromField.value) || '',
      to: (toField && toField.value) || ''
    };
  }

  function syncHiddenInputs (from, to) {
    const fromField = DOC.querySelector('#filter-date-from, #events-date-from');
    const toField = DOC.querySelector('#filter-date-to, #events-date-to');
    if (fromField) fromField.value = from || '';
    if (toField) toField.value = to || '';
  }

  // ---------- styles ----------
  function ensureStyles () {
    // ✅ Pokud SCSS nastaví :root { --ajsee-date-tm-css: 1; } → neinjektovat JS CSS
    try {
      const flag = WIN.getComputedStyle(DOC.documentElement)
        .getPropertyValue('--ajsee-date-tm-css')
        .trim();
      if (flag === '1') return;
    } catch {
      // pokud getComputedStyle selže, pokračujeme (fallback na injekci CSS)
    }

    if (DOC.getElementById('ajsee-date-tm-css')) return;

    const s = DOC.createElement('style');
    s.id = 'ajsee-date-tm-css';
    s.textContent = `
      .ajsee-date-popover.ajsee-date-tm{
        position:fixed;
        display:none;
        z-index:${CONFIG.Z};
        background:#fff;
        border-radius:12px;
        box-shadow:0 18px 60px rgba(9,30,66,.22);
        overflow:hidden;
        max-width:${CONFIG.MAX_W}px;
        width:min(${CONFIG.MAX_W}px, calc(100vw - 24px));
      }

      .ajsee-date-tm__inner{ padding:14px 16px 12px; }

      .ajsee-date-tm__tabs{
        display:flex; gap:10px; align-items:center;
        padding:12px 16px 0;
      }
      .ajsee-date-tm__tab{
        border:0; background:transparent; padding:8px 4px;
        font:inherit; font-weight:600; cursor:pointer; opacity:.75;
        border-bottom:2px solid transparent;
      }
      .ajsee-date-tm__tab.is-active{ opacity:1; border-bottom-color: currentColor; }

      .ajsee-date-tm__inputs{
        display:grid; grid-template-columns: 1fr 1fr;
        gap:14px; padding:10px 16px 8px;
      }
      .ajsee-date-tm__field label{
        display:block; font-size:12px; opacity:.7; margin-bottom:6px;
      }
      .ajsee-date-tm__field input{
        width:100%;
        height:44px;
        border-radius:10px;
        border:1px solid rgba(0,0,0,.18);
        padding:0 12px;
        font:inherit;
        outline:none;
      }
      .ajsee-date-tm__field input:focus{ border-color: rgba(2,108,223,.7); box-shadow: 0 0 0 3px rgba(2,108,223,.12); }

      .ajsee-date-tm__cal{
        padding:4px 16px 10px;
      }
      .ajsee-date-tm__months{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:18px;
      }
      @media (max-width: 640px){
        .ajsee-date-tm__months{ grid-template-columns: 1fr; }
      }

      .ajsee-date-tm__month-head{
        display:flex; align-items:center; justify-content:space-between;
        margin:4px 0 8px;
      }
      .ajsee-date-tm__nav{
        border:0; background:transparent;
        width:36px; height:36px;
        border-radius:10px;
        cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        opacity:.85;
      }
      .ajsee-date-tm__nav:disabled{ cursor:not-allowed; opacity:.35; }
      .ajsee-date-tm__title{ font-weight:700; }

      .ajsee-date-tm__dow{
        display:grid; grid-template-columns: repeat(7, 1fr);
        gap:4px;
        font-size:12px; opacity:.65;
        margin-bottom:6px;
      }
      .ajsee-date-tm__dow span{ text-align:center; }

      .ajsee-date-tm__grid{
        display:grid;
        grid-template-columns: repeat(7, 1fr);
        gap:4px;
      }
      .ajsee-date-tm__cell{ height:36px; }
      .ajsee-date-tm__empty{ height:36px; }

      .ajsee-date-tm__day{
        width:100%;
        height:36px;
        border:0;
        border-radius:10px;
        background:transparent;
        cursor:pointer;
        font:inherit;
        position:relative;
      }
      .ajsee-date-tm__day:hover{ background: rgba(2,108,223,.08); }
      .ajsee-date-tm__day.is-disabled{ cursor:not-allowed; opacity:.35; }
      .ajsee-date-tm__day.is-disabled:hover{ background:transparent; }

      .ajsee-date-tm__day.is-today::after{
        content:'';
        position:absolute;
        left:50%; transform:translateX(-50%);
        bottom:6px;
        width:16px; height:2px;
        border-radius:2px;
        background: rgba(2,108,223,.9);
        opacity:.9;
      }

      /* range */
      .ajsee-date-tm__day.is-in-range{ background: rgba(2,108,223,.10); }
      .ajsee-date-tm__day.is-start,
      .ajsee-date-tm__day.is-end{
        background: rgba(2,108,223,.95);
        color:#fff;
      }

      .ajsee-date-tm__actions{
        display:flex; justify-content:space-between; align-items:center;
        gap:12px;
        padding:10px 16px 14px;
        border-top:1px solid rgba(0,0,0,.08);
      }
      .ajsee-date-tm__btn{
        border:0; background:transparent; cursor:pointer;
        padding:10px 10px; border-radius:10px;
        font:inherit; font-weight:600;
        opacity:.9;
      }
      .ajsee-date-tm__btn:hover{ background: rgba(0,0,0,.06); }
      .ajsee-date-tm__btn.primary{
        background: rgba(2,108,223,.95);
        color:#fff;
        padding:10px 16px;
      }
      .ajsee-date-tm__btn.primary:hover{ background: rgba(2,108,223,1); }
      .ajsee-date-tm__btn:disabled{ opacity:.5; cursor:not-allowed; }
    `;
    (DOC.head || DOC.documentElement).appendChild(s);
  }

  // ---------- state ----------
  let popover = null;
  let anchorEl = null;
  let isOpen = false;

  let viewMonthIdx = null;      // left month index
  let selFrom = '';             // ISO
  let selTo = '';               // ISO

  // ---------- popover markup ----------
  function ensurePopover () {
    if (popover) return;
    ensureStyles();

    const lang = currentLang();
    const t = txt();
    const wrap = DOC.createElement('div');
    wrap.className = 'ajsee-date-popover ajsee-date-tm';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('data-ajsee', 'date-popover');
    wrap.style.display = 'none';
    wrap.style.zIndex = String(CONFIG.Z);

    const placeholder = (lang === 'en') ? 'MM/DD/YYYY' : 'dd.mm.rrrr';

    wrap.innerHTML = `
      <div class="ajsee-date-tm__tabs">
        <button type="button" class="ajsee-date-tm__tab" data-quick="anytime">${esc(t.anytime)}</button>
        <button type="button" class="ajsee-date-tm__tab" data-quick="today">${esc(t.today)}</button>
      </div>

      <div class="ajsee-date-tm__inputs">
        <div class="ajsee-date-tm__field">
          <label>${esc(t.start)}</label>
          <input type="text" data-role="start" placeholder="${esc(placeholder)}" readonly />
        </div>
        <div class="ajsee-date-tm__field">
          <label>${esc(t.end)}</label>
          <input type="text" data-role="end" placeholder="${esc(placeholder)}" readonly />
        </div>
      </div>

      <div class="ajsee-date-tm__cal">
        <div class="ajsee-date-tm__months">
          <div class="ajsee-date-tm__month" data-month="0">
            <div class="ajsee-date-tm__month-head">
              <button type="button" class="ajsee-date-tm__nav" data-nav="prev" aria-label="Previous month">‹</button>
              <div class="ajsee-date-tm__title" data-role="title-0"></div>
              <span style="width:36px;height:36px;"></span>
            </div>
            <div class="ajsee-date-tm__dow" data-role="dow-0"></div>
            <div class="ajsee-date-tm__grid" data-role="grid-0"></div>
          </div>

          <div class="ajsee-date-tm__month" data-month="1">
            <div class="ajsee-date-tm__month-head">
              <span style="width:36px;height:36px;"></span>
              <div class="ajsee-date-tm__title" data-role="title-1"></div>
              <button type="button" class="ajsee-date-tm__nav" data-nav="next" aria-label="Next month">›</button>
            </div>
            <div class="ajsee-date-tm__dow" data-role="dow-1"></div>
            <div class="ajsee-date-tm__grid" data-role="grid-1"></div>
          </div>
        </div>
      </div>

      <div class="ajsee-date-tm__actions">
        <button type="button" class="ajsee-date-tm__btn" data-act="clear">${esc(t.clear)}</button>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="ajsee-date-tm__btn" data-act="cancel">${esc(t.cancel)}</button>
          <button type="button" class="ajsee-date-tm__btn primary" data-act="apply">${esc(t.apply)}</button>
        </div>
      </div>
    `;

    DOC.body.appendChild(wrap);
    popover = wrap;

    // interactions
    popover.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePopover(); }
      else if (e.key === 'Enter') { e.preventDefault(); applyAndClose(); }
    });

    popover.querySelectorAll('[data-quick]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-quick');
        const today = todayISO();
        if (mode === 'anytime') {
          selFrom = ''; selTo = '';
        } else if (mode === 'today') {
          selFrom = today; selTo = today;
        }
        // keep view at current month for quick modes
        const cur = parseISO(today);
        viewMonthIdx = monthIndex(new Date(cur.getFullYear(), cur.getMonth(), 1, 12, 0, 0, 0));
        renderUI();
      });
    });

    popover.querySelector('[data-act="clear"]').addEventListener('click', () => {
      selFrom = ''; selTo = '';
      renderUI();
    });

    popover.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      closePopover();
    });

    popover.querySelector('[data-act="apply"]').addEventListener('click', applyAndClose);

    popover.querySelector('[data-nav="prev"]').addEventListener('click', () => {
      const minIdx = monthIndex(new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0));
      viewMonthIdx = Math.max(minIdx, (viewMonthIdx || minIdx) - 1);
      renderUI();
    });

    popover.querySelector('[data-nav="next"]').addEventListener('click', () => {
      const base = (viewMonthIdx == null) ? monthIndex(new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0)) : viewMonthIdx;
      viewMonthIdx = base + 1;
      renderUI();
    });

    // day click (event delegation)
    popover.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button[data-iso]');
      if (!btn) return;
      const iso = btn.getAttribute('data-iso') || '';
      if (!iso) return;
      if (btn.classList.contains('is-disabled')) return;
      onPickDay(iso);
    });
  }

  function normalizeSelection () {
    const min = todayISO();

    if (selFrom && selFrom < min) selFrom = min;
    if (selTo && selTo < min) selTo = min;

    if (selFrom && selTo && selFrom > selTo) {
      const tmp = selFrom; selFrom = selTo; selTo = tmp;
    }
  }

  function onPickDay (iso) {
    const min = todayISO();
    if (iso < min) return;

    // typical range behavior:
    // - if no from: set from
    // - if from set and to empty: set to if >= from, else replace from
    // - if both set: start new selection from clicked day
    if (!selFrom) {
      selFrom = iso;
      selTo = '';
    } else if (selFrom && !selTo) {
      if (iso >= selFrom) selTo = iso;
      else { selFrom = iso; selTo = ''; }
    } else {
      selFrom = iso;
      selTo = '';
    }

    normalizeSelection();

    // keep the view so selection stays visible
    const d = parseISO(selFrom || todayISO()) || parseISO(todayISO());
    viewMonthIdx = monthIndex(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));

    renderUI();
  }

  function setTabsActive () {
    const today = todayISO();
    const any = (!selFrom && !selTo);
    const isToday = (selFrom === today && selTo === today);

    popover.querySelectorAll('.ajsee-date-tm__tab').forEach(b => b.classList.remove('is-active'));
    const bAny = popover.querySelector('[data-quick="anytime"]');
    const bToday = popover.querySelector('[data-quick="today"]');
    if (any && bAny) bAny.classList.add('is-active');
    if (isToday && bToday) bToday.classList.add('is-active');
  }

  function renderMonth (monthOffset) {
    const lang = currentLang();
    const startIdx = (viewMonthIdx == null)
      ? monthIndex(new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0))
      : viewMonthIdx;

    const monthStart = fromMonthIndex(startIdx + monthOffset);
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();

    const titleEl = popover.querySelector(`[data-role="title-${monthOffset}"]`);
    if (titleEl) titleEl.textContent = monthTitle(monthStart, lang);

    const dowEl = popover.querySelector(`[data-role="dow-${monthOffset}"]`);
    if (dowEl) {
      const labels = weekdayLabels(lang);
      dowEl.innerHTML = labels.map(w => `<span>${esc(w)}</span>`).join('');
    }

    const gridEl = popover.querySelector(`[data-role="grid-${monthOffset}"]`);
    if (!gridEl) return;

    const first = new Date(y, m, 1, 12, 0, 0, 0);
    const daysInMonth = new Date(y, m + 1, 0, 12, 0, 0, 0).getDate();

    const startDow = weekStartsOn(lang);
    const firstDow = first.getDay(); // 0..6 (Sun..Sat)
    const leading = (firstDow - startDow + 7) % 7;

    const min = todayISO();
    const today = todayISO();

    let html = '';

    for (let i = 0; i < leading; i++) {
      html += `<div class="ajsee-date-tm__empty"></div>`;
    }

    const from = selFrom || '';
    const to = selTo || '';

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day, 12, 0, 0, 0);
      const iso = toISO(d);

      const disabled = iso < min;
      const isT = iso === today;

      const isStart = !!from && iso === from;
      const isEnd = !!to && iso === to;
      const inRange = !!from && !!to && iso > from && iso < to;

      const cls = [
        'ajsee-date-tm__day',
        disabled ? 'is-disabled' : '',
        isT ? 'is-today' : '',
        inRange ? 'is-in-range' : '',
        isStart ? 'is-start' : '',
        isEnd ? 'is-end' : ''
      ].filter(Boolean).join(' ');

      const ariaDisabled = disabled ? 'true' : 'false';

      html += `
        <div class="ajsee-date-tm__cell">
          <button type="button"
            class="${cls}"
            data-iso="${esc(iso)}"
            aria-disabled="${ariaDisabled}"
            ${disabled ? 'tabindex="-1"' : ''}>
            ${day}
          </button>
        </div>
      `;
    }

    gridEl.innerHTML = html;
  }

  function renderUI () {
    if (!popover) return;
    normalizeSelection();

    const lang = currentLang();
    const startInp = popover.querySelector('input[data-role="start"]');
    const endInp = popover.querySelector('input[data-role="end"]');
    if (startInp) startInp.value = formatDisplay(selFrom, lang);
    if (endInp) endInp.value = formatDisplay(selTo, lang);

    setTabsActive();

    renderMonth(0);
    renderMonth(1);

    // disable prev when would go to past month
    const minIdx = monthIndex(new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0));
    const prevBtn = popover.querySelector('[data-nav="prev"]');
    if (prevBtn) prevBtn.disabled = (viewMonthIdx == null ? minIdx : viewMonthIdx) <= minIdx;
  }

  // ---------- open/close ----------
  function openPopover (anchor) {
    if (!anchor) return;
    ensurePopover();

    anchorEl = anchor;
    isOpen = true;
    popover.style.display = 'block';

    // load current values
    const { from, to } = readCurrentHiddenInputs();
    selFrom = (from || '').trim();
    selTo = (to || '').trim();

    // clamp past
    normalizeSelection();

    // choose initial view month
    const base = parseISO(selFrom || todayISO()) || parseISO(todayISO());
    const baseMonth = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
    const minMonth = new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0);
    viewMonthIdx = Math.max(monthIndex(minMonth), monthIndex(baseMonth));

    renderUI();
    positionPopover();

    // focus for accessibility (first actionable control)
    const applyBtn = popover.querySelector('[data-act="apply"]');
    (applyBtn || popover).focus && (applyBtn || popover).focus();
  }

  function closePopover () {
    if (!isOpen) return;
    isOpen = false;
    if (popover) popover.style.display = 'none';
    anchorEl = null;
  }

  function applyAndClose () {
    if (!popover) return;

    const from = (selFrom || '').trim();
    const to = (selTo || '').trim();

    syncHiddenInputs(from, to);

    let mode = 'range';
    const today = todayISO();
    if (!from && !to) mode = 'anytime';
    else if (from === today && to === today) mode = 'today';

    const detail = { mode, from, to, dateFrom: from, dateTo: to };

    try { WIN.dispatchEvent(new CustomEvent('AJSEE:date-popover:apply', { detail })); } catch { /* noop */ }

    closePopover();
  }

  // ---------- positioning + auto-close when anchor out of view ----------
  function getHeaderSafeTop () {
    const header = DOC.querySelector('.site-header');
    const h = header && header.getBoundingClientRect ? header.getBoundingClientRect().height : 0;
    return Math.max(CONFIG.SAFE, Math.round(h + 8));
  }

  function positionPopover () {
    if (!isOpen || !popover) return;

    const anchor = DOC.getElementById('date-combo-button') || anchorEl;
    if (!anchor) return;

    const r = anchor.getBoundingClientRect();
    const vpW = WIN.innerWidth;
    const vpH = WIN.innerHeight;

    // ✅ when filters (anchor) are out of view -> close
    if (r.bottom <= 0 || r.top >= vpH) {
      closePopover();
      return;
    }

    const SAFE = CONFIG.SAFE;
    const SAFE_TOP = getHeaderSafeTop();
    const GAP = CONFIG.GAP;

    popover.style.maxHeight = '';
    popover.style.maxWidth = '';
    // measure
    const width = Math.min(popover.offsetWidth || 520, CONFIG.MAX_W, vpW - SAFE * 2);
    const height = popover.offsetHeight || CONFIG.MAX_H;

    let left = r.left;
    left = Math.max(left, SAFE);
    left = Math.min(left, vpW - SAFE - width);

    let top = r.bottom + GAP;

    // if not enough room below, try above; otherwise clamp
    if (top + height > vpH - SAFE) {
      const above = r.top - GAP - height;
      if (above >= SAFE_TOP) {
        top = above;
      } else {
        top = SAFE_TOP;
        const usableH = Math.max(220, vpH - SAFE_TOP - SAFE);
        popover.style.maxHeight = usableH + 'px';
      }
    } else {
      // ensure it never goes under header area
      if (top < SAFE_TOP) top = SAFE_TOP;
    }

    popover.style.position = 'fixed';
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function onScrollOrResize () {
    if (!isOpen) return;
    positionPopover();
  }

  // ---------- outside click ----------
  function onGlobalPointerDown (e) {
    if (!isOpen) return;
    const t = e.target;
    if (popover && popover.contains(t)) return;
    if (anchorEl && anchorEl.contains(t)) return;
    closePopover();
  }

  DOC.addEventListener('mousedown', onGlobalPointerDown, true);
  DOC.addEventListener('touchstart', onGlobalPointerDown, true);

  WIN.addEventListener('scroll', onScrollOrResize, { passive: true });
  WIN.addEventListener('resize', onScrollOrResize, { passive: true });

  // Jazyk se změnil → zahodit popover, vytvoří se znovu s novými texty + DOW
  WIN.addEventListener('AJSEE:langChanged', (e) => {
    // ✅ zkus vzít lang z detailu (pokud ho někdo posílá)
    let forced = null;
    try {
      const d = e && e.detail;
      if (typeof d === 'string') forced = d;
      else if (d && typeof d.lang === 'string') forced = d.lang;
      else if (d && typeof d.locale === 'string') forced = d.locale;
      else if (d && typeof d.language === 'string') forced = d.language;
    } catch {}

    // ✅ přeložit label "Datum" i mimo popover
    syncDateComboLabel(forced);

    if (popover) { popover.remove(); popover = null; }
    closePopover();
  });

  // ---------- anchor init ----------
  function initAnchors () {
    const btn = DOC.getElementById('date-combo-button') ||
      DOC.querySelector('[data-ajsee-date-combo]') ||
      DOC.querySelector('.date-combo .combo-button');
    if (!btn) return;

    // ✅ přeložit label hned při initu
    syncDateComboLabel();

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isOpen) closePopover();
      else openPopover(btn);
    });
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', () => {
      initAnchors();
      observeLangChanges();
      // ✅ pro jistotu ještě jednou po layoutu (kdyby se filtry domontovaly)
      setTimeout(syncDateComboLabel, 0);
      setTimeout(syncDateComboLabel, 80);
      setTimeout(syncDateComboLabel, 250);
    });
  } else {
    initAnchors();
    observeLangChanges();
    setTimeout(syncDateComboLabel, 0);
    setTimeout(syncDateComboLabel, 80);
    setTimeout(syncDateComboLabel, 250);
  }
})();
