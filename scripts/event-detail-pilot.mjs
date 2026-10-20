// Explicit, reviewable occurrences survive a missing or incomplete feed refresh.
// Feed absence is never a cancellation signal. Publishing is a separate step.
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
    } else if (ticket.protocol !== 'https:' || !ticket.searchParams.get('a_box') || !{
      colosseumticket: ['colosseumticket.cz'], smsticket: ['www.smsticket.cz', 'smsticket.cz']
    }[event.partner].includes(ticket.hostname)) throw new Error('Invalid partner destination or missing affiliate parameter');
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

export function buildEventSchema(event) {
  const url = ORIGIN + '/udalosti/' + event.slug + '/';
  const schema = {
    '@context': 'https://schema.org', '@type': 'Event', '@id': url + '#event',
    name: [event.title, event.subtitle].filter(Boolean).join(' – '), description: event.introduction,
    startDate: event.startDate, eventStatus: 'https://schema.org/' + STATUS[event.status],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'cs', url, image: [event.image.url],
    location: { '@type': 'Place', name: event.venue.name, address: {
      '@type': 'PostalAddress', addressLocality: event.venue.city, addressCountry: event.venue.country,
      ...(event.venue.street ? { streetAddress: event.venue.street } : {})
    } },
    ...(event.organizer ? { organizer: { '@type': 'Organization', name: event.organizer } } : {}),
    ...(event.previousStartDate ? { previousStartDate: event.previousStartDate } : {})
  };
  // Frozen review data is not an up-to-date offer. No invented endDate,
  // InStock, free entry or seller-as-organizer in the public schema.
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
const dateText = iso => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const dayText = iso => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(' ', ' · ');
const dateOnlyText = date => dateText(date + 'T12:00:00+01:00');

export function renderEventDetail(event, { now = new Date() } = {}) {
  const e = escapeHtml, text = czechText, partner = PARTNERS[event.partner];
  const state = eventState(event, now);
  const purchasable = ['scheduled', 'rescheduled'].includes(state);
  const stateCopy = {
    past: 'Tento termín už je v minulosti. Další akce najdete v našem přehledu událostí.',
    cancelled: 'Tato akce byla zrušena. Informace ke vstupenkám poskytne prodejce.',
    postponed: 'Akce byla odložena. Nový termín zatím není potvrzen.'
  }[state];
  const price = event.price ? `Od ${new Intl.NumberFormat('cs-CZ').format(event.price.minimum)} Kč` : 'Cenu ověříte u prodejce';
  return `<a class="skip-link" href="#main">Přejít na obsah</a>
  <main id="main" class="detail-main"><div class="detail-container">
    <nav class="detail-breadcrumbs" aria-label="Drobečková navigace"><a href="/">AJSEE</a>${icon('chevron')}<a href="/events">Události</a>${icon('chevron')}<span aria-current="page">${text(event.category)}</span></nav>
    <header class="detail-heading"><p class="detail-eyebrow">${text(event.category)}<span aria-hidden="true">·</span>${text(event.venue.city)}</p>
      <h1 class="detail-title">${text(event.title)}${event.subtitle ? `<span class="detail-subtitle">${text(event.subtitle)}</span>` : ''}</h1>
      <p class="detail-lead">${text(event.introduction)}</p>
    </header>
    ${stateCopy ? `<p class="detail-status" role="status">${text(stateCopy)}</p>` : ''}
    <div class="detail-layout">
        <figure class="detail-artwork"><div class="detail-image-wrap"><img class="detail-image${event.image.fit === 'cover' ? ' detail-image--photo' : ''}" src="${e(event.image.url)}" alt="${e(event.image.alt)}" width="1200" height="800" decoding="async" loading="eager" fetchpriority="high"></div><figcaption>${text(event.image.credit)}</figcaption></figure>
      <aside class="detail-panel" aria-labelledby="ticket-heading"><h2 id="ticket-heading">${purchasable ? 'Naplánujte si návštěvu' : 'Informace o termínu'}</h2>
        <dl class="detail-facts"><div class="detail-fact">${icon('calendar')}<div><dt>Kdy</dt><dd><time datetime="${e(event.startDate)}">${text(dateText(event.startDate))}<span>${text(dayText(event.startDate))}</span></time></dd></div></div>
          <div class="detail-fact">${icon('location')}<div><dt>Kde</dt><dd>${text(event.venue.name)}<span>${text([event.venue.street, event.venue.city].filter(Boolean).join(', '))}</span></dd></div></div></dl>
        <div class="detail-ticket">${purchasable ? `<p class="detail-price${event.price ? '' : ' detail-price--unknown'}">${text(price)}</p>${event.price ? `<p class="detail-price-note">Cena podle nabídky z ${text(dateOnlyText(event.price.checkedAt))}.</p>` : ''}
          <a class="detail-cta" href="${e(event.tickets)}" target="_blank" rel="sponsored noopener noreferrer" data-placement="event_detail" data-partner="${e(event.partner)}" data-event-id="${e(event.id)}" data-event-title="${e(event.title)}" data-event-city="${e(event.venue.city)}"><span>Vstupenky u ${text(partner)}</span>${icon('external')}</a>
          <p class="detail-purchase-note">Aktuální nabídku si prohlédnete a vstupenky koupíte přímo u ${text(partner)}.</p>${event.termNote ? `<p class="detail-term-note">${text(event.termNote)}</p>` : ''}
          <p class="detail-affiliate-note">Při nákupu přes náš odkaz může AJSEE získat provizi.</p>` : `<a class="detail-text-link" href="/events">Prozkoumat další události${icon('arrow')}</a>`}</div>
      </aside>
      <section class="detail-editorial" aria-labelledby="about-event"><h2 id="about-event">${event.category === 'Muzikál' ? 'O představení' : 'Na co se těšit'}</h2>${event.paragraphs.map(p => `<p>${text(p)}</p>`).join('')}
        <details class="detail-info"><summary>Než vyrazíte</summary><p>${text(event.practical)}</p></details>
      </section>
    </div>
    <section class="detail-related" aria-labelledby="related-title"><div class="detail-related-heading"><h2 id="related-title">Mohlo by se vám hodit</h2><a class="detail-text-link" href="/events">Všechny události${icon('arrow')}</a></div>
      <div class="detail-related-grid">${(event.related || []).map(item => `<article class="detail-related-card"><span>${text(item.label)}</span><h3>${text(item.title)}</h3><p>${text(item.description)}</p><a class="detail-text-link" href="${e(item.url)}">${text(item.cta)}${icon('arrow')}</a></article>`).join('')}</div>
    </section>
  </div></main>`;
}
