const SHARED_EVENT_FILTERS_MARKUP = `
  <div class="filters-toolbar" aria-label="Rychlé filtry">
    <div class="chips">
      <button
        type="button"
        class="chip"
        id="chipToday"
        data-i18n-key="filters.today"
        aria-pressed="false"
      >Dnes</button>

      <button
        type="button"
        class="chip"
        id="chipTomorrow"
        data-i18n-key="filters.tomorrow"
        aria-pressed="false"
      >Zítra</button>

      <button
        type="button"
        class="chip"
        id="chipThisWeek"
        data-i18n-key="filters.thisWeek"
        aria-pressed="false"
      >Tento týden</button>

      <button
        type="button"
        class="chip"
        id="chipWeekend"
        data-i18n-key="filters.weekend"
        aria-pressed="false"
      >Tento víkend</button>

      <button
        type="button"
        class="chip family-audience-chip"
        id="filter-audience-family"
        data-i18n-key="filters.family"
        aria-pressed="false"
      >Pro rodiny</button>

      <button
        type="button"
        class="chip ghost"
        id="chipClear"
        data-i18n-key="filters.reset"
      >Vymazat</button>
    </div>

    <button
      type="button"
      class="chip chip-near"
      id="chipNearMe"
      aria-pressed="false"
      aria-label="V mém okolí"
      data-i18n-aria="filters.nearMe"
      title="V mém okolí"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1"></path>
      </svg>

      <span data-i18n-key="filters.nearMe">
        V mém okolí
      </span>
    </button>
  </div>

  <fieldset class="filters-fieldset">
    <legend class="sr-only">Filtry</legend>

    <div class="filter-group native-date from is-hidden">
      <label
        for="filter-date-from"
        data-i18n-key="filters.from"
      >Od</label>

      <input
        type="date"
        id="filter-date-from"
        name="date_from"
        class="styled-input"
        inputmode="none"
      />
    </div>

    <div class="filter-group native-date to is-hidden">
      <label
        for="filter-date-to"
        data-i18n-key="filters.to"
      >Do</label>

      <input
        type="date"
        id="filter-date-to"
        name="date_to"
        class="styled-input"
        inputmode="none"
      />
    </div>

    <div class="filter-group">
      <label
        for="filter-category"
        data-i18n-key="filters.category"
      >Kategorie</label>

      <select
        id="filter-category"
        name="category"
        class="styled-select"
      >
        <option
          value="all"
          data-i18n-key="filters.all"
        >Vše</option>

        <option
          value="concert"
          data-i18n-key="category-concert"
        >Koncerty</option>

        <option
          value="festival"
          data-i18n-key="category-festival"
        >Festivaly</option>

        <option
          value="theatre"
          data-i18n-key="category-theatre"
        >Divadlo</option>

        <option
          value="sport"
          data-i18n-key="category-sport"
        >Sport</option>

        <option
          value="film"
          data-i18n-key="category-film"
        >Film a kino</option>
      </select>
    </div>

    <div class="filter-group">
      <label
        for="filter-sort"
        data-i18n-key="filters.sort"
      >Řazení</label>

      <select
        id="filter-sort"
        name="sort"
        class="styled-select"
      >
        <option
          value="nearest"
          data-i18n-key="filters.nearest"
        >Nejbližší</option>

        <option
          value="latest"
          data-i18n-key="filters.latest"
        >Nejnovější</option>
      </select>
    </div>

    <div class="filter-group">
      <label
        for="filter-city"
        data-i18n-key="filters.city"
      >Město</label>

      <div class="field">
        <span class="leading" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
            ></path>
          </svg>
        </span>

        <input
          id="filter-city"
          name="city"
          type="text"
          class="styled-input"
          placeholder="Praha, Brno…"
          data-i18n-placeholder="filters.cityPlaceholder"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="filter-group date-combo">
      <label
        for="date-combo-button"
        data-i18n-key="filters.date"
      >Termín</label>

      <button
        id="date-combo-button"
        class="combo-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls="date-combo-popover"
      >
        <span
          class="combo-text"
          id="date-combo-text"
          data-i18n-key="filters.anytime"
        >Kdykoliv</span>
      </button>

      <div
        class="combo-popover ajsee-date-popover"
        id="date-combo-popover"
        hidden
      ></div>
    </div>

    <div class="filter-group filter-keyword">
      <label
        for="filter-keyword"
        data-i18n-key="filters.keyword"
      >Klíčové slovo</label>

      <div class="field">
        <span class="leading" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
            ></path>
          </svg>
        </span>

        <input
          id="filter-keyword"
          name="keyword"
          type="search"
          class="styled-input"
          placeholder="Umělec, místo, akce…"
          data-i18n-placeholder="filters.keywordPlaceholder"
        />
      </div>
    </div>

    <div class="filter-actions">
      <button
        type="button"
        class="btn btn-ghost"
        id="filter-nearme"
        data-i18n-key="filters.nearMe"
        data-i18n-aria="filters.nearMe"
        aria-label="V mém okolí"
        title="V mém okolí"
      >V mém okolí</button>

      <button
        type="submit"
        class="btn btn-primary"
        data-i18n-key="filters.apply"
      >Použít filtry</button>

      <button
        type="reset"
        class="btn btn-ghost"
        data-i18n-key="filters.reset"
      >Vymazat</button>
    </div>
  </fieldset>
`;

export function getSharedEventFiltersMarkup() {
  return SHARED_EVENT_FILTERS_MARKUP;
}

export function ensureSharedEventFiltersMarkup(
  doc = globalThis.document
) {
  const form =
    doc?.getElementById?.(
      'events-filters-form'
    );

  if (!form) {
    return null;
  }

  if (
    form.dataset
      .ajseeSharedEventFilters ===
    'v1'
  ) {
    return form;
  }

  form.innerHTML =
    SHARED_EVENT_FILTERS_MARKUP;

  form.dataset.ajseeSharedEventFilters =
    'v1';

  return form;
}

if (
  typeof document !==
  'undefined'
) {
  ensureSharedEventFiltersMarkup(
    document
  );
}