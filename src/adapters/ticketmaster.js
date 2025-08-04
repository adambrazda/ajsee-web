// /src/adapters/ticketmaster.js

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  // Nastav parametry podle filtru, případně rozšiř dál
  const countryCode = filters.countryCode || 'CZ';
  const keyword = filters.keyword || '';
  const API_KEY = 'H7xX6YI5hvXf7agA7ACEjg9aT6iAFmwz';
  // VOLAT NA LOKÁLNÍ BACKEND, NE PŘÍMO NA TICKETMASTER!
const url = `/.netlify/functions/ticketmasterEvents?countryCode=${countryCode}&locale=${locale}&keyword=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data._embedded || !data._embedded.events) return [];
    return data._embedded.events.map(ev => ({
      id: `ticketmaster-${ev.id}`,
      title: { [locale]: ev.name },
      description: { [locale]: ev.info || ev.pleaseNote || '' },
      category: ev.classifications?.[0]?.segment?.name?.toLowerCase() || 'other',
      datetime: ev.dates?.start?.dateTime || ev.dates?.start?.localDate || '',
      location: {
        city: ev._embedded?.venues?.[0]?.city?.name || '',
        country: ev._embedded?.venues?.[0]?.country?.countryCode || ''
      },
      image: ev.images?.[0]?.url || "",
      partner: "ticketmaster",
      url: ev.url || "",
      priceFrom: null,
      promo: null,
      tickets: ev.url || ""
    }));
  } catch (e) {
    console.error('Chyba načítání Ticketmaster událostí:', e);
    return [];
  }
}
