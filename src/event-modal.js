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


/* AJSEE_MODAL_READ_MORE_PATCH_v1
   ---------------------------------------------------------
   Long descriptions in partner feeds, especially smsticket, can make
   the modal too tall. This runtime layer clamps only long descriptions
   and adds an accessible read-more toggle.
   --------------------------------------------------------- */

function ajseeModalReadMoreLang() {
  try {
    return String(document.documentElement.lang || document.body?.dataset?.lang || 'cs')
      .toLowerCase()
      .slice(0, 2);
  } catch {
    return 'cs';
  }
}

function ajseeModalReadMoreCopy() {
  const lang = ajseeModalReadMoreLang();

  const map = {
    cs: { more: 'Číst více', less: 'Zobrazit méně' },
    sk: { more: 'Čítať viac', less: 'Zobraziť menej' },
    en: { more: 'Read more', less: 'Show less' },
    de: { more: 'Mehr lesen', less: 'Weniger anzeigen' },
    pl: { more: 'Czytaj więcej', less: 'Pokaż mniej' },
    hu: { more: 'Tovább olvasom', less: 'Kevesebb' }
  };

  return map[lang] || map.cs;
}

function ajseeEnsureModalReadMoreStyles() {
  if (document.getElementById('ajsee-modal-readmore-css')) return;

  const style = document.createElement('style');
  style.id = 'ajsee-modal-readmore-css';
  style.textContent = `
    .ajsee-modal-description-clamp{
      display:-webkit-box;
      -webkit-line-clamp:7;
      -webkit-box-orient:vertical;
      overflow:hidden;
      position:relative;
    }

    .ajsee-modal-description-clamp.is-expanded{
      display:block;
      -webkit-line-clamp:unset;
      overflow:visible;
    }

    .ajsee-modal-readmore{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      margin:10px 0 14px;
      padding:0;
      border:0;
      background:transparent;
      color:#006fd6;
      font:inherit;
      font-size:14px;
      font-weight:800;
      line-height:1.3;
      cursor:pointer;
      text-decoration:none;
    }

    .ajsee-modal-readmore:hover{
      text-decoration:underline;
    }

    .ajsee-modal-readmore:focus-visible{
      outline:3px solid rgba(0,111,214,.28);
      outline-offset:4px;
      border-radius:8px;
    }

    @media (max-width: 760px){
      .ajsee-modal-description-clamp{
        -webkit-line-clamp:6;
      }
    }
  `;

  document.head.appendChild(style);
}

function ajseeModalFindDescription(root) {
  if (!root || root.dataset?.ajseeReadMoreScanned === '1') return null;

  const preferredSelectors = [
    '[data-event-description]',
    '[data-ajsee-event-description]',
    '.event-modal-description',
    '.event-detail-description',
    '.event-description',
    '.modal-description',
    '.ajsee-event-modal__description',
    '.event-modal__description',
    '.modal-body p',
    '.modal-content p'
  ];

  for (const selector of preferredSelectors) {
    const candidates = Array.from(root.querySelectorAll(selector))
      .filter((el) => {
        const text = String(el.textContent || '').trim();
        if (text.length < 360) return false;
        if (el.closest('button, a')) return false;
        if (el.querySelector('button, a, img, h1, h2, h3')) return false;
        return true;
      });

    if (candidates.length) {
      return candidates.sort((a, b) => String(b.textContent || '').length - String(a.textContent || '').length)[0];
    }
  }

  const genericCandidates = Array.from(root.querySelectorAll('p, div'))
    .filter((el) => {
      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();

      if (text.length < 430) return false;
      if (el.closest('button, a')) return false;
      if (el.matches('button, a, h1, h2, h3, nav')) return false;
      if (el.querySelector('button, a, img, h1, h2, h3')) return false;

      const lower = text.toLowerCase();
      if (lower.includes('přidat do kalendáře')) return false;
      if (lower.includes('add to calendar')) return false;
      if (lower.includes('kategorie:')) return false;
      if (lower.includes('vstupenky')) return false;

      return true;
    });

  if (!genericCandidates.length) return null;

  return genericCandidates.sort((a, b) => String(b.textContent || '').length - String(a.textContent || '').length)[0];
}

function ajseeModalApplyReadMore(root) {
  if (!root || root.dataset?.ajseeReadMoreScanned === '1') return;

  const description = ajseeModalFindDescription(root);
  root.dataset.ajseeReadMoreScanned = '1';

  if (!description) return;
  if (description.dataset.ajseeReadMoreApplied === '1') return;

  const text = String(description.textContent || '').replace(/\s+/g, ' ').trim();

  // Text shorter than this usually does not need a clamp.
  if (text.length < 520) return;

  ajseeEnsureModalReadMoreStyles();

  const copy = ajseeModalReadMoreCopy();
  const id = description.id || ('ajsee-modal-description-' + Math.random().toString(36).slice(2, 10));

  description.id = id;
  description.classList.add('ajsee-modal-description-clamp');
  description.dataset.ajseeReadMoreApplied = '1';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ajsee-modal-readmore';
  button.setAttribute('aria-controls', id);
  button.setAttribute('aria-expanded', 'false');
  button.textContent = copy.more;

  button.addEventListener('click', () => {
    const expanded = description.classList.toggle('is-expanded');
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.textContent = expanded ? copy.less : copy.more;

    if (!expanded) {
      try {
        description.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* noop */
      }
    }
  });

  description.insertAdjacentElement('afterend', button);
}

function ajseeScanEventModalsForReadMore() {
  const roots = Array.from(document.querySelectorAll([
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.event-modal',
    '.event-detail-modal',
    '.ajsee-event-modal',
    '.ajsee-modal',
    '.modal'
  ].join(',')));

  roots.forEach(ajseeModalApplyReadMore);
}

function ajseeInstallEventModalReadMore() {
  if (window.__ajseeEventModalReadMoreInstalled) return;
  window.__ajseeEventModalReadMoreInstalled = true;

  ajseeEnsureModalReadMoreStyles();
  ajseeScanEventModalsForReadMore();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(ajseeScanEventModalsForReadMore);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('click', () => {
    window.setTimeout(ajseeScanEventModalsForReadMore, 0);
  }, true);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ajseeInstallEventModalReadMore, { once: true });
  } else {
    ajseeInstallEventModalReadMore();
  }
}


/* AJSEE_MODAL_READ_MORE_FORCE_PATCH_v2
   ---------------------------------------------------------
   Stronger long-description clamp for event modal.
   Finds the longest text block inside a visible fixed/dialog overlay
   and adds an accessible "Číst více" / "Zobrazit méně" toggle.
   --------------------------------------------------------- */

(function installAjseeModalReadMoreForceV2() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__ajseeModalReadMoreForceV2Installed) return;

  window.__ajseeModalReadMoreForceV2Installed = true;

  const STYLE_ID = 'ajsee-modal-readmore-force-v2-css';

  function lang() {
    return String(document.documentElement.lang || 'cs').toLowerCase().slice(0, 2);
  }

  function copy() {
    const map = {
      cs: { more: 'Číst více', less: 'Zobrazit méně' },
      sk: { more: 'Čítať viac', less: 'Zobraziť menej' },
      en: { more: 'Read more', less: 'Show less' },
      de: { more: 'Mehr lesen', less: 'Weniger anzeigen' },
      pl: { more: 'Czytaj więcej', less: 'Pokaż mniej' },
      hu: { more: 'Tovább olvasom', less: 'Kevesebb' }
    };

    return map[lang()] || map.cs;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ajsee-modal-long-description-v2{
        position:relative;
      }

      .ajsee-modal-long-description-v2:not(.is-expanded){
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:7;
        overflow:hidden;
        max-height:12.4em;
      }

      .ajsee-modal-long-description-v2.is-expanded{
        display:block;
        -webkit-line-clamp:unset;
        max-height:none;
        overflow:visible;
      }

      .ajsee-modal-readmore-v2{
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

      .ajsee-modal-readmore-v2:hover{
        text-decoration:underline;
      }

      .ajsee-modal-readmore-v2:focus-visible{
        outline:3px solid rgba(0,111,214,.28);
        outline-offset:4px;
        border-radius:8px;
      }

      @media (max-width:760px){
        .ajsee-modal-long-description-v2:not(.is-expanded){
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

  function findOverlayAncestor(el) {
    let node = el;

    while (node && node !== document.body && node !== document.documentElement) {
      if (!node.matches) {
        node = node.parentElement;
        continue;
      }

      const cls = String(node.className || '').toLowerCase();
      const role = String(node.getAttribute('role') || '').toLowerCase();
      const ariaModal = String(node.getAttribute('aria-modal') || '').toLowerCase();
      const style = window.getComputedStyle(node);

      if (
        role === 'dialog' ||
        ariaModal === 'true' ||
        cls.includes('modal') ||
        cls.includes('dialog') ||
        style.position === 'fixed'
      ) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  function isBadCandidate(el) {
    if (!el || !el.matches) return true;

    const tag = el.tagName.toLowerCase();
    if (!['p', 'div', 'section', 'article'].includes(tag)) return true;

    if (el.dataset.ajseeReadMoreV2 === '1') return true;
    if (el.closest('.event-card')) return true;
    if (el.closest('button, a')) return true;
    if (el.matches('button, a, h1, h2, h3, nav, header, footer')) return true;

    // Popis nesmí obsahovat ovládací prvky / strukturu celého modalu.
    if (el.querySelector('button, a, img, picture, svg, input, select, textarea, h1, h2, h3')) return true;

    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 520) return true;

    const lower = text.toLowerCase();
    if (lower.includes('přidat do kalendáře')) return true;
    if (lower.includes('add to calendar')) return true;
    if (lower.includes('vstupenky') && lower.includes('google') && lower.includes('outlook')) return true;

    const overlay = findOverlayAncestor(el);
    if (!overlay || !isVisible(overlay)) return true;

    return false;
  }

  function findDescriptionCandidate() {
    const nodes = Array.from(document.querySelectorAll('p, div, section, article'))
      .filter((el) => !isBadCandidate(el))
      .map((el) => ({
        el,
        textLength: String(el.textContent || '').replace(/\s+/g, ' ').trim().length,
        rect: el.getBoundingClientRect()
      }))
      .filter((item) => item.rect.top < window.innerHeight && item.rect.bottom > 0)
      .sort((a, b) => b.textLength - a.textLength);

    return nodes[0]?.el || null;
  }

  function applyReadMore() {
    ensureStyles();

    const description = findDescriptionCandidate();
    if (!description) return;

    description.dataset.ajseeReadMoreV2 = '1';
    description.classList.add('ajsee-modal-long-description-v2');

    const id = description.id || ('ajsee-modal-description-v2-' + Math.random().toString(36).slice(2, 10));
    description.id = id;

    const labels = copy();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ajsee-modal-readmore-v2';
    button.textContent = labels.more;
    button.setAttribute('aria-controls', id);
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', () => {
      const expanded = description.classList.toggle('is-expanded');

      button.textContent = expanded ? labels.less : labels.more;
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');

      try {
        window.__ajseeModalReadMoreForceV2Last = {
          expanded,
          text: String(description.textContent || '').slice(0, 120),
          at: new Date().toISOString()
        };
      } catch {
        // noop
      }
    });

    description.insertAdjacentElement('afterend', button);

    try {
      window.__ajseeModalReadMoreForceV2Last = {
        applied: true,
        textLength: String(description.textContent || '').length,
        text: String(description.textContent || '').slice(0, 160),
        at: new Date().toISOString()
      };
    } catch {
      // noop
    }
  }

  let scheduled = false;

  function scheduleApply() {
    if (scheduled) return;

    scheduled = true;

    window.setTimeout(() => {
      scheduled = false;
      applyReadMore();
    }, 80);
  }

  document.addEventListener('click', scheduleApply, true);
  document.addEventListener('keydown', scheduleApply, true);

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  } else {
    scheduleApply();
  }
})();

