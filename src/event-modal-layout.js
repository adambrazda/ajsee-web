const layouts = new WeakMap();

function ensureLayoutStyles(doc) {
  if (doc.getElementById('ajsee-event-modal-premium-layout-css')) return;
  const style = doc.createElement('style');
  style.id = 'ajsee-event-modal-premium-layout-css';
  style.textContent = `
    .event-modal { padding: 24px; align-items: center; }
    .event-modal .event-modal-content { display: flex; flex-direction: column; box-sizing: border-box; width: min(960px, 100%); max-width: 960px; max-height: calc(100dvh - 48px); min-height: 0; padding: 0; gap: 0; overflow: hidden; border: 1px solid var(--aj-event-border); border-radius: 22px; background: var(--aj-event-surface); color: var(--aj-event-text); margin: auto 0; }
    .event-modal .modal-header { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; padding: 12px 20px 0; }
    .event-modal .modal-brand { font-size: 18px; font-weight: 750; letter-spacing: 2px; color: var(--aj-event-text); }
    .event-modal .event-modal-close { position: static; width: 44px; height: 44px; margin: 0; background: var(--aj-event-soft); color: var(--aj-event-text); box-shadow: none; flex: 0 0 44px; }
    .event-modal .event-modal-close svg { stroke: currentColor; }
    .event-modal .event-modal-close:focus-visible { outline: 2px solid var(--aj-event-cta); outline-offset: 3px; }
    .event-modal .modal-body { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 28px; min-height: 0; padding: 16px 24px 24px; overflow: auto; overscroll-behavior: contain; }
    .event-modal .modal-visual-column { position: relative; min-width: 0; }
    .event-modal #modalImage { display: block; width: 100%; height: clamp(200px, 26vw, 300px); min-height: 0; max-height: none; margin: 0 0 14px; object-fit: contain; background: var(--aj-event-soft); border-radius: 12px; }
    .event-modal .modal-provider-badge { position: absolute; top: 8px; inset-inline-start: 8px; margin: 0; padding: 4px 8px; max-width: calc(100% - 16px); border-radius: 6px; background: var(--aj-event-surface); color: var(--aj-event-muted); border: 1px solid var(--aj-event-border); font-size: 11px; font-weight: 600; pointer-events: none; }
    .event-modal .modal-details { min-width: 0; padding: 0; overflow: visible; }
    .event-modal .modal-title { margin: 0 0 16px; font-size: clamp(26px, 2.5vw, 32px); line-height: 1.15; letter-spacing: -.025em; color: var(--aj-event-text); overflow-wrap: anywhere; }
    .event-modal .modal-category { margin: 0 0 6px; color: var(--aj-event-muted); font-size: 11px; font-weight: 600; font-style: normal; text-transform: uppercase; letter-spacing: .06em; }
    .event-modal .modal-meta { display: grid; gap: 8px; margin: 0 0 18px; color: var(--aj-event-muted); font-size: 14px; font-weight: 400; line-height: 1.5; }
    .event-modal .modal-meta-row { display: flex; align-items: flex-start; gap: 8px; }
    .event-modal .modal-meta-row svg { flex: 0 0 17px; margin-top: 2px; }
    .event-modal .modal-description { margin: 0; padding-top: 16px; border-top: 1px solid var(--aj-event-border); color: var(--aj-event-muted); font-size: 14px; line-height: 1.6; }
    .event-modal .ajsee-modal-long-description-v3:not(.is-expanded) { -webkit-line-clamp: 5; max-height: 9.1em; }
    .event-modal .ajsee-modal-readmore-v3 { min-height: 44px; margin: 0 0 8px; color: var(--aj-event-cta); font-weight: 600; }
    .event-modal .modal-purchase { min-width: 0; }
    .event-modal .modal-purchase .event-commerce--detail .event-price { font-size: 23px; }
    .event-modal .modal-purchase .event-commerce--detail .event-price--unknown { font-size: 14px; }
    .event-modal .modal-purchase .modal-ticket-cta { display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; margin: 0; padding: 12px 14px; font-size: 15px; line-height: 1.4; white-space: normal; overflow-wrap: anywhere; }
    .event-modal .modal-purchase .modal-ticket-cta[hidden], .event-modal .modal-purchase .modal-ticket-options[hidden], .event-modal .modal-provider-badge[hidden] { display: none; }
    .event-modal .modal-purchase .modal-ticket-options { margin: 0; gap: 8px; }
    .event-modal .modal-purchase .modal-seller-note { margin: 8px 0 0; color: var(--aj-event-muted); text-align: center; font-size: 11px; font-weight: 400; line-height: 1.5; }
    .event-modal .modal-calendar-picker { display: block; margin-top: 14px; border-top: 1px solid var(--aj-event-border); padding-top: 8px; }
    .event-modal .modal-calendar-picker > summary { display: flex; align-items: center; gap: 8px; min-height: 44px; list-style: none; cursor: pointer; color: var(--aj-event-muted); font-size: 13px; }
    .event-modal .modal-calendar-picker > summary::-webkit-details-marker { display: none; }
    .event-modal .modal-calendar-picker > summary::after { content: '⌄'; margin-inline-start: auto; font-size: 16px; }
    .event-modal .modal-calendar-picker .calendar-label { margin: 0; color: inherit; font-size: inherit; font-weight: 500; }
    .event-modal .modal-calendar-picker .calendar-buttons { margin: 4px 0 0; }
    .event-modal .modal-calendar-picker:not([open]) .calendar-buttons { display: none; }
    .event-modal .modal-calendar-picker .calendar-btns-wrap { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
    .event-modal .modal-calendar-picker .calendar-btn { flex: 1 1 90px; width: auto; min-height: 44px; margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--aj-event-soft); border-color: var(--aj-event-border); color: var(--aj-event-text); font-size: 12px; font-weight: 500; }
    @media (min-width: 600px) and (max-width: 1023px) {
      .event-modal { padding: 16px; }
      .event-modal .event-modal-content { max-height: calc(100dvh - 32px); }
      .event-modal .modal-body { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 20px; padding: 16px 20px 20px; }
      .event-modal #modalImage { height: 240px; margin-bottom: 0; }
      .event-modal .modal-title { font-size: 25px; }
    }
    .event-modal[data-layout="tablet"] .modal-purchase, .event-modal[data-layout="mobile"] .modal-purchase { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .85fr); gap: 0 16px; flex: 0 0 auto; padding: 12px 20px max(12px, env(safe-area-inset-bottom)); border-top: 1px solid var(--aj-event-border); background: var(--aj-event-surface); }
    .event-modal[data-layout="tablet"] #modalCommerce, .event-modal[data-layout="mobile"] #modalCommerce { grid-column: 1; grid-row: 1; }
    .event-modal[data-layout="tablet"] #modalTicketsLink, .event-modal[data-layout="mobile"] #modalTicketsLink { grid-column: 2; grid-row: 1; align-self: center; }
    .event-modal[data-layout="tablet"] #modalTicketOptions, .event-modal[data-layout="mobile"] #modalTicketOptions { grid-column: 1 / -1; }
    .event-modal[data-layout="tablet"] .modal-seller-note, .event-modal[data-layout="mobile"] .modal-seller-note { grid-column: 1 / -1; }
    @media (max-width: 599px) {
      .event-modal { padding: 0; align-items: stretch; overflow: hidden; }
      .event-modal .event-modal-content { width: 100%; max-width: none; height: 100dvh; max-height: 100dvh; border: 0; border-radius: 0; margin: 0; }
      .event-modal .modal-header { padding: max(10px, env(safe-area-inset-top)) 16px 8px; border-bottom: 1px solid var(--aj-event-border); }
      .event-modal .modal-body { display: flex; flex-direction: column; flex: 1 1 auto; gap: 14px; padding: 16px; }
      .event-modal .modal-title { font-size: 25px; margin-bottom: 12px; }
      .event-modal .modal-meta { margin-bottom: 0; font-size: 13px; }
      .event-modal #modalImage { height: 160px; margin: 0; }
      .event-modal .modal-description { padding-top: 14px; font-size: 13px; }
      .event-modal[data-layout="mobile"] .modal-purchase { padding-inline: 16px; gap: 0 12px; }
      .event-modal[data-layout="mobile"] .event-commerce--detail { grid-template-columns: minmax(0, 1fr); gap: 0; margin: 0; }
      .event-modal[data-layout="mobile"] .modal-purchase .event-price { font-size: 21px; }
      .event-modal[data-layout="mobile"] .modal-purchase .event-price--unknown { font-size: 13px; }
      .event-modal[data-layout="mobile"] .event-stock-count { font-size: 11px; margin-bottom: 0; }
      .event-modal[data-layout="mobile"] .modal-seller-note { text-align: start; }
    }
    @media (max-height: 500px) { .event-modal[data-layout="mobile"] .modal-purchase, .event-modal[data-layout="tablet"] .modal-purchase { max-height: 50dvh; overflow: auto; } }
  `;
  doc.head.appendChild(style);
}

export function ensurePremiumModalLayout(modal) {
  const doc = modal.ownerDocument;
  const content = modal.querySelector('.event-modal-content');
  const image = modal.querySelector('#modalImage');
  const details = modal.querySelector('.modal-details');
  if (!content || !image || !details) return null;
  if (!layouts.has(modal)) {
    const header = doc.createElement('div');
    header.className = 'modal-header';
    const brand = doc.createElement('span');
    brand.className = 'modal-brand';
    brand.textContent = 'AJSEE';
    header.append(brand, modal.querySelector('#modalClose'));
    const body = doc.createElement('div');
    body.className = 'modal-body';
    const visual = doc.createElement('div');
    visual.className = 'modal-visual-column';
    const provider = doc.createElement('p');
    provider.className = 'modal-provider-badge';
    provider.hidden = true;
    visual.append(image, provider);
    body.append(visual, details);
    content.append(header, body);

    const intro = doc.createElement('div');
    intro.className = 'modal-intro';
    intro.append(details.querySelector('.modal-category'), modal.querySelector('#modalTitle'), details.querySelector('.modal-meta'));
    details.prepend(intro);
    const meta = intro.querySelector('.modal-meta');
    const date = meta.querySelector('#modalDate');
    const location = meta.querySelector('#modalLocation');
    if (date && location) {
      const dateRow = doc.createElement('span');
      dateRow.className = 'modal-meta-row';
      dateRow.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';
      dateRow.append(date);
      const locationRow = doc.createElement('span');
      locationRow.className = 'modal-meta-row';
      locationRow.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
      locationRow.append(location);
      meta.replaceChildren(dateRow, locationRow);
    }

    const calendar = details.querySelector('.calendar-buttons');
    if (calendar) {
      const picker = doc.createElement('details');
      picker.className = 'modal-calendar-picker';
      const summary = doc.createElement('summary');
      const label = calendar.querySelector('.calendar-label');
      if (label) summary.append(label);
      calendar.before(picker);
      picker.append(summary, calendar);
    }

    const commerce = doc.createElement('div');
    commerce.id = 'modalCommerce';
    const purchase = doc.createElement('section');
    purchase.className = 'modal-purchase';
    purchase.append(commerce, modal.querySelector('#modalTicketOptions'), modal.querySelector('#modalTicketsLink'), modal.querySelector('#modalSellerNote'));
    const mobile = doc.defaultView.matchMedia?.('(max-width: 599px)');
    const tablet = doc.defaultView.matchMedia?.('(min-width: 600px) and (max-width: 1023px)');
    const place = () => {
      if (mobile?.matches || tablet?.matches) {
        modal.dataset.layout = mobile?.matches ? 'mobile' : 'tablet';
        content.append(purchase);
        if (mobile?.matches) body.prepend(intro);
        else details.prepend(intro);
      } else {
        modal.dataset.layout = 'desktop';
        visual.append(purchase);
        details.prepend(intro);
      }
    };
    mobile?.addEventListener?.('change', place);
    tablet?.addEventListener?.('change', place);
    layouts.set(modal, {place, commerce});
  }
  ensureLayoutStyles(doc);
  layouts.get(modal).place();
  return layouts.get(modal).commerce;
}
