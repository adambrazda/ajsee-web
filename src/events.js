// /src/events.js

/**
 * Načte eventy z Ticketmaster backend endpointu (proxy).
 * 
 * @param {Object} options - Volby pro dotaz
 * @param {string} options.country - Kód země (např. 'CZ')
 * @param {string} options.locale - Kód jazyka (např. 'cs')
 * @returns {Promise<Array>} Pole eventů připravených pro výpis
 */
export async function fetchTicketmasterEvents({ country = 'CZ', locale = 'cs' } = {}) {
  // Pozn.: Měj v projektu backend proxy endpoint, např. /api/ticketmasterEvents
  const response = await fetch(`/api/ticketmasterEvents?country=${country}&locale=${locale}`);
  if (!response.ok) throw new Error('Chyba načítání událostí z API');
  const data = await response.json();

  // Transformace Ticketmaster struktury na jednoduchý formát
  if (data._embedded && data._embedded.events) {
    return data._embedded.events.map(event => ({
      id: event.id,
      title: event.name,
      description: event.info || event.pleaseNote || '',
      date: event.dates?.start?.localDate || '',
      time: event.dates?.start?.localTime || '',
      url: event.url,
      image: event.images?.[0]?.url || '',
      venue: event._embedded?.venues?.[0]?.name || '',
      city: event._embedded?.venues?.[0]?.city?.name || '',
      country: event._embedded?.venues?.[0]?.country?.name || '',
      category: event.classifications?.[0]?.segment?.name || '',
      genre: event.classifications?.[0]?.genre?.name || '',
      priceRanges: event.priceRanges || [],
      ticketsUrl: event.url, // můžeš použít jiné pole pokud je jiné
      source: 'ticketmaster'
    }));
  }
  return [];
}

/**
 * Demo badge (zůstává z původního kódu, volitelné)
 */
export function showDemoBadge(isDemo) {
  let badge = document.getElementById('demo-badge');
  if (isDemo) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'demo-badge';
      badge.innerHTML = 'Testovací provoz: <b>Demo akce</b>';
      badge.style = 'position:fixed;bottom:18px;left:18px;z-index:99;background:#ffecc3;color:#333;padding:8px 18px;border-radius:10px;box-shadow:0 2px 8px #0001;font-size:1rem;';
      document.body.appendChild(badge);
    } else {
      badge.style.display = 'block';
    }
  } else if (badge) {
    badge.style.display = 'none';
  }
}
