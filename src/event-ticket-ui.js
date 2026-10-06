// One external-purchase icon for cards and modal links. Text remains localized.
export const EVENT_TICKET_ARROW = '<svg class="event-ticket-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

export function setEventTicketLabel(link, label) {
  link.textContent = label;
  link.insertAdjacentHTML('beforeend', EVENT_TICKET_ARROW);
}
