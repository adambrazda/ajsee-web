import '../../identity-init.js';

import { initNav } from '../../nav-core.js';
import { applyTranslations, detectLang } from '../../i18n.js';

const SUPPORTED = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const INITIAL_VISIBLE_SHOWS = 24;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const TODAYTIX_PURCHASE_BASE_URL = 'https://ajsee.tixculture.com/';

let londonMusicalsShows = [];
let londonMusicalsExpanded = false;

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



const SHOW_MORE_COPY = {
  cs: {
    showAll: 'Zobrazit všechna představení',
    showing: 'Zobrazeno {shown} z {total} produkcí'
  },
  en: {
    showAll: 'Show all shows',
    showing: 'Showing {shown} of {total} productions'
  },
  de: {
    showAll: 'Alle Vorstellungen anzeigen',
    showing: '{shown} von {total} Produktionen angezeigt'
  },
  sk: {
    showAll: 'Zobraziť všetky predstavenia',
    showing: 'Zobrazené {shown} z {total} produkcií'
  },
  pl: {
    showAll: 'Pokaż wszystkie spektakle',
    showing: 'Wyświetlono {shown} z {total} produkcji'
  },
  hu: {
    showAll: 'Összes előadás megjelenítése',
    showing: '{shown} / {total} produkció megjelenítve'
  }
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
        '<a class="lm-btn lm-btn--primary js-lm-partner-click" href="', esc(href), '" target="_blank" rel="noopener noreferrer sponsored" data-partner="todaytix" data-event-title="', esc(title), '" data-event-city="London" data-outbound-url="', esc(href), '" data-placement="london_musicals_card">', esc(copy(lang, 'cta')), '</a>',
      '</div>',
    '</article>'
  ].join('');
}

/* SeatPlan feed loading disabled: London ticket purchase now goes through TodayTix/Encore. */

function showMoreCopy(lang, key, values = {}) {
  const messages = SHOW_MORE_COPY[lang] || SHOW_MORE_COPY.cs;

  return String(messages[key] || SHOW_MORE_COPY.cs[key] || '')
    .replace('{shown}', String(values.shown ?? ''))
    .replace('{total}', String(values.total ?? ''));
}

function ensureShowMoreControls(grid) {
  let controls = document.getElementById('londonMusicalsControls');

  if (controls) return controls;

  controls = document.createElement('div');
  controls.id = 'londonMusicalsControls';
  controls.className = 'lm-show-more';
  controls.innerHTML = [
    '<p class="lm-show-count" id="londonMusicalsCount" aria-live="polite"></p>',
    '<button type="button" class="lm-btn lm-btn--primary" id="londonMusicalsShowAll"></button>'
  ].join('');

  grid.insertAdjacentElement('afterend', controls);
  return controls;
}

function hideShowMoreControls() {
  const controls = document.getElementById('londonMusicalsControls');
  if (controls) controls.hidden = true;
}

function renderVisibleShows(grid, lang) {
  const total = londonMusicalsShows.length;
  const visibleCount = londonMusicalsExpanded
    ? total
    : Math.min(INITIAL_VISIBLE_SHOWS, total);

  const visibleShows = londonMusicalsShows.slice(0, visibleCount);
  grid.innerHTML = visibleShows.map((event) => cardHtml(event, lang)).join('');

  const controls = ensureShowMoreControls(grid);
  const count = document.getElementById('londonMusicalsCount');
  const button = document.getElementById('londonMusicalsShowAll');

  controls.hidden = false;

  if (count) {
    count.textContent = showMoreCopy(lang, 'showing', {
      shown: visibleCount,
      total
    });
  }

  if (button) {
    button.hidden = visibleCount >= total;
    button.textContent = showMoreCopy(lang, 'showAll');

    button.onclick = () => {
      const beforeExpand = visibleCount;

      londonMusicalsExpanded = true;
      renderVisibleShows(grid, lang);

      trackLondonMusicalsShowAll({
        visibleBefore: beforeExpand,
        visibleAfter: londonMusicalsShows.length,
        total
      });

      button.blur();
    };
  }
}


const PARTNER_PURCHASE_COPY = {
  cs: {
    badge: 'Nákup přes TodayTix',
    title: 'Vstupenky na londýnské muzikály',
    text: 'Aktuální nabídku představení, termínů a cen najdete na naší partnerské stránce pro nákup vstupenek. Nákupní prostředí je zatím v angličtině.',
    cta: 'Zobrazit vstupenky',
    note: 'Výběr sedadel, platba a zákaznická podpora probíhají u našeho ticketingového partnera TodayTix.'
  },
  en: {
    badge: 'Book through TodayTix',
    title: 'London musical tickets',
    text: 'See current shows, dates and prices on our partner purchase page. The ticket purchase experience is currently in English.',
    cta: 'View tickets',
    note: 'Seat selection, payment and customer support are handled by our ticketing partner TodayTix.'
  },
  de: {
    badge: 'Buchung über TodayTix',
    title: 'Tickets für Londoner Musicals',
    text: 'Aktuelle Shows, Termine und Preise finden Sie auf unserer Partnerseite für den Ticketkauf. Der Kaufbereich ist derzeit auf Englisch.',
    cta: 'Tickets ansehen',
    note: 'Sitzplatzauswahl, Zahlung und Kundenservice erfolgen über unseren Ticketing-Partner TodayTix.'
  },
  sk: {
    badge: 'Nákup cez TodayTix',
    title: 'Vstupenky na londýnske muzikály',
    text: 'Aktuálnu ponuku predstavení, termínov a cien nájdete na našej partnerskej stránke pre nákup vstupeniek. Nákupné prostredie je zatiaľ v angličtine.',
    cta: 'Zobraziť vstupenky',
    note: 'Výber sedadiel, platba a zákaznícka podpora prebiehajú u nášho ticketingového partnera TodayTix.'
  },
  pl: {
    badge: 'Zakup przez TodayTix',
    title: 'Bilety na londyńskie musicale',
    text: 'Aktualne spektakle, terminy i ceny znajdziesz na naszej partnerskiej stronie zakupu biletów. Proces zakupu jest obecnie dostępny w języku angielskim.',
    cta: 'Zobacz bilety',
    note: 'Wybór miejsc, płatność i obsługa klienta odbywają się u naszego partnera ticketingowego TodayTix.'
  },
  hu: {
    badge: 'Vásárlás a TodayTix-en keresztül',
    title: 'Jegyek londoni musicalekre',
    text: 'Az aktuális előadásokat, időpontokat és árakat partneri jegyvásárlási oldalunkon találod. A vásárlási felület jelenleg angol nyelvű.',
    cta: 'Jegyek megtekintése',
    note: 'Az ülőhelyválasztást, a fizetést és az ügyfélszolgálatot ticketing partnerünk, a TodayTix kezeli.'
  }
};

function getTodayTixPurchaseUrl(lang = 'cs') {
  const url = new URL(TODAYTIX_PURCHASE_BASE_URL);
  url.searchParams.set('utm_source', 'ajsee');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'london_musicals');
  url.searchParams.set('utm_content', normLang(lang));
  return url.toString();
}

function partnerPurchasePanelHtml(lang) {
  const safeLang = normLang(lang);
  const purchaseCopy = PARTNER_PURCHASE_COPY[safeLang] || PARTNER_PURCHASE_COPY.cs;
  const href = getTodayTixPurchaseUrl(safeLang);

  return [
    '<article class="lm-card lm-card--partner-purchase">',
      '<div class="lm-card-body">',
        '<span class="lm-card-badge">', esc(purchaseCopy.badge), '</span>',
        '<h3>', esc(purchaseCopy.title), '</h3>',
        '<p>', esc(purchaseCopy.text), '</p>',
        '<a class="lm-btn lm-btn--primary js-lm-partner-click" href="', esc(href), '" target="_blank" rel="noopener noreferrer sponsored" data-partner="todaytix" data-event-title="London musicals" data-event-city="London" data-outbound-url="', esc(href), '" data-placement="london_musicals_partner_purchase_panel">', esc(purchaseCopy.cta), '</a>',
        '<p class="lm-card-note">', esc(purchaseCopy.note), '</p>',
      '</div>',
    '</article>'
  ].join('');
}

async function renderShows() {
  const lang = normLang(detectLang());
  const grid = document.getElementById('londonMusicalsGrid');
  const empty = document.getElementById('londonMusicalsEmpty');

  if (!grid) return;

  grid.setAttribute('aria-busy', 'true');

  try {
    londonMusicalsExpanded = false;
    londonMusicalsShows = [];

    hideShowMoreControls();

    if (empty) empty.hidden = true;

    // SeatPlan is no longer used. London ticket purchase now goes through
    // the AJSEE partner purchase page powered by TodayTix/Encore.
    grid.innerHTML = partnerPurchasePanelHtml(lang);
  } catch {
    grid.innerHTML = '';
    hideShowMoreControls();
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


/* AJSEE_LONDON_MUSICALS_TRACKING_V1
   Track TodayTix partner purchase clicks and key London musicals funnel actions. */
function cleanTrackingText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getTrackingLang() {
  return cleanTrackingText(document.documentElement.getAttribute('lang'))
    .slice(0, 2)
    .toLowerCase() || normLang(detectLang());
}

function getUrlHost(value) {
  try {
    return new URL(value, window.location.origin).hostname;
  } catch {
    return '';
  }
}

function pushAnalyticsEvent(payload) {
  const eventPayload = {
    ...payload,
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    language: getTrackingLang(),
    ts: new Date().toISOString()
  };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventPayload);
  } catch {
    /* noop */
  }

  try {
    window.__ajsee = window.__ajsee || {};
    window.__ajsee.lastLondonMusicalsEvent = eventPayload;
  } catch {
    /* noop */
  }

  try {
    sessionStorage.setItem('ajsee:lastLondonMusicalsEvent', JSON.stringify(eventPayload));
  } catch {
    /* noop */
  }

  try {
    console.info('[AJSEE London musicals tracking]', eventPayload);
  } catch {
    /* noop */
  }
}

function trackLondonMusicalsPartnerClick(link) {
  if (!link) return;

  const partner = cleanTrackingText(link.dataset.partner || 'todaytix');
  const eventTitle = cleanTrackingText(link.dataset.eventTitle || link.closest('.lm-card')?.querySelector('h3')?.textContent);
  const eventCity = cleanTrackingText(link.dataset.eventCity || 'London');
  const clickedHref = cleanTrackingText(link.href || link.getAttribute('href'));
  const outboundUrl = cleanTrackingText(link.dataset.outboundUrl) || clickedHref;
  const placement = cleanTrackingText(link.dataset.placement || 'london_musicals_card');

  if (!partner && !outboundUrl) return;

  pushAnalyticsEvent({
    event: 'partner_click',

    partner,
    event_name: eventTitle,
    city: eventCity,
    outbound_url: outboundUrl,
    placement,

    event_title: eventTitle,
    event_city: eventCity,
    event_provider: partner,
    destination_url: outboundUrl,
    destination_host: getUrlHost(outboundUrl),
    clicked_href: clickedHref,
    clicked_host: getUrlHost(clickedHref),
    route_city: 'London',
    route_country_code: 'GB',
    link_text: cleanTrackingText(link.textContent)
  });
}

function trackLondonMusicalsShowAll({ visibleBefore, visibleAfter, total } = {}) {
  pushAnalyticsEvent({
    event: 'london_musicals_show_all',
    placement: 'london_musicals_list',
    visible_before: Number(visibleBefore) || 0,
    visible_after: Number(visibleAfter) || 0,
    total_productions: Number(total) || 0,
    route_city: 'London',
    route_country_code: 'GB'
  });
}

function trackLondonMusicalsContestRulesClick(link) {
  const fallbackUrl = '/londynske-muzikaly/soutez-instagram/';
  const href = link?.href || fallbackUrl;

  pushAnalyticsEvent({
    event: 'london_musicals_contest_rules_click',
    placement: 'instagram_contest_banner',
    destination_url: href,
    destination_host: getUrlHost(href),
    clicked_href: href,
    clicked_host: getUrlHost(href),
    route_city: 'London',
    route_country_code: 'GB',
    link_text: cleanTrackingText(link?.textContent)
  });
}

function initLondonMusicalsTracking() {
  if (window.__ajseeLondonMusicalsTrackingInit) return;
  window.__ajseeLondonMusicalsTrackingInit = true;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const partnerLink = target.closest('.js-lm-partner-click');
    if (partnerLink) {
      trackLondonMusicalsPartnerClick(partnerLink);
      return;
    }

    const contestRulesLink = target.closest('a[href="/londynske-muzikaly/soutez-instagram/"]');
    if (contestRulesLink) {
      trackLondonMusicalsContestRulesClick(contestRulesLink);
    }
  }, true);
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
  initLondonMusicalsTracking();
  trackTrustedStaysClicks();

  const retry = document.getElementById('londonMusicalsRetry');
  if (retry) retry.addEventListener('click', () => void renderShows());

  await renderShows();
});
