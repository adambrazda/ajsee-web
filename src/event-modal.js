// src/event-modal.js
// Event modal + kalendáře (Google/Outlook/ICS), bez závislosti na main.js

const pickLocalized = (map, preferred = []) => {
  if (!map) return '';
  if (typeof map === 'string') return map;
  if (typeof map !== 'object') return '';
  for (const k of preferred) {
    const v = map?.[k];
    if (v) return String(v);
  }
  const any = Object.values(map).find(Boolean);
  return any ? String(any) : '';
};

const toISODate = (d) => {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
};
const toCalDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};
const buildICS = ({ title, description, location, start, end }) => {
  const dtStart = toCalDate(start);
  const dtEnd = toCalDate(end || start);
  const esc = (s) => String(s || '').replace(/[\n\r]/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AJSEE//Events//CS','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
};

export function initEventModal() {
  const closeBtn = document.querySelector('#modalClose');
  const modalEl  = document.querySelector('#eventModal');

  const closeEventModal = () => {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
  };
  if (closeBtn) closeBtn.addEventListener('click', closeEventModal);
  if (modalEl) {
    window.addEventListener('click', (e) => {
      if (e.target === modalEl) closeEventModal();
    });
  }
  // Expose (volitelně) pro případné použití jinde
  window.__ajseeCloseEventModal = closeEventModal;
}

export async function openEventModal(eventData, locale = 'cs', opts = {}) {
  const t = typeof opts.t === 'function' ? opts.t : ((k, fb)=>fb);

  const modal = document.getElementById('eventModal');
  if (!modal) {
    console.error('Modal #eventModal not found!');
    return;
  }

  const titleEl    = modal.querySelector('#modalTitle');
  const imageEl    = modal.querySelector('#modalImage');
  const dateEl     = modal.querySelector('#modalDate');
  const locationEl = modal.querySelector('#modalLocation');
  const descEl     = modal.querySelector('#modalDescription');
  const categoryEl = modal.querySelector('#modalCategory');

  if (!titleEl || !imageEl || !dateEl || !locationEl || !descEl || !categoryEl) {
    console.error('Missing modal element(s)', { titleEl, imageEl, dateEl, locationEl, descEl, categoryEl });
    return;
  }

  if (!window.translations && typeof window.applyTranslations === 'function') {
    try { await window.applyTranslations(locale); } catch {}
  }

  const preferredLocales = [locale, 'en', 'cs'];

  const categoryKey = eventData.category || '';
  const categoryTranslated = t(`category-${categoryKey}`, categoryKey);

  const title = pickLocalized(eventData.title, preferredLocales) || 'Untitled';
  const description = pickLocalized(eventData.description, preferredLocales) || '';
  const image = eventData.image || '/images/fallbacks/concert0.jpg';
  const dateVal = eventData.datetime || eventData.date;
  const date = dateVal
    ? new Date(dateVal).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const location = eventData.location?.city || eventData.location || '';

  titleEl.textContent = title;
  imageEl.src = image; imageEl.alt = title;
  dateEl.textContent = date;
  locationEl.textContent = location;
  descEl.textContent = description;
  categoryEl.textContent = categoryTranslated;

  try {
    const start = toISODate(dateVal);
    const end = start;

    const gParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${toCalDate(start)}/${toCalDate(end)}`,
      details: description,
      location
    });
    const gLink = modal.querySelector('#googleCalendarLink');
    if (gLink) gLink.href = `https://calendar.google.com/calendar/render?${gParams.toString()}`;

    const oParams = new URLSearchParams({
      path: '/calendar/action/compose',
      ri: '0',
      subject: title,
      body: description,
      location
    });
    const oLink = modal.querySelector('#outlookCalendarLink');
    if (oLink) oLink.href = `https://outlook.office.com/calendar/0/deeplink/compose?${oParams.toString()}`;

    const icsText = buildICS({ title, description, location, start, end });
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const aLink = modal.querySelector('#appleCalendarLink');
    if (aLink) aLink.href = URL.createObjectURL(blob);
  } catch (e) {
    console.warn('Calendar links build failed:', e);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
