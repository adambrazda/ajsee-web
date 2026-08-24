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

      <button
        type="button"
        class="chip ghost"
        id="chipClear"
        data-i18n-key="filters.reset"
      >Vymazat</button>
    </div>
  </div>

  <button
    type="button"
    class="filters-details-toggle"
    id="filters-details-toggle"
    aria-expanded="false"
    aria-controls="events-filters-details"
  >
    <span data-filter-details-label>
      Upřesnit filtry
    </span>

    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></path>
    </svg>
  </button>

  <fieldset
    class="filters-fieldset"
    id="events-filters-details"
  >
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


    <div class="filter-group filter-price">
      <label
        for="filter-price-max"
        data-i18n-key="filters.priceMax"
      >Cena od – max.</label>

      <div class="price-control">
        <input
          id="filter-price-max"
          name="max_price"
          type="number"
          class="styled-input"
          min="0"
          step="any"
          inputmode="decimal"
          placeholder="1000"
          data-i18n-placeholder="filters.priceMaxPlaceholder"
          aria-describedby="filter-price-help"
          aria-errormessage="filter-price-error"
        />

        <label
          class="sr-only"
          for="filter-price-currency"
          data-i18n-key="filters.priceCurrency"
        >Měna</label>

        <select
          id="filter-price-currency"
          name="price_currency"
          class="styled-select"
          aria-label="Měna"
          data-i18n-aria="filters.priceCurrency"
        >
          <option
            value=""
            data-i18n-key="filters.priceCurrency"
          >Měna</option>

          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
          <option value="PLN">PLN</option>
          <option value="HUF">HUF</option>
        </select>
      </div>

      <span
        id="filter-price-help"
        class="sr-only"
        data-i18n-key="filters.priceHelp"
      >Filtruje podle nejnižší známé ceny od partnera.</span>

      <span
        id="filter-price-error"
        class="filter-error"
        role="alert"
        hidden
        data-i18n-key="filters.priceInvalid"
      >Zadejte nezápornou maximální cenu.</span>
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

const FILTER_DETAILS_COPY = {
  cs: {
    expand: 'Upřesnit filtry',
    collapse: 'Skrýt filtry'
  },

  en: {
    expand: 'Refine filters',
    collapse: 'Hide filters'
  },

  de: {
    expand: 'Filter verfeinern',
    collapse: 'Filter ausblenden'
  },

  sk: {
    expand: 'Spresniť filtre',
    collapse: 'Skryť filtre'
  },

  pl: {
    expand: 'Doprecyzuj filtry',
    collapse: 'Ukryj filtry'
  },

  hu: {
    expand: 'Szűrők pontosítása',
    collapse: 'Szűrők elrejtése'
  }
};


function sharedFilterDisclosureLocale(
  doc
) {
  const raw =
    String(
      doc?.documentElement?.lang ||
      'cs'
    )
      .trim()
      .toLowerCase();

  const locale =
    raw.split('-')[0];

  return FILTER_DETAILS_COPY[locale]
    ? locale
    : 'cs';
}


function sharedFilterForm(
  doc
) {
  return doc
    ?.getElementById?.(
      'events-filters-form'
    ) ||
    null;
}


function hasDetailedFilterUrlState(
  win
) {
  const search =
    String(
      win?.location?.search ||
      ''
    );

  if (!search) {
    return false;
  }

  const params =
    new URLSearchParams(
      search
    );

  return [
    'segment',
    'city',
    'cityCC',
    'keyword',
    'q',
    'from',
    'to',
    'priceMax',
    'priceCurrency',
    'placeType',
    'lat',
    'lon',
    'radius'
  ].some(
    key =>
      params.has(key)
  );
}


export function syncSharedEventFilterDisclosureCopy(
  doc = globalThis.document
) {
  const form =
    sharedFilterForm(
      doc
    );

  const button =
    form?.querySelector?.(
      '#filters-details-toggle'
    );

  const label =
    button?.querySelector?.(
      '[data-filter-details-label]'
    );

  if (
    !form ||
    !button ||
    !label
  ) {
    return false;
  }

  const locale =
    sharedFilterDisclosureLocale(
      doc
    );

  const expanded =
    form.dataset
      .ajseeFilterDetailsExpanded ===
    'true';

  const copy =
    FILTER_DETAILS_COPY[
      locale
    ];

  const text =
    expanded
      ? copy.collapse
      : copy.expand;

  label.textContent =
    text;

  button.setAttribute(
    'aria-label',
    text
  );

  return true;
}


export function setSharedEventFilterDetailsExpanded(
  expanded,
  doc = globalThis.document
) {
  const form =
    sharedFilterForm(
      doc
    );

  const button =
    form?.querySelector?.(
      '#filters-details-toggle'
    );

  if (
    !form ||
    !button
  ) {
    return false;
  }

  const value =
    expanded === true;

  form.dataset
    .ajseeFilterDetailsExpanded =
      value
        ? 'true'
        : 'false';

  button.setAttribute(
    'aria-expanded',
    String(value)
  );

  syncSharedEventFilterDisclosureCopy(
    doc
  );

  return true;
}


export function initSharedEventFilterDisclosure(
  form,
  doc = globalThis.document,
  win = doc?.defaultView ||
    globalThis.window
) {
  const button =
    form?.querySelector?.(
      '#filters-details-toggle'
    );

  if (
    !form ||
    !button
  ) {
    return false;
  }

  if (
    !form.dataset
      .ajseeFilterDetailsExpanded
  ) {
    setSharedEventFilterDetailsExpanded(
      hasDetailedFilterUrlState(
        win
      ),
      doc
    );
  } else {
    setSharedEventFilterDetailsExpanded(
      form.dataset
        .ajseeFilterDetailsExpanded ===
        'true',
      doc
    );
  }

  if (
    button.dataset
      .ajseeFilterDetailsBound !==
    '1'
  ) {
    button.addEventListener(
      'click',
      () => {
        const expanded =
          form.dataset
            .ajseeFilterDetailsExpanded ===
          'true';

        setSharedEventFilterDetailsExpanded(
          !expanded,
          doc
        );
      }
    );

    button.dataset
      .ajseeFilterDetailsBound =
        '1';
  }

  const Observer =
    win?.MutationObserver;

  if (
    typeof Observer ===
      'function' &&
    doc?.documentElement &&
    !form
      ._ajseeFilterDisclosureObserver
  ) {
    const observer =
      new Observer(
        mutations => {
          if (
            mutations.some(
              mutation =>
                mutation.type ===
                  'attributes' &&
                mutation.attributeName ===
                  'lang'
            )
          ) {
            syncSharedEventFilterDisclosureCopy(
              doc
            );
          }
        }
      );

    observer.observe(
      doc.documentElement,
      {
        attributes:
          true,

        attributeFilter: [
          'lang'
        ]
      }
    );

    form
      ._ajseeFilterDisclosureObserver =
        observer;
  }

  return true;
}

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
    initSharedEventFilterDisclosure(
      form,
      doc,
      doc?.defaultView ||
        globalThis.window
    );

    return form;
  }

  form.innerHTML =
    SHARED_EVENT_FILTERS_MARKUP;

  form.dataset.ajseeSharedEventFilters =
    'v1';

  initSharedEventFilterDisclosure(
    form,
    doc,
    doc?.defaultView ||
      globalThis.window
  );

  return form;
}

export function scrollToSharedEventResults(
  doc = globalThis.document,
  win = globalThis.window
) {
  const target =
    doc?.getElementById?.(
      'eventsList'
    );

  if (
    !target ||
    typeof target.scrollIntoView !== 'function'
  ) {
    return false;
  }

  const header =
    doc.querySelector?.(
      '.site-header'
    );

  const headerHeight =
    Number(
      header
        ?.getBoundingClientRect?.()
        .height
    ) || 0;

  const scrollMarginTop =
    Math.max(
      0,
      Math.ceil(headerHeight) + 16
    );

  if (target.style) {
    target.style.scrollMarginTop =
      `${scrollMarginTop}px`;
  }

  const reduceMotion =
    win?.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches === true;

  target.scrollIntoView({
    behavior:
      reduceMotion
        ? 'auto'
        : 'smooth',
    block: 'start'
  });

  return true;
}

if (
  typeof document !==
  'undefined'
) {
  ensureSharedEventFiltersMarkup(
    document
  );
}