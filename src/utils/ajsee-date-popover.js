// /src/utils/ajsee-date-popover.js
/*! AJSEE – responsive date range popover
   - desktop: anchored popover under #date-combo-button
   - mobile: bottom sheet
   - emits `AJSEE:date-popover:apply` with { mode, from, to, dateFrom, dateTo }
   - styling is expected from SCSS (.ajsee-date-panel)
*/

(function () {
  const WIN = window;
  const DOC = document;
  const GLOBAL_KEY = '__AJSEE_DATE_POPOVER_V2__';

  if (WIN[GLOBAL_KEY]) return;
  WIN[GLOBAL_KEY] = true;

  const CONFIG = {
    SAFE: 12,
    GAP: 10,
    DESKTOP_BREAKPOINT: 900,
    DESKTOP_MAX_W: 760,
    DESKTOP_MIN_W: 680,
    DESKTOP_MAX_H: 640
  };

  const STRINGS = {
    cs: { anytime: 'Kdykoliv', today: 'Dnes', start: 'Od', end: 'Do', apply: 'Použít', clear: 'Vymazat', cancel: 'Zrušit', close: 'Zavřít', dateLabel: 'Termín' },
    en: { anytime: 'Anytime', today: 'Today', start: 'From', end: 'To', apply: 'Apply', clear: 'Clear', cancel: 'Cancel', close: 'Close', dateLabel: 'Date' },
    de: { anytime: 'Beliebig', today: 'Heute', start: 'Von', end: 'Bis', apply: 'Übernehmen', clear: 'Löschen', cancel: 'Abbrechen', close: 'Schließen', dateLabel: 'Datum' },
    sk: { anytime: 'Kedykoľvek', today: 'Dnes', start: 'Od', end: 'Do', apply: 'Použiť', clear: 'Vymazať', cancel: 'Zrušiť', close: 'Zavrieť', dateLabel: 'Dátum' },
    pl: { anytime: 'Kiedykolwiek', today: 'Dzisiaj', start: 'Od', end: 'Do', apply: 'Zastosuj', clear: 'Wyczyść', cancel: 'Anuluj', close: 'Zamknij', dateLabel: 'Data' },
    hu: { anytime: 'Bármikor', today: 'Ma', start: 'Tól', end: 'Ig', apply: 'Alkalmaz', clear: 'Törlés', cancel: 'Mégse', close: 'Bezárás', dateLabel: 'Dátum' }
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLang(l) {
    const key = String(l || '').toLowerCase().slice(0, 2);
    return STRINGS[key] ? key : 'cs';
  }

  function currentLang(forced) {
    if (forced) return normalizeLang(forced);

    try {
      const htmlLang = (DOC.documentElement.getAttribute('lang') || '').trim();
      if (htmlLang) return normalizeLang(htmlLang);

      const path = WIN.location && WIN.location.pathname ? WIN.location.pathname : '';
      const match = path.match(/^\/(cs|en|de|sk|pl|hu)(\/|$)/i);
      if (match && match[1]) return normalizeLang(match[1]);

      const qs = WIN.location && WIN.location.search ? new URLSearchParams(WIN.location.search) : null;
      const queryLang = qs ? (qs.get('lang') || qs.get('locale') || '') : '';
      if (queryLang) return normalizeLang(queryLang);
    } catch {
      /* noop */
    }

    return 'cs';
  }

  function txt(forcedLang) {
    return STRINGS[currentLang(forcedLang)] || STRINGS.cs;
  }

  function isDesktop() {
    return (WIN.innerWidth || DOC.documentElement.clientWidth || 0) >= CONFIG.DESKTOP_BREAKPOINT;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseISO(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(+match[1], +match[2] - 1, +match[3], 12, 0, 0, 0);
  }

  function toISO(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function monthIndex(d) {
    return d.getFullYear() * 12 + d.getMonth();
  }

  function fromMonthIndex(idx) {
    return new Date(Math.floor(idx / 12), idx % 12, 1, 12, 0, 0, 0);
  }

  function weekStartsOn(lang) {
    return lang === 'en' ? 0 : 1;
  }

  function weekdayLabels(lang) {
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

  function formatDisplay(iso, lang) {
    const d = parseISO(iso);
    if (!d) return '';
    if (lang === 'en') return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function monthTitle(d, lang) {
    try {
      return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(d);
    } catch {
      return `${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }

  function getDateComboButtons() {
    const out = new Set();
    const byId = DOC.getElementById('date-combo-button');
    if (byId) out.add(byId);

    DOC.querySelectorAll('[data-ajsee-date-combo]').forEach((el) => {
      if (el.tagName === 'BUTTON') out.add(el);
      else {
        const btn = el.querySelector('button, .combo-button');
        if (btn) out.add(btn);
      }
    });

    DOC.querySelectorAll('.date-combo .combo-button').forEach((btn) => out.add(btn));
    return Array.from(out);
  }

  function findLabelForDateComboButton(btn) {
    if (!btn) return null;

    const id = (btn.id || '').trim();
    if (id) {
      const safeId = WIN.CSS && CSS.escape ? CSS.escape(id) : id;
      const byFor = DOC.querySelector(`label[for="${safeId}"]`);
      if (byFor) return byFor;
    }

    const combo = btn.closest('.date-combo') || btn.closest('[data-ajsee-date-combo]');
    if (combo) {
      const prev = combo.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') return prev;
      const direct = combo.parentElement ? Array.from(combo.parentElement.children).find((child) => child.tagName === 'LABEL') : null;
      if (direct) return direct;
    }

    const wrappers = [
      btn.closest('.filter-group'),
      combo && combo.closest('.filter-group'),
      btn.closest('.filters-fieldset'),
      btn.closest('.field')
    ].filter(Boolean);

    for (const wrapper of wrappers) {
      const direct = Array.from(wrapper.children || []).find((child) => child.tagName === 'LABEL');
      if (direct) return direct;
      const any = wrapper.querySelector('label');
      if (any) return any;
    }

    return null;
  }

  function syncDateComboLabel(forcedLang) {
    const t = txt(forcedLang);
    const label = t.dateLabel || 'Date';
    const buttons = getDateComboButtons();

    if (!buttons.length) {
      const lone = DOC.querySelector('label[for="date-combo-button"]');
      if (lone) lone.textContent = label;
      return;
    }

    buttons.forEach((btn) => {
      const lbl = findLabelForDateComboButton(btn);
      if (lbl) lbl.textContent = label;
      try {
        btn.setAttribute('aria-label', label);
      } catch {
        /* noop */
      }
    });
  }

  function observeLangChanges() {
    if (!WIN.MutationObserver) return;

    try {
      const mo = new MutationObserver(() => {
        WIN.requestAnimationFrame(() => {
          syncDateComboLabel();
          if (popover) rebuildStaticTexts();
        });
      });

      mo.observe(DOC.documentElement, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
      if (DOC.body) mo.observe(DOC.body, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
    } catch {
      /* noop */
    }
  }

  function readCurrentHiddenInputs() {
    const fromField = DOC.querySelector('#filter-date-from, #events-date-from');
    const toField = DOC.querySelector('#filter-date-to, #events-date-to');
    return {
      from: (fromField && fromField.value) || '',
      to: (toField && toField.value) || ''
    };
  }

  function syncHiddenInputs(from, to) {
    const fromField = DOC.querySelector('#filter-date-from, #events-date-from');
    const toField = DOC.querySelector('#filter-date-to, #events-date-to');
    if (fromField) fromField.value = from || '';
    if (toField) toField.value = to || '';
  }

  function getScrollParents(el) {
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
        const canScroll = node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth;
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

  function getHeaderEl() {
    return DOC.querySelector('header.site-header') || DOC.querySelector('.site-header') || DOC.querySelector('header');
  }

  function getHeaderSafeTop() {
    const header = getHeaderEl();
    if (!header || !header.getBoundingClientRect) return CONFIG.SAFE;
    const rect = header.getBoundingClientRect();
    return Math.max(CONFIG.SAFE, Math.round((rect.bottom || 0) + 10));
  }

  let popover = null;
  let anchorEl = null;
  let isOpen = false;
  let viewMonthIdx = null;
  let selFrom = '';
  let selTo = '';
  let boundParents = [];
  let lastScrollY = 0;

  function saveBodyScrollState() {
    if (DOC.body.classList.contains('ajsee-date-sheet-open')) return;
    lastScrollY = WIN.scrollY || WIN.pageYOffset || 0;
    DOC.body.style.top = `-${lastScrollY}px`;
    DOC.body.classList.add('ajsee-date-sheet-open');
  }

  function restoreBodyScrollState() {
    if (!DOC.body.classList.contains('ajsee-date-sheet-open')) return;
    DOC.body.classList.remove('ajsee-date-sheet-open');
    DOC.body.style.removeProperty('top');
    WIN.scrollTo({ top: lastScrollY, behavior: 'auto' });
  }

  function ensurePopover() {
    if (popover) return;

    const t = txt();
    const wrap = DOC.createElement('div');
    wrap.className = 'ajsee-date-panel';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', isDesktop() ? 'false' : 'true');
    wrap.setAttribute('data-ajsee', 'date-popover');
    wrap.hidden = true;

    wrap.innerHTML = `
      <div class="ajsee-date-panel__backdrop" data-ajsee-close></div>
      <div class="ajsee-date-panel__surface" tabindex="-1">
        <div class="ajsee-date-panel__grab" aria-hidden="true"></div>

        <div class="ajsee-date-panel__header">
          <div class="ajsee-date-panel__tabs" role="tablist" aria-label="Rychlé volby termínu">
            <button type="button" class="ajsee-date-panel__tab" data-quick="anytime">${esc(t.anytime)}</button>
            <button type="button" class="ajsee-date-panel__tab" data-quick="today">${esc(t.today)}</button>
          </div>

          <button type="button" class="ajsee-date-panel__close" data-ajsee-close aria-label="${esc(t.close)}">×</button>
        </div>

        <div class="ajsee-date-panel__inputs">
          <div class="ajsee-date-panel__field">
            <label data-role="label-start">${esc(t.start)}</label>
            <input type="text" data-role="start" readonly />
          </div>
          <div class="ajsee-date-panel__field">
            <label data-role="label-end">${esc(t.end)}</label>
            <input type="text" data-role="end" readonly />
          </div>
        </div>

        <div class="ajsee-date-panel__calendar">
          <div class="ajsee-date-panel__months">
            <section class="ajsee-date-panel__month" data-month="0">
              <div class="ajsee-date-panel__month-head">
                <button type="button" class="ajsee-date-panel__nav" data-nav="prev" aria-label="Předchozí měsíc">‹</button>
                <div class="ajsee-date-panel__title" data-role="title-0"></div>
                <span class="ajsee-date-panel__nav-spacer"></span>
              </div>
              <div class="ajsee-date-panel__dow" data-role="dow-0"></div>
              <div class="ajsee-date-panel__grid" data-role="grid-0"></div>
            </section>

            <section class="ajsee-date-panel__month" data-month="1">
              <div class="ajsee-date-panel__month-head">
                <span class="ajsee-date-panel__nav-spacer"></span>
                <div class="ajsee-date-panel__title" data-role="title-1"></div>
                <button type="button" class="ajsee-date-panel__nav" data-nav="next" aria-label="Další měsíc">›</button>
              </div>
              <div class="ajsee-date-panel__dow" data-role="dow-1"></div>
              <div class="ajsee-date-panel__grid" data-role="grid-1"></div>
            </section>
          </div>
        </div>

        <div class="ajsee-date-panel__actions">
          <button type="button" class="ajsee-date-panel__btn ajsee-date-panel__btn--ghost" data-act="clear">${esc(t.clear)}</button>
          <div class="ajsee-date-panel__actions-right">
            <button type="button" class="ajsee-date-panel__btn ajsee-date-panel__btn--ghost" data-act="cancel">${esc(t.cancel)}</button>
            <button type="button" class="ajsee-date-panel__btn ajsee-date-panel__btn--primary" data-act="apply">${esc(t.apply)}</button>
          </div>
        </div>
      </div>
    `;

    DOC.body.appendChild(wrap);
    popover = wrap;

    popover.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
      }
      if (e.key === 'Enter' && e.target && e.target.matches('button[data-iso]')) {
        e.preventDefault();
        const iso = e.target.getAttribute('data-iso') || '';
        if (iso) onPickDay(iso);
      }
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

        const base = parseISO(today);
        viewMonthIdx = monthIndex(new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0));
        renderUI();
      });
    });

    popover.querySelector('[data-act="clear"]').addEventListener('click', () => {
      selFrom = '';
      selTo = '';
      renderUI();
    });

    popover.querySelector('[data-act="cancel"]').addEventListener('click', closePopover);
    popover.querySelector('[data-act="apply"]').addEventListener('click', applyAndClose);
    popover.querySelectorAll('[data-ajsee-close]').forEach((btn) => btn.addEventListener('click', closePopover));

    popover.querySelector('[data-nav="prev"]').addEventListener('click', () => {
      const now = parseISO(todayISO());
      const minIdx = monthIndex(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
      viewMonthIdx = Math.max(minIdx, (viewMonthIdx || minIdx) - 1);
      renderUI();
      schedulePosition();
    });

    popover.querySelector('[data-nav="next"]').addEventListener('click', () => {
      const now = parseISO(todayISO());
      const base = viewMonthIdx == null
        ? monthIndex(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0))
        : viewMonthIdx;
      viewMonthIdx = base + 1;
      renderUI();
      schedulePosition();
    });

    popover.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button[data-iso]');
      if (!btn) return;
      const iso = btn.getAttribute('data-iso') || '';
      if (!iso || btn.classList.contains('is-disabled')) return;
      onPickDay(iso);
    });
  }

  function rebuildStaticTexts(forcedLang) {
    if (!popover) return;
    const t = txt(forcedLang);

    const closeBtn = popover.querySelector('[data-ajsee-close].ajsee-date-panel__close');
    if (closeBtn) closeBtn.setAttribute('aria-label', t.close);

    const tabAny = popover.querySelector('[data-quick="anytime"]');
    const tabToday = popover.querySelector('[data-quick="today"]');
    const clearBtn = popover.querySelector('[data-act="clear"]');
    const cancelBtn = popover.querySelector('[data-act="cancel"]');
    const applyBtn = popover.querySelector('[data-act="apply"]');
    const startLabel = popover.querySelector('[data-role="label-start"]');
    const endLabel = popover.querySelector('[data-role="label-end"]');

    if (tabAny) tabAny.textContent = t.anytime;
    if (tabToday) tabToday.textContent = t.today;
    if (clearBtn) clearBtn.textContent = t.clear;
    if (cancelBtn) cancelBtn.textContent = t.cancel;
    if (applyBtn) applyBtn.textContent = t.apply;
    if (startLabel) startLabel.textContent = t.start;
    if (endLabel) endLabel.textContent = t.end;

    renderUI();
  }

  function normalizeSelection() {
    const min = todayISO();
    if (selFrom && selFrom < min) selFrom = min;
    if (selTo && selTo < min) selTo = min;
    if (selFrom && selTo && selFrom > selTo) {
      const tmp = selFrom;
      selFrom = selTo;
      selTo = tmp;
    }
  }

  function onPickDay(iso) {
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
    if (!isDesktop() && selFrom && selTo) {
      applyAndClose();
      return;
    }
    schedulePosition();
  }

  function setTabsActive() {
    const today = todayISO();
    const any = !selFrom && !selTo;
    const isToday = selFrom === today && selTo === today;

    popover.querySelectorAll('.ajsee-date-panel__tab').forEach((tab) => tab.classList.remove('is-active'));

    const anyBtn = popover.querySelector('[data-quick="anytime"]');
    const todayBtn = popover.querySelector('[data-quick="today"]');

    if (any && anyBtn) anyBtn.classList.add('is-active');
    if (isToday && todayBtn) todayBtn.classList.add('is-active');
  }

  function renderMonth(offset) {
    const lang = currentLang();
    const now = parseISO(todayISO());
    const startIdx = viewMonthIdx == null
      ? monthIndex(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0))
      : viewMonthIdx;

    const monthStart = fromMonthIndex(startIdx + offset);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    const titleEl = popover.querySelector(`[data-role="title-${offset}"]`);
    if (titleEl) titleEl.textContent = monthTitle(monthStart, lang);

    const dowEl = popover.querySelector(`[data-role="dow-${offset}"]`);
    if (dowEl) dowEl.innerHTML = weekdayLabels(lang).map((day) => `<span>${esc(day)}</span>`).join('');

    const gridEl = popover.querySelector(`[data-role="grid-${offset}"]`);
    if (!gridEl) return;

    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const daysInMonth = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
    const startDow = weekStartsOn(lang);
    const firstDow = first.getDay();
    const leading = (firstDow - startDow + 7) % 7;

    const min = todayISO();
    const today = todayISO();
    const from = selFrom || '';
    const to = selTo || '';

    let html = '';
    for (let i = 0; i < leading; i++) html += '<div class="ajsee-date-panel__empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day, 12, 0, 0, 0);
      const iso = toISO(date);
      const disabled = iso < min;
      const isTodayCell = iso === today;
      const isStart = from && iso === from;
      const isEnd = to && iso === to;
      const inRange = from && to && iso > from && iso < to;

      const cls = [
        'ajsee-date-panel__day',
        disabled ? 'is-disabled' : '',
        isTodayCell ? 'is-today' : '',
        inRange ? 'is-in-range' : '',
        isStart ? 'is-start' : '',
        isEnd ? 'is-end' : ''
      ].filter(Boolean).join(' ');

      html += `
        <div class="ajsee-date-panel__cell">
          <button
            type="button"
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

  function renderUI() {
    if (!popover) return;

    normalizeSelection();
    const lang = currentLang();
    const t = txt();

    popover.classList.toggle('is-desktop', isDesktop());
    popover.classList.toggle('is-mobile', !isDesktop());
    popover.setAttribute('aria-modal', isDesktop() ? 'false' : 'true');

    const startInput = popover.querySelector('input[data-role="start"]');
    const endInput = popover.querySelector('input[data-role="end"]');
    if (startInput) {
      startInput.value = formatDisplay(selFrom, lang);
      startInput.placeholder = lang === 'en' ? 'MM/DD/YYYY' : 'dd.mm.rrrr';
      startInput.setAttribute('aria-label', t.start);
    }
    if (endInput) {
      endInput.value = formatDisplay(selTo, lang);
      endInput.placeholder = lang === 'en' ? 'MM/DD/YYYY' : 'dd.mm.rrrr';
      endInput.setAttribute('aria-label', t.end);
    }

    setTabsActive();
    renderMonth(0);
    renderMonth(1);

    const now = parseISO(todayISO());
    const minIdx = monthIndex(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
    const prevBtn = popover.querySelector('[data-nav="prev"]');
    if (prevBtn) prevBtn.disabled = (viewMonthIdx == null ? minIdx : viewMonthIdx) <= minIdx;
  }

  function clearParentBindings() {
    boundParents.forEach(({ target, handler }) => {
      try {
        target.removeEventListener('scroll', handler);
      } catch {
        /* noop */
      }
    });
    boundParents = [];
  }

  let positionRaf = 0;
  function schedulePosition() {
    if (!isOpen) return;
    if (positionRaf) return;
    positionRaf = WIN.requestAnimationFrame(() => {
      positionRaf = 0;
      positionPopover();
    });
  }

  function bindAnchorScrollParents() {
    clearParentBindings();
    if (!anchorEl || !isDesktop()) return;

    const parents = getScrollParents(anchorEl.closest('.filter-group') || anchorEl);
    parents.forEach((parent) => {
      if (!parent || parent === WIN) return;
      const handler = () => schedulePosition();
      parent.addEventListener('scroll', handler, { passive: true });
      boundParents.push({ target: parent, handler });
    });
  }

  function positionDesktopPopover() {
    if (!popover || !anchorEl) return;

    const anchor = DOC.getElementById('date-combo-button') || anchorEl;
    if (!anchor) return;

    const group = anchor.closest('.filter-group') || anchor;
    const rect = group.getBoundingClientRect();
    const vpW = WIN.innerWidth || DOC.documentElement.clientWidth || 0;
    const vpH = WIN.innerHeight || DOC.documentElement.clientHeight || 0;

    if (rect.bottom <= 0 || rect.top >= vpH) {
      closePopover();
      return;
    }

    popover.style.left = '0px';
    popover.style.top = '0px';
    popover.style.width = '';
    popover.style.maxHeight = '';

    const availableW = Math.max(320, vpW - CONFIG.SAFE * 2);
    const desiredW = Math.min(CONFIG.DESKTOP_MAX_W, Math.max(CONFIG.DESKTOP_MIN_W, Math.round(rect.width * 1.9)));
    const panelW = Math.min(desiredW, availableW);

    popover.style.width = `${panelW}px`;

    const safeTop = getHeaderSafeTop();
    const surface = popover.querySelector('.ajsee-date-panel__surface');
    const panelH = surface ? surface.offsetHeight : popover.offsetHeight;

    let left = rect.left;
    left = Math.max(CONFIG.SAFE, Math.min(left, vpW - CONFIG.SAFE - panelW));

    let top = rect.bottom + CONFIG.GAP;
    const maxBottom = vpH - CONFIG.SAFE;

    if (top + panelH > maxBottom) {
      const above = rect.top - CONFIG.GAP - panelH;
      if (above >= safeTop) {
        top = above;
      } else {
        top = Math.max(safeTop, maxBottom - panelH);
      }
    }

    const maxH = Math.max(420, vpH - safeTop - CONFIG.SAFE);
    popover.style.maxHeight = `${Math.min(CONFIG.DESKTOP_MAX_H, maxH)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function positionMobileSheet() {
    if (!popover) return;
    popover.style.left = '0px';
    popover.style.top = '0px';
    popover.style.width = '100%';
    popover.style.maxHeight = '100%';
  }

  function positionPopover() {
    if (!isOpen || !popover) return;
    if (isDesktop()) positionDesktopPopover();
    else positionMobileSheet();
  }

  function openPopover(anchor) {
    if (!anchor) return;

    ensurePopover();
    anchorEl = anchor;
    isOpen = true;
    popover.hidden = false;

    const current = readCurrentHiddenInputs();
    selFrom = (current.from || '').trim();
    selTo = (current.to || '').trim();
    normalizeSelection();

    const base = parseISO(selFrom || todayISO()) || parseISO(todayISO());
    const baseMonth = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
    const minMonthDate = parseISO(todayISO());
    const minMonth = new Date(minMonthDate.getFullYear(), minMonthDate.getMonth(), 1, 12, 0, 0, 0);
    viewMonthIdx = Math.max(monthIndex(minMonth), monthIndex(baseMonth));

    renderUI();
    bindAnchorScrollParents();
    if (!isDesktop()) saveBodyScrollState();
    positionPopover();

    const surface = popover.querySelector('.ajsee-date-panel__surface');
    if (surface && surface.focus) surface.focus();
  }

  function closePopover() {
    if (!isOpen) return;
    isOpen = false;
    clearParentBindings();
    restoreBodyScrollState();

    if (popover) {
      popover.hidden = true;
      popover.style.removeProperty('left');
      popover.style.removeProperty('top');
      popover.style.removeProperty('width');
      popover.style.removeProperty('max-height');
    }

    const prevAnchor = anchorEl;
    anchorEl = null;
    if (prevAnchor && prevAnchor.setAttribute) prevAnchor.setAttribute('aria-expanded', 'false');
  }

  function applyAndClose() {
    const from = (selFrom || '').trim();
    const to = (selTo || '').trim();

    syncHiddenInputs(from, to);

    let mode = 'range';
    const today = todayISO();
    if (!from && !to) mode = 'anytime';
    else if (from === today && to === today) mode = 'today';

    const detail = { mode, from, to, dateFrom: from, dateTo: to };
    try {
      WIN.dispatchEvent(new CustomEvent('AJSEE:date-popover:apply', { detail }));
    } catch {
      /* noop */
    }
    closePopover();
  }

  function onGlobalPointerDown(e) {
    if (!isOpen) return;
    const target = e.target;
    if (popover && popover.contains(target)) return;
    if (anchorEl && anchorEl.contains(target)) return;
    closePopover();
  }

  function initAnchors() {
    const buttons = getDateComboButtons();
    if (!buttons.length) return;

    syncDateComboLabel();

    buttons.forEach((btn) => {
      if (btn.dataset.ajseeDateBound === '1') return;
      btn.dataset.ajseeDateBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentTarget = e.currentTarget;
        if (isOpen && anchorEl === currentTarget) closePopover();
        else {
          currentTarget.setAttribute('aria-expanded', 'true');
          openPopover(currentTarget);
        }
      });
    });
  }

  DOC.addEventListener('mousedown', onGlobalPointerDown, true);
  DOC.addEventListener('touchstart', onGlobalPointerDown, true);
  WIN.addEventListener('resize', schedulePosition, { passive: true });
  WIN.addEventListener('scroll', schedulePosition, { passive: true });

  WIN.addEventListener('AJSEE:langChanged', (e) => {
    const detail = e && e.detail ? e.detail : null;
    const forced = typeof detail === 'string' ? detail : (detail && (detail.lang || detail.locale || detail.language)) || null;
    syncDateComboLabel(forced);
    rebuildStaticTexts(forced);
    schedulePosition();
  });

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', () => {
      initAnchors();
      observeLangChanges();
      setTimeout(initAnchors, 0);
      setTimeout(syncDateComboLabel, 80);
      setTimeout(syncDateComboLabel, 250);
    });
  } else {
    initAnchors();
    observeLangChanges();
    setTimeout(initAnchors, 0);
    setTimeout(syncDateComboLabel, 80);
    setTimeout(syncDateComboLabel, 250);
  }
})();