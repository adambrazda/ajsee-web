/*!
 * AJSEE – Date Popover helper
 * - Clamp umístění do viewportu (left/top) přes CSS proměnné
 * - Re-pozicování při resize/scrollu
 * - Auto "compact" mód (1 kalendář) podle šířky viewportu / kotvy
 * - Outside click + Escape zavření (volitelné)
 * - MutationObserver: reaguje na přidané .ajsee-date-popover
 *
 * Použití:
 *  1) Na stránku vlož <script type="module" src="/js/ajsee-date-popover.js"></script>
 *  2) Po DOMContentLoaded zavolej  AjseeDatePopover.init();
 *  3) Při otevření kalendáře vytvoř element .ajsee-date-popover a nastav mu:
 *       - data-anchored-to="ID_kotvy"   (ID inputu/tlačítka)
 *       - (volitelně) data-prefer="start|end"  – preferovaný okraj (výchozí "start")
 *       - (volitelně) data-dismiss-outside="1" – zavřít klikem mimo
 *       - (volitelně) data-close-on-escape="1" – zavřít Esc
 *       - (volitelně) data-auto-remove="1"     – po zavření remove() (default 1)
 *  4) Kdykoliv můžeš zavolat AjseeDatePopover.repositionAll()
 */

(function () {
  const WIN = window;
  const DOC = document;

  const CONFIG = {
    SAFE: 16,               // bezpečný vnitřní okraj od hran viewportu
    GAP: 8,                 // mezera mezi kotvou a popoverem
    MAX_W: 680,             // hard limit (odpovídá SCSS --popover-w)
    MAX_H: 520,             // hard limit (odpovídá --ajsee-popover-height)
    Z_INDEX: 10010,         // nad headerem/overlayi
    COMPACT_BREAKPOINT: 560 // pod touto šířkou -> data-compact="1"
  };

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function getAnchor(pop) {
    if (!pop) return null;
    const id = pop.getAttribute('data-anchored-to');
    if (id) return DOC.getElementById(id);
    // fallback: první focuseable předek, případně předchozí sourozenec
    const labelFor = pop.getAttribute('aria-labelledby');
    if (labelFor) {
      const el = DOC.getElementById(labelFor);
      if (el) return el;
    }
    // pokud nic – zkusíme prvek s [aria-controls] ukazující na popover.id
    if (pop.id) {
      const ctrl = DOC.querySelector(`[aria-controls="${pop.id}"]`);
      if (ctrl) return ctrl;
    }
    // nouzovka: předchozí sourozenec
    return pop.previousElementSibling || null;
  }

  function sizePopover(pop) {
    // Respektuj CSS max-width/height z SCSS, ale nastav root proměnné pro jistotu
    const w = Math.min(CONFIG.MAX_W, WIN.innerWidth - CONFIG.SAFE * 2);
    const h = Math.min(CONFIG.MAX_H, WIN.innerHeight - CONFIG.SAFE * 2);
    pop.style.setProperty('--ajsee-popover-width', `${w}px`);
    pop.style.setProperty('--ajsee-popover-height', `${h}px`);
    pop.style.zIndex = String(CONFIG.Z_INDEX);

    // Compact mód – podle viewportu a šířky kotvy
    const anchor = getAnchor(pop);
    const anchorW = anchor ? anchor.getBoundingClientRect().width : 0;
    if (WIN.innerWidth <= CONFIG.COMPACT_BREAKPOINT || anchorW < 420) {
      pop.setAttribute('data-compact', '1');
    } else {
      pop.removeAttribute('data-compact');
    }
  }

  function positionPopover(pop) {
    const anchor = getAnchor(pop);
    sizePopover(pop);

    // Preferred edge: start (left) nebo end (right) vzhledem k anchoru
    const prefer = (pop.getAttribute('data-prefer') || 'start').toLowerCase();

    // Skutečné rozměry popoveru (po layoutu)
    // Pokud ještě není v dokumentu s rozměry, dočasně zobrazíme
    const wasHidden = pop.style.display === 'none';
    if (wasHidden) pop.style.display = '';

    const rectA = anchor ? anchor.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    const rectP = pop.getBoundingClientRect();
    const w = Math.min(rectP.width || CONFIG.MAX_W, WIN.innerWidth - CONFIG.SAFE * 2);
    const h = Math.min(rectP.height || CONFIG.MAX_H, WIN.innerHeight - CONFIG.SAFE * 2);

    // X: defaultně zarovnáme k levému okraji kotvy (start),
    // při prefer="end" k pravému okraji.
    let left = (prefer === 'end')
      ? rectA.right - w
      : rectA.left;

    // Y: pod kotvu (bottom + GAP). Pokud by přetekl spodní hranu, zkusíme nad kotvu.
    let top = rectA.bottom + CONFIG.GAP;
    if (top + h + CONFIG.SAFE > WIN.innerHeight) {
      const above = rectA.top - CONFIG.GAP - h;
      if (above >= CONFIG.SAFE) top = above;
    }

    // Clamp do viewportu
    left = clamp(left, CONFIG.SAFE, WIN.innerWidth - w - CONFIG.SAFE);
    top  = clamp(top,  CONFIG.SAFE, WIN.innerHeight - h - CONFIG.SAFE);

    // Proměnné čte SCSS (viz filters-premium.scss)
    pop.style.setProperty('--ajsee-popover-left', `${Math.round(left)}px`);
    pop.style.setProperty('--ajsee-popover-top',  `${Math.round(top)}px`);
    pop.style.setProperty('--ajsee-popover-width', `${Math.round(w)}px`);
    pop.style.setProperty('--ajsee-popover-height', `${Math.round(h)}px`);

    if (wasHidden) pop.style.display = 'none';
  }

  function closePopover(pop) {
    if (!pop) return;
    pop.removeAttribute('data-open');
    const autoRemove = pop.getAttribute('data-auto-remove');
    if (autoRemove === null || autoRemove === '1') {
      pop.remove();
    } else {
      pop.hidden = true;
    }
  }

  function handleOutsideClick(e) {
    const pops = DOC.querySelectorAll('.ajsee-date-popover[data-dismiss-outside="1"]');
    pops.forEach(pop => {
      if (!pop.contains(e.target)) {
        const anchor = getAnchor(pop);
        if (anchor && anchor.contains(e.target)) return; // klik na kotvu neuzavírá
        closePopover(pop);
      }
    });
  }

  function handleEscape(e) {
    if (e.key !== 'Escape') return;
    const pops = DOC.querySelectorAll('.ajsee-date-popover[data-close-on-escape="1"]');
    if (pops.length === 0) return;
    // zavřít poslední (nejvýše přidaný)
    closePopover(pops[pops.length - 1]);
  }

  // Debounce pro resize/scroll
  let rafId = 0;
  function scheduleRepositionAll() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      AjseeDatePopover.repositionAll();
    });
  }

  // Public API
  const AjseeDatePopover = {
    init() {
      // Repozicování při resize/scroll
      WIN.addEventListener('resize', scheduleRepositionAll, { passive: true });
      WIN.addEventListener('scroll', scheduleRepositionAll, { passive: true });

      // Outside click / Escape
      DOC.addEventListener('pointerdown', handleOutsideClick, true);
      DOC.addEventListener('keydown', handleEscape);

      // Najdi existující a pozicuj
      this.repositionAll();

      // Sleduj přidávání do DOM (kalendářové knihovny často mountují dynamicky)
      const mo = new MutationObserver((muts) => {
        let changed = false;
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            if (n.classList && n.classList.contains('ajsee-date-popover')) {
              // základní atributy
              n.setAttribute('role', 'dialog');
              n.setAttribute('data-open', '1');
              // implicitní chování, pokud není nastaveno
              if (!n.hasAttribute('data-auto-remove')) n.setAttribute('data-auto-remove', '1');
              // vycentruj na první dobrou
              positionPopover(n);
              changed = true;
            } else {
              // zanořený popover?
              const inner = n.querySelector?.('.ajsee-date-popover');
              if (inner) {
                inner.setAttribute('role', 'dialog');
                inner.setAttribute('data-open', '1');
                if (!inner.hasAttribute('data-auto-remove')) inner.setAttribute('data-auto-remove', '1');
                positionPopover(inner);
                changed = true;
              }
            }
          }
        }
        if (changed) scheduleRepositionAll();
      });
      mo.observe(DOC.body, { childList: true, subtree: true });
      this._mo = mo;
    },

    // Ruční otevření/pozicování pro daný pár (kotva, popover)
    openFor(anchorEl, popEl, opts = {}) {
      if (!(anchorEl instanceof HTMLElement) || !(popEl instanceof HTMLElement)) return;
      if (opts.prefer) popEl.setAttribute('data-prefer', String(opts.prefer));
      if (opts.dismissOutside) popEl.setAttribute('data-dismiss-outside', '1');
      if (opts.closeOnEscape) popEl.setAttribute('data-close-on-escape', '1');
      if (opts.autoRemove === false) popEl.setAttribute('data-auto-remove', '0');

      if (anchorEl.id) popEl.setAttribute('data-anchored-to', anchorEl.id);

      popEl.classList.add('ajsee-date-popover');
      popEl.setAttribute('role', 'dialog');
      popEl.setAttribute('data-open', '1');

      // Ujisti se, že je v dokumentu
      if (!popEl.isConnected) DOC.body.appendChild(popEl);

      positionPopover(popEl);
      scheduleRepositionAll();
    },

    repositionAll() {
      const pops = DOC.querySelectorAll('.ajsee-date-popover');
      pops.forEach(positionPopover);
    }
  };

  // Expose
  WIN.AjseeDatePopover = AjseeDatePopover;
})();
