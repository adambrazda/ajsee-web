// /src/api/eventsApi.js

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';

// Pozor – pokud máš více produkčních domén, uprav includes("ajsee.cz") např. na includes("ajsee")
const isProduction = window.location.hostname.includes("ajsee.cz");

/**
 * Vrací všechny události z partnerů/slučuje, filtruje, mapuje.
 * @param {Object} param0
 * @param {string} param0.locale - Jazyk
 * @param {Object} param0.filters - Objekt s filtry (kategorie, datum atd.)
 */
export async function getAllEvents({ locale = 'cs', filters = {} } = {}) {
  let allEvents = [];

  // --- Získej eventy ---
  // V produkci jen Ticketmaster, v dev i demo (lazy import)
  const ticketmasterEvents = await fetchTicketmasterEvents({ locale, filters });
  allEvents = allEvents.concat(ticketmasterEvents);

  if (!isProduction) {
    // Importuj demo pouze při vývoji, ať se nenačítá zbytečně na produkci
    const { fetchEvents: fetchDemoEvents } = await import('../adapters/demo.js');
    const demoEvents = await fetchDemoEvents({ locale, filters });
    allEvents = allEvents.concat(demoEvents);
  }

  // --- Filtr kategorie ---
  if (filters.category && filters.category !== 'all') {
    allEvents = allEvents.filter(ev =>
      ev.category?.toLowerCase() === filters.category.toLowerCase()
    );
  }

  // --- Filtr data ---
  if (filters.date) {
    allEvents = allEvents.filter(ev =>
      ev.datetime?.startsWith(filters.date)
    );
  }

  // --- Řazení dle data ---
  allEvents.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  return allEvents;
}
