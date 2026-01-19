// /src/filters/active-chips.js
// Aktivní „prémiové“ chips (sdílené pro homepage i /events)
// renderFilterChips({ t, getFilters, setFilters, setFilterInputsFromState, renderAndSync, findChipsHost })

export function renderFilterChips({ t, getFilters, setFilters, setFilterInputsFromState, renderAndSync, findChipsHost }) {
  const f = getFilters?.() || {};
  const mount = findChipsHost?.();
  if (!mount) return;

  let host = document.querySelector('.chips.chips-active');
  if (!host) {
    host = document.createElement('div');
    host.className = 'chips chips-active';
    if (mount.after) mount.parent.insertBefore(host, mount.after.nextSibling);
    else if (mount.before) mount.parent.insertBefore(host, mount.before);
    else mount.parent.appendChild(host);
  } else {
    // zajisti správné umístění při reflow/SSR
    const shouldBeAfter = mount.after && host.previousElementSibling !== mount.after;
    const shouldBeBefore = mount.before && host.nextElementSibling !== mount.before;
    if (shouldBeAfter || shouldBeBefore) {
      host.remove();
      if (mount.after) mount.parent.insertBefore(host, mount.after.nextSibling);
      else if (mount.before) mount.parent.insertBefore(host, mount.before);
    }
  }

  host.innerHTML = '';

  /* ───────── utils ───────── */
  const esc = (s = '') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const pad2 = (n) => String(n).padStart(2,'0');

  const parseISODateMidday = (iso) => {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      const d = new Date(iso);
      return isNaN(d) ? null : d;
    }
    return new Date(+m[1], +m[2]-1, +m[3], 12, 0, 0, 0);
  };
  const formatDMY = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
  const formatDateRangeCompact = (aISO, bISO) => {
    if (aISO && !bISO) {
      const A = parseISODateMidday(aISO); return A ? formatDMY(A) : aISO;
    }
    if (bISO && !aISO) {
      const B = parseISODateMidday(bISO); return B ? formatDMY(B) : bISO;
    }
    if (!aISO && !bISO) return '';
    const A = parseISODateMidday(aISO), B = parseISODateMidday(bISO);
    if (!A || !B) return `${aISO || ''}${aISO && bISO ? ' – ' : ''}${bISO || ''}`;

    const sameYear  = A.getFullYear() === B.getFullYear();
    const sameMonth = sameYear && A.getMonth() === B.getMonth();
    if (sameMonth) {
      return `${pad2(A.getDate())}–${pad2(B.getDate())}.${pad2(A.getMonth()+1)}.${A.getFullYear()}`;
    }
    if (sameYear) {
      return `${pad2(A.getDate())}.${pad2(A.getMonth()+1)} – ${pad2(B.getDate())}.${pad2(B.getMonth()+1)}.${B.getFullYear()}`;
    }
    return `${formatDMY(A)} – ${formatDMY(B)}`;
  };

  const i18n = (key, fb) => (typeof t === 'function' ? t(key, fb) : (fb ?? key));
  const labelCategory = i18n('filters.category','Category');
  const labelCity     = i18n('filters.city','City');
  const labelFrom     = i18n('filters.dateFrom','From');
  const labelTo       = i18n('filters.dateTo','To');
  const labelDate     = i18n('filters.date','Date');
  const labelKeyword  = i18n('filters.keyword','Keyword');
  const labelSort     = i18n('filters.sort','Sort');
  const labelLatest   = i18n('filters.latest','Latest');
  const labelNearMe   = i18n('filters.nearMe','Near me');
  const labelClear    = i18n('filters.reset','Clear');

  const addChip = (label, onClear) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip is-active';
    chip.textContent = label;
    chip.setAttribute('aria-label', `${label} – ${labelClear}`);
    chip.addEventListener('click', onClear);
    host.appendChild(chip);
  };

  let chipsCount = 0;

  // Kategorie
  if (f.category) {
    addChip(`${labelCategory}: ${i18n('category-'+f.category, f.category)}`, async () => {
      setFilters?.({ category: undefined });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // Město
  if (f.city) {
    addChip(`${labelCity}: ${f.city}`, async () => {
      setFilters?.({ city: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // Datum – jednotný čip (range)
  if (f.dateFrom || f.dateTo) {
    const compact = formatDateRangeCompact(f.dateFrom || '', f.dateTo || '');
    addChip(`${labelDate}: ${compact}`, async () => {
      setFilters?.({ dateFrom: '', dateTo: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // Klíčové slovo (zkrátit, když je moc dlouhé)
  if (f.keyword) {
    const kw = String(f.keyword || '');
    const shortKw = kw.length > 28 ? `${kw.slice(0, 25)}…` : kw;
    addChip(`${labelKeyword}: ${shortKw}`, async () => {
      setFilters?.({ keyword: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // Řazení (zobraz jen když není default "nearest")
  if (f.sort && f.sort !== 'nearest') {
    addChip(`${labelSort}: ${labelLatest}`, async () => {
      setFilters?.({ sort: 'nearest' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // Near Me
  if (f.nearMeLat && f.nearMeLon) {
    const radius = f.nearMeRadiusKm || 50;
    addChip(`${labelNearMe} ~${radius} km`, async () => {
      setFilters?.({ nearMeLat: null, nearMeLon: null, nearMeRadiusKm: null });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
    chipsCount++;
  }

  // schovej wrap, pokud není co zobrazit
  host.hidden = chipsCount === 0;
}
