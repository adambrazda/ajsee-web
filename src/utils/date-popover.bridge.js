// src/utils/date-popover.bridge.js
/*! AJSEE – Bridge mezi date-combo widgetem a popover engine
   2025-11
   • Priorita: nový engine (AJSEE.DatePopoverEngine), poté legacy (AJSEE_DatePopover)
   • Fallback: hoist do <body>, fixed pozice NAD kotvou, clamp do viewportu
   • Jistota interakce: z-index, pointer-events, ESC, klik mimo
   • ARIA: aria-expanded/controls, role="dialog"
   • Idempotentní montáž obsahu přes __ajseeBuildDateComboPopover
*/
(function () {
  const DOC = document;
  const WIN = window;

  const SAFE = 16, GAP = 8, MAX_W = 720, MAX_H = 520, Z = 199990;

  const STATE = { close:null, onDocClick:null, onEsc:null, onReposition:null };
  const _prevDisplay = new WeakMap();

  const qs = (s, r=DOC) => r.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function on(t, ev, fn, opts){
    if(!t||!t.addEventListener) return ()=>{};
    t.addEventListener(ev, fn, opts);
    return ()=>{ try{ t.removeEventListener(ev, fn, opts);}catch{} };
  }

  function getAnchor(){
    return qs('#date-combo-button') ||
           qs('.date-combo .combo-button') ||
           qs('.date-combo .combo-trigger');
  }

  function ensureInlineHost(){
    const wrap = qs('.date-combo');
    if (!wrap) return null;
    let pop = wrap.querySelector('#date-combo-popover') || wrap.querySelector('.combo-popover');
    if (!pop) {
      pop = DOC.createElement('div');
      pop.id = 'date-combo-popover';
      pop.className = 'combo-popover ajsee-date-popover';
      pop.hidden = true;
      wrap.appendChild(pop);
    } else {
      pop.id ||= 'date-combo-popover';
      pop.classList.add('ajsee-date-popover');
    }
    pop.setAttribute('data-owner','date-combo');
    return pop;
  }

  function mountContentIfNeeded(host){
    if (!host) return host;
    if (!host.firstElementChild && typeof WIN.__ajseeBuildDateComboPopover === 'function') {
      try { const node = WIN.__ajseeBuildDateComboPopover(); if (node) host.appendChild(node); }
      catch(e){ console.warn('[date-bridge] build failed:', e); }
    }
    host.setAttribute('role','dialog');
    host.setAttribute('aria-modal','false');
    return host;
  }

  // ----- fallback positioning -----
  function hoist(host){ try{ if (host.parentElement!==DOC.body) DOC.body.appendChild(host); }catch{} return host; }

  function positionAbove(anchor, host){
    if (!anchor || !host) return;
    host.style.position = 'fixed';
    host.style.zIndex = String(Z);
    host.style.pointerEvents = 'auto';
    host.style.overflow = 'auto';
    host.style.overscrollBehavior = 'contain';
    host.style.maxWidth = Math.min(MAX_W, Math.max(280, window.innerWidth - SAFE*2)) + 'px';

    const ar = anchor.getBoundingClientRect();
    const rect = host.getBoundingClientRect();
    const w = rect.width || host.offsetWidth || 420;
    const vw = window.innerWidth, vh = window.innerHeight;

    const roomAbove = Math.max(180, ar.top - GAP - SAFE);
    const h = Math.min(rect.height || host.offsetHeight || MAX_H, Math.min(MAX_H, vh - SAFE*2, roomAbove));
    host.style.maxHeight = h + 'px';

    const left = clamp(Math.round(ar.left + (ar.width/2) - (w/2)), SAFE, Math.max(SAFE, vw - w - SAFE));
    const top  = clamp(Math.round(ar.top - GAP - h), SAFE, Math.max(SAFE, vh - h - SAFE));

    host.style.left = left+'px';
    host.style.top  = top +'px';
  }

  function bindReposition(anchor, host){
    const handler = ()=>positionAbove(anchor, host);
    STATE.onReposition = handler;
    on(window, 'resize', handler, {passive:true});
    on(window, 'scroll', handler, {passive:true});
    on(window, 'ajsee:monthchange', handler, {passive:true});
    setTimeout(handler,0); setTimeout(handler,60); setTimeout(handler,120);
  }
  function unbindReposition(){
    if (!STATE.onReposition) return;
    try{
      window.removeEventListener('resize', STATE.onReposition);
      window.removeEventListener('scroll', STATE.onReposition);
      window.removeEventListener('ajsee:monthchange', STATE.onReposition);
    }catch{}
    STATE.onReposition = null;
  }

  // ----- visibility helpers -----
  function makeVisible(host){
    host.hidden = false;
    if (!_prevDisplay.has(host)) _prevDisplay.set(host, host.style.display);
    host.style.display = 'block';
    host.style.removeProperty('visibility');
  }
  function restoreVisibility(host){
    host.hidden = true;
    if (_prevDisplay.has(host)) {
      const d = _prevDisplay.get(host); _prevDisplay.delete(host);
      if (d) host.style.display = d; else host.style.removeProperty('display');
    } else {
      host.style.removeProperty('display');
    }
  }

  // ----- OPEN/CLOSE -----
  function openWithEngine(anchor, host){
    // Připrav ARIA & vazby, aby engine anchor jednoznačně našel
    if (!anchor.id) anchor.id = 'date-combo-button';
    host.setAttribute('data-anchored-to', anchor.id);
    if (!anchor.getAttribute('aria-controls')) anchor.setAttribute('aria-controls', host.id);

    // zviditelnit a dát dopředu ještě před voláním enginu (bez bliknutí)
    hoist(host);
    makeVisible(host);
    anchor.setAttribute('aria-expanded','true');

    // Primárně nový engine (AJSEE.DatePopoverEngine)
    const NEW = WIN.AJSEE && WIN.AJSEE.DatePopoverEngine;
    if (NEW && typeof NEW.openById === 'function') {
      try {
        NEW.openById(host.id);
        // reposition pro jistotu (nový engine má vlastní loop, ale tohle nebolí)
        try { NEW.reposition(host.id); } catch {}
        return ()=>{ try{ NEW.closeById && NEW.closeById(host.id); }catch{} anchor.setAttribute('aria-expanded','false'); restoreVisibility(host); };
      } catch(e){ console.warn('[date-bridge] AJSEE.DatePopoverEngine.openById failed:', e); }
    }

    // Legacy engine (AJSEE_DatePopover)
    if (WIN.AJSEE_DatePopover && typeof WIN.AJSEE_DatePopover.openById === 'function') {
      try {
        WIN.AJSEE_DatePopover.openById(host.id, { anchor });
        return ()=>{ anchor.setAttribute('aria-expanded','false'); restoreVisibility(host); };
      } catch(e){ console.warn('[date-bridge] legacy openById failed:', e); }
    }

    // Generický hook (pokud by existoval)
    if (typeof WIN.ajseeOpenPopover === 'function') {
      try {
        const close = WIN.ajseeOpenPopover(anchor, host, {
          onClose(){ anchor.setAttribute('aria-expanded','false'); STATE.close=null; restoreVisibility(host); }
        });
        if (typeof close === 'function') return ()=>{ try{ close(); }catch{} restoreVisibility(host); };
      } catch(e){ console.warn('[date-bridge] ajseeOpenPopover failed:', e); }
    }

    // engine nedostupný → necháme fallback převzít
    restoreVisibility(host);
    return null;
  }

  function openFallback(anchor, host){
    hoist(host);
    makeVisible(host);
    anchor.setAttribute('aria-expanded','true');
    bindReposition(anchor, host);

    STATE.onDocClick = (ev)=>{
      const t = ev.target;
      if (host.contains(t) || anchor.contains(t)) return;
      STATE.close && STATE.close();
    };
    STATE.onEsc = (e)=>{ if (e.key==='Escape'){ e.stopPropagation(); STATE.close && STATE.close(); } };
    on(DOC, 'mousedown', STATE.onDocClick, true);
    on(DOC, 'touchstart', STATE.onDocClick, true);
    on(DOC, 'keydown', STATE.onEsc, true);

    STATE.close = function(){
      restoreVisibility(host);
      anchor.setAttribute('aria-expanded','false');
      try{
        DOC.removeEventListener('mousedown', STATE.onDocClick, true);
        DOC.removeEventListener('touchstart', STATE.onDocClick, true);
        DOC.removeEventListener('keydown', STATE.onEsc, true);
      }catch{}
      STATE.onDocClick = STATE.onEsc = null;
      unbindReposition();
      STATE.close = null;
    };
  }

  function openPopover(){
    const anchor = getAnchor();
    const inlineHost = ensureInlineHost();
    if (!anchor || !inlineHost) return;

    // Toggle
    if (!inlineHost.hidden && typeof STATE.close === 'function') {
      STATE.close(); return;
    }

    const host = mountContentIfNeeded(inlineHost);

    // ARIA
    anchor.setAttribute('aria-haspopup','dialog');
    anchor.getAttribute('aria-controls') || anchor.setAttribute('aria-controls', host.id);

    // Engine → fallback
    const closeFromEngine = openWithEngine(anchor, host);
    if (typeof closeFromEngine === 'function') {
      STATE.close = closeFromEngine;
    } else {
      openFallback(anchor, host);
    }
  }

  // public
  WIN.__ajseeDateBridgeOpen = openPopover;

  // wire once (HMR-safe)
  if (!WIN.__ajseeBridgeBound) {
    WIN.__ajseeBridgeBound = true;

    // Klik na kotvu – zachytit v capture fázi a zastavit propagaci,
    // aby nedošlo k dvojímu togglu (bridge + engine handler).
    on(DOC, 'click', (e)=>{
      const a = e.target && e.target.closest('#date-combo-button, .date-combo .combo-button, .date-combo .combo-trigger');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      openPopover();
    }, true);

    // Klávesy na kotvě
    on(DOC, 'keydown', (e)=>{
      if (e.key!=='Enter' && e.key!==' ') return;
      const a = DOC.activeElement;
      if (!a || !a.matches('#date-combo-button, .date-combo .combo-button, .date-combo .combo-trigger')) return;
      e.preventDefault();
      e.stopPropagation();
      openPopover();
    }, true);

    // Zavření na APPLY/CANCEL (oba zápisy)
    on(WIN, 'AJSEE:date-popover:apply', ()=> STATE.close && STATE.close());
    on(WIN, 'AJSEE:date-popover:cancel', ()=> STATE.close && STATE.close());
    on(WIN, 'ajsee:date-popover:apply', ()=> STATE.close && STATE.close());
    on(WIN, 'ajsee:date-popover:cancel', ()=> STATE.close && STATE.close());

    // Sync hidden inputů při APPLY (zachováno)
    on(WIN, 'AJSEE:date-combo:apply', (ev)=>{
      const d = (ev && ev.detail) || {};
      const fEl = qs('#filter-date-from') || qs('#events-date-from');
      const tEl = qs('#filter-date-to')   || qs('#events-date-to');
      if (fEl && ('from' in d || d.clear)) { fEl.value = d.clear ? '' : (d.from || ''); fEl.dispatchEvent(new Event('change', {bubbles:true})); }
      if (tEl && ('to' in d || d.clear))   { tEl.value = d.clear ? '' : (d.to   || ''); tEl.dispatchEvent(new Event('change', {bubbles:true})); }
    });
  }
})();
