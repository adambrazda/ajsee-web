import COPY from '../content/event-detail-copy.json' with { type: 'json' };
import { detailPath, localeCode, freshTimestamp } from '../shared/event-details/state.js';
// Explicit, reviewable occurrences survive a missing or incomplete feed refresh.
// Feed absence is never a cancellation signal. Public pages share this renderer.
const ORIGIN = 'https://ajsee.cz';
export const PREVIEW_ROOT = '/previews/event-details';
export const PARTNERS = {
  colosseumticket: 'ColosseumTicket', ticketmaster: 'Ticketmaster', smsticket: 'smsticket'
};
const STATUS = {
  scheduled: 'EventScheduled', cancelled: 'EventCancelled',
  postponed: 'EventPostponed', rescheduled: 'EventRescheduled'
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
// Czech single-letter prepositions and conjunctions travel with the next word.
export const czechText = value => escapeHtml(value).replace(/(^|[\s(])([aAiIkKoOsSuUvVzZ]) +(?=\S)/g, '$1$2&nbsp;');

export function validatePilot(events) {
  const ids = new Set(), slugs = new Set();
  for (const event of events) {
    if (!event.id || ids.has(event.id) || !/^[a-z0-9-]+$/.test(event.slug) || slugs.has(event.slug)) throw new Error('Duplicate or invalid occurrence identity');
    ids.add(event.id); slugs.add(event.slug);
    if (!PARTNERS[event.partner] || !event.title || !event.introduction || !event.venue?.name || !event.venue?.city || !event.image?.alt) throw new Error(`Incomplete event: ${event.id}`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(event.startDate) || !Number.isFinite(Date.parse(event.startDate))) throw new Error('Explicit local datetime and UTC offset required');
    const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(event.startDate)).replace(' ', 'T');
    if (local !== event.startDate.slice(0, 19)) throw new Error('Datetime must match the Europe/Prague offset');
    if (!STATUS[event.status]) throw new Error('Unknown explicit event status');
    if (event.status === 'rescheduled' && !event.previousStartDate) throw new Error('Rescheduled event requires its previous date');
    const ticket = new URL(event.tickets, ORIGIN);
    if (event.partner === 'ticketmaster') {
      if (ticket.origin !== ORIGIN || ticket.pathname !== '/.netlify/functions/tmOutbound' || !ticket.searchParams.get('to') || !ticket.searchParams.get('eid')) throw new Error('Ticketmaster must retain its existing outbound function and event identity');
    } else if (event.partner === 'colosseumticket') {
      const destination = new URL(ticket.searchParams.get('to'));
      if (ticket.origin !== ORIGIN || ticket.pathname !== '/.netlify/functions/colosseumOutbound' || destination.protocol !== 'https:' || destination.hostname !== 'colosseumticket.cz' || destination.searchParams.has('a_box')) throw new Error('Colosseum affiliate identity must be added server-side');
    } else if (ticket.protocol !== 'https:' || !ticket.searchParams.get('a_box') || !['www.smsticket.cz', 'smsticket.cz'].includes(ticket.hostname)) throw new Error('Invalid partner destination or missing affiliate parameter');
    if (event.price && (!(event.price.minimum > 0) || event.price.currency !== 'CZK' || !/^\d{4}-\d{2}-\d{2}$/.test(event.price.checkedAt))) throw new Error('Price needs a positive verified amount, currency and date');
    for (const related of event.related || []) if (!/^\/(?:reviews|microguides)\/[a-z0-9-]+\/$/.test(related.url)) throw new Error('Related link must be an existing editorial route');
  }
  return events;
}

export function eventState(event, now = new Date()) {
  if (event.status !== 'scheduled' && event.status !== 'rescheduled') return event.status;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', dateStyle: 'short' }).format(now);
  return today > event.startDate.slice(0, 10) ? 'past' : event.status;
}

export function localizeEvent(event, lang = 'cs') {
  const copy = COPY[lang] || COPY.cs, translated = copy.events[event.id];
  if (!translated) throw new Error('Missing translated event copy');
  return { ...event, ...translated, introduction: lang === 'cs' ? event.introduction : translated.introduction, paragraphs: lang === 'cs' ? event.paragraphs : [translated.p1, translated.p2], image: { ...event.image, alt: translated.imageAlt },
    related: (event.related || []).map(item => ({ ...item, ...copy.related[item.url.split('/').filter(Boolean).at(-1)],
      label: item.url.startsWith('/reviews/') ? copy.labels.fromBlog : copy.labels.guide, cta: copy.labels.read,
      url: (lang === 'cs' ? '' : '/' + lang) + item.url })) };
}

export function buildEventSchema(event, { lang = 'cs', publicPage = false, now = new Date() } = {}) {
  event = localizeEvent(event, lang);
  const url = ORIGIN + detailPath(event.slug, lang);
  const schema = {
    '@context': 'https://schema.org', '@type': 'Event', '@id': url + '#event',
    name: [event.title, event.subtitle].filter(Boolean).join(' – '), description: event.introduction,
    startDate: event.startDate, eventStatus: 'https://schema.org/' + STATUS[event.status],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url, image: [event.image.url],
    location: { '@type': 'Place', name: event.venue.name, address: {
      '@type': 'PostalAddress', addressLocality: event.venue.city, addressCountry: event.venue.country,
      ...(event.venue.street ? { streetAddress: event.venue.street } : {})
    } },
    ...(event.organizer ? { organizer: { '@type': 'Organization', name: event.organizer } } : {}),
    ...(event.previousStartDate ? { previousStartDate: event.previousStartDate } : {})
  };
  // Frozen review data is not an up-to-date offer. No invented endDate,
  // InStock, free entry or seller-as-organizer in the public schema.
  if (publicPage && ['scheduled', 'rescheduled'].includes(eventState(event, now)) && event.price?.minimum > 0 && freshTimestamp(event.price.observedAt, now)) {
    schema.offers = { '@type': 'Offer', url: new URL(event.tickets, ORIGIN).href, price: event.price.minimum, priceCurrency: event.price.currency };
  }
  return schema;
}

const icons = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M7 17 17 7M7 7h10v10"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
export const dateText = (iso, lang = 'cs') => new Intl.DateTimeFormat(localeCode(lang), { timeZone: 'Europe/Prague', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const timeText = (iso, lang) => new Intl.DateTimeFormat(localeCode(lang), { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const dayText = (iso, lang) => new Intl.DateTimeFormat(localeCode(lang), { timeZone: 'Europe/Prague', weekday: 'long' }).format(new Date(iso)) + ' · ' + timeText(iso, lang);
const dateOnlyText = (date, lang) => dateText(date + 'T12:00:00Z', lang);

export function renderEventDetail(event, { now = new Date(), lang = 'cs' } = {}) {
  event = localizeEvent(event, lang);
  const e = escapeHtml, text = lang === 'cs' ? czechText : escapeHtml, partner = PARTNERS[event.partner];
  const labels = (COPY[lang] || COPY.cs).labels;
  const t = (key, values = {}) => Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll('{' + name + '}', replacement), labels[key]);
  const eventsHref = lang === 'cs' ? '/events' : '/' + lang + '/events/';
  const state = eventState(event, now);
  const purchasable = ['scheduled', 'rescheduled'].includes(state);
  const stateCopy = ['past', 'cancelled', 'postponed'].includes(state) ? t(state) : state === 'rescheduled' ? t('rescheduled', { date: dateText(event.previousStartDate, lang) }) : '';
  const price = event.price ? t('from', { price: new Intl.NumberFormat(localeCode(lang), { style: 'currency', currency: event.price.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(event.price.minimum) }) : t('unknownPrice');
  const termNote = event.termNote ? t('termNote', { date: dateText(event.startDate, lang), time: timeText(event.startDate, lang) }) : '';
  return `<a class="skip-link" href="#main">${text(t('skip'))}</a>
  <main id="main" class="detail-main"><div class="detail-container">
    <nav class="detail-breadcrumbs" aria-label="${e(t('breadcrumbs'))}"><a href="${lang === 'cs' ? '/' : '/' + lang + '/'}">AJSEE</a>${icon('chevron')}<a href="${eventsHref}">${text(t('events'))}</a>${icon('chevron')}<span aria-current="page">${text(event.category)}</span></nav>
    <header class="detail-heading"><p class="detail-eyebrow">${text(event.category)}<span aria-hidden="true">·</span>${text(event.venue.city)}</p>
      <h1 class="detail-title">${text(event.title)}${event.subtitle ? `<span class="detail-subtitle">${text(event.subtitle)}</span>` : ''}</h1>
      <p class="detail-lead">${text(event.introduction)}</p>
    </header>
    ${stateCopy ? `<p class="detail-status" role="status">${text(stateCopy)}</p>` : ''}
    <div class="detail-layout">
        <figure class="detail-artwork"><div class="detail-image-wrap"><img class="detail-image${event.image.fit === 'cover' ? ' detail-image--photo' : ''}" src="${e(event.image.url)}" alt="${e(event.image.alt)}" width="1200" height="800" decoding="async" loading="eager" fetchpriority="high"></div><figcaption>${text(t('source', { partner }))}</figcaption></figure>
      <aside class="detail-panel" aria-labelledby="ticket-heading"><h2 id="ticket-heading">${text(t(purchasable ? 'plan' : 'facts'))}</h2>
        <dl class="detail-facts"><div class="detail-fact">${icon('calendar')}<div><dt>${text(t('when'))}</dt><dd><time datetime="${e(event.startDate)}">${text(dateText(event.startDate, lang))}<span>${text(dayText(event.startDate, lang))}</span></time></dd></div></div>
          <div class="detail-fact">${icon('location')}<div><dt>${text(t('where'))}</dt><dd>${text(event.venue.name)}<span>${text([event.venue.street, event.venue.city].filter(Boolean).join(', '))}</span></dd></div></div></dl>
        <div class="detail-ticket">${purchasable ? `<p class="detail-price${event.price ? '' : ' detail-price--unknown'}">${text(price)}</p>${event.price ? `<p class="detail-price-note">${text(t('priceChecked', { date: dateOnlyText(event.price.checkedAt, lang) }))}</p>` : ''}
          <a class="detail-cta" href="${e(event.tickets)}" target="_blank" rel="sponsored noopener noreferrer" data-placement="event_detail" data-partner="${e(event.partner)}" data-event-id="${e(event.id)}" data-event-title="${e(event.title)}" data-event-city="${e(event.venue.city)}"><span>${text(t('tickets', { partner }))}</span>${icon('external')}</a>
          <p class="detail-purchase-note">${text(t('purchaseNote', { partner }))}</p>${termNote ? `<p class="detail-term-note">${text(termNote)}</p>` : ''}
          <p class="detail-affiliate-note">${text(t('affiliateNote'))}</p>` : `<a class="detail-text-link" href="${eventsHref}">${text(t('explore'))}${icon('arrow')}</a>`}</div>
      </aside>
      <section class="detail-editorial" aria-labelledby="about-event"><h2 id="about-event">${text(t(event.id.startsWith('colosseumticket-') ? 'about' : 'expect'))}</h2>${event.paragraphs.map(p => `<p>${text(p)}</p>`).join('')}
        <details class="detail-info"><summary>${text(t('practical'))}</summary><p>${text(event.practical)}</p></details>
      </section>
    </div>
    <section class="detail-related" aria-labelledby="related-title"><div class="detail-related-heading"><h2 id="related-title">${text(t('related'))}</h2><a class="detail-text-link" href="${eventsHref}">${text(t('allEvents'))}${icon('arrow')}</a></div>
      <div class="detail-related-grid">${(event.related || []).map(item => `<article class="detail-related-card"><span>${text(item.label)}</span><h3>${text(item.title)}</h3><p>${text(item.description)}</p><a class="detail-text-link" href="${e(item.url)}">${text(item.cta)}${icon('arrow')}</a></article>`).join('')}</div>
    </section>
  </div></main>`;
}
