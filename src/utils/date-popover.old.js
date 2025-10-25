/**
 * date-popover.js
 * Bezpečné ukotvení kalendářového popoveru do viewportu bez !important.
 * Používá CSS proměnné na .ajsee-date-popover (viz SCSS).
 */

(function () {
  const GAP = 8;   // mezera od triggeru
  const PAD = 16;  // bezpečný okraj od viewportu

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  /**
   * Ukotví popover k triggeru a zajistí, že nepřeteče viewport.
   * @param {HTMLElement} trigger  tlačítko nebo input (ten, co popover otevírá)
   * @param {HTMLElement} popover  element s class .ajsee-date-popover
   */
  function positionDatePopover(trigger, popover) {
    if (!trigger || !popover) return;

    // rozměry
    const t = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // popover může být čerstvě mountnutý -> po reflow
    const pw = popover.offsetWidth || 520;
    const ph = popover.offsetHeight || 420;

    // preferuj umístění POD trigger
    let top = t.bottom + GAP;
    if (top + ph > vh - PAD) {
      const above = t.top - GAP - ph;
      top = (above >= PAD) ? above : clamp(top, PAD, Math.max(PAD, vh - ph - PAD));
    }

    // zarovnání vlevo k triggeru, ale omez hranami viewportu
    let left = t.left;
    left = clamp(left, PAD, vw - pw - PAD);

    // zapiš do CSS proměnných
    popover.style.setProperty('--ajsee-popover-left', `${Math.round(left)}px`);
    popover.style.setProperty('--ajsee-popover-top',  `${Math.round(top)}px`);
    popover.style.setProperty('--ajsee-popover-width', `${Math.round(pw)}px`);
    popover.style.setProperty('--ajsee-popover-height', `${Math.round(ph)}px`);
  }

  // Export do window
  window.ajseePositionDatePopover = positionDatePopover;

  // Volitelná utilita: reflow při změně okna, pokud je popover otevřený
  window.addEventListener('resize', () => {
    const pop = document.querySelector('.ajsee-date-popover:not([hidden])');
    if (!pop) return;
    const trigger = document.querySelector('[aria-controls="' + pop.id + '"]') ||
                    document.querySelector('[data-combo="dates"][aria-expanded="true"]') ||
                    document.querySelector('#date-combo-button');
    if (trigger) positionDatePopover(trigger, pop);
  });
})();