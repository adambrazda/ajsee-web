import { canonForInputCity, labelForCanon, normalize } from './canonical.js';

const key = (value) => normalize(value).replace(/\s+/g, ' ').trim();
const scopeSet = (scope) => new Set((Array.isArray(scope) ? scope : String(scope || '').split(','))
  .map(value => String(value).trim().toUpperCase()).filter(Boolean));

// Only city names and seller-market identity enter this small public index.
// Ticket URLs, descriptions, inventory and venue coordinates stay in the feeds.
export function buildEventCityCatalog(sources = []) {
  const cities = new Map();
  for (const { events = [], marketCountryCode = '' } of sources) {
    for (const event of events) {
      const raw = String(event?.location?.city || event?.venue?.city || '').trim();
      const countryCode = String(event?.location?.country || event?.venue?.country ||
        marketCountryCode).trim().toUpperCase();
      if (!raw || !/^[A-Z]{2}$/.test(countryCode)) continue;
      const canonical = canonForInputCity(raw) || raw;
      const id = `${key(canonical)}|${countryCode}`;
      const city = cities.get(id) || { city: raw, countryCode, aliases: new Set() };
      // Canonical city labels collapse supported districts, not arbitrary hyphens.
      city.city = labelForCanon(canonical, 'cs') || raw;
      city.aliases.add(raw);
      city.aliases.add(canonical);
      cities.set(id, city);
    }
  }
  return [...cities.values()].map(city => ({
    city: city.city, countryCode: city.countryCode,
    aliases: [...city.aliases].sort((a, b) => a.localeCompare(b, 'cs'))
  })).sort((a, b) => a.city.localeCompare(b.city, 'cs') || a.countryCode.localeCompare(b.countryCode));
}

export function eventCitySuggestions(catalog = [], query = '', { locale = 'cs', countryCodes = [], size = 32 } = {}) {
  const q = key(query);
  if (q.length < 2) return [];
  const allowed = scopeSet(countryCodes);
  return catalog.filter(city => !allowed.size || allowed.has(city.countryCode)).map(city => {
    const label = labelForCanon(canonForInputCity(city.city), locale) || city.city;
    const variants = [label, city.city, ...(city.aliases || [])].map(key);
    const score = Math.max(...variants.map(value => value === q ? 3000 : value.startsWith(q) ? 2000 : value.includes(q) ? 1000 : 0));
    return { type: 'city', kind: 'city', isCountry: false, city: label, label, name: label,
      countryCode: city.countryCode, aliases: city.aliases, score, source: 'event-feed' };
  }).filter(city => city.score > 0).sort((a, b) => b.score - a.score || a.city.localeCompare(b.city, locale))
    .slice(0, size);
}

export function eventCityCountryCode(catalog = [], query = '') {
  const q = key(canonForInputCity(query));
  if (!q) return '';
  const countries = new Set(catalog.filter(city =>
    [city.city, ...(city.aliases || [])].some(label => key(canonForInputCity(label)) === q)
  ).map(city => city.countryCode));
  return countries.size === 1 ? [...countries][0] : '';
}
