import { eventCitySuggestions, eventCityCountryCode } from '../../shared/city/event-city-catalog.js';
import { withRequestDeadline } from '../provider-request.js';

let catalog = null;
let pending = null;
let retryAfter = 0;

export async function loadEventCityCatalog() {
  if (catalog) return catalog;
  if (pending) return pending;
  if (Date.now() < retryAfter) return [];
  pending = (async () => {
    try {
      const payload = await withRequestDeadline(async signal => {
        const response = await fetch('/data/event-cities.json', { cache: 'default', signal });
        if (!response.ok) throw new Error('City catalog unavailable');
        return response.json();
      }, 2000);
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
