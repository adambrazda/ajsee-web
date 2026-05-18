// /src/event-modal.js
// ---------------------------------------------------------
// AJSEE – Event modal
// - funguje i bez předem připraveného HTML ve stránce
// - používá stejný ticket link jako karta události
// - neobchází affiliate / tmOutbound flow
// - podporuje Google / Outlook / Apple ICS kalendář
// - překládá vlastní texty modalu podle aktuálního jazyka
// - desktop modal je scrollovatelný, aby se nikdy neořízl obsah
// - modal Ticketmaster CTA přepisuje tmOutbound placement na event_modal
// ---------------------------------------------------------

const MODAL_ID = 'eventModal';

let previousFocus = null;

const MODAL_I18N = {
  cs: {
    close: 'Zavřít',
    detailsFallback: 'Podrobnosti najdete přímo u prodejce vstupenek.',
    categoryPrefix: 'Kategorie:',
    calendarLabel: 'Přidat do kalendáře:',
    tickets: 'Vstupenky',
    untitled: 'Událost',
    categoryUnknown: 'Událost',
    categories: {
      concert: 'Koncerty',
      festival: 'Festivaly',
      sport: 'Sport',
      theatre: 'Divadlo',
      other: 'Ostatní',
    },
  },
  en: {
    close: 'Close',
    detailsFallback: 'Details are available directly from the ticket seller.',
    categoryPrefix: 'Category:',
    calendarLabel: 'Add to calendar:',
    tickets: 'Tickets',
    untitled: 'Event',
    categoryUnknown: 'Event',
    categories: {
      concert: 'Concerts',
      festival: 'Festivals',
      sport: 'Sport',
      theatre: 'Theatre',
      other: 'Other',
    },
  },
  de: {
    close: 'Schließen',
    detailsFallback: 'Details findest du direkt beim Ticketanbieter.',
    categoryPrefix: 'Kategorie:',
    calendarLabel: 'Zum Kalender hinzufügen:',
    tickets: 'Tickets',
    untitled: 'Event',
    categoryUnknown: 'Event',
    categories: {
      concert: 'Konzerte',
      festival: 'Festivals',
      sport: 'Sport',
      theatre: 'Theater',
      other: 'Sonstiges',
    },
  },
  sk: {
    close: 'Zavrieť',
    detailsFallback: 'Podrobnosti nájdete priamo u predajcu vstupeniek.',
    categoryPrefix: 'Kategória:',
    calendarLabel: 'Pridať do kalendára:',
    tickets: 'Vstupenky',
    untitled: 'Udalosť',
    categoryUnknown: 'Udalosť',
    categories: {
      concert: 'Koncerty',
      festival: 'Festivaly',
      sport: 'Šport',
      theatre: 'Divadlo',
      other: 'Ostatné',
    },
  },
  pl: {
    close: 'Zamknij',
    detailsFallback: 'Szczegóły znajdziesz bezpośrednio u sprzedawcy biletów.',
    categoryPrefix: 'Kategoria:',
    calendarLabel: 'Dodaj do kalendarza:',
    tickets: 'Bilety',
    untitled: 'Wydarzenie',
    categoryUnknown: 'Wydarzenie',
    categories: {
      concert: 'Koncerty',
      festival: 'Festiwale',
      sport: 'Sport',
      theatre: 'Teatr',
      other: 'Inne',
    },
  },
  hu: {
    close: 'Bezárás',
    detailsFallback: 'A részletek közvetlenül a jegyértékesítőnél érhetők el.',
    categoryPrefix: 'Kategória:',
    calendarLabel: 'Hozzáadás a naptárhoz:',
    tickets: 'Jegyek',
    untitled: 'Esemény',
    categoryUnknown: 'Esemény',
    categories: {
      concert: 'Koncertek',
      festival: 'Fesztiválok',
      sport: 'Sport',
      theatre: 'Színház',
      other: 'Egyéb',
    },
  },
};

function normalizeLang(locale = '') {
  const lang = String(locale || document.documentElement.lang || 'cs')
    .trim()
    .toLowerCase()
    .slice(0, 2);

  return ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(lang) ? lang : 'cs';
}

function browserLocale(locale = '') {
  const lang = normalizeLang(locale);

  const map = {
    cs: 'cs-CZ',
    en: 'en-GB',
    de: 'de-DE',
    sk: 'sk-SK',
    pl: 'pl-PL',
    hu: 'hu-HU',
  };

  return map[lang] || 'cs-CZ';
}

function i18n(lang, key) {
  return MODAL_I18N[lang]?.[key] || MODAL_I18N.cs[key] || '';
}

function pickLocalized(value, preferred = []) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  for (const key of preferred) {
    const found = value?.[key];
    if (found) return String(found);
  }

  const any = Object.values(value).find(Boolean);
  return any ? String(any) : '';
}

function parseEventDate(raw) {
  if (!raw) return null;

  const text = String(raw);

  // Důležité: YYYY-MM-DD parsujeme jako lokální den, ne UTC.
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0
    );
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function toSafeUrl(raw = '') {
  try {
    const u = new URL(String(raw || ''), window.location.origin);

    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.toString();
    }
  } catch {
    // noop
  }

  return '';
}

function getModalSourcePage(opts = {}) {
  if (opts.sourcePage) return String(opts.sourcePage);

  if (document.body?.dataset?.page === 'home') return 'homepage';
  if (document.body?.dataset?.page === 'events') return 'events_page';

  const path = String(location.pathname || '').toLowerCase();

  if (path.endsWith('/events') || path.endsWith('/events.html')) {
    return 'events_page';
  }

  return 'homepage';
}

function isTicketmasterLikeHost(hostname = '') {
  const h = String(hostname || '').toLowerCase().replace(/^www\./, '');

  return (
    h === 'ticketmaster.evyy.net' ||
    h === 'ticketmaster.com' ||
    /^ticketmaster\.[a-z]{2,}(\.[a-z]{2,})?$/.test(h)
  );
}

function buildModalTicketHref(rawUrl = '', eventData = {}, opts = {}) {
  const sourcePage = getModalSourcePage(opts);
  const eventId = String(
    eventData?.id ||
    eventData?.eventId ||
    eventData?.tmId ||
    ''
  ).replace(/^ticketmaster-/i, '');

  try {
    const u = new URL(String(rawUrl || ''), window.location.origin);

    // Pokud už jde o náš tmOutbound link, jen přepíšeme placement.
    if (u.pathname.includes('/.netlify/functions/tmOutbound')) {
      u.searchParams.set('source', sourcePage);
      u.searchParams.set('placement', 'event_modal');

      if (eventId && !u.searchParams.has('eid') && !u.searchParams.has('eventId')) {
        u.searchParams.set('eid', eventId);
      }

      return u.toString();
    }

    // Pokud by někdy přišel přímý Ticketmaster / Impact link,
    // zabalíme ho do tmOutbound, aby se použila centrální affiliate logika.
    if (isTicketmasterLikeHost(u.hostname)) {
      const out = new URL('/.netlify/functions/tmOutbound', window.location.origin);

      out.searchParams.set('to', u.toString());
      out.searchParams.set('source', sourcePage);
      out.searchParams.set('placement', 'event_modal');

      if (eventId) {
        out.searchParams.set('eid', eventId);
      }

      return out.toString();
    }

    return u.toString();
  } catch {
    return rawUrl;
  }
}

function toISODate(raw) {
  const d = parseEventDate(raw);
  if (!d) return '';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, days = 1) {
  if (!iso) return '';

  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days, 12, 0, 0, 0);

  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yy}-${mm}-${dd}`;
}

function toCalDate(iso) {
  if (!iso) return '';
  return String(iso).replaceAll('-', '');
}

function escapeICS(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildICS({ title, description, location, start, end }) {
  const dtStart = toCalDate(start);
  const dtEnd = toCalDate(end || addDaysISO(start, 1));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AJSEE//Events//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function normalizeCategoryKey(raw = '') {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!value) return 'other';

  if (
    value === 'concert' ||
    value === 'concerts' ||
    value === 'music' ||
    value.includes('concert')
  ) {
    return 'concert';
  }

  if (
    value === 'festival' ||
    value === 'festivals' ||
    value.includes('festival')
  ) {
    return 'festival';
  }

  if (
    value === 'sport' ||
    value === 'sports' ||
    value.includes('sport')
  ) {
    return 'sport';
  }

  if (
    value === 'theatre' ||
    value === 'theater' ||
    value.includes('theatre') ||
    value.includes('theater') ||
    value.includes('arts')
  ) {
    return 'theatre';
  }

  return 'other';
}

function translateCategory(rawCategory, lang) {
  const key = normalizeCategoryKey(rawCategory);
  return MODAL_I18N[lang]?.categories?.[key] ||
    MODAL_I18N.cs.categories[key] ||
    rawCategory ||
    i18n(lang, 'categoryUnknown');
}

function injectOnce(id, css) {
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function ensureModalStyles() {
  injectOnce('ajsee-event-modal-css', `
    .event-modal.hidden {
      display: none !important;
    }

    .event-modal {
      position: fixed;
      inset: 0;
      z-index: 10080;
      display: none;
      justify-content: center;
      align-items: flex-start;
      padding: 28px 22px;
      background: rgba(10, 20, 35, 0.52);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .event-modal.open {
      display: flex;
    }

    .event-modal-content {
      position: relative;
      width: min(960px, 100%);
      max-height: none !important;
      min-height: auto;
      overflow: visible !important;
      display: grid;
      grid-template-columns: minmax(260px, 42%) 1fr;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(217, 225, 239, 0.95);
      border-radius: 28px;
      box-shadow: 0 28px 80px rgba(9, 30, 66, 0.28);
      margin: auto 0;
    }

    .event-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 3;
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #14213d;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 28px rgba(9, 30, 66, 0.16);
    }

    .modal-image {
      width: 100%;
      height: 100%;
      min-height: 420px;
      object-fit: cover;
      background: #eef5ff;
      border-radius: 28px 0 0 28px;
    }

    .modal-details {
      padding: 42px 38px 34px;
      overflow: visible !important;
    }

    .modal-title {
      margin: 0 0 14px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
      letter-spacing: -0.04em;
      color: #102033;
    }

    .modal-meta {
      margin: 0 0 18px;
      color: #526071;
      font-weight: 650;
      line-height: 1.5;
    }

    .modal-description {
      margin: 0 0 18px;
      color: #344054;
      line-height: 1.65;
      font-size: 16px;
    }

    .modal-category {
      margin: 0 0 22px;
      color: #667085;
      font-size: 14px;
      font-weight: 700;
    }

    .modal-ticket-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 22px;
      margin: 0 0 24px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 800;
      background: linear-gradient(135deg, #0077cc, #14c2c5);
      color: #fff;
      box-shadow: 0 14px 32px rgba(0, 119, 204, 0.24);
    }

    .calendar-buttons {
      margin-top: 4px;
    }

    .calendar-label {
      display: block;
      margin-bottom: 10px;
      color: #0A3D62;
      font-size: 18px;
      font-weight: 800;
    }

    .calendar-btns-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .calendar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid #d9e1ef;
      background: #fff;
      color: #14213d;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
    }

    @media (max-width: 760px) {
      .event-modal {
        padding: 12px;
        align-items: flex-start;
      }

      .event-modal-content {
        grid-template-columns: 1fr;
        width: 100%;
        border-radius: 26px;
      }

      .modal-image {
        min-height: 230px;
        max-height: 280px;
        border-radius: 26px 26px 0 0;
      }

      .modal-details {
        padding: 28px 22px 26px;
      }

      .modal-title {
        font-size: 30px;
      }

      .modal-ticket-cta {
        width: auto;
      }
    }
  `);
}

function ensureEventModalShell() {
  ensureModalStyles();

  let modal = document.getElementById(MODAL_ID);

  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'event-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="event-modal-content" role="document">
        <button id="modalClose" class="event-modal-close" aria-label="Zavřít" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <img id="modalImage" class="modal-image" alt="" />

        <div class="modal-details">
          <h2 id="modalTitle" class="modal-title"></h2>

          <p class="modal-meta">
            <span id="modalDate" class="modal-date"></span>
            <span aria-hidden="true"> | </span>
            <span id="modalLocation" class="modal-location"></span>
          </p>

          <p id="modalDescription" class="modal-description"></p>

          <p class="modal-category">
            <span id="modalCategoryPrefix">Kategorie:</span>
            <span id="modalCategory"></span>
          </p>

          <a id="modalTicketsLink" class="modal-ticket-cta" href="#" target="_blank" rel="noopener noreferrer">
            Vstupenky
          </a>

          <div class="calendar-buttons">
            <span class="calendar-label" id="modalCalendarLabel">Přidat do kalendáře:</span>

            <div class="calendar-btns-wrap">
              <a href="#" id="googleCalendarLink" class="calendar-btn calendar-btn--google" target="_blank" rel="noopener noreferrer">
                <span class="calendar-btn-label">Google</span>
              </a>

              <a href="#" id="outlookCalendarLink" class="calendar-btn calendar-btn--outlook" target="_blank" rel="noopener noreferrer">
                <span class="calendar-btn-label">Outlook</span>
              </a>

              <a href="#" id="appleCalendarLink" class="calendar-btn calendar-btn--apple" download="event.ics">
                <span class="calendar-btn-label">Apple / ICS</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  ensureTicketCta(modal);

  return modal;
}

function ensureTicketCta(modal) {
  if (!modal) return null;

  let ticket = modal.querySelector('#modalTicketsLink');
  if (ticket) return ticket;

  ticket = document.createElement('a');
  ticket.id = 'modalTicketsLink';
  ticket.className = 'modal-ticket-cta';
  ticket.href = '#';
  ticket.target = '_blank';
  ticket.rel = 'noopener noreferrer';

  const details = modal.querySelector('.modal-details');
  const calendar = modal.querySelector('.calendar-buttons');

  if (details && calendar) {
    details.insertBefore(ticket, calendar);
  } else if (details) {
    details.appendChild(ticket);
  }

  return ticket;
}

function setStaticModalLabels(modal, lang) {
  const closeBtn = modal.querySelector('#modalClose');
  if (closeBtn) {
    closeBtn.setAttribute('aria-label', i18n(lang, 'close'));
    closeBtn.setAttribute('title', i18n(lang, 'close'));
  }

  const categoryPrefix =
    modal.querySelector('#modalCategoryPrefix') ||
    modal.querySelector('.modal-category span:first-child');

  if (categoryPrefix) {
    categoryPrefix.textContent = i18n(lang, 'categoryPrefix') + ' ';
  }

  const calendarLabel =
    modal.querySelector('#modalCalendarLabel') ||
    modal.querySelector('.calendar-label');

  if (calendarLabel) {
    calendarLabel.textContent = i18n(lang, 'calendarLabel');
  }
}

function closeEventModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  modal.classList.remove('open');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = '';

  if (previousFocus && typeof previousFocus.focus === 'function') {
    try {
      previousFocus.focus({ preventScroll: true });
    } catch {
      previousFocus.focus();
    }
  }

  previousFocus = null;
}

export function initEventModal() {
  const modal = ensureEventModalShell();

  if (window.__ajseeEventModalInitialized) return;
  window.__ajseeEventModalInitialized = true;

  const closeBtn = modal.querySelector('#modalClose');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeEventModal);
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeEventModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const activeModal = document.getElementById(MODAL_ID);
    if (activeModal?.classList.contains('open')) {
      closeEventModal();
    }
  });

  window.__ajseeCloseEventModal = closeEventModal;
}

export async function openEventModal(eventData, locale = 'cs', opts = {}) {
  const lang = normalizeLang(locale);
  const intlLocale = browserLocale(locale);
  const modal = ensureEventModalShell();

  if (!window.__ajseeEventModalInitialized) {
    initEventModal();
  }

  if (!eventData || typeof eventData !== 'object') return;

  if (!window.translations && typeof window.applyTranslations === 'function') {
    try {
      await window.applyTranslations(lang);
    } catch {
      // noop
    }
  }

  setStaticModalLabels(modal, lang);

  const preferredLocales = [
    lang,
    locale,
    'en',
    'cs',
  ].filter(Boolean);

  const title =
    pickLocalized(eventData.title, preferredLocales) ||
    i18n(lang, 'untitled');

  const description =
    pickLocalized(eventData.description, preferredLocales) ||
    i18n(lang, 'detailsFallback');

  const dateVal = eventData.datetime || eventData.date || '';
  const dateObj = parseEventDate(dateVal);

  const dateText = dateObj
    ? dateObj.toLocaleDateString(intlLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const locationObj = eventData.location || {};
  const locationText = typeof locationObj === 'string'
    ? locationObj
    : [
        locationObj?.city || '',
        locationObj?.country || '',
      ].filter(Boolean).join(', ');

  const image =
    eventData.image ||
    '/images/fallbacks/concert0.jpg';

  // Důležité:
  // Preferujeme ticket link spočítaný při renderu karty,
  // ale pro modal přepíšeme tmOutbound placement na event_modal.
  // Tím neobcházíme affiliate flow a zároveň v Impactu oddělíme kliky z modalu.
  const rawTicketHref =
    eventData.__ajseeTicketsHref ||
    eventData.tickets ||
    eventData.url ||
    '';

  const ticketHref = toSafeUrl(
    buildModalTicketHref(rawTicketHref, eventData, opts)
  );

  const titleEl = modal.querySelector('#modalTitle');
  const imageEl = modal.querySelector('#modalImage');
  const dateEl = modal.querySelector('#modalDate');
  const locationEl = modal.querySelector('#modalLocation');
  const descEl = modal.querySelector('#modalDescription');
  const categoryEl = modal.querySelector('#modalCategory');
  const ticketEl = modal.querySelector('#modalTicketsLink');

  if (titleEl) titleEl.textContent = title;

  if (imageEl) {
    imageEl.src = image;
    imageEl.alt = title;
  }

  if (dateEl) dateEl.textContent = dateText;
  if (locationEl) locationEl.textContent = locationText;
  if (descEl) descEl.textContent = description;
  if (categoryEl) categoryEl.textContent = translateCategory(eventData.category, lang);

  if (ticketEl) {
    ticketEl.textContent = i18n(lang, 'tickets');

    if (ticketHref) {
      ticketEl.href = ticketHref;
      ticketEl.hidden = false;
      ticketEl.setAttribute('aria-label', `${i18n(lang, 'tickets')}: ${title}`);
    } else {
      ticketEl.href = '#';
      ticketEl.hidden = true;
    }
  }

  try {
    const start = toISODate(dateVal);
    const end = addDaysISO(start, 1);

    const googleLink = modal.querySelector('#googleCalendarLink');
    if (googleLink && start) {
      const googleParams = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${toCalDate(start)}/${toCalDate(end)}`,
        details: description,
        location: locationText,
      });

      googleLink.href = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;
    }

    const outlookLink = modal.querySelector('#outlookCalendarLink');
    if (outlookLink) {
      const outlookParams = new URLSearchParams({
        path: '/calendar/action/compose',
        ri: '0',
        subject: title,
        body: description,
        location: locationText,
      });

      outlookLink.href = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;
    }

    const appleLink = modal.querySelector('#appleCalendarLink');
    if (appleLink && start) {
      const icsText = buildICS({
        title,
        description,
        location: locationText,
        start,
        end,
      });

      const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
      appleLink.href = URL.createObjectURL(blob);
      appleLink.download = `${title.replace(/[^\w\d-]+/g, '-').slice(0, 60) || 'event'}.ics`;
    }
  } catch (error) {
    console.warn('[event-modal] Calendar links build failed:', error);
  }

  previousFocus = document.activeElement;

  modal.classList.remove('hidden');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';

  const closeBtn = modal.querySelector('#modalClose');
  if (closeBtn) {
    setTimeout(() => {
      try {
        closeBtn.focus({ preventScroll: true });
      } catch {
        closeBtn.focus();
      }
    }, 0);
  }
}

window.__ajseeOpenEventModal = openEventModal;


/* AJSEE_MODAL_READ_MORE_PATCH_v3
   ---------------------------------------------------------
   Single deterministic long-description clamp for event modals.
   Replaces older runtime scanners to prevent duplicate buttons.
   --------------------------------------------------------- */

(function installAjseeModalReadMoreV3() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__ajseeModalReadMoreV3Installed) return;

  window.__ajseeModalReadMoreV3Installed = true;

  const STYLE_ID = 'ajsee-modal-readmore-v3-css';

  function getLang() {
    return String(document.documentElement.lang || 'cs').toLowerCase().slice(0, 2);
  }

  function getCopy() {
    const map = {
      cs: { more: 'Číst více', less: 'Zobrazit méně' },
      sk: { more: 'Čítať viac', less: 'Zobraziť menej' },
      en: { more: 'Read more', less: 'Show less' },
      de: { more: 'Mehr lesen', less: 'Weniger anzeigen' },
      pl: { more: 'Czytaj więcej', less: 'Pokaż mniej' },
      hu: { more: 'Tovább olvasom', less: 'Kevesebb' }
    };

    return map[getLang()] || map.cs;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ajsee-modal-long-description-v3{
        position:relative;
      }

      .ajsee-modal-long-description-v3:not(.is-expanded){
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:7;
        overflow:hidden;
        max-height:12.4em;
      }

      .ajsee-modal-long-description-v3.is-expanded{
        display:block;
        -webkit-line-clamp:unset;
        max-height:none;
        overflow:visible;
      }

      .ajsee-modal-readmore-v3{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin:10px 0 16px;
        padding:0;
        border:0;
        background:transparent;
        color:#006fd6;
        font:inherit;
        font-size:14px;
        font-weight:800;
        line-height:1.3;
        cursor:pointer;
      }

      .ajsee-modal-readmore-v3:hover{
        text-decoration:underline;
      }

      .ajsee-modal-readmore-v3:focus-visible{
        outline:3px solid rgba(0,111,214,.28);
        outline-offset:4px;
        border-radius:8px;
      }

      @media (max-width:760px){
        .ajsee-modal-long-description-v3:not(.is-expanded){
          -webkit-line-clamp:6;
          max-height:10.8em;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    return (
      rect.width > 20 &&
      rect.height > 20 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0
    );
  }

  function getVisibleModalRoots() {
    return Array.from(document.querySelectorAll([
      '[role="dialog"]',
      '[aria-modal="true"]',
      '.event-modal',
      '.event-detail-modal',
      '.ajsee-event-modal',
      '.ajsee-modal',
      '.modal',
      '[class*="modal"]',
      '[class*="dialog"]'
    ].join(','))).filter(isVisible);
  }

  function cleanupOldReadMore(root) {
    root.querySelectorAll([
      '.ajsee-modal-readmore',
      '.ajsee-modal-readmore-v2',
      '.ajsee-modal-readmore-v3'
    ].join(',')).forEach((button) => button.remove());

    root.querySelectorAll([
      '.ajsee-modal-description-clamp',
      '.ajsee-modal-long-description-v2',
      '.ajsee-modal-long-description-v3'
    ].join(',')).forEach((el) => {
      el.classList.remove(
        'ajsee-modal-description-clamp',
        'ajsee-modal-long-description-v2',
        'ajsee-modal-long-description-v3',
        'is-expanded'
      );
      delete el.dataset.ajseeReadMoreApplied;
      delete el.dataset.ajseeReadMoreV2;
      delete el.dataset.ajseeReadMoreV3;
    });
  }

  function isBadCandidate(el, root) {
    if (!el || !el.matches) return true;

    const tag = el.tagName.toLowerCase();
    if (!['p', 'div', 'section', 'article'].includes(tag)) return true;
    if (el === root) return true;
    if (el.closest('.event-card')) return true;
    if (el.closest('button, a')) return true;
    if (el.matches('button, a, h1, h2, h3, nav, header, footer')) return true;
    if (el.querySelector('button, a, img, picture, svg, input, select, textarea, h1, h2, h3')) return true;

    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 520) return true;

    const lower = text.toLowerCase();
    if (lower.includes('přidat do kalendáře')) return true;
    if (lower.includes('add to calendar')) return true;
    if (lower.includes('vstupenky') && lower.includes('google') && lower.includes('outlook')) return true;

    return false;
  }

  function findDescriptionCandidate(root) {
    const candidates = Array.from(root.querySelectorAll('p, div, section, article'))
      .filter((el) => !isBadCandidate(el, root))
      .map((el) => ({
        el,
        textLength: String(el.textContent || '').replace(/\s+/g, ' ').trim().length,
        childTextBlocks: el.querySelectorAll('p, div, section, article').length
      }))
      .sort((a, b) => {
        // Prefer real text blocks over large wrappers.
        if (a.childTextBlocks !== b.childTextBlocks) {
          return a.childTextBlocks - b.childTextBlocks;
        }

        return b.textLength - a.textLength;
      });

    return candidates[0]?.el || null;
  }

  function applyToRoot(root) {
    if (!root || root.dataset.ajseeReadMoreV3Root === '1') return;

    const candidate = findDescriptionCandidate(root);
    if (!candidate) return;

    root.dataset.ajseeReadMoreV3Root = '1';

    cleanupOldReadMore(root);
    ensureStyles();

    const labels = getCopy();
    const id = candidate.id || ('ajsee-modal-description-v3-' + Math.random().toString(36).slice(2, 10));

    candidate.id = id;
    candidate.classList.add('ajsee-modal-long-description-v3');
    candidate.dataset.ajseeReadMoreV3 = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ajsee-modal-readmore-v3';
    button.textContent = labels.more;
    button.setAttribute('aria-controls', id);
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', () => {
      const expanded = candidate.classList.toggle('is-expanded');

      button.textContent = expanded ? labels.less : labels.more;
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');

      try {
        window.__ajseeModalReadMoreV3Last = {
          expanded,
          text: String(candidate.textContent || '').slice(0, 160),
          at: new Date().toISOString()
        };
      } catch {
        // noop
      }
    });

    candidate.insertAdjacentElement('afterend', button);

    try {
      window.__ajseeModalReadMoreV3Last = {
        applied: true,
        textLength: String(candidate.textContent || '').length,
        text: String(candidate.textContent || '').slice(0, 160),
        at: new Date().toISOString()
      };
    } catch {
      // noop
    }
  }

  let scheduled = false;

  function scan() {
    scheduled = false;
    getVisibleModalRoots().forEach(applyToRoot);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(scan, 80);
  }

  ensureStyles();

  document.addEventListener('click', scheduleScan, true);
  document.addEventListener('keydown', scheduleScan, true);

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
  } else {
    scheduleScan();
  }
})();


/* AJSEE_MODAL_DESKTOP_CALENDAR_POLISH_v1
   ---------------------------------------------------------
   Desktop-only calendar layout polish for event modal.
   Mobile layout intentionally unchanged.
   --------------------------------------------------------- */

(function installAjseeModalDesktopCalendarPolish() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__ajseeModalDesktopCalendarPolishInstalled) return;

  window.__ajseeModalDesktopCalendarPolishInstalled = true;

  const STYLE_ID = 'ajsee-modal-desktop-calendar-polish-css';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 900px){
        .ajsee-modal-calendar-group-v1{
          display:grid;
          grid-template-columns:1fr;
          gap:10px;
          align-items:start;
          margin-top:18px;
        }

        .ajsee-modal-calendar-label-v1{
          display:block;
          margin:0;
          font-weight:800;
          line-height:1.25;
        }

        .ajsee-modal-calendar-actions-v1{
          display:grid;
          grid-template-columns:repeat(3, minmax(118px, 1fr));
          gap:10px;
          align-items:center;
          width:min(100%, 520px);
        }

        .ajsee-modal-calendar-actions-v1 > a,
        .ajsee-modal-calendar-actions-v1 > button{
          width:100%;
          min-height:44px;
          white-space:nowrap;
          text-align:center;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    return (
      rect.width > 20 &&
      rect.height > 20 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0
    );
  }

  function getVisibleModalRoots() {
    return Array.from(document.querySelectorAll([
      '[role="dialog"]',
      '[aria-modal="true"]',
      '.event-modal',
      '.event-detail-modal',
      '.ajsee-event-modal',
      '.ajsee-modal',
      '.modal',
      '[class*="modal"]',
      '[class*="dialog"]'
    ].join(','))).filter(isVisible);
  }

  function normalizedText(el) {
    return String(el?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isCalendarButton(el) {
    const text = normalizedText(el).toLowerCase();
    const href = String(el?.getAttribute?.('href') || '').toLowerCase();

    return (
      text === 'google' ||
      text === 'outlook' ||
      text === 'apple / ics' ||
      text === 'apple/ics' ||
      href.includes('calendar.google') ||
      href.includes('outlook') ||
      href.includes('.ics')
    );
  }

  function findCalendarLabel(root) {
    const candidates = Array.from(root.querySelectorAll('strong, b, p, span, div'))
      .filter((el) => {
        const text = normalizedText(el).toLowerCase();

        if (!text) return false;
        if (text.length > 80) return false;

        return (
          text.includes('přidat do kalendáře') ||
          text.includes('pridat do kalendare') ||
          text.includes('add to calendar') ||
          text.includes('do kalendáře') ||
          text.includes('do kalendare')
        );
      });

    return candidates[0] || null;
  }

  function commonAncestor(elements) {
    const valid = elements.filter(Boolean);

    if (!valid.length) return null;
    if (valid.length === 1) return valid[0].parentElement;

    const paths = valid.map((el) => {
      const path = [];
      let node = el;

      while (node && node !== document.documentElement) {
        path.push(node);
        node = node.parentElement;
      }

      return path;
    });

    return paths[0].find((node) => paths.every((path) => path.includes(node))) || null;
  }

  function directChildOf(parent, child) {
    let node = child;

    while (node && node.parentElement && node.parentElement !== parent) {
      node = node.parentElement;
    }

    return node && node.parentElement === parent ? node : child;
  }

  function applyCalendarPolish(root) {
    if (!root || root.dataset.ajseeCalendarPolishV1 === '1') return;

    const buttons = Array.from(root.querySelectorAll('a, button')).filter(isCalendarButton);

    if (buttons.length < 2) return;

    const label = findCalendarLabel(root);
    const group = commonAncestor(label ? [label, ...buttons] : buttons);

    if (!group || group === document.body || group === document.documentElement) return;

    const actionsCommon = commonAncestor(buttons);
    const actionsChild = actionsCommon && group.contains(actionsCommon)
      ? directChildOf(group, actionsCommon)
      : null;

    root.dataset.ajseeCalendarPolishV1 = '1';
    group.classList.add('ajsee-modal-calendar-group-v1');

    if (label) {
      label.classList.add('ajsee-modal-calendar-label-v1');
    }

    if (actionsChild) {
      actionsChild.classList.add('ajsee-modal-calendar-actions-v1');
    } else {
      const buttonParent = buttons[0]?.parentElement;

      if (buttonParent) {
        buttonParent.classList.add('ajsee-modal-calendar-actions-v1');
      }
    }

    try {
      window.__ajseeModalCalendarPolishLast = {
        applied: true,
        buttons: buttons.map((button) => normalizedText(button)),
        at: new Date().toISOString()
      };
    } catch {
      // noop
    }
  }

  let scheduled = false;

  function scan() {
    scheduled = false;
    ensureStyles();
    getVisibleModalRoots().forEach(applyCalendarPolish);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(scan, 80);
  }

  ensureStyles();

  document.addEventListener('click', scheduleScan, true);
  document.addEventListener('keydown', scheduleScan, true);

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
  } else {
    scheduleScan();
  }
})();

