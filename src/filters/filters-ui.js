// src/filters/filters-ui.js
// Prémiový „skin“ pro filtry + chování (homepage i /events):
// - glass UI sjednocené s containerem
// - segmented toggle pro Řazení s animovaným "thumbem"
// - gradientový "V mém okolí"
// - badge s počtem aktivních filtrů u tlačítka Skrýt/Zobrazit
// - HMR safe, idempotentní

let cssInjected = false;

function injectCssOnce() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.id = 'ajsee-filters-skin';
  s.textContent = `
    .filters-toolbar { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
    .filters-toolbar .chip { height:40px; padding:0 .95rem; font-weight:800; border-radius:999px;
      border:1px solid rgba(10,40,70,.10); background:rgba(255,255,255,.8); color:#0b2640;
      box-shadow:0 2px 8px rgba(0,0,0,.05); transition:transform .12s ease, box-shadow .12s ease;
    }
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
      width: 44%; border-radius:10px; background:#fff; box-shadow:0 4px 14px rgba(0,0,0,.10);
      transition: transform .18s cubic-bezier(.2,.8,.2,1), width .18s ease; will-change:transform,width; }
    .segmented__btn{ position:relative; z-index:1; border:0; background:transparent;
      padding:.55rem 1rem; border-radius:10px; font-weight:900; color:#123; opacity:.75; }
    .segmented__btn.is-active{ opacity:1; color:#0b2640; }

    /* select schovat a ponechat pro a11y */
    select[data-upgraded="segmented"]{ position:absolute !important; width:1px; height:1px; clip:rect(0 0 0 0); clip-path:inset(50%); overflow:hidden; white-space:nowrap; border:0; padding:0; margin:-1px; }

    /* Toggle s badge */
    #filtersToggle{ background:#fff; border:1px solid rgba(0,0,0,.06); }
    #filtersToggle .badge{
      display:inline-flex; align-items:center; justify-content:center;
      min-width:28px; height:22px; margin-left:.5rem; padding:0 .5rem; border-radius:999px;
      background:#0b5ed7; color:#fff; font-weight:800; font-size:.8rem;
    }
  `;
  document.head.appendChild(s);
}

function isTruthy(v) { return v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all'; }

function countActiveFilters(form) {
  if (!form) return 0;
  const cat = form.querySelector('#filter-category')?.value;
  const city= form.querySelector('#filter-city')?.value;
  const df  = form.querySelector('#filter-date-from')?.value;
  const dt  = form.querySelector('#filter-date-to')?.value;
  const kw  = form.querySelector('#filter-keyword')?.value;
  const sort= (form.querySelector('#filter-sort')?.value) || 'nearest';
  let n = 0;
  if (isTruthy(cat)) n++;
  if (isTruthy(city)) n++;
  if (isTruthy(df)) n++;
  if (isTruthy(dt)) n++;
  if (isTruthy(kw)) n++;
  if (sort === 'latest') n++;
  return n;
}

/** Segmented toggle Řazení s "jezdcem" (thumb) */
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

  // init
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

function ensureToggleWithBadge(root, form, t, initialLabel='hide') {
  const toggle = root.querySelector('#filtersToggle');
  if (!toggle) return { update(){} };
  const setLabel = (mode) => {
    const label = mode === 'show'
      ? (t?.('filters.show','Zobrazit filtry') || 'Zobrazit filtry')
      : (t?.('filters.hide','Skrýt filtry') || 'Skrýt filtry');
    const active = countActiveFilters(form);
    toggle.innerHTML = `<span class="btn-label">${label}</span> <span class="badge">${active}</span>`;
  };
  setLabel(initialLabel);
  return { update(){ setLabel(initialLabel); } };
}

export function initFiltersUI({ root=document, form=null, lang='cs', t=(k,f)=>f } = {}) {
  injectCssOnce();
  const frm = form || root.querySelector('#events-filters-form') || root.querySelector('form.filter-dock') || root.querySelector('.events-filters');
  harmonizeButtons(root, t);
  const seg = enhanceSortToggle(root, t);
  const badge = ensureToggleWithBadge(root, frm, t, 'hide');

  if (frm) ['input','change'].forEach(ev => frm.addEventListener(ev, () => badge.update()));

  return {
    update(){ seg.update?.(); badge.update?.(); }
  };
}
