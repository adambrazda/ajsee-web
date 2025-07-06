// /src/adapters/demo.js
import demoEvents from '../content/events-demo.json';

// Exportuj tuto funkci přesně pod tímto názvem
export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  // (Filtry zatím ignorujeme)
  return (demoEvents.events || []).map(event => ({
    id: `demo-${event.title}-${event.date}`,
    title: { [locale]: event.title },
    description: { [locale]: event.description || "" },
    category: event.category || "other",
    datetime: event.date,
    location: {
      city: event.city || event.location,
      country: event.country || "CZ"
    },
    image: event.image || "",
    partner: "demo",
    url: event.url || "",
    priceFrom: event.priceFrom || null,
    promo: event.promo || null
  }));
}
