import { parsePriceAmount } from './event-price.js';

const TEXT = {
  cs: { from:'Od {price}', priceUnknown:'Cena u prodejce', priceNote:'Orientační cena od prodejce. Konečnou cenu včetně případných poplatků ověřte před nákupem.', unknown:'Ověřit dostupnost', unknownNote:'Prodejce nám neposkytuje aktuální počet volných vstupenek. Dostupnost ověřte u něj.', plentiful:'Dostatek volných míst', limited:'Omezená dostupnost', last:'Poslední volná místa', sold_out:'Vyprodáno u prodejce', available:'Vstupenky dostupné', unavailable:'Momentálně nedostupné', offsale:'Prodej není otevřen', canceled:'Akce zrušena', postponed:'Akce odložena', remaining:'Zbývá přibližně {count} vstupenek u prodejce.', checked:'Aktualizováno: {time}', stockNote:'Stav platí pro nabídku tohoto prodejce. Dostupnost se může změnit.', saleNote:'Stav prodeje nepotvrzuje počet volných míst ani vyprodání.' },
  sk: { from:'Od {price}', priceUnknown:'Cena u predajcu', priceNote:'Orientačná cena od predajcu. Konečnú cenu vrátane prípadných poplatkov overte pred nákupom.', unknown:'Overiť dostupnosť', unknownNote:'Predajca nám neposkytuje aktuálny počet voľných vstupeniek. Dostupnosť overte u neho.', plentiful:'Dostatok voľných miest', limited:'Obmedzená dostupnosť', last:'Posledné voľné miesta', sold_out:'Vypredané u predajcu', available:'Vstupenky dostupné', unavailable:'Momentálne nedostupné', offsale:'Predaj nie je otvorený', canceled:'Podujatie zrušené', postponed:'Podujatie odložené', remaining:'Zostáva približne {count} vstupeniek u predajcu.', checked:'Aktualizované: {time}', stockNote:'Stav platí pre ponuku tohto predajcu. Dostupnosť sa môže zmeniť.', saleNote:'Stav predaja nepotvrdzuje počet voľných miest ani vypredanie.' },
  en: { from:'From {price}', priceUnknown:'Price at seller', priceNote:'Indicative seller price. Check the final price, including any fees, before purchase.', unknown:'Check availability', unknownNote:'The seller does not provide us with a current remaining ticket count. Check availability with them.', plentiful:'Plenty of tickets available', limited:'Limited availability', last:'Last few tickets', sold_out:'Sold out at this seller', available:'Tickets available', unavailable:'Currently unavailable', offsale:'Sale not open', canceled:'Event cancelled', postponed:'Event postponed', remaining:'Approximately {count} tickets remaining at this seller.', checked:'Updated: {time}', stockNote:'This status applies to this seller’s inventory. Availability may change.', saleNote:'Sale status does not confirm remaining ticket numbers or a sell-out.' },
  de: { from:'Ab {price}', priceUnknown:'Preis beim Anbieter', priceNote:'Unverbindliche Preisangabe des Anbieters. Prüfe den Endpreis einschließlich möglicher Gebühren vor dem Kauf.', unknown:'Verfügbarkeit prüfen', unknownNote:'Der Anbieter liefert uns keine aktuelle Anzahl verbleibender Tickets. Prüfe die Verfügbarkeit direkt beim Anbieter.', plentiful:'Viele Tickets verfügbar', limited:'Begrenzte Verfügbarkeit', last:'Letzte Tickets', sold_out:'Bei diesem Anbieter ausverkauft', available:'Tickets verfügbar', unavailable:'Derzeit nicht verfügbar', offsale:'Verkauf nicht geöffnet', canceled:'Veranstaltung abgesagt', postponed:'Veranstaltung verschoben', remaining:'Etwa {count} Tickets bei diesem Anbieter übrig.', checked:'Aktualisiert: {time}', stockNote:'Dieser Status gilt für das Angebot dieses Anbieters. Die Verfügbarkeit kann sich ändern.', saleNote:'Der Verkaufsstatus bestätigt weder die Anzahl freier Plätze noch einen Ausverkauf.' },
  pl: { from:'Od {price}', priceUnknown:'Cena u sprzedawcy', priceNote:'Orientacyjna cena sprzedawcy. Przed zakupem sprawdź cenę końcową wraz z ewentualnymi opłatami.', unknown:'Sprawdź dostępność', unknownNote:'Sprzedawca nie udostępnia nam aktualnej liczby pozostałych biletów. Sprawdź dostępność bezpośrednio u niego.', plentiful:'Dużo wolnych miejsc', limited:'Ograniczona dostępność', last:'Ostatnie wolne miejsca', sold_out:'Wyprzedane u sprzedawcy', available:'Bilety dostępne', unavailable:'Obecnie niedostępne', offsale:'Sprzedaż nie jest otwarta', canceled:'Wydarzenie odwołane', postponed:'Wydarzenie przełożone', remaining:'U sprzedawcy pozostało około {count} biletów.', checked:'Aktualizacja: {time}', stockNote:'Status dotyczy oferty tego sprzedawcy. Dostępność może się zmienić.', saleNote:'Status sprzedaży nie potwierdza liczby wolnych miejsc ani wyprzedania biletów.' },
  hu: { from:'{price}-tól', priceUnknown:'Ár a jegyértékesítőnél', priceNote:'A jegyértékesítő tájékoztató ára. Vásárlás előtt ellenőrizd a végső árat az esetleges díjakkal együtt.', unknown:'Elérhetőség ellenőrzése', unknownNote:'A jegyértékesítő nem ad aktuális adatot a fennmaradó jegyek számáról. Ellenőrizd az elérhetőséget nála.', plentiful:'Sok szabad hely', limited:'Korlátozott elérhetőség', last:'Utolsó szabad helyek', sold_out:'Elfogyott ennél az értékesítőnél', available:'Jegyek elérhetők', unavailable:'Jelenleg nem elérhető', offsale:'Az értékesítés nem elérhető', canceled:'Az eseményt törölték', postponed:'Az eseményt elhalasztották', remaining:'Körülbelül {count} jegy maradt ennél az értékesítőnél.', checked:'Frissítve: {time}', stockNote:'Az állapot ennek az értékesítőnek a kínálatára vonatkozik. Az elérhetőség változhat.', saleNote:'Az értékesítés állapota nem igazolja a szabad helyek számát vagy a jegyek elfogyását.' }
};
const language = locale => String(locale || 'cs').toLowerCase().split(/[-_]/)[0];
const words = locale => TEXT[language(locale)] || TEXT.en;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null);
const currency = value => /^[A-Z]{3}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : '';

// Never join multiple numbers into one price, or compare prices across currencies.
function textPrice(value, explicitCurrency) {
  const raw = String(value ?? '').replace(/[\u00a0\u202f]/g, ' ').trim();
  const aliases = { 'Kč':'CZK', '€':'EUR', '£':'GBP', '$':'USD', 'zł':'PLN', 'Ft':'HUF' };
  const symbol = Object.keys(aliases).find(x => raw.includes(x));
  const cur = currency(explicitCurrency) || (symbol && aliases[symbol]) || currency(raw.match(/\b[A-Z]{3}\b/)?.[0]);
  const stripped = raw.replace(/(?:CZK|EUR|GBP|USD|PLN|HUF|Kč|€|£|\$|zł|Ft)/g, '').replace(/^(?:od|from|ab)\s+/i, '').trim();
  const bounds = stripped.split(/\s*[–—-]\s*/);
  if (!cur || bounds.length > 2 || bounds.some(x => !/^\d[\d\s.,]*$/.test(x))) return null;
  const min = parsePriceAmount(bounds[0]);
  const max = bounds.length === 2 ? parsePriceAmount(bounds[1]) : null;
  if (min === null || (max !== null && max < min)) return null;
  return { min, max, currency:cur };
}

export function eventPriceLabels(event = {}, locale = 'cs') {
  const ranges = [];
  for (const raw of Array.isArray(event.priceRanges) ? event.priceRanges : []) {
    const min = amount(raw.min), max = amount(raw.max), cur = currency(raw.currency);
    if (min !== null && cur) ranges.push({min, max:max !== null && max >= min ? max : null, currency:cur});
  }
  if (!ranges.length) {
    for (const raw of [...(Array.isArray(event.priceOptions) ? event.priceOptions : []), ...(Array.isArray(event.ticketOptions) ? event.ticketOptions : []), {priceFrom:event.priceFrom, currency:event.currency}]) {
      const p = raw.amount !== undefined
        ? {min:amount(raw.amount), max:null, currency:currency(raw.currency)}
        : textPrice(raw.priceFrom, raw.currency);
      if (p && p.min !== null && p.currency) ranges.push(p);
    }
  }
  const grouped = new Map();
  for (const p of ranges) {
    const existing = grouped.get(p.currency);
    if (!existing) grouped.set(p.currency,{...p});
    else { existing.min = Math.min(existing.min,p.min); existing.max = existing.max !== null && p.max !== null ? Math.max(existing.max,p.max) : null; }
  }
  return [...grouped.values()].map(p => {
    const fmt = n => new Intl.NumberFormat(TEXT[language(locale)] ? locale : 'en', {style:'currency',currency:p.currency,minimumFractionDigits:Number.isInteger(n) ? 0 : 2,maximumFractionDigits:2}).format(n);
    return p.max !== null && p.max > p.min ? `${fmt(p.min)} – ${fmt(p.max)}` : words(locale).from.replace('{price}',fmt(p.min));
  });
}

// Reserved contract for an authorized inventory integration. Discovery sale status
// and the public SMS Ticket feed are NOT inventory evidence. No current adapter
// populates ticketInventory. Missing or stale evidence must stay neutral.
export function eventInventoryState(event = {}, now = Date.now()) {
  const sale = String(event.saleStatus || '');
  if (['canceled','postponed','offsale'].includes(sale)) return {status:sale,tone:'neutral'};
  const inv = event.ticketInventory;
  const age = Number(now) - Date.parse(inv?.observedAt || '');
  const valid = inv?.source === event.partner && inv?.scope === 'seller' && Number.isFinite(age) && age >= 0 && age <= 15 * 60 * 1000;
  const allowed = ['plentiful','limited','last','sold_out','available','unavailable'];
  if (!valid || !allowed.includes(inv.status)) return {status:'unknown',tone:'neutral'};
  const count = Number.isInteger(inv.remaining) && inv.remaining >= 0 ? inv.remaining : null;
  // Contradictory data must never produce a scarcity/sold-out claim.
  if ((count === 0 && ['plentiful','limited','last','available'].includes(inv.status)) || (count > 0 && ['sold_out','unavailable'].includes(inv.status))) return {status:'unknown',tone:'neutral'};
  return {status:inv.status,tone:({plentiful:'green',limited:'orange',last:'red'})[inv.status] || 'neutral',remaining:count,observedAt:inv.observedAt};
}

export function renderEventCommerce(event = {}, locale = 'cs', {detail = false, now = Date.now()} = {}) {
  const t = words(locale), prices = eventPriceLabels(event,locale), stock = eventInventoryState(event,now);
  const known = !!stock.observedAt;
  const countText = known && stock.remaining > 0 && stock.remaining < 100 ? t.remaining.replace('{count}',stock.remaining) : '';
  const updated = known ? t.checked.replace('{time}', new Date(stock.observedAt).toLocaleString(TEXT[language(locale)] ? locale : 'en')) : '';
  const explanation = known ? t.stockNote : stock.status === 'unknown' ? t.unknownNote : t.saleNote;
  return `<div class="event-commerce${detail ? ' event-commerce--detail' : ''}">
    <p class="event-price${prices.length ? '' : ' event-price--unknown'}">${esc(prices.join(' / ') || t.priceUnknown)}</p>
    ${detail && prices.length ? `<p class="event-commerce-note">${esc(t.priceNote)}</p>` : ''}
    <details class="event-stock" data-stock-tone="${stock.tone}" data-stock-status="${stock.status}">
      <summary title="${esc(explanation + (updated ? ' ' + updated : ''))}"><span class="event-stock-dot" aria-hidden="true"></span><span>${esc(t[stock.status])}</span><span aria-hidden="true">ⓘ</span></summary>
      <div class="event-stock-help">${esc(explanation)}${updated ? `<br>${esc(updated)}` : ''}</div>
    </details>
    ${detail && countText ? `<p class="event-stock-count">${esc(countText)}</p>` : ''}
  </div>`;
}

export function ensureEventCommerceStyles(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById('ajsee-event-commerce-css')) return;
  const style = doc.createElement('style');
  style.id = 'ajsee-event-commerce-css';
  style.textContent = `
    .event-commerce { margin: 12px 0; color: #0a3d62; min-width: 0; }
    .event-commerce .event-price { margin: 0 0 4px; font-size: 18px; font-weight: 750; line-height: 1.4; overflow-wrap: anywhere; }
    .event-commerce .event-price--unknown { font-size: 14px; font-weight: 500; color: #526071; }
    .event-commerce .event-stock { font-size: 13px; line-height: 1.5; color: #344054; }
    .event-commerce .event-stock summary { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; list-style: none; width: fit-content; max-width: 100%; border-radius: 6px; }
    .event-commerce .event-stock summary::-webkit-details-marker { display: none; }
    .event-commerce .event-stock summary:focus-visible { outline: 2px solid #007fac; outline-offset: 3px; }
    .event-commerce .event-stock-dot { width: 10px; height: 10px; flex: 0 0 10px; border-radius: 50%; background: #667085; }
    .event-commerce [data-stock-tone="green"] .event-stock-dot { background: #16803b; }
    .event-commerce [data-stock-tone="orange"] .event-stock-dot { background: #b85e00; }
    .event-commerce [data-stock-tone="red"] .event-stock-dot { background: #c62828; }
    .event-commerce [data-stock-status="sold_out"] summary { font-weight: 750; background: #f2f4f7; padding: 0 10px; }
    .event-commerce .event-stock-help { display: none; padding: 10px 12px; background: #f2f6fa; border: 1px solid #d8e4ee; border-radius: 8px; overflow-wrap: anywhere; }
    .event-commerce .event-stock[open] .event-stock-help { display: block; }
    .event-commerce .event-commerce-note { margin: 6px 0; font-size: 13px; line-height: 1.5; color: #526071; }
    .event-commerce .event-stock-count { margin: 6px 0; font-size: 14px; font-weight: 650; }
    .event-commerce--detail { padding: 16px; background: #f8fafc; border: 1px solid #d8e4ee; border-radius: 12px; }
  `;
  doc.head.appendChild(style);
}
