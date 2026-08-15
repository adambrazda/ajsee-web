import { formatEventVenueLine } from './event-location.js';

const FALLBACK_IMAGE = '/images/fallbacks/concert0.jpg';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function eventProviderKey(event = {}) {
  const raw = String(
    event?.partner ||
    event?.source ||
    event?.bookingProvider ||
    event?.affiliate?.provider ||
    event?.tickets ||
    event?.url ||
    ''
  )
    .trim()
    .toLowerCase();

  if (raw.includes('smsticket')) return 'smsticket';

  if (
    raw.includes('ticketmaster') ||
    raw.includes('tmoutbound')
  ) {
    return 'ticketmaster';
  }

  return '';
}

function eventProviderLabel(provider = '') {
  if (provider === 'smsticket') return 'smsticket';
  if (provider === 'ticketmaster') return 'Ticketmaster';

  return '';
}

function eventProviderBadgeHtml(event = {}) {
  const provider = eventProviderKey(event);
  const label = eventProviderLabel(provider);

  if (!provider || !label) return '';

  return `
    <p
      class="event-partner-badge"
      data-provider="${escapeHtml(provider)}"
    >
      <span>${escapeHtml(label)}</span>
    </p>
  `;
}

export function eventImageOrFallback(event = {}) {
  const raw = String(
    event?.image ||
    event?.imageUrl ||
    event?.imageOriginal ||
    event?.images?.[0]?.url ||
    ''
  ).trim();

  return raw
    ? raw.replace(/^http:\/\//i, 'https://')
    : FALLBACK_IMAGE;
}

/*
 * Canonical AJSEE event-card markup.
 *
 * Page entrypoints still own:
 * - fetching
 * - pagination
 * - ticket URL preparation
 * - modal behaviour
 *
 * This module owns the visual card contract.
 */
export function renderSharedEventCard({
  event = {},
  modalId = '',
  titleHtml = '',
  titleRaw = '',
  dateHtml = '',
  imageSrc = '',
  ticketsHref = '',
  detailLabelHtml = '',
  ticketLabelHtml = '',
  provider = null,
  providerBadgeHtml = null,
  venueLineHtml = null,
  eventCityAttrHtml = null
} = {}) {
  const resolvedProvider =
    provider === null
      ? eventProviderKey(event)
      : String(provider || '');

  const resolvedProviderBadge =
    providerBadgeHtml === null
      ? eventProviderBadgeHtml(event)
      : String(providerBadgeHtml || '');

  const resolvedVenueLine =
    venueLineHtml === null
      ? (() => {
          const line = formatEventVenueLine(event);

          return line
            ? `<p class="event-date event-location">${escapeHtml(line)}</p>`
            : '';
        })()
      : String(venueLineHtml || '');

  const resolvedCityAttr =
    eventCityAttrHtml === null
      ? escapeHtml(
          event?.location?.city ||
          event?.venue?.city ||
          event?.place?.city ||
          ''
        )
      : String(eventCityAttrHtml || '');

  const resolvedImage =
    imageSrc ||
    eventImageOrFallback(event);

  const safeModalId =
    escapeHtml(modalId);

  const safeImage =
    escapeHtml(resolvedImage);

  const safeHref =
    escapeHtml(ticketsHref);

  const safeTitleAttr =
    escapeHtml(titleRaw);

  const safeProvider =
    escapeHtml(resolvedProvider);

  return `
    <article
      class="event-card"
      data-event-id="${safeModalId}"
      data-event-provider="${safeProvider}"
    >
      <img
        src="${safeImage}"
        alt="${titleHtml}"
        class="event-img"
        loading="lazy"
        decoding="async"
        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
      />

      <div class="event-content">
        <h3 class="event-title">${titleHtml}</h3>

        <p class="event-date">${dateHtml}</p>

        ${resolvedVenueLine}

        ${resolvedProviderBadge}

        <div class="event-buttons-group">
          <button
            type="button"
            class="btn-event detail js-event-detail"
            data-event-id="${safeModalId}"
          >
            ${detailLabelHtml}
          </button>

          <a
            href="${safeHref}"
            class="btn-event ticket js-partner-click"
            target="_blank"
            rel="noopener noreferrer"
            data-partner="${safeProvider}"
            data-event-id="${safeModalId}"
            data-placement="event_card"
            data-event-title="${safeTitleAttr}"
            data-event-city="${resolvedCityAttr}"
            data-outbound-url="${safeHref}"
          >
            ${ticketLabelHtml}
          </a>
        </div>
      </div>
    </article>
  `;
}

/*
 * One responsive grid contract for homepage + /events.
 *
 * mobile        -> 1
 * tablet        -> 2
 * notebook      -> 3
 * wide desktop  -> 4
 *
 * The card max-width protects a single result from stretching.
 */
const partnerClickBound = new WeakSet();

export function trackSharedEventPartnerClick(
  link,
  {
    win = globalThis.window,
    doc = globalThis.document
  } = {}
) {
  if (!link || !win || !doc) return;

  const cleanText = value =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const getUrlHost = value => {
    try {
      return new URL(
        value,
        win.location.origin
      ).hostname;
    } catch {
      return '';
    }
  };

  const getLang = () =>
    cleanText(
      doc.documentElement?.getAttribute('lang')
    )
      .slice(0, 2)
      .toLowerCase() || 'cs';

  const partner =
    cleanText(link.dataset.partner);

  const eventId =
    cleanText(link.dataset.eventId);

  const eventName =
    cleanText(link.dataset.eventTitle);

  const city =
    cleanText(link.dataset.eventCity);

  const clickedHref =
    cleanText(
      link.href ||
      link.getAttribute('href')
    );

  const outboundUrl =
    cleanText(link.dataset.outboundUrl) ||
    clickedHref;

  const placement =
    cleanText(link.dataset.placement) ||
    'event_card';

  let routeCity = '';
  let routeCountryCode = '';

  try {
    const params =
      new URLSearchParams(
        win.location.search
      );

    routeCity =
      cleanText(
        params.get('city')
      );

    routeCountryCode =
      cleanText(
        params.get('cityCc') ||
        params.get('country') ||
        params.get('countryCode')
      ).toUpperCase();
  } catch {
    /* noop */
  }

  if (!partner && !outboundUrl) return;

  const payload = {
    event: 'partner_click',

    partner,
    event_id: eventId,
    event_name: eventName,
    city,
    outbound_url: outboundUrl,
    placement,
    page_path:
      win.location.pathname +
      win.location.search,
    ts: new Date().toISOString(),

    event_title: eventName,
    event_city: city || routeCity,
    event_provider: partner,
    destination_url: outboundUrl,
    destination_host:
      getUrlHost(outboundUrl),
    clicked_href: clickedHref,
    clicked_host:
      getUrlHost(clickedHref),
    route_city: routeCity,
    route_country_code:
      routeCountryCode,
    page_location:
      win.location.href,
    language: getLang(),
    link_text:
      cleanText(link.textContent)
  };

  try {
    win.dataLayer =
      win.dataLayer || [];

    win.dataLayer.push(payload);
  } catch {
    /* noop */
  }

  try {
    win.__ajsee =
      win.__ajsee || {};

    win.__ajsee.lastPartnerClick =
      payload;
  } catch {
    /* noop */
  }

  try {
    win.sessionStorage?.setItem(
      'ajsee:lastPartnerClick',
      JSON.stringify(payload)
    );
  } catch {
    /* noop */
  }

  try {
    win.console?.info?.(
      '[AJSEE partner_click]',
      payload
    );
  } catch {
    /* noop */
  }

  return payload;
}

export function wireSharedEventCardAnalytics(
  root = globalThis.document
) {
  const links =
    root?.querySelectorAll?.(
      '.js-partner-click'
    ) || [];

  for (const link of links) {
    if (partnerClickBound.has(link)) {
      continue;
    }

    partnerClickBound.add(link);

    let tracked = false;

    const trackOnce = () => {
      if (tracked) return;

      tracked = true;

      trackSharedEventPartnerClick(link);
    };

    link.addEventListener(
      'pointerdown',
      trackOnce,
      { passive: true }
    );

    link.addEventListener(
      'click',
      trackOnce
    );
  }
}
export function ensureSharedEventGridStyles(
  doc = globalThis.document
) {
  if (!doc?.head) return;

  if (
    doc.getElementById(
      'ajsee-shared-event-card-grid-v1-css'
    )
  ) {
    return;
  }

  const style =
    doc.createElement('style');

  style.id =
    'ajsee-shared-event-card-grid-v1-css';

  style.textContent = `
    #eventsList.events-list {
      width: 100% !important;
      max-width: 1440px !important;
      margin-inline: auto;

      grid-template-columns: 1fr !important;
      justify-content: start !important;
    }

    #eventsList.events-list > .event-card {
      width: 100% !important;
      max-width: 24rem !important;
      justify-self: start;
    }

    #eventsList.events-list > :not(.event-card) {
      grid-column: 1 / -1;
      width: 100%;
    }

    .event-card[data-event-provider] {
      position: relative;
    }

    .event-partner-badge {
      margin: 0 0 12px;
      line-height: 1;
    }

    .event-partner-badge span {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid var(--aj-provider-badge-border, rgba(10, 61, 98, 0.12));
      background: var(--aj-provider-badge-bg, rgba(10, 61, 98, 0.045));
      color: var(--aj-provider-badge-text, #0a3d62);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .event-card[data-event-provider="smsticket"] .event-partner-badge span {
      background: var(--aj-provider-smsticket-bg, rgba(92, 70, 255, 0.08));
      border-color: var(--aj-provider-smsticket-border, rgba(92, 70, 255, 0.16));
      color: var(--aj-provider-smsticket-text, #342f75);
    }

    .event-card[data-event-provider="ticketmaster"] .event-partner-badge span {
      background: var(--aj-provider-ticketmaster-bg, rgba(0, 116, 224, 0.08));
      border-color: var(--aj-provider-ticketmaster-border, rgba(0, 116, 224, 0.16));
      color: var(--aj-provider-ticketmaster-text, #064c9b);
    }

    .event-card .event-img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      height: auto;
      max-height: 260px;
      object-fit: cover;
      object-position: center;
      border-radius: 18px;
      background: #eef5fb;
    }

    @media (min-width: 768px) {
      #eventsList.events-list {
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          ) !important;
      }
    }

    @media (min-width: 1024px) {
      #eventsList.events-list {
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          ) !important;
      }
    }

    @media (min-width: 1536px) {
      #eventsList.events-list {
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          ) !important;
      }
    }

    @media (max-width: 760px) {
      .event-card .event-img {
        max-height: 220px;
      }
    }

    @media (max-width: 700px) {
      #eventsList.events-list {
        grid-template-columns: 1fr !important;
      }

      #eventsList.events-list > .event-card {
        max-width: none !important;
      }
    }

    @media (max-width: 420px) {
      .event-card .event-img {
        max-height: 190px;
      }
    }
  `;

  doc.head.appendChild(style);
}