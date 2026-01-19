// src/filters/filters-ui.js
// Prémiový „skin“ pro filtry + chování (homepage i /events)
// – BEZ tlačítka Zobrazit/Skrýt (desktop i mobil)
// – sjednocení tlačítek, segmented toggle Řazení
// – HMR safe, idempotentní

let cssInjected = false;

function injectCssOnce() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.id = 'ajsee-filters-skin';
  s.textContent = `
    .filters-toolbar{ display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
    .filters-toolbar .chip{ height:40px; padding:0 .95rem; font-weight:800; border-radius:999px;
      border:1px solid rgba(10,40,70,.10); background:rgba(255,255,255,.8); color:#0b2640;
      box-shadow:0 2px 8px rgba(0,0,0,.05); transition:transform .12s ease, box-shadow .12s ease; }
    .filters-toolbar .chip:hover{ transform:translateY(-1px); box-shadow:0 10px 18px rgba(0,0,0,.08); }
    #chipNearMe, .btn-nearme{
      position:relative; border:0; color:#fff; font-weight:900;
      background:linear-gradient(135deg,#0b5ed7 0%,#00bfd8 100%);
      box-shadow:0 14px 38px rgba(0,140,200,.28); border-radius:999px; padding:.9rem 1.2rem;
    }
    #chipNearMe::before{ content:"✨"; margin-right:.55rem; }

    /* Segmented control */
    .segmented{ position:relative; display:inline-flex; gap:.25rem; padding:.35rem;
      border-radius:14px; background:rgba(243,246,251,.7); box-shadow:inset 0 0 0 1px rgba(10,40,70,.08); }
    .segmented__thumb{ position:absolute; top:.35rem; left:.35rem; height: calc(100% - .7rem);
      border-radius:10px; background:#fff; box-shadow:0 4px 14px rgba(0,0,0,.10);
      transition: transform .18s cubic-bezier(.2,.8,.2,1), width .18s ease; will-change:transform,width; }
    .segmented__btn{ position:relative; z-index:1; border:0; background:transparent;
      padding:.55rem 1rem; border-radius:10px; font-weight:900; color:#123; opacity:.75; }
    .segmented__btn.is-active{ opacity:1; color:#0b2640; }

    /* schovat původní select pro a11y */
    select[data-upgraded="segmented"]{ position:absolute !important; width:1px; height:1px; clip:rect(0 0 0 0); clip-path:inset(50%); overflow:hidden; white-space:nowrap; border:0; padding:0; margin:-1px; }
  `;
  document.head.appendChild(s);
}

function enhanceSortToggle(root, t) {
  const sel = root.querySelector('#filter-sort') || root.querySelector('#events-sort-filter');
  if (!sel || sel.dataset.upgraded === 'segmented') return { update(){} };
  sel.dataset.upgraded = 'segmented';

  const wrap = document.createElement('div');
  wrap.className = 'segmented';
  const thumb = document.createElement('div');
  thumb.className = 'segmented__thumb';
  wrap.appendChild(thumb);

  const mkBtn = (value, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__btn';
    b.textContent = label;
    b.dataset.value = value;
    if ((sel.value || 'nearest') === value) b.classList.add('is-active');
    b.addEventListener('click', () => {
      sel.value = value;
      wrap.querySelectorAll('.segmented__btn').forEach(ch => ch.classList.toggle('is-active', ch === b));
      moveThumb();
      sel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    return b;
  };
  const nearestLbl = t?.('filters.nearest','Nejbližší') || 'Nejbližší';
  const latestLbl  = t?.('filters.latest','Nejnovější') || 'Nejnovější';
  wrap.appendChild(mkBtn('nearest', nearestLbl));
  wrap.appendChild(mkBtn('latest',  latestLbl));

  // vlož před select a select skryj
  sel.parentElement.insertBefore(wrap, sel);
  sel.classList.add('sr-only');

  const moveThumb = () => {
    const active = wrap.querySelector('.segmented__btn.is-active') || wrap.querySelector('.segmented__btn');
    const r = active.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const w = Math.max(48, r.width);
    const x = r.left - wr.left;
    thumb.style.width = `${w}px`;
    thumb.style.transform = `translateX(${Math.max(0, x)}px)`;
  };

  // sync z selectu do UI
  sel.addEventListener('change', () => {
    wrap.querySelectorAll('.segmented__btn').forEach(ch => ch.classList.toggle('is-active', ch.dataset.value === sel.value));
    moveThumb();
  });

  requestAnimationFrame(moveThumb);
  window.addEventListener('resize', moveThumb, { passive:true });

  return { update(){ moveThumb(); } };
}

function harmonizeButtons(root, t) {
  const apply = root.querySelector('#events-apply-filters') || root.querySelector('.filter-actions .btn.btn-primary');
  const clear = root.querySelector('#events-clear-filters') || root.querySelector('.filter-actions button[type="reset"]');
  if (apply) { apply.classList.add('btn','btn-primary'); apply.textContent = t?.('filters.apply','Použít filtry') || 'Použít filtry'; }
  if (clear) { clear.classList.add('btn','btn-ghost');   clear.textContent = t?.('filters.reset','Vymazat') || 'Vymazat'; }
  const near = root.querySelector('#chipNearMe') || root.querySelector('#filter-nearme');
  if (near) near.classList.add('btn-nearme');
}

function removeShowHideControls(root){
  // zruš jakékoliv prvky pro show/hide (desktop i mobil), pokud by v DOM náhodou byly
  ['#filtersToggle','#filtersOpen','#filtersClose','#filtersOverlay'].forEach(sel=>{
    const el = root.querySelector(sel) || document.querySelector(sel);
    if (el) el.remove();
  });
  // u formuláře zruš režim „sheet“
  const frm = root.querySelector('#events-filters-form') || root.querySelector('form.filter-dock') || root.querySelector('.events-filters');
  if (frm && frm.hasAttribute('data-behavior')) frm.removeAttribute('data-behavior');
}

export function initFiltersUI({ root=document, form=null, lang='cs', t=(k,f)=>f } = {}) {
  injectCssOnce();
  removeShowHideControls(root);

  harmonizeButtons(root, t);
  const seg = enhanceSortToggle(root, t);

  return { update(){ seg.update?.(); } };
}
