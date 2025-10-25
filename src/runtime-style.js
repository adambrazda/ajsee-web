// Runtime CSS + dynamický header offset (sdílené)
let injected = false;

export function ensureRuntimeStyles() {
  if (injected || document.getElementById('ajsee-runtime-style')) { injected = true; return; }
  const style = document.createElement('style');
  style.id = 'ajsee-runtime-style';
  style.textContent = `
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;}
    .filter-dock.is-collapsed .filters-fieldset{display:none;}
    .filter-dock.is-collapsed{padding-bottom:.6rem;}
    .filter-dock.is-collapsed .filters-toolbar{margin-bottom:0;}
    .filters-toggle.chip{display:inline-flex;align-items:center;gap:.5rem;}
    .events-upcoming-section .filter-dock{top:var(--header-offset,88px);}
    /* ACTIVE chips – sjednocení s homepage */
    .chips.chips-active{display:flex;flex-wrap:wrap;gap:.5rem;margin:.5rem 0 0 0}
    .chips.chips-active .chip.is-active{display:inline-flex;align-items:center;gap:.5rem}
    .chips.chips-active .chip.is-active::after{content:'×';font-weight:600;line-height:1}
    /* Skeleton karty (není-li už ve SCSS) */
    .event-card.skeleton{border-radius:16px;overflow:hidden;background:#f6f8fb;padding:12px}
    .event-card.skeleton .ph-img{height:140px;background:linear-gradient(90deg,#eef2f6, #f6f8fb, #eef2f6);animation:s1 1.2s infinite}
    .event-card.skeleton .ph-line{height:12px;margin-top:12px;background:#e8edf4;border-radius:8px}
    .event-card.skeleton .ph-line.short{width:60%}
    @keyframes s1{0%{background-position:-200px 0}100%{background-position:200px 0}}
  `;
  document.head.appendChild(style);
  injected = true;
}

export function updateHeaderOffset() {
  const header = document.querySelector('.site-header');
  const h = header ? Math.ceil(header.getBoundingClientRect().height) : 80;
  const safe = Math.max(56, h + 8);
  document.documentElement.style.setProperty('--header-offset', `${safe}px`);
}
