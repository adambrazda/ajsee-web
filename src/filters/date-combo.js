// src/filters/date-combo.js
// Date range combo (2 months) – FIXED positioning:
// • right-aligned k triggeru (inline style left/top – žádné CSS var)
// • viewport clamping, above/below volba
// • repositions on scroll/resize (throttled via rAF)
// • outside click + ESC to close
// • Reset / Cancel / Apply (+ mirrors to #filter-date-from / #filter-date-to)
// • Today ring + timezone-safe (počítáme v poledne)

export function initDateCombo(opts = {}) {
  const BUTTON_SEL = opts.buttonSelector || '#date-combo-button';
  const FROM_SEL   = opts.fromSelector   || '#filter-date-from,#events-date-from';
  const TO_SEL     = opts.toSelector     || '#filter-date-to,#events-date-to';

  const button = document.querySelector(BUTTON_SEL);
  const fromEl = document.querySelector(FROM_SEL);
  const toEl   = document.querySelector(TO_SEL);
  if (!button || !fromEl || !toEl) return;

  // signal pro fallback v events-home.js, že běží custom picker
  button.setAttribute('data-date-combo','1');

  let open = false;
  let pop = null;
  let selStart = parseISO(fromEl.value);
  let selEnd   = parseISO(toEl.value);
  if (selStart && selEnd && selEnd < selStart) [selStart, selEnd] = [selEnd, selStart];
  let base = firstOfMonth(selStart || new Date());

  // i18n
  const LANG = (document.documentElement.lang || 'cs').toLowerCase().slice(0,2);
  const DICT = ({
    cs: { start:'Počáteční datum', end:'Koncové datum', reset:'Vymazat', cancel:'Zrušit', apply:'Použít',
          days:['po','út','st','čt','pá','so','ne'] },
    sk: { start:'Počiatočný dátum', end:'Koncový dátum', reset:'Vymazať', cancel:'Zrušiť', apply:'Použiť',
          days:['po','ut','st','št','pi','so','ne'] },
    en: { start:'Start date', end:'End date', reset:'Reset', cancel:'Cancel', apply:'Apply',
          days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    de: { start:'Startdatum', end:'Enddatum', reset:'Zurücksetzen', cancel:'Abbrechen', apply:'Übernehmen',
          days:['Mo','Di','Mi','Do','Fr','Sa','So'] },
    pl: { start:'Data początkowa', end:'Data końcowa', reset:'Wyczyść', cancel:'Anuluj', apply:'Zastosuj',
          days:['Pn','Wt','Śr','Cz','Pt','So','Nd'] },
    hu: { start:'Kezdő dátum', end:'Záró dátum', reset:'Törlés', cancel:'Mégse', apply:'Alkalmaz',
          days:['H','K','Sze','Cs','P','Szo','V'] }
  })[LANG] || { start:'Start date', end:'End date', reset:'Reset', cancel:'Cancel', apply:'Apply',
                days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] };

  const toggle = () => (open ? close() : openPopover());
  button.addEventListener('click', toggle);
  button.addEventListener('keydown', (e)=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggle(); } });

  function openPopover(){
    selStart = parseISO(fromEl.value);
    selEnd   = parseISO(toEl.value);
    if (selStart && selEnd && selEnd < selStart) [selStart, selEnd] = [selEnd, selStart];
    base = firstOfMonth(selStart || new Date());
    renderPopover();
    open = true;
    button.setAttribute('aria-expanded','true');
  }

  function renderPopover(){
    destroy();

    pop = document.createElement('div');
    pop.className = 'ajsee-date-popover';
    pop.id = 'ajsee-date-popover';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-modal','true');
    pop.style.position = 'fixed';
    pop.style.zIndex = '200000';       // nad headerem

    // šířka/výška přes CSS var necháme (OK), ale pozici nastavíme inline
    const vw = window.innerWidth || 1280;
    const targetW = Math.min(560, Math.max(480, Math.floor(vw * 0.42)));
    pop.style.setProperty('--ajsee-popover-width', `${targetW}px`);
    pop.style.setProperty('--ajsee-popover-height', `420px`);

    pop.innerHTML = `
      <div class="ajsee-date-inner">
        <div class="ajsee-date-top">
          <div class="date-inputs">
            <input class="di start" type="text" value="${fmtDisplay(selStart) || ''}" placeholder="${esc(DICT.start)}" readonly>
            <span class="di-sep">–</span>
            <input class="di end"   type="text" value="${fmtDisplay(selEnd)   || ''}" placeholder="${esc(DICT.end)}" readonly>
          </div>
          <div class="nav">
            <button type="button" class="nav-btn prev" aria-label="Prev">‹</button>
            <button type="button" class="nav-btn next" aria-label="Next">›</button>
          </div>
        </div>
        <div class="cal-wrap">
          <div class="cal cal-left"></div>
          <div class="cal cal-right"></div>
        </div>
        <div class="ajsee-date-actions">
          <button type="button" class="btn ghost reset">${esc(DICT.reset)}</button>
          <span class="flex-spacer"></span>
          <button type="button" class="btn ghost cancel">${esc(DICT.cancel)}</button>
          <button type="button" class="btn primary apply">${esc(DICT.apply)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(pop);

    const leftHost  = pop.querySelector('.cal-left');
    const rightHost = pop.querySelector('.cal-right');
    renderMonth(leftHost, base);
    renderMonth(rightHost, addMonths(base, 1));

    pop.querySelector('.prev').addEventListener('click', () => { base = addMonths(base, -1); renderMonth(leftHost, base); renderMonth(rightHost, addMonths(base, 1)); position(true); });
    pop.querySelector('.next').addEventListener('click', () => { base = addMonths(base, +1); renderMonth(leftHost, base); renderMonth(rightHost, addMonths(base, 1)); position(true); });

    pop.querySelector('.reset').addEventListener('click', () => {
      selStart = null; selEnd = null;
      fromEl.value = ''; toEl.value = '';
      pop.querySelector('.di.start').value = '';
      pop.querySelector('.di.end').value = '';
      renderMonth(leftHost, base);
      renderMonth(rightHost, addMonths(base, 1));
    });
    pop.querySelector('.cancel').addEventListener('click', close);
    pop.querySelector('.apply').addEventListener('click', () => {
      fromEl.value = fmtISO(selStart) || '';
      toEl.value   = fmtISO(selEnd)   || '';
      fromEl.dispatchEvent(new Event('change', { bubbles:true }));
      toEl.dispatchEvent(new Event('change', { bubbles:true }));
      const form = button.closest('form') || document.getElementById('events-filters-form');
      if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
      close();
    });

    setTimeout(()=>{ document.addEventListener('pointerdown', handleOutside, true); document.addEventListener('keydown', handleEsc, true); },0);

    position(true);
    const rafThrottle = (fn)=>{ let pid=0; return ()=>{ if (pid) return; pid=requestAnimationFrame(()=>{ pid=0; fn(); }); }; };
    const onMove = rafThrottle(()=> position(false));
    window.addEventListener('resize', onMove, { passive:true });
    window.addEventListener('scroll', onMove, true);

    // ulož pro cleanup
    pop._onMove = onMove;
  }

  function renderMonth(host, dateObj){
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const title = dateObj.toLocaleDateString(undefined, { month:'long', year:'numeric' });

    const first = new Date(y, m, 1, 12,0,0,0);
    let startOffset = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const daysIn = new Date(y, m+1, 0, 12,0,0,0).getDate();

    const today = new Date(); today.setHours(12,0,0,0);

    let html = `<div class="cal-head">${esc(cap(title))}</div>`;
    html += `<div class="dow">${DICT.days.map(d=>`<span>${esc(d)}</span>`).join('')}</div>`;
    html += `<div class="grid">`;
    for (let i=0;i<startOffset;i++) html += `<button class="empty" tabindex="-1" aria-hidden="true"></button>`;
    for (let d=1; d<=daysIn; d++){
      const cur = new Date(y, m, d, 12,0,0,0);
      const iso = fmtISO(cur);
      const inSel = inRange(cur, selStart, selEnd);
      const isStart = sameDay(cur, selStart);
      const isEnd   = sameDay(cur, selEnd);
      const isToday = sameDay(cur, today);
      const cls = ['day', inSel&&'in', isStart&&'start', isEnd&&'end', isToday&&'today'].filter(Boolean).join(' ');
      html += `<button type="button" class="${cls}" data-iso="${iso}"><span>${d}</span></button>`;
    }
    html += `</div>`;
    host.innerHTML = html;

    host.querySelectorAll('.day').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const d = parseISO(btn.dataset.iso);
        if (!selStart || (selStart && selEnd)) { selStart = d; selEnd = null; }
        else if (d >= selStart) { selEnd = d; }
        else { selEnd = selStart; selStart = d; }
        pop.querySelector('.di.start').value = fmtDisplay(selStart) || '';
        pop.querySelector('.di.end').value   = fmtDisplay(selEnd)   || '';
        const leftHost  = pop.querySelector('.cal-left');
        const rightHost = pop.querySelector('.cal-right');
        renderMonth(leftHost, base);
        renderMonth(rightHost, addMonths(base, 1));
      });
    });
  }

  // RIGHT-aligned positioning + clamp
  function position(forceMeasure = false){
    if (!pop) return;

    const GAP = 8, PAD = 16;
    const t = button.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    if (forceMeasure) {
      pop.style.visibility = 'hidden';
      pop.style.left = '0px'; pop.style.top = '0px';
      // vynucení layoutu
      void pop.offsetWidth;
    }

    const pw = pop.offsetWidth || 560;
    const ph = pop.offsetHeight || 420;

    // výchozí: pod triggerem
    let top = t.bottom + GAP;
    if (top + ph > vh - PAD) {
      const above = t.top - GAP - ph;
      top = (above >= PAD) ? above : clamp(top, PAD, Math.max(PAD, vh - ph - PAD));
    }

    // right-aligned k pravému okraji tlačítka
    let left = t.right - pw;
    // clamp do viewportu
    left = clamp(left, PAD, vw - pw - PAD);

    // >>> zásadní změna: inline left/top, žádné CSS var <<<
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top  = `${Math.round(top)}px`;
    pop.style.visibility = 'visible';
  }

  function handleOutside(e){
    if (!pop || !open) return;
    if (pop.contains(e.target) || button.contains(e.target)) return;
    close();
  }
  function handleEsc(e){ if (e.key === 'Escape') close(); }

  function close(){
    open = false;
    destroy();
    document.removeEventListener('pointerdown', handleOutside, true);
    document.removeEventListener('keydown', handleEsc, true);
    try { button.setAttribute('aria-expanded','false'); button.focus(); } catch{}
  }

  function destroy(){
    if (!pop) return;
    try {
      window.removeEventListener('resize', pop._onMove);
      window.removeEventListener('scroll',  pop._onMove, true);
    } catch {}
    if (pop.parentNode) pop.parentNode.removeChild(pop);
    pop = null;
  }

  // utils
  function parseISO(s){
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3], 12,0,0,0);
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  function fmtISO(d){ if(!d) return ''; const y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate();
    return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
  function fmtDisplay(d){ if(!d) return ''; try{
    return d.toLocaleDateString(undefined,{ day:'2-digit', month:'2-digit', year:'numeric' });
  }catch{ return fmtISO(d); } }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function firstOfMonth(d){ const x = d? new Date(d) : new Date(); x.setDate(1); x.setHours(12,0,0,0); return x; }
  function addMonths(d, n){ const x = new Date(d); x.setMonth(x.getMonth()+n,1); return x; }
  function sameDay(a,b){ if(!a||!b) return false; return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function inRange(d, a, b){ if(!a||!b) return false; const t=d.getTime(), x=a.getTime(), y=b.getTime(); return t>=Math.min(x,y) && t<=Math.max(x,y); }
}
