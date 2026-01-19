// src/filters/date-combo.js
// AJSEE – Compact date-range combo (button + inline popover)
// - Works wherever #date-combo-button + #date-combo-popover + hidden #filter-date-from/#filter-date-to exist
// - No dependency on other engines; fully self-contained
// - Updates native inputs (name="date_from"/"date_to") so existing filters API keeps working

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const DOC = document;

  function log(...args) {
    if (window && window.console && console.debug) {
      console.debug('[date-combo]', ...args);
    }
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, days) {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  function addMonths(d, months) {
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  function isSameDate(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function isBefore(a, b) {
    return a.getTime() < b.getTime();
  }

  function isBetween(date, start, end) {
    if (!start || !end) return false;
    const t = startOfDay(date).getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  function formatISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatLabelRange(start, end, lang) {
    if (!start && !end) return null;
    const fmtDay = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'numeric' });
    const fmtDayYear = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'numeric', year: 'numeric' });

    if (start && end && isSameDate(start, end)) {
      return fmtDayYear.format(start);
    }

    if (start && end && start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth()) {
      // "2.–5. 3. 2025"
      const day1 = start.getDate();
      const day2 = end.getDate();
      const tail = fmtDayYear.format(end).replace(/^\d+\.?\s*/, '');
      return `${day1}.–${day2}. ${tail}`;
    }

    // general "2. 3. – 10. 4. 2025"
    const part1 = fmtDay.format(start);
    const part2 = fmtDayYear.format(end);
    return `${part1} – ${part2}`;
  }

  function upcomingWeekendRange(base) {
    const today = startOfDay(base);
    const weekday = today.getDay(); // 0=Sun .. 6=Sat
    const daysToSaturday = (6 - weekday + 7) % 7;
    const saturday = addDays(today, daysToSaturday);
    const sunday = addDays(saturday, 1);
    return { start: saturday, end: sunday };
  }

  function notifyChange(input) {
    if (!input) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function initDateCombo() {
    const button = DOC.getElementById('date-combo-button');
    const labelSpan = DOC.getElementById('date-combo-text');
    const popover = DOC.getElementById('date-combo-popover');
    const inputFrom = DOC.getElementById('filter-date-from');
    const inputTo = DOC.getElementById('filter-date-to');

    if (!button || !labelSpan || !popover || !inputFrom || !inputTo) {
      log('Required elements not found – skipping init.');
      return;
    }

    // Make container positioning context
    const group = button.closest('.filter-group') || button.parentElement;
    if (group && getComputedStyle(group).position === 'static') {
      group.style.position = 'relative';
    }

    const lang = (DOC.documentElement.getAttribute('lang') || 'cs').toLowerCase();
    const defaultLabel = labelSpan.textContent.trim() || 'Kdykoliv';
    const today = startOfDay(new Date());

    const state = {
      viewDate: new Date(today.getFullYear(), today.getMonth(), 1),
      start: inputFrom.value ? startOfDay(new Date(inputFrom.value)) : null,
      end: inputTo.value ? startOfDay(new Date(inputTo.value)) : null,
      open: false
    };

    // --- Build POPUP UI -----------------------------------------------------
    popover.classList.add('date-combo-popover');
    popover.hidden = true;
    // Ensure basic positioning; SCSS can refine.
    if (getComputedStyle(popover).position === 'static') {
      popover.style.position = 'absolute';
    }
    if (!popover.style.top) popover.style.top = 'calc(100% + 8px)';
    if (!popover.style.left) popover.style.left = '0px';
    if (!popover.style.zIndex) popover.style.zIndex = '1000';

    popover.innerHTML = `
      <div class="dc-panel" role="dialog" aria-modal="false">
        <header class="dc-header">
          <button type="button" class="dc-nav dc-prev" aria-label="Předchozí měsíc">‹</button>
          <div class="dc-month" aria-live="polite"></div>
          <button type="button" class="dc-nav dc-next" aria-label="Další měsíc">›</button>
        </header>
        <div class="dc-weekdays" aria-hidden="true"></div>
        <div class="dc-grid" role="grid"></div>
        <footer class="dc-footer">
          <div class="dc-quick">
            <button type="button" class="dc-pill dc-anytime" data-mode="anytime">Kdykoliv</button>
            <button type="button" class="dc-pill dc-today" data-mode="today">Dnes</button>
            <button type="button" class="dc-pill dc-weekend" data-mode="weekend">Tento víkend</button>
          </div>
          <button type="button" class="dc-clear">Vymazat</button>
        </footer>
      </div>
    `;

    const monthEl = popover.querySelector('.dc-month');
    const gridEl = popover.querySelector('.dc-grid');
    const weekdaysEl = popover.querySelector('.dc-weekdays');
    const prevBtn = popover.querySelector('.dc-prev');
    const nextBtn = popover.querySelector('.dc-next');
    const clearBtn = popover.querySelector('.dc-clear');
    const quickButtons = Array.from(popover.querySelectorAll('.dc-pill'));

    // Weekday labels (Mon–Sun)
    try {
      const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
      const baseMonday = new Date(2024, 0, 1); // Monday
      const frag = DOC.createDocumentFragment();
      for (let i = 0; i < 7; i++) {
        const d = new Date(baseMonday);
        d.setDate(d.getDate() + i);
        const span = DOC.createElement('span');
        span.textContent = fmt.format(d);
        frag.appendChild(span);
      }
      weekdaysEl.innerHTML = '';
      weekdaysEl.appendChild(frag);
    } catch (e) {
      weekdaysEl.textContent = 'Po Út St Čt Pá So Ne';
    }

    function applyToInputs() {
      if (state.start) {
        inputFrom.value = formatISO(state.start);
      } else {
        inputFrom.value = '';
      }
      if (state.end) {
        inputTo.value = formatISO(state.end);
      } else {
        inputTo.value = '';
      }
      notifyChange(inputFrom);
      notifyChange(inputTo);
    }

    function updateLabel() {
      if (!state.start || !state.end) {
        labelSpan.textContent = defaultLabel;
        return;
      }
      labelSpan.textContent = formatLabelRange(state.start, state.end, lang) || defaultLabel;
    }

    function renderMonth() {
      const y = state.viewDate.getFullYear();
      const m = state.viewDate.getMonth();
      try {
        monthEl.textContent = state.viewDate.toLocaleDateString(lang, {
          month: 'long',
          year: 'numeric'
        });
      } catch {
        const mNum = m + 1;
        monthEl.textContent = `${y}-${mNum.toString().padStart(2,'0')}`;
      }

      gridEl.innerHTML = '';

      const firstOfMonth = new Date(y, m, 1);
      const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
      const daysInMonth = new Date(y, m + 1, 0).getDate();

      const totalCells = 42; // 6 weeks
      const startDate = addDays(firstOfMonth, -firstWeekday);

      const frag = DOC.createDocumentFragment();

      for (let i = 0; i < totalCells; i++) {
        const dayDate = addDays(startDate, i);
        const dayBtn = DOC.createElement('button');
        dayBtn.type = 'button';
        dayBtn.className = 'dc-day';
        dayBtn.textContent = String(dayDate.getDate());
        dayBtn.setAttribute('data-date', formatISO(dayDate));
        dayBtn.setAttribute('role', 'gridcell');

        if (dayDate.getMonth() !== m) {
          dayBtn.classList.add('is-out');
        }
        if (isSameDate(dayDate, today)) {
          dayBtn.classList.add('is-today');
        }
        if (state.start && isSameDate(dayDate, state.start)) {
          dayBtn.classList.add('is-start', 'is-in-range');
        }
        if (state.end && isSameDate(dayDate, state.end)) {
          dayBtn.classList.add('is-end', 'is-in-range');
        }
        if (isBetween(dayDate, state.start, state.end)) {
          dayBtn.classList.add('is-in-range');
        }

        dayBtn.addEventListener('click', () => handleDayClick(dayDate));
        frag.appendChild(dayBtn);
      }

      gridEl.appendChild(frag);
    }

    function handleDayClick(dayDate) {
      const day = startOfDay(dayDate);

      if (!state.start || (state.start && state.end)) {
        state.start = day;
        state.end = null;
      } else {
        if (isBefore(day, state.start)) {
          state.end = state.start;
          state.start = day;
        } else {
          state.end = day;
        }
      }

      // If end is still null (user clicked the same start twice), treat as single-day range
      if (state.start && !state.end) {
        state.end = state.start;
      }

      applyToInputs();
      updateLabel();
      renderMonth();

      // If full range picked, auto-close
      if (state.start && state.end) {
        closePopover();
      }
    }

    function clearRange() {
      state.start = null;
      state.end = null;
      applyToInputs();
      updateLabel();
      renderMonth();
    }

    function quickSelect(mode) {
      if (mode === 'anytime') {
        clearRange();
        closePopover();
        return;
      }

      if (mode === 'today') {
        const d = today;
        state.start = d;
        state.end = d;
      } else if (mode === 'weekend') {
        const r = upcomingWeekendRange(today);
        state.start = r.start;
        state.end = r.end;
        state.viewDate = new Date(r.start.getFullYear(), r.start.getMonth(), 1);
      }

      applyToInputs();
      updateLabel();
      renderMonth();
      closePopover();
    }

    prevBtn.addEventListener('click', () => {
      state.viewDate = addMonths(state.viewDate, -1);
      renderMonth();
    });

    nextBtn.addEventListener('click', () => {
      state.viewDate = addMonths(state.viewDate, 1);
      renderMonth();
    });

    clearBtn.addEventListener('click', clearRange);

    quickButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        quickSelect(btn.getAttribute('data-mode'));
      });
    });

    // --- OPEN/CLOSE ---------------------------------------------------------
    function openPopover() {
      if (state.open) return;
      state.open = true;
      popover.hidden = false;
      button.setAttribute('aria-expanded', 'true');

      positionPopover();

      DOC.addEventListener('click', handleDocumentClick, true);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', positionPopover);
    }

    function closePopover() {
      if (!state.open) return;
      state.open = false;
      popover.hidden = true;
      button.setAttribute('aria-expanded', 'false');

      DOC.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', positionPopover);
    }

    function handleDocumentClick(ev) {
      if (!state.open) return;
      const target = ev.target;
      if (button.contains(target) || popover.contains(target)) return;
      closePopover();
    }

    function handleKeyDown(ev) {
      if (ev.key === 'Escape') {
        closePopover();
      }
    }

    function positionPopover() {
      // Positioned relative to filter-group; rely on CSS for styling.
      // Here we just ensure it does not overflow viewport horizontally.
      // Reset left before measuring so repeated opens don't stack shifts.
      popover.style.left = popover.style.left || '0px';
      const rect = popover.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const overflowRight = rect.right - vw;
      if (overflowRight > 0) {
        const style = getComputedStyle(popover);
        let currentLeft = parseFloat(style.left);
        if (isNaN(currentLeft)) currentLeft = 0;
        popover.style.left = (currentLeft - overflowRight - 8) + 'px';
      }
    }

    button.addEventListener('click', () => {
      if (state.open) {
        closePopover();
      } else {
        openPopover();
      }
    });

    // Hook chips, if present, so combo label stays in sync
    const chipToday = DOC.getElementById('chipToday');
    const chipWeekend = DOC.getElementById('chipWeekend');
    const chipClear = DOC.getElementById('chipClear');

    if (chipToday) {
      chipToday.addEventListener('click', () => quickSelect('today'));
    }
    if (chipWeekend) {
      chipWeekend.addEventListener('click', () => quickSelect('weekend'));
    }
    if (chipClear) {
      chipClear.addEventListener('click', () => quickSelect('anytime'));
    }

    // Initial sync
    applyToInputs();
    updateLabel();
    renderMonth();

    log('Initialized.');
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', initDateCombo);
  } else {
    initDateCombo();
  }
})();
