// /src/api/eventsApi.js

// Importuj přesně tento název
import { fetchEvents as fetchDemoEvents } from '../adapters/demo.js'; // univerzální demo zdroj

/**
 * Vrací všechny události z partnerů/slučuje, filtruje, mapuje.
 * @param {Object} param0
 * @param {string} param0.locale - Jazyk
 * @param {Object} param0.filters - Objekt s filtry (kategorie, datum atd.)
 */
export async function getAllEvents({ locale = 'cs', filters = {} } = {}) {
  let allEvents = [];

  // --- Získej eventy od všech zdrojů ---
  // Demo data (přidej další fetch pro reálné API podle potřeby)
  const demoEvents = await fetchDemoEvents({ locale, filters });
  allEvents = allEvents.concat(demoEvents);

  // --- Filtr kategorie ---
  if (filters.category) {
    allEvents = allEvents.filter(ev => ev.category === filters.category);
  }
  // --- Filtr data ---
  if (filters.date) {
    allEvents = allEvents.filter(ev => ev.datetime.startsWith(filters.date));
  }

  // --- Řazení dle data ---
  allEvents.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  return allEvents;
}
