// /src/event-modal.js
// ---------------------------------------------------------
// AJSEE – Event modal
// - funguje i bez předem připraveného HTML ve stránce
// - používá stejný ticket link jako karta události
// - neobchází affiliate / tmOutbound flow
// - podporuje Google / Outlook / Apple ICS kalendář
// - překládá vlastní texty modalu podle aktuálního jazyka
// - desktop modal je scrollovatelný, aby se nikdy neořízl obsah
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
  // Preferujeme přesně ten ticket link, který byl spočítaný při renderu karty.
  // Tím neobcházíme tmOutbound ani affiliate cestu.
  const ticketHref = toSafeUrl(
    eventData.__ajseeTicketsHref ||
    eventData.tickets ||
    eventData.url ||
    ''
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