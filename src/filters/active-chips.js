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

  const addChip = (label, onClear) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip is-active';
    chip.textContent = label;
    chip.setAttribute('aria-label', `${label} – ${t?.('filters.reset','Clear') || 'Clear'}`);
    chip.addEventListener('click', onClear);
    host.appendChild(chip);
  };

  if (f.category) {
    addChip(`${t?.('filters.category','Category')}: ${t?.('category-'+f.category, f.category)}`, async () => {
      setFilters?.({ category: undefined });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.city) {
    addChip(`${t?.('filters.city','City')}: ${f.city}`, async () => {
      setFilters?.({ city: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.dateFrom) {
    addChip(`${t?.('filters.dateFrom','From')}: ${f.dateFrom}`, async () => {
      setFilters?.({ dateFrom: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.dateTo) {
    addChip(`${t?.('filters.dateTo','To')}: ${f.dateTo}`, async () => {
      setFilters?.({ dateTo: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.keyword) {
    addChip(`${t?.('filters.keyword','Keyword')}: ${f.keyword}`, async () => {
      setFilters?.({ keyword: '' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.sort && f.sort !== 'nearest') {
    addChip(`${t?.('filters.sort','Sort')}: ${t?.('filters.latest','Latest')}`, async () => {
      setFilters?.({ sort: 'nearest' });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
  if (f.nearMeLat && f.nearMeLon) {
    const radius = f.nearMeRadiusKm || 50;
    addChip(`${t?.('filters.nearMe','Near me')} ~${radius} km`, async () => {
      setFilters?.({ nearMeLat: null, nearMeLon: null, nearMeRadiusKm: null });
      setFilterInputsFromState?.();
      await renderAndSync?.();
    });
  }
}
