// /src/utils/ajsee-date-popover.js
/*! AJSEE – responsive date range popover / sheet
   - Desktop: anchored floating popover under #date-combo-button
   - Mobile: bottom sheet with internal scroll + sticky actions
   - 2-month grid on desktop, 1-month stepping on mobile (single visible month)
   - Highlights today
   - Disables past days + disables navigation to past months
   - Emits `AJSEE:date-popover:apply` and `AJSEE:dateRangeApply`
     with { mode, from, to, dateFrom, dateTo }
*/

(function () {
  const WIN = window;
  const DOC = document;
  const GLOBAL_KEY = '__AJSEE_DATE_POPOVER_RESPONSIVE__';

  if (WIN[GLOBAL_KEY]) return;
  WIN[GLOBAL_KEY] = true;

  const CONFIG = {
    SAFE: 12,
    GAP: 8,
    MAX_W: 720,
    MAX_H: 520,
    Z: 10040,
    MOBILE_BREAKPOINT: 720
  };

  const STRINGS = {
    cs: {
      anytime: 'Kdykoliv',
      today: 'Dnes',
      start: 'Od',
      end: 'Do',
      apply: 'Použít',
      clear: 'Vymazat',
      cancel: 'Zrušit',
      dateLabel: 'Datum',
      pickerTitle: 'Vyber datum'
    },
    en: {
      anytime: 'Anytime',
      today: 'Today',
      start: 'Start date',
      end: 'End date',
      apply: 'Apply',
      clear: 'Clear',
      cancel: 'Cancel',
      dateLabel: 'Date',
      pickerTitle: 'Choose date'
    },
    de: {
      anytime: 'Beliebig',
      today: 'Heute',
      start: 'Von',
      end: 'Bis',
      apply: 'Übernehmen',
      clear: 'Löschen',
      cancel: 'Abbrechen',
      dateLabel: 'Datum',
      pickerTitle: 'Datum wählen'
    },
    sk: {
      anytime: 'Kedykoľvek',
      today: 'Dnes',
      start: 'Od',
      end: 'Do',
      apply: 'Použiť',
      clear: 'Vymazať',
      cancel: 'Zrušiť',
      dateLabel: 'Dátum',
      pickerTitle: 'Vyber dátum'
    },
    pl: {
      anytime: 'Kiedykolwiek',
      today: 'Dzisiaj',
      start: 'Od',
      end: 'Do',
      apply: 'Zastosuj',
      clear: 'Wyczyść',
      cancel: 'Anuluj',
      dateLabel: 'Data',
      pickerTitle: 'Wybierz datę'
    },
    hu: {
      anytime: 'Bármikor',
      today: 'Ma',
      start: 'Kezdet',
      end: 'Vége',
      apply: 'Alkalmaz',
      clear: 'Törlés',
      cancel: 'Mégse',
      dateLabel: 'Dátum',
      pickerTitle: 'Dátum kiválasztása'
    }
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
    const key = String(l || '').toLowerCase().slice(0, 2);
    return STRINGS[key] ? key : 'cs';
  }

  function currentLang (forced) {
    if (forced) return normalizeLang(forced);

    try {
      const html = DOC.documentElement;
      const htmlLang = (html && html.getAttribute('lang')) || '';
      if (htmlLang) return normalizeLang(htmlLang);

      const htmlDataLang = (html && (html.getAttribute('data-lang') || (html.dataset && html.dataset.lang))) || '';
      if (htmlDataLang) return normalizeLang(htmlDataLang);

      const body = DOC.body;
      if (body) {
        const bodyLang = (body.getAttribute('lang') || body.getAttribute('data-lang') || (body.dataset && body.dataset.lang)) || '';
        if (bodyLang) return normalizeLang(bodyLang);
      }

      const winLang = WIN.AJSEE_LANG || WIN.__AJSEE_LANG__ || WIN.lang || '';
      if (winLang) return normalizeLang(winLang);

      try {
        const ls = WIN.localStorage;
        const lsLang = (ls && (ls.getItem('ajsee:lang') || ls.getItem('ajsee_lang') || ls.getItem('lang') || ls.getItem('locale'))) || '';
        if (lsLang) return normalizeLang(lsLang);
      } catch {
        /* noop */
      }

      try {
        const path = WIN.location && WIN.location.pathname ? WIN.location.pathname : '';
        const pathMatch = path.match(/^\/(cs|en|de|sk|pl|hu)(\/|$)/i);
        if (pathMatch && pathMatch[1]) return normalizeLang(pathMatch[1]);

        const qs = WIN.location && WIN.location.search ? WIN.location.search : '';
        if (qs) {
          const p = new URLSearchParams(qs);
          const qp = p.get('lang') || p.get('locale');
          if (qp) return normalizeLang(qp);
        }
      } catch {
        /* noop */
      }
    } catch {
      /* noop */
    }

    return 'cs';
  }

  function txt (forcedLang) {
    return STRINGS[currentLang(forcedLang)] || STRINGS.cs;
  }

  function isMobileMode () {
    try {
      return WIN.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`).matches;
    } catch {
      return (WIN.innerWidth || 1024) <= CONFIG.MOBILE_BREAKPOINT;
    }
  }

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

    const id = (btn.id || btn.getAttribute('id') || '').trim();
    if (id) {
      const safeId = (WIN.CSS && CSS.escape) ? CSS.escape(id) : id;
      const byFor = DOC.querySelector(`label[for="${safeId}"]`);
      if (byFor) return byFor;
    }

    const combo = btn.closest('.date-combo') || btn.closest('[data-ajsee-date-combo]');
    if (combo) {
      const prev = combo.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') return prev;

      const parent = combo.parentElement;
      if (parent && parent.children) {
        const direct = Array.from(parent.children).find((ch) => ch && ch.tagName === 'LABEL');
        if (direct) return direct;
      }
    }

    const wrappers = [
      btn.closest('.filter-group'),
      combo && combo.closest('.filter-group'),
      btn.closest('.filters-field'),
      btn.closest('.form-field'),
      btn.closest('.field'),
      btn.closest('[class*="filter"]')
    ].filter(Boolean);

    for (const wrapper of wrappers) {
      if (!wrapper || !wrapper.children) continue;
      const direct = Array.from(wrapper.children).filter((ch) => ch && ch.tagName === 'LABEL');
      if (direct.length) return direct[0];
    }

    for (const wrapper of wrappers) {
      if (!wrapper) continue;
      const any = wrapper.querySelector('label');
      if (any) return any;
    }

    return null;
  }

  function syncDateComboLabel (forcedLang) {
    const t = txt(forcedLang);
    const labelText = t.dateLabel || 'Date';

    const btns = getDateComboButtons();
    if (!btns.length) {
      const direct = DOC.querySelector('label[for="date-combo-button"]');
      if (direct) direct.textContent = labelText;
      return;
    }

    btns.forEach((btn) => {
      const lbl = findLabelForDateComboButton(btn);
      if (lbl) lbl.textContent = labelText;
      try { btn.setAttribute('aria-label', labelText); } catch {
        /* noop */
      }
    });
  }

  function observeLangChanges () {
    if (!WIN.MutationObserver) return;

    try {
      const mo = new MutationObserver(() => {
        WIN.requestAnimationFrame(() => syncDateComboLabel());
      });

      const root = DOC.documentElement;
      if (root) mo.observe(root, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
      if (DOC.body) mo.observe(DOC.body, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
    } catch {
      /* noop */
    }
  }

  function pad2 (n) {
    return String(n).padStart(2, '0');
  }

  function todayISO () {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseISO (iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
  }

  function toISO (d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function monthIndex (d) {
    return d.getFullYear() * 12 + d.getMonth();
  }

  function fromMonthIndex (idx) {
    return new Date(Math.floor(idx / 12), idx % 12, 1, 12, 0, 0, 0);
  }

  function weekStartsOn (lang) {
    return lang === 'en' ? 0 : 1;
  }

  function weekdayLabels (lang) {
    const start = weekStartsOn(lang);
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
    if (lang === 'en') return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function monthTitle (d, lang) {
    try {
      return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(d);
    } catch {
      return `${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }

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

    if (fromField) {
      fromField.value = from || '';
      try { fromField.dispatchEvent(new Event('input', { bubbles: true })); } catch {
        /* noop */
      }
      try { fromField.dispatchEvent(new Event('change', { bubbles: true })); } catch {
        /* noop */
      }
    }

    if (toField) {
      toField.value = to || '';
      try { toField.dispatchEvent(new Event('input', { bubbles: true })); } catch {
        /* noop */
      }
      try { toField.dispatchEvent(new Event('change', { bubbles: true })); } catch {
        /* noop */
      }
    }
  }

  function getScrollParents (el) {
    const out = [];
    const seen = new Set();
    const overflowRe = /(auto|scroll|overlay)/;

    let node = el;
    while (node && node !== DOC.body && node !== DOC.documentElement) {
      node = node.parentElement;
      if (!node) break;

      try {
        const st = WIN.getComputedStyle(node);
        const oy = st.overflowY || st.overflow || '';
        const ox = st.overflowX || st.overflow || '';
        const scrollable = overflowRe.test(oy) || overflowRe.test(ox);
        const canScroll = (node.scrollHeight > node.clientHeight) || (node.scrollWidth > node.clientWidth);
        if (scrollable && canScroll && !seen.has(node)) {
          seen.add(node);
          out.push(node);
        }
      } catch {
        /* noop */
      }
    }

    const se = DOC.scrollingElement || DOC.documentElement;
    if (se && !seen.has(se)) out.push(se);
    out.push(WIN);
    return out;
  }

  function getHeaderSafeTop () {
    const header = DOC.querySelector('header.site-header') || DOC.querySelector('.site-header') || DOC.querySelector('header');
    const rect = header && header.getBoundingClientRect ? header.getBoundingClientRect() : null;
    const bottom = rect ? rect.bottom : 0;
    return Math.max(CONFIG.SAFE, Math.round(bottom + 8));
  }

  let overlay = null;
  let popover = null;
  let anchorEl = null;
  let isOpen = false;
  let isMobileOpen = false;
  let viewMonthIdx = null;
  let selFrom = '';
  let selTo = '';
  let scrollParents = [];
  let scrollYBeforeLock = 0;
  let rafPosition = 0;

  function updateViewportVars () {
    const vv = WIN.visualViewport;
    const vh = vv ? vv.height : WIN.innerHeight;
    DOC.documentElement.style.setProperty('--ajsee-date-sheet-vh', `${vh}px`);
  }

  function lockBodyScroll () {
    scrollYBeforeLock = WIN.scrollY || WIN.pageYOffset || 0;
    DOC.body.classList.add('ajsee-date-picker-open');
    DOC.body.style.top = `-${scrollYBeforeLock}px`;
  }

  function unlockBodyScroll () {
    DOC.body.classList.remove('ajsee-date-picker-open');
    DOC.body.style.top = '';
    WIN.scrollTo(0, scrollYBeforeLock);
  }

  function ensureStyles () {
    if (DOC.getElementById('ajsee-date-tm-css')) return;

    const s = DOC.createElement('style');
    s.id = 'ajsee-date-tm-css';
    s.textContent = `
      body.ajsee-date-picker-open{
        position:fixed;
        overflow:hidden;
        width:100%;
        left:0;
        right:0;
      }

      .ajsee-date-popover-overlay[hidden],
      .ajsee-date-popover[hidden]{
        display:none !important;
      }

      .ajsee-date-popover-overlay{
        position:fixed;
        inset:0;
        z-index:${CONFIG.Z};
        display:flex;
        align-items:flex-start;
        justify-content:flex-start;
        background:transparent;
        pointer-events:none;
      }

      .ajsee-date-popover-overlay.is-desktop{
        padding:0 !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        background:transparent !important;
        pointer-events:none !important;
        align-items:flex-start !important;
        justify-content:flex-start !important;
      }

      .ajsee-date-popover-overlay.is-desktop .ajsee-date-popover{
        pointer-events:auto;
      }

      .ajsee-date-popover-overlay.is-mobile{
        align-items:flex-end;
        justify-content:center;
        background:rgba(11,16,32,.28);
        backdrop-filter:blur(10px);
        -webkit-backdrop-filter:blur(10px);
        pointer-events:auto;
        padding:12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
      }

      .ajsee-date-popover{
        background:rgba(255,255,255,.98);
        backdrop-filter:blur(22px);
        -webkit-backdrop-filter:blur(22px);
        box-shadow:0 18px 60px rgba(9,30,66,.22);
        border:1px solid rgba(217,225,239,.96);
        overflow:hidden;
        color:#101828;
      }

      .ajsee-date-popover.ajsee-date-tm.is-desktop{
        position:fixed !important;
        width:min(${CONFIG.MAX_W}px, calc(100vw - 24px)) !important;
        max-width:min(${CONFIG.MAX_W}px, calc(100vw - 24px)) !important;
        max-height:min(${CONFIG.MAX_H}px, calc(100vh - 24px)) !important;
        border-radius:24px !important;
        overflow:auto !important;
        margin:0 !important;
        inset:auto auto auto auto !important;
        transform:none !important;
        box-shadow:0 24px 64px rgba(9,30,66,.22) !important;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile{
        position:relative;
        width:min(100%, 720px);
        max-height:calc(var(--ajsee-date-sheet-vh, 100vh) - env(safe-area-inset-top, 0px) - 16px);
        border-radius:28px;
        display:flex;
        flex-direction:column;
        box-shadow:0 24px 60px rgba(9,30,66,.24);
      }

      .ajsee-date-tm__grab{
        display:none;
        width:48px;
        height:5px;
        border-radius:999px;
        background:rgba(71,84,103,.22);
        margin:10px auto 2px;
        flex:0 0 auto;
      }

      .ajsee-date-tm__header{
        display:none;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__grab{
        display:block;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        padding:16px 18px 12px;
        flex:0 0 auto;
      }

      .ajsee-date-tm__header-copy{
        min-width:0;
      }

      .ajsee-date-tm__title-main{
        margin:0;
        font-size:22px;
        line-height:1.15;
        font-weight:800;
        color:#101828;
      }

      .ajsee-date-tm__close{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:40px;
        height:40px;
        border:0;
        border-radius:999px;
        background:#f2f4f7;
        color:#344054;
        cursor:pointer;
        flex:0 0 auto;
      }

      .ajsee-date-tm__close span{
        font-size:28px;
        line-height:1;
      }

      .ajsee-date-tm__body{
        display:flex;
        flex-direction:column;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__body{
        flex:1 1 auto;
        min-height:0;
        overflow:auto;
        -webkit-overflow-scrolling:touch;
      }

      .ajsee-date-tm__tabs{
        display:flex;
        gap:10px;
        align-items:center;
        padding:14px 16px 0;
        flex-wrap:wrap;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__tabs{
        padding:0 18px 0;
      }

      .ajsee-date-tm__tab{
        border:0;
        background:transparent;
        padding:8px 4px;
        font:inherit;
        font-weight:700;
        cursor:pointer;
        opacity:.72;
        border-bottom:2px solid transparent;
        color:#344054;
      }

      .ajsee-date-tm__tab.is-active{
        opacity:1;
        color:#2f5fd0;
        border-bottom-color:currentColor;
      }

      .ajsee-date-tm__inputs{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        padding:10px 16px 8px;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__inputs{
        padding:12px 18px 8px;
      }

      .ajsee-date-tm__field label{
        display:block;
        font-size:12px;
        color:#667085;
        margin-bottom:6px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:.04em;
      }

      .ajsee-date-tm__field input{
        width:100%;
        height:48px;
        border-radius:14px;
        border:1px solid rgba(217,225,239,.96);
        background:#fff;
        padding:0 14px;
        font:inherit;
        font-size:15px;
        color:#101828;
        outline:none;
      }

      .ajsee-date-tm__field input:focus{
        border-color:rgba(47,107,255,.72);
        box-shadow:0 0 0 4px rgba(47,107,255,.10);
      }

      .ajsee-date-tm__cal{
        padding:4px 16px 10px;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__cal{
        padding:6px 18px 12px;
      }

      .ajsee-date-tm__months{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:18px;
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__months{
        grid-template-columns:1fr;
        gap:14px;
      }

      .ajsee-date-tm__month[hidden]{
        display:none !important;
      }

      .ajsee-date-tm__month-head{
        display:grid;
        grid-template-columns:36px 1fr 36px;
        align-items:center;
        gap:10px;
        margin:4px 0 10px;
      }

      .ajsee-date-tm__nav{
        border:0;
        background:#f8fafc;
        width:36px;
        height:36px;
        border-radius:12px;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        opacity:.92;
        color:#101828;
      }

      .ajsee-date-tm__nav:disabled{
        cursor:not-allowed;
        opacity:.35;
      }

      .ajsee-date-tm__nav[hidden]{
        visibility:hidden;
      }

      .ajsee-date-tm__title{
        font-weight:800;
        font-size:16px;
        text-align:center;
        color:#101828;
      }

      .ajsee-date-tm__dow{
        display:grid;
        grid-template-columns:repeat(7, 1fr);
        gap:6px;
        font-size:12px;
        color:#667085;
        margin-bottom:8px;
      }

      .ajsee-date-tm__dow span{
        text-align:center;
      }

      .ajsee-date-tm__grid{
        display:grid;
        grid-template-columns:repeat(7, 1fr);
        gap:8px;
      }

      .ajsee-date-tm__cell,
      .ajsee-date-tm__empty{
        min-height:42px;
      }

      .ajsee-date-tm__day{
        width:100%;
        height:42px;
        border:0;
        border-radius:14px;
        background:#fff;
        box-shadow:0 4px 12px rgba(9,30,66,.04);
        cursor:pointer;
        font:inherit;
        font-weight:700;
        color:#1d2340;
        position:relative;
        transition:background-color .18s ease, transform .18s ease, box-shadow .18s ease;
      }

      .ajsee-date-tm__day:hover{
        background:rgba(47,107,255,.08);
      }

      .ajsee-date-tm__day.is-disabled{
        cursor:not-allowed;
        opacity:.30;
        box-shadow:none;
      }

      .ajsee-date-tm__day.is-disabled:hover{
        background:#fff;
      }

      .ajsee-date-tm__day.is-today::after{
        content:'';
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        bottom:6px;
        width:16px;
        height:3px;
        border-radius:2px;
        background:rgba(47,107,255,.95);
      }

      .ajsee-date-tm__day.is-in-range{
        background:rgba(47,107,255,.10);
      }

      .ajsee-date-tm__day.is-start,
      .ajsee-date-tm__day.is-end{
        background:linear-gradient(180deg, rgba(71,132,255,.98), rgba(32,89,214,.98));
        color:#fff;
      }

      .ajsee-date-tm__actions{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        padding:12px 16px 14px;
        border-top:1px solid rgba(0,0,0,.08);
        background:rgba(255,255,255,.92);
      }

      .ajsee-date-popover.ajsee-date-tm.is-mobile .ajsee-date-tm__actions{
        position:sticky;
        bottom:0;
        padding:12px 18px calc(14px + env(safe-area-inset-bottom, 0px));
        backdrop-filter:blur(18px);
        -webkit-backdrop-filter:blur(18px);
      }

      .ajsee-date-tm__actions-right{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .ajsee-date-tm__btn{
        border:0;
        background:transparent;
        cursor:pointer;
        padding:10px 10px;
        border-radius:12px;
        font:inherit;
        font-weight:800;
        color:#1d2340;
      }

      .ajsee-date-tm__btn:hover{
        background:rgba(0,0,0,.06);
      }

      .ajsee-date-tm__btn.primary{
        background:linear-gradient(180deg, rgba(71,132,255,.98), rgba(32,89,214,.98));
        color:#fff;
        padding:12px 18px;
        box-shadow:0 10px 22px rgba(47,107,255,.24);
      }

      .ajsee-date-tm__btn.primary:hover{
        background:linear-gradient(180deg, rgba(64,125,248,1), rgba(27,83,205,1));
      }

      .ajsee-date-tm__btn:disabled{
        opacity:.5;
        cursor:not-allowed;
      }

      @media (max-width: 640px){
        .ajsee-date-tm__inputs{
          grid-template-columns:1fr;
          gap:12px;
        }
      }
    `;

    (DOC.head || DOC.documentElement).appendChild(s);
  }

  function ensurePopover () {
    if (overlay && popover) return;

    ensureStyles();
    updateViewportVars();

    const t = txt();
    const lang = currentLang();
    const placeholder = lang === 'en' ? 'MM/DD/YYYY' : 'dd.mm.rrrr';

    const overlayEl = DOC.createElement('div');
    overlayEl.className = 'ajsee-date-popover-overlay';
    overlayEl.setAttribute('data-ajsee-date-overlay', '1');
    overlayEl.hidden = true;

    overlayEl.innerHTML = `
      <div class="ajsee-date-popover ajsee-date-tm" data-ajsee="date-popover" role="dialog" aria-modal="false" aria-labelledby="ajsee-date-tm-title" tabindex="-1">
        <div class="ajsee-date-tm__grab" aria-hidden="true"></div>

        <div class="ajsee-date-tm__header">
          <div class="ajsee-date-tm__header-copy">
            <h3 class="ajsee-date-tm__title-main" id="ajsee-date-tm-title">${esc(t.pickerTitle || t.dateLabel || 'Date')}</h3>
          </div>
          <button type="button" class="ajsee-date-tm__close" data-act="close" aria-label="${esc(t.cancel)}">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="ajsee-date-tm__body">
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
                  <button type="button" class="ajsee-date-tm__nav" data-nav="next-inline" aria-label="Next month">›</button>
                </div>
                <div class="ajsee-date-tm__dow" data-role="dow-0"></div>
                <div class="ajsee-date-tm__grid" data-role="grid-0"></div>
              </div>

              <div class="ajsee-date-tm__month" data-month="1">
                <div class="ajsee-date-tm__month-head">
                  <button type="button" class="ajsee-date-tm__nav" data-nav="prev-inline" aria-label="Previous month">‹</button>
                  <div class="ajsee-date-tm__title" data-role="title-1"></div>
                  <button type="button" class="ajsee-date-tm__nav" data-nav="next" aria-label="Next month">›</button>
                </div>
                <div class="ajsee-date-tm__dow" data-role="dow-1"></div>
                <div class="ajsee-date-tm__grid" data-role="grid-1"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="ajsee-date-tm__actions">
          <button type="button" class="ajsee-date-tm__btn" data-act="clear">${esc(t.clear)}</button>
          <div class="ajsee-date-tm__actions-right">
            <button type="button" class="ajsee-date-tm__btn" data-act="cancel">${esc(t.cancel)}</button>
            <button type="button" class="ajsee-date-tm__btn primary" data-act="apply">${esc(t.apply)}</button>
          </div>
        </div>
      </div>
    `;

    DOC.body.appendChild(overlayEl);

    overlay = overlayEl;
    popover = overlayEl.querySelector('.ajsee-date-popover');

    popover.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
      } else if (e.key === 'Enter') {
        const target = e.target;
        const isDayButton = !!(target && target.closest && target.closest('button[data-iso]'));
        if (!isDayButton) {
          e.preventDefault();
          applyAndClose();
        }
      }
    });

    overlay.addEventListener('click', (e) => {
      if (!isOpen) return;
      if (!isMobileOpen) return;
      if (e.target === overlay) closePopover();
    });

    popover.querySelectorAll('[data-quick]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-quick');
        const today = todayISO();

        if (mode === 'anytime') {
          selFrom = '';
          selTo = '';
        } else if (mode === 'today') {
          selFrom = today;
          selTo = today;
        }

        const cur = parseISO(today);
        viewMonthIdx = monthIndex(new Date(cur.getFullYear(), cur.getMonth(), 1, 12, 0, 0, 0));
        renderUI();
      });
    });

    const closeBtn = popover.querySelector('[data-act="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closePopover());
    }

    popover.querySelector('[data-act="clear"]').addEventListener('click', () => {
      selFrom = '';
      selTo = '';
      renderUI();
    });

    popover.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      closePopover();
    });

    popover.querySelector('[data-act="apply"]').addEventListener('click', applyAndClose);

    const goPrev = () => {
      const minDate = parseISO(todayISO());
      const minIdx = monthIndex(new Date(minDate.getFullYear(), minDate.getMonth(), 1, 12, 0, 0, 0));
      viewMonthIdx = Math.max(minIdx, (viewMonthIdx == null ? minIdx : viewMonthIdx) - 1);
      renderUI();
    };

    const goNext = () => {
      const baseDate = parseISO(todayISO());
      const baseIdx = monthIndex(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 12, 0, 0, 0));
      const currentIdx = viewMonthIdx == null ? baseIdx : viewMonthIdx;
      viewMonthIdx = currentIdx + 1;
      renderUI();
    };

    popover.querySelector('[data-nav="prev"]').addEventListener('click', goPrev);
    popover.querySelector('[data-nav="prev-inline"]').addEventListener('click', goPrev);
    popover.querySelector('[data-nav="next"]').addEventListener('click', goNext);
    popover.querySelector('[data-nav="next-inline"]').addEventListener('click', goNext);

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
      const tmp = selFrom;
      selFrom = selTo;
      selTo = tmp;
    }
  }

  function onPickDay (iso) {
    const min = todayISO();
    if (iso < min) return;

    if (!selFrom) {
      selFrom = iso;
      selTo = '';
    } else if (selFrom && !selTo) {
      if (iso >= selFrom) selTo = iso;
      else {
        selFrom = iso;
        selTo = '';
      }
    } else {
      selFrom = iso;
      selTo = '';
    }

    normalizeSelection();

    const d = parseISO(selFrom || todayISO()) || parseISO(todayISO());
    viewMonthIdx = monthIndex(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));

    renderUI();
  }

  function setTabsActive () {
    const today = todayISO();
    const any = !selFrom && !selTo;
    const isToday = selFrom === today && selTo === today;

    popover.querySelectorAll('.ajsee-date-tm__tab').forEach((b) => b.classList.remove('is-active'));

    const bAny = popover.querySelector('[data-quick="anytime"]');
    const bToday = popover.querySelector('[data-quick="today"]');
    if (any && bAny) bAny.classList.add('is-active');
    if (isToday && bToday) bToday.classList.add('is-active');
  }

  function renderMonth (monthOffset) {
    const lang = currentLang();
    const todayDate = parseISO(todayISO());
    const startIdx = viewMonthIdx == null
      ? monthIndex(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1, 12, 0, 0, 0))
      : viewMonthIdx;

    const monthStart = fromMonthIndex(startIdx + monthOffset);
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();

    const titleEl = popover.querySelector(`[data-role="title-${monthOffset}"]`);
    if (titleEl) titleEl.textContent = monthTitle(monthStart, lang);

    const dowEl = popover.querySelector(`[data-role="dow-${monthOffset}"]`);
    if (dowEl) {
      const labels = weekdayLabels(lang);
      dowEl.innerHTML = labels.map((w) => `<span>${esc(w)}</span>`).join('');
    }

    const gridEl = popover.querySelector(`[data-role="grid-${monthOffset}"]`);
    if (!gridEl) return;

    const first = new Date(y, m, 1, 12, 0, 0, 0);
    const daysInMonth = new Date(y, m + 1, 0, 12, 0, 0, 0).getDate();

    const startDow = weekStartsOn(lang);
    const firstDow = first.getDay();
    const leading = (firstDow - startDow + 7) % 7;

    const min = todayISO();
    const today = todayISO();
    const from = selFrom || '';
    const to = selTo || '';

    let html = '';
    for (let i = 0; i < leading; i++) {
      html += '<div class="ajsee-date-tm__empty"></div>';
    }

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

      html += `
        <div class="ajsee-date-tm__cell">
          <button type="button"
            class="${cls}"
            data-iso="${esc(iso)}"
            aria-disabled="${disabled ? 'true' : 'false'}"
            ${disabled ? 'tabindex="-1"' : ''}>
            ${day}
          </button>
        </div>
      `;
    }

    gridEl.innerHTML = html;
  }

  function updateNavVisibility () {
    const month0 = popover.querySelector('[data-month="0"]');
    const month1 = popover.querySelector('[data-month="1"]');
    const btnPrev = popover.querySelector('[data-nav="prev"]');
    const btnPrevInline = popover.querySelector('[data-nav="prev-inline"]');
    const btnNextInline = popover.querySelector('[data-nav="next-inline"]');
    const btnNext = popover.querySelector('[data-nav="next"]');

    const minDate = parseISO(todayISO());
    const minIdx = monthIndex(new Date(minDate.getFullYear(), minDate.getMonth(), 1, 12, 0, 0, 0));
    const isAtMin = (viewMonthIdx == null ? minIdx : viewMonthIdx) <= minIdx;

    if (isMobileMode()) {
      if (month0) month0.hidden = false;
      if (month1) month1.hidden = true;

      if (btnPrev) {
        btnPrev.hidden = false;
        btnPrev.disabled = isAtMin;
      }
      if (btnNextInline) btnNextInline.hidden = false;
      if (btnPrevInline) btnPrevInline.hidden = true;
      if (btnNext) btnNext.hidden = true;
    } else {
      if (month0) month0.hidden = false;
      if (month1) month1.hidden = false;

      if (btnPrev) {
        btnPrev.hidden = false;
        btnPrev.disabled = isAtMin;
      }
      if (btnNextInline) btnNextInline.hidden = true;
      if (btnPrevInline) btnPrevInline.hidden = true;
      if (btnNext) btnNext.hidden = false;
    }
  }

  function renderUI () {
    if (!popover) return;
    normalizeSelection();

    const lang = currentLang();
    const t = txt();

    const titleMain = popover.querySelector('.ajsee-date-tm__title-main');
    const startLabel = popover.querySelector('.ajsee-date-tm__field:nth-child(1) label');
    const endLabel = popover.querySelector('.ajsee-date-tm__field:nth-child(2) label');
    const bAny = popover.querySelector('[data-quick="anytime"]');
    const bToday = popover.querySelector('[data-quick="today"]');
    const bClear = popover.querySelector('[data-act="clear"]');
    const bCancel = popover.querySelector('[data-act="cancel"]');
    const bApply = popover.querySelector('[data-act="apply"]');

    if (titleMain) titleMain.textContent = t.pickerTitle || t.dateLabel || 'Date';
    if (startLabel) startLabel.textContent = t.start;
    if (endLabel) endLabel.textContent = t.end;
    if (bAny) bAny.textContent = t.anytime;
    if (bToday) bToday.textContent = t.today;
    if (bClear) bClear.textContent = t.clear;
    if (bCancel) bCancel.textContent = t.cancel;
    if (bApply) bApply.textContent = t.apply;

    const closeBtn = popover.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.setAttribute('aria-label', t.cancel);

    const placeholder = lang === 'en' ? 'MM/DD/YYYY' : 'dd.mm.rrrr';
    const startInp = popover.querySelector('input[data-role="start"]');
    const endInp = popover.querySelector('input[data-role="end"]');
    if (startInp) {
      startInp.value = formatDisplay(selFrom, lang);
      startInp.placeholder = placeholder;
    }
    if (endInp) {
      endInp.value = formatDisplay(selTo, lang);
      endInp.placeholder = placeholder;
    }

    setTabsActive();
    updateNavVisibility();
    renderMonth(0);
    if (!isMobileMode()) renderMonth(1);
  }

  function removeAnchorScrollListeners () {
    if (!scrollParents.length) return;
    scrollParents.forEach((node) => {
      try { node.removeEventListener('scroll', schedulePosition, { passive: true }); } catch {
        /* noop */
      }
    });
    scrollParents = [];
  }

  function addAnchorScrollListeners () {
    removeAnchorScrollListeners();
    if (!anchorEl) return;

    scrollParents = getScrollParents(anchorEl);
    scrollParents.forEach((node) => {
      try { node.addEventListener('scroll', schedulePosition, { passive: true }); } catch {
        /* noop */
      }
    });
  }

  function schedulePosition () {
    if (!isOpen) return;
    if (rafPosition) return;
    rafPosition = WIN.requestAnimationFrame(() => {
      rafPosition = 0;
      positionPopover();
    });
  }

  function positionDesktopPopover () {
    if (!popover || !anchorEl) return;

    if (overlay) {
      overlay.style.pointerEvents = 'none';
      overlay.style.background = 'transparent';
      overlay.style.backdropFilter = 'none';
      overlay.style.webkitBackdropFilter = 'none';
      overlay.style.padding = '0';
      overlay.style.alignItems = 'flex-start';
      overlay.style.justifyContent = 'flex-start';
    }

    popover.style.position = 'fixed';
    popover.style.margin = '0';
    popover.style.inset = 'auto';
    popover.style.right = 'auto';
    popover.style.bottom = 'auto';
    popover.style.transform = 'none';
    popover.style.width = `min(${CONFIG.MAX_W}px, calc(100vw - 24px))`;
    popover.style.maxWidth = `min(${CONFIG.MAX_W}px, calc(100vw - 24px))`;
    popover.style.overflow = 'auto';

    const anchor = DOC.getElementById('date-combo-button') || anchorEl;
    if (!anchor || !anchor.isConnected) {
      closePopover();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const vpW = WIN.innerWidth || DOC.documentElement.clientWidth || 1024;
    const vpH = WIN.innerHeight || DOC.documentElement.clientHeight || 768;
    const safeTop = getHeaderSafeTop();

    if (rect.bottom <= safeTop || rect.top >= vpH || rect.width <= 0 || rect.height <= 0) {
      closePopover();
      return;
    }

    popover.style.maxHeight = '';
    popover.style.maxWidth = '';

    const panelRect = popover.getBoundingClientRect();
    const panelW = Math.min(panelRect.width || CONFIG.MAX_W, CONFIG.MAX_W, vpW - CONFIG.SAFE * 2);
    const panelH = panelRect.height || CONFIG.MAX_H;

    let computed = null;
    try {
      if (typeof WIN.ajseePositionDatePopover === 'function') {
        computed = WIN.ajseePositionDatePopover({
          anchor,
          anchorRect: rect,
          panel: popover,
          panelRect: { width: panelW, height: panelH },
          viewportWidth: vpW,
          viewportHeight: vpH,
          gap: CONFIG.GAP
        });
      }
    } catch {
      computed = null;
    }

    let left;
    let top;
    let maxHeight;

    if (computed && typeof computed.left === 'number' && typeof computed.top === 'number') {
      left = computed.left;
      top = computed.top;
      maxHeight = computed.maxHeight;
    } else {
      left = Math.max(CONFIG.SAFE, Math.min(rect.left, vpW - CONFIG.SAFE - panelW));
      top = rect.bottom + CONFIG.GAP;

      if (top + panelH > vpH - CONFIG.SAFE) {
        const above = rect.top - CONFIG.GAP - panelH;
        if (above >= safeTop) {
          top = above;
        } else {
          top = safeTop;
          maxHeight = Math.max(220, vpH - safeTop - CONFIG.SAFE);
        }
      } else if (top < safeTop) {
        top = safeTop;
      }
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.right = 'auto';
    popover.style.bottom = 'auto';
    popover.style.transform = 'none';
    popover.style.overflow = 'auto';
    popover.style.maxHeight = `${Math.round(maxHeight || Math.min(CONFIG.MAX_H, vpH - safeTop - CONFIG.SAFE))}px`;
  }

  function positionPopover () {
    if (!isOpen || !popover || !overlay) return;

    updateViewportVars();

    if (isMobileOpen) {
      overlay.classList.add('is-mobile');
      overlay.classList.remove('is-desktop');
      popover.classList.add('is-mobile');
      popover.classList.remove('is-desktop');
      popover.style.left = '';
      popover.style.top = '';
      popover.style.maxHeight = '';
      return;
    }

    overlay.classList.add('is-desktop');
    overlay.classList.remove('is-mobile');
    popover.classList.add('is-desktop');
    popover.classList.remove('is-mobile');

    positionDesktopPopover();
  }

  function openPopover (anchor) {
    if (!anchor) return;

    ensurePopover();

    anchorEl = anchor;
    isOpen = true;
    isMobileOpen = isMobileMode();

    overlay.hidden = false;
    popover.hidden = false;

    const values = readCurrentHiddenInputs();
    selFrom = (values.from || '').trim();
    selTo = (values.to || '').trim();
    normalizeSelection();

    const base = parseISO(selFrom || todayISO()) || parseISO(todayISO());
    const baseMonth = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
    const minMonth = new Date(parseISO(todayISO()).getFullYear(), parseISO(todayISO()).getMonth(), 1, 12, 0, 0, 0);
    viewMonthIdx = Math.max(monthIndex(minMonth), monthIndex(baseMonth));

    if (isMobileOpen) {
      lockBodyScroll();
      overlay.classList.add('is-mobile');
      overlay.classList.remove('is-desktop');
    } else {
      overlay.classList.add('is-desktop');
      overlay.classList.remove('is-mobile');
      addAnchorScrollListeners();
    }

    renderUI();
    positionPopover();

    const focusTarget = isMobileOpen
      ? popover.querySelector('[data-act="close"]')
      : popover.querySelector('[data-act="apply"]');

    if (focusTarget && focusTarget.focus) {
      try { focusTarget.focus({ preventScroll: true }); } catch {
        try { focusTarget.focus(); } catch {
          /* noop */
        }
      }
    }
  }

  function closePopover () {
    if (!isOpen) return;

    isOpen = false;

    if (rafPosition) {
      WIN.cancelAnimationFrame(rafPosition);
      rafPosition = 0;
    }

    removeAnchorScrollListeners();

    if (isMobileOpen) unlockBodyScroll();
    isMobileOpen = false;

    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-mobile', 'is-desktop');
    }

    if (popover) {
      popover.hidden = true;
      popover.classList.remove('is-mobile', 'is-desktop');
      popover.style.left = '';
      popover.style.top = '';
      popover.style.maxHeight = '';
    }

    anchorEl = null;
  }

  function emitApply (detail) {
    try { WIN.dispatchEvent(new CustomEvent('AJSEE:date-popover:apply', { detail })); } catch {
      /* noop */
    }
    try { WIN.dispatchEvent(new CustomEvent('AJSEE:dateRangeApply', { detail })); } catch {
      /* noop */
    }
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

    emitApply({ mode, from, to, dateFrom: from, dateTo: to });
    closePopover();
  }

  function onGlobalPointerDown (e) {
    if (!isOpen || isMobileOpen) return;
    const target = e.target;
    if (popover && popover.contains(target)) return;
    if (anchorEl && anchorEl.contains(target)) return;
    closePopover();
  }

  function bindGlobalListeners () {
    DOC.addEventListener('mousedown', onGlobalPointerDown, true);
    DOC.addEventListener('touchstart', onGlobalPointerDown, true);

    WIN.addEventListener('resize', schedulePosition, { passive: true });
    WIN.addEventListener('orientationchange', schedulePosition, { passive: true });

    if (WIN.visualViewport) {
      WIN.visualViewport.addEventListener('resize', schedulePosition, { passive: true });
      WIN.visualViewport.addEventListener('scroll', schedulePosition, { passive: true });
    }

    WIN.addEventListener('AJSEE:langChanged', (e) => {
      let forced = null;
      try {
        const detail = e && e.detail;
        if (typeof detail === 'string') forced = detail;
        else if (detail && typeof detail.lang === 'string') forced = detail.lang;
        else if (detail && typeof detail.locale === 'string') forced = detail.locale;
        else if (detail && typeof detail.language === 'string') forced = detail.language;
      } catch {
        /* noop */
      }

      syncDateComboLabel(forced);

      if (overlay) {
        try { overlay.remove(); } catch {
          /* noop */
        }
        overlay = null;
        popover = null;
      }

      closePopover();
      initAnchors();
      WIN.requestAnimationFrame(() => syncDateComboLabel(forced));
    });
  }

  function bindTrigger (btn) {
    if (!btn || btn.dataset.ajseeDateBound === '1') return;
    btn.dataset.ajseeDateBound = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen && anchorEl === btn) closePopover();
      else openPopover(btn);
    });
  }

  function initAnchors () {
    getDateComboButtons().forEach(bindTrigger);
    syncDateComboLabel();
  }

  bindGlobalListeners();

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', () => {
      initAnchors();
      observeLangChanges();
      setTimeout(syncDateComboLabel, 0);
      setTimeout(syncDateComboLabel, 80);
      setTimeout(syncDateComboLabel, 250);
      setTimeout(initAnchors, 250);
    });
  } else {
    initAnchors();
    observeLangChanges();
    setTimeout(syncDateComboLabel, 0);
    setTimeout(syncDateComboLabel, 80);
    setTimeout(syncDateComboLabel, 250);
    setTimeout(initAnchors, 250);
  }
})();
