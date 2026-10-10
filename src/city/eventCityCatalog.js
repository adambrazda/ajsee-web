import { eventCitySuggestions, eventCityCountryCode } from '../../shared/city/event-city-catalog.js';

let catalog = null;
let pending = null;
let retryAfter = 0;

export async function loadEventCityCatalog() {
  if (catalog) return catalog;
  if (pending) return pending;
  if (Date.now() < retryAfter) return [];
  pending = (async () => {
    try {
      const response = await fetch('/data/event-cities.json', { cache: 'default', signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error('City catalog unavailable');
      const payload = await response.json();
      if (!Array.isArray(payload.items)) throw new Error('Invalid city catalog');
      catalog = payload.items.filter(item => item && typeof item.city === 'string' && /^[A-Z]{2}$/.test(item.countryCode));
      return catalog;
    } catch {
      retryAfter = Date.now() + 1000;
      return [];
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export const getEventCitySuggestions = (query, options) => eventCitySuggestions(catalog || [], query, options);
export const countryCodeForEventCity = (query) => eventCityCountryCode(catalog || [], query);
