import '../../identity-init.js';

import { initNav } from '../../nav-core.js';
import { applyTranslations, detectLang } from '../../i18n.js';

const SUPPORTED = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const MAX_SHOWS = 12;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const RUNTIME_COPY = {
  cs: {
    badge: 'Vstupenky u partnera',
    venue: 'Místo konání',
    dates: 'Termíny',
    priceFrom: 'Cena od',
    cta: 'Najít vstupenky',
    priceFallback: 'Cena se liší podle termínu',
    dateFallback: 'Termíny u partnera',
    imageCredit: 'Obrázek: SeatPlan'
  },
  en: {
    badge: 'Tickets with a partner',
    venue: 'Venue',
    dates: 'Performance dates',
    priceFrom: 'From',
    cta: 'Find tickets',
    priceFallback: 'Prices vary by date',
    dateFallback: 'Dates available with partner',
    imageCredit: 'Image: SeatPlan'
  },
  de: {
    badge: 'Tickets beim Partner',
    venue: 'Veranstaltungsort',
    dates: 'Spieltermine',
    priceFrom: 'Preis ab',
    cta: 'Tickets finden',
    priceFallback: 'Der Preis variiert je nach Termin',
    dateFallback: 'Termine beim Partner verfügbar',
    imageCredit: 'Bild: SeatPlan'
  },
  sk: {
    badge: 'Vstupenky u partnera',
    venue: 'Miesto konania',
    dates: 'Termíny',
    priceFrom: 'Cena od',
    cta: 'Nájsť vstupenky',
    priceFallback: 'Cena sa líši podľa termínu',
    dateFallback: 'Termíny u partnera',
    imageCredit: 'Obrázok: SeatPlan'
  },
  pl: {
    badge: 'Bilety u partnera',
    venue: 'Miejsce',
    dates: 'Terminy',
    priceFrom: 'Cena od',
    cta: 'Znajdź bilety',
    priceFallback: 'Cena zależy od terminu',
    dateFallback: 'Terminy dostępne u partnera',
    imageCredit: 'Obraz: SeatPlan'
  },
  hu: {
    badge: 'Jegyek partnernél',
    venue: 'Helyszín',
    dates: 'Időpontok',
    priceFrom: 'Ár ettől',
    cta: 'Jegyek keresése',
    priceFallback: 'Az ár időpontonként változhat',
    dateFallback: 'Időpontok a partnernél érhetők el',
    imageCredit: 'Kép: SeatPlan'
  }
};

const ROUTES = {
  cs: '/londynske-muzikaly/',
  en: '/en/london-musicals/',
  de: '/de/london-musicals/',
  sk: '/sk/londynske-muzikaly/',
  pl: '/pl/londynskie-musicale/',
  hu: '/hu/londoni-musicalek/'
};

function normLang(value) {
  const lang = String(value || '').toLowerCase().slice(0, 2);
  return SUPPORTED.includes(lang) ? lang : 'cs';
}

function copy(lang, key) {
  return (RUNTIME_COPY[lang] || RUNTIME_COPY.cs)[key] || RUNTIME_COPY.cs[key] || '';
}

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickLocalized(value, lang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.cs || Object.values(value)[0] || '';
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value, lang) {
  const d = parseDate(value);
  if (!d) return '';

  const locale = {
    cs: 'cs-CZ',
    en: 'en-GB',
    de: 'de-DE',
    sk: 'sk-SK',
    pl: 'pl-PL',
    hu: 'hu-HU'
  }[lang] || 'en-GB';

  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return value;
  }
}

function formatDates(event, lang) {
  const from = formatDate(event.dateFrom || event.bookingFrom, lang);
  const to = formatDate(event.dateTo || event.bookingUntil, lang);

  if (from && to) return from + ' – ' + to;
  if (from) return from;
  if (to) return to;

  return copy(lang, 'dateFallback');
}

function formatPrice(event, lang) {
  const min = Number(event?.price?.min);
  const currency = event?.price?.currency || 'GBP';

  if (!Number.isFinite(min) || min <= 0) return copy(lang, 'priceFallback');

  const locale = {
    cs: 'cs-CZ',
    en: 'en-GB',
    de: 'de-DE',
    sk: 'sk-SK',
    pl: 'pl-PL',
    hu: 'hu-HU'
  }[lang] || 'en-GB';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(min);
  } catch {
    return currency + ' ' + Math.round(min);
  }
}

function isRelevantLondonShow(event) {
  const city = String(event?.location?.city || event?.venue?.city || '').toLowerCase();
  const country = String(event?.countryCode || event?.country || '').toUpperCase();
  const bookingUntil = parseDate(event?.bookingUntil || event?.dateTo);

  if (country && country !== 'GB') return false;
  if (city && !city.includes('london')) return false;
  if (!bookingUntil) return false;

  const minDate = new Date(Date.now() + TWO_WEEKS_MS);
  return bookingUntil > minDate;
}

function sortBySeatPlanPriority(a, b) {
  const ao = Number.isFinite(Number(a.sourceOrder)) ? Number(a.sourceOrder) : 999999;
  const bo = Number.isFinite(Number(b.sourceOrder)) ? Number(b.sourceOrder) : 999999;

  return (ao - bo) || String(pickLocalized(a.title, 'en')).localeCompare(String(pickLocalized(b.title, 'en')));
}

function cardHtml(event, lang) {
  const title = pickLocalized(event.title, lang) || pickLocalized(event.title, 'en') || 'London musical';
  const venue = event?.venue?.name || event?.location?.venue || 'West End';
  const image = event.image || event.imageOriginal || '/images/logo-ajsee.png';
  const href = event.tickets || event.url || '#';
  const needsCredit = event?.attribution?.requiredForImages;

  return [
    '<article class="lm-card">',
      '<div class="lm-card-media">',
        '<img src="', esc(image), '" alt="', esc(title), '" loading="lazy" decoding="async" />',
        needsCredit ? '<span class="lm-card-attr">' + esc(copy(lang, 'imageCredit')) + '</span>' : '',
      '</div>',
      '<div class="lm-card-body">',
        '<span class="lm-card-badge">', esc(copy(lang, 'badge')), '</span>',
        '<h3>', esc(title), '</h3>',
        '<div class="lm-card-meta">',
          '<span><strong>', esc(copy(lang, 'venue')), ':</strong> ', esc(venue), '</span>',
          '<span><strong>', esc(copy(lang, 'dates')), ':</strong> ', esc(formatDates(event, lang)), '</span>',
          '<span><strong>', esc(copy(lang, 'priceFrom')), ':</strong> ', esc(formatPrice(event, lang)), '</span>',
        '</div>',
        '<a class="lm-btn lm-btn--primary" href="', esc(href), '" target="_blank" rel="noopener noreferrer sponsored">', esc(copy(lang, 'cta')), '</a>',
      '</div>',
    '</article>'
  ].join('');
}

async function loadSeatPlanEvents() {
  const response = await fetch('/data/seatplan-events.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('SeatPlan feed unavailable');

  const payload = await response.json();
  return Array.isArray(payload?.events) ? payload.events : [];
}

async function renderShows() {
  const lang = normLang(detectLang());
  const grid = document.getElementById('londonMusicalsGrid');
  const empty = document.getElementById('londonMusicalsEmpty');

  if (!grid) return;

  try {
    grid.setAttribute('aria-busy', 'true');

    const events = await loadSeatPlanEvents();
    const shows = events
      .filter(isRelevantLondonShow)
      .sort(sortBySeatPlanPriority)
      .slice(0, MAX_SHOWS);

    if (!shows.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    grid.innerHTML = shows.map((event) => cardHtml(event, lang)).join('');
  } catch {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

function localizeLanguageButtons(currentLang) {
  document.querySelectorAll('.lang-btn[data-lang]').forEach((button) => {
    const lang = normLang(button.getAttribute('data-lang'));
    const target = ROUTES[lang] || ROUTES.cs;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (lang === currentLang) return;
      window.location.href = target;
    });
  });
}

function syncYear() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}

function trackTrustedStaysClicks() {
  document.querySelectorAll('a[href*="trustedstays.co.uk/book-a-home"]').forEach((link) => {
    link.addEventListener('click', () => {
      try {
        window.gtag?.('event', 'trustedstays_london_musicals_banner_click', {
          href: link.href
        });
      } catch {
        // noop
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = normLang(detectLang());

  initNav({ lang });
  await applyTranslations(lang);
  syncYear();
  localizeLanguageButtons(lang);
  trackTrustedStaysClicks();

  const retry = document.getElementById('londonMusicalsRetry');
  if (retry) retry.addEventListener('click', () => void renderShows());

  await renderShows();
});
