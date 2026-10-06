import { renderEventCommerce, ensureEventCommerceStyles, eventInventoryState, eventStockLabel } from './event-commerce.js';
import { EVENT_TICKET_ARROW } from './event-ticket-ui.js';
import { formatEventVenueLine } from './event-location.js';

import {
  recordAiSearchPartnerClickout
} from './ai-search/learning.js';

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
  if (raw.includes('colosseum')) return 'colosseumticket';

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
  if (provider === 'colosseumticket') return 'ColosseumTicket';

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

const EVENT_IMAGE_CONTAIN_MAX_RATIO = 1.3;
const eventImageFramingBound = new WeakSet();

function normalizeEventImageFit(value) {
  const fit =
    String(value || '')
      .trim()
      .toLowerCase();

  return fit === 'cover' ||
    fit === 'contain'
      ? fit
      : 'auto';
}

function normalizeEventImageSurface(
  value
) {
  const surface =
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase();

  return surface ===
    'adaptive-matte'
      ? surface
      : 'neutral';
}

function normalizeEventImageFocalPoint(
  value,
  fallback = 50
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numeric
    )
  );
}

export function sharedEventImageFitForDimensions(
  width,
  height
) {
  const safeWidth =
    Number(width);

  const safeHeight =
    Number(height);

  if (
    !(safeWidth > 0) ||
    !(safeHeight > 0)
  ) {
    return 'cover';
  }

  return (
    safeWidth / safeHeight
  ) < EVENT_IMAGE_CONTAIN_MAX_RATIO
    ? 'contain'
    : 'cover';
}

function eventImagePresentation(
  event = {}
) {
  const raw =
    event?.imagePresentation &&
    typeof event.imagePresentation === 'object'
      ? event.imagePresentation
      : {};

  return {
    fit:
      normalizeEventImageFit(
        raw.fit
      ),

    x:
      normalizeEventImageFocalPoint(
        raw.x
      ),

    y:
      normalizeEventImageFocalPoint(
        raw.y
      ),

    surface:
      normalizeEventImageSurface(
        raw.surface
      )
  };
}

export function sharedEventImageMatteUrl(
  rawSource = ''
) {
  const source =
    String(
      rawSource ||
      ''
    ).trim();

  if (
    !source ||
    /^(?:data|blob):/i.test(
      source
    )
  ) {
    return '';
  }

  const params =
    new URLSearchParams({
      url:
        source,
      w:
        '1',
      h:
        '1',
      fit:
        'fill',
      fm:
        'webp'
    });

  return (
    '/.netlify/images?' +
    params.toString()
  );
}

function syncSharedEventImageFrame(
  image,
  fit
) {
  image
    ?.closest?.(
      '.event-image-frame'
    )
    ?.setAttribute?.(
      'data-ajsee-image-fit',
      fit
    );
}

function syncSharedEventImageSurface(
  image,
  fit
) {
  const frame =
    image?.closest?.(
      '.event-image-frame'
    );

  if (!frame) {
    return;
  }

  const surface =
    normalizeEventImageSurface(
      frame.getAttribute?.(
        'data-ajsee-image-surface'
      )
    );

  if (
    fit !== 'contain' ||
    surface !== 'adaptive-matte'
  ) {
    frame.removeAttribute?.(
      'data-ajsee-image-matte'
    );

    frame.style?.removeProperty?.(
      '--aj-event-image-matte'
    );

    return;
  }

  const source =
    String(
      image.currentSrc ||
      image.getAttribute?.(
        'src'
      ) ||
      ''
    ).trim();

  const matteUrl =
    sharedEventImageMatteUrl(
      source
    );

  if (!matteUrl) {
    return;
  }

  frame.style?.setProperty?.(
    '--aj-event-image-matte',
    `url("${matteUrl}")`
  );

  frame.setAttribute?.(
    'data-ajsee-image-matte',
    'ready'
  );
}

export function wireSharedEventImageFraming(
  root = globalThis.document
) {
  const images =
    root?.querySelectorAll?.(
      '.event-img'
    ) || [];

  for (const image of images) {
    if (
      eventImageFramingBound.has(
        image
      )
    ) {
      continue;
    }

    eventImageFramingBound.add(
      image
    );

    const requestedFit =
      normalizeEventImageFit(
        image.getAttribute?.(
          'data-ajsee-image-fit'
        )
      );

    const applyFit = () => {
      const fit =
        requestedFit === 'auto'
          ? sharedEventImageFitForDimensions(
              image.naturalWidth,
              image.naturalHeight
            )
          : requestedFit;

      image.setAttribute?.(
        'data-ajsee-image-fit',
        fit
      );

      syncSharedEventImageFrame(
        image,
        fit
      );

      syncSharedEventImageSurface(
        image,
        fit
      );
    };

    if (
      requestedFit === 'cover'
    ) {
      applyFit();
      continue;
    }

    if (
      requestedFit === 'contain'
    ) {
      image.setAttribute?.(
        'data-ajsee-image-fit',
        'contain'
      );

      image
        .closest?.(
          '.event-image-frame'
        )
        ?.setAttribute?.(
          'data-ajsee-image-fit',
          'contain'
        );
    }

    if (
      image.complete &&
      Number(image.naturalWidth) > 0 &&
      Number(image.naturalHeight) > 0
    ) {
      applyFit();
      continue;
    }

    image.addEventListener?.(
      'load',
      applyFit,
      { once: true }
    );
  }
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
  locale = 'cs',
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
  eventCityAttrHtml = null,
  resultPosition = null
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

  const imagePresentation =
    eventImagePresentation(event);

  const safeImageFit =
    escapeHtml(
      imagePresentation.fit
    );

  const safeImageSurface =
    escapeHtml(
      imagePresentation.surface
    );

  const safeImagePosition =
    `${imagePresentation.x}% ${imagePresentation.y}%`;

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
  const soldOut = eventInventoryState(event).status === 'sold_out';
  const soldOutLabel = escapeHtml(eventStockLabel('sold_out', locale));

  const numericResultPosition =
    Number(resultPosition);

  const safeResultPosition =
    Number.isInteger(
      numericResultPosition
    ) &&
    numericResultPosition > 0
      ? String(
          numericResultPosition
        )
      : '';

  return `
    <article
      class="event-card"
      data-event-id="${safeModalId}"
      data-event-provider="${safeProvider}"
      data-result-position="${safeResultPosition}"
    >
      <div
        class="event-image-frame"
        data-ajsee-image-fit="${safeImageFit}"
        data-ajsee-image-surface="${safeImageSurface}"
      >
        <img
          src="${safeImage}"
          alt="${titleHtml}"
          class="event-img"
          data-ajsee-image-fit="${safeImageFit}"
          style="object-position: ${safeImagePosition};"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
        <button type="button" class="event-image-action js-event-detail"
          data-event-id="${safeModalId}" data-result-position="${safeResultPosition}"
          aria-label="${safeTitleAttr || escapeHtml(detailLabelHtml) || 'Detail'}"></button>
        ${soldOut ? `<span class="event-sold-badge" title="${soldOutLabel}">${soldOutLabel}</span>` : ''}
      </div>

      <div class="event-content">
        ${resolvedProviderBadge}
        <h3 class="event-title"><button type="button" class="event-title-action js-event-detail"
          data-event-id="${safeModalId}" data-result-position="${safeResultPosition}">${titleHtml}</button></h3>

        <p class="event-date">${dateHtml}</p>

        ${resolvedVenueLine}

        <div class="event-card-footer">
          ${renderEventCommerce(event, locale)}
          <div class="event-buttons-group">

          <a
            ${soldOut ? 'aria-disabled="true" tabindex="-1"' : `href="${safeHref}"`}
            class="btn-event ticket js-partner-click"
            target="_blank"
            rel="noopener noreferrer"
            data-partner="${safeProvider}"
            data-event-id="${safeModalId}"
            data-result-position="${safeResultPosition}"
            data-placement="event_card"
            data-event-title="${safeTitleAttr}"
            data-event-city="${resolvedCityAttr}"
            data-outbound-url="${safeHref}"
          >
            <span>${ticketLabelHtml}</span>${EVENT_TICKET_ARROW}
          </a>
          </div>
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
      if (link.getAttribute('aria-disabled') === 'true') return;
      if (tracked) return;

      tracked = true;

      trackSharedEventPartnerClick(
        link
      );
    };

    const trackLearningClickout =
      () => {
        if (link.getAttribute('aria-disabled') === 'true') return;
        void recordAiSearchPartnerClickout({
          eventRef:
            link.dataset.eventId,

          provider:
            link.dataset.partner,

          resultPosition:
            link.dataset.resultPosition,

          placement:
            link.dataset.placement ||
            'event_card'
        });
      };

    /*
     * Existing rich analytics keeps pointerdown fallback.
     * Learning records only a completed click so a cancelled
     * pointer gesture cannot become a false conversion.
     */
    link.addEventListener(
      'pointerdown',
      trackOnce,
      { passive: true }
    );

    link.addEventListener(
      'click',
      trackOnce
    );

    link.addEventListener(
      'click',
      trackLearningClickout
    );
  }
}
export function ensureSharedEventGridStyles(
  doc = globalThis.document
) {
  if (!doc?.head) return;
  ensureEventCommerceStyles(doc);

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
    body:is([data-page="home"], [data-page="events"]) #eventsList.events-list {
      width: 100%;
      max-width: 1440px;
      margin-inline: auto;
      box-sizing: border-box;
      padding-inline: clamp(16px, 3vw, 32px);

      grid-template-columns: 1fr;
      justify-content: start;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList.events-list > .event-card {
      width: 100%;
      max-width: 24rem;
      justify-self: start;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList.events-list > :not(.event-card) {
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

    .event-card .event-image-frame {
      position: relative;
      isolation: isolate;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 15px 15px 0 0;
      background: var(--aj-event-soft, #eef5fb);
    }

    .event-card .event-image-frame::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: #eef5fb;
      opacity: 0;
    }

    .event-card .event-image-frame[
      data-ajsee-image-fit="contain"
    ][
      data-ajsee-image-surface="adaptive-matte"
    ][
      data-ajsee-image-matte="ready"
    ]::before {
      background-image:
        var(
          --aj-event-image-matte
        );
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
      filter:
        saturate(0.42)
        brightness(1.08);
      opacity: 0.52;
    }

    .event-card .event-image-frame > .event-img {
      position: relative;
      z-index: 1;
      display: block;
      width: 100%;
      height: 100%;
      max-height: none;
      margin-bottom: 0;
      object-fit: cover;
      object-position: center;
      border-radius: inherit;
      background: transparent;
    }

    .event-card .event-img[data-ajsee-image-fit="contain"] {
      object-fit: contain;
    }

    .event-card .event-img[data-ajsee-image-fit="cover"],
    .event-card .event-img[data-ajsee-image-fit="auto"] {
      object-fit: cover;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-card {
      min-height: 0;
      padding: 0;
      border: 1px solid var(--aj-event-border);
      border-radius: 16px;
      background: var(--aj-event-surface);
      overflow: visible;
      transform: none;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-content {
      position: relative;
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      min-width: 0;
      padding: 14px 16px 16px;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-title {
      margin: 0 0 8px;
      font-size: 19px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-date {
      margin: 0 0 4px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--aj-event-muted);
      font-weight: 400;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList
      .event-card[data-event-provider]:has(.event-partner-badge)
      .event-date {
      padding-inline-end: 104px;
    }

    #eventsList .event-card .event-content > .event-partner-badge {
      position: absolute;
      top: 70px;
      inset-inline-end: 16px;
      z-index: 3;
      max-width: 96px;
      margin: 0;
      line-height: 1;
      pointer-events: none;
    }

    #eventsList .event-card .event-content > .event-partner-badge span {
      min-height: 24px;
      max-width: 100%;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: none;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-buttons-group {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
      margin-top: 0;
      padding-top: 0;
      width: 100%;
    }

    body:is([data-page="home"], [data-page="events"]) #eventsList .event-buttons-group .btn-event {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 44px;
      padding: 10px 8px;
      font-size: 14px;
      line-height: 1.3;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: center;
      border-radius: 11px;
    }

    .event-card .event-image-action { position: absolute; inset: 0; z-index: 2; border: 0; border-radius: inherit; padding: 0; background: transparent; cursor: pointer; }
    .event-card .event-title-action { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; width: 100%; background: transparent; color: var(--aj-event-text); border: 0; padding: 0; text-align: start; font: inherit; font-weight: 650; cursor: pointer; }
    .event-card .event-title-action:hover { color: var(--aj-event-cta); }
    .event-card .event-card-footer { margin-top: auto; padding-top: 4px; min-width: 0; }
    .event-card .event-sold-badge { position: absolute; bottom: 8px; inset-inline-end: 8px; z-index: 3; max-width: calc(100% - 16px); padding: 4px 8px; border-radius: 7px; background: var(--aj-event-surface); color: var(--aj-event-red); font-size: 11px; font-weight: 650; pointer-events: none; }
    body:is([data-page="home"], [data-page="events"]) #eventsList .event-card:hover { transform: translateY(-2px); }
    body:is([data-page="home"], [data-page="events"]) #eventsList .event-card:is(:hover, :focus-within) { z-index: 4; }

    @media (min-width: 600px) {
      body:is([data-page="home"], [data-page="events"]) #eventsList.events-list {
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
      }
    }

    @media (min-width: 1100px) {
      body:is([data-page="home"], [data-page="events"]) #eventsList.events-list {
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );
      }
    }

    @media (min-width: 1500px) {
      body:is([data-page="home"], [data-page="events"]) #eventsList.events-list {
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
      }
    }

    @media (max-width: 599px) {
      body:is([data-page="home"], [data-page="events"]) #eventsList.events-list {
        grid-template-columns: 1fr;
      }

      body:is([data-page="home"], [data-page="events"]) #eventsList.events-list > .event-card {
        max-width: none;
      }
      body:is([data-page="home"], [data-page="events"]) #eventsList .event-card { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 6px 12px; padding: 14px; }
      body:is([data-page="home"], [data-page="events"]) #eventsList .event-content { display: contents; }
      #eventsList .event-card .event-image-frame { grid-column: 1; grid-row: 1 / span 3; height: 112px; aspect-ratio: auto; border-radius: 8px; }
      #eventsList .event-card .event-title { grid-column: 2; margin: 0; font-size: 17px; line-height: 1.28; }
      #eventsList .event-card .event-date { grid-column: 2; margin: 0; padding-inline-end: 0; line-height: 1.4; font-size: 12px; }
      #eventsList .event-card .event-card-footer { grid-column: 1 / -1; grid-row: 4; padding-top: 6px; margin-top: 6px; border-top: 1px solid var(--aj-event-border); }
      #eventsList .event-card .event-content > .event-partner-badge {
        position: relative;
        grid-column: 1;
        grid-row: 4;
        align-self: start;
        justify-self: start;
        top: auto;
        inset-inline-end: auto;
        z-index: 3;
        max-width: 82px;
        margin: 14px 0 0;
      }
      #eventsList .event-card .event-content > .event-partner-badge span {
        min-height: 22px;
        max-width: 82px;
        padding: 3px 6px;
        border-radius: 999px;
        font-size: 10px;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #eventsList .event-card[data-event-provider]:has(.event-partner-badge) .event-card-footer > .event-commerce {
        padding-inline-start: 94px;
      }
      #eventsList .event-card .event-sold-badge { bottom: 3px; inset-inline-end: 3px; max-width: calc(100% - 6px); font-size: 11px; padding: 3px 5px; }
    }
    @media (prefers-reduced-motion: reduce) { body:is([data-page="home"], [data-page="events"]) #eventsList .event-card { transition: none; } }

  `;

  doc.head.appendChild(style);
}
