import { guessCountryCodeFromCity, normalize } from '../city/canonical.js';
import { distanceKm, eventCoordinates, validCoordinates } from './coordinates.js';

// Country checks use the city AND the provider's point. In particular, Trnava
// and Žilina also name Czech municipalities. Anchors were checked against the
// public SMS Ticket venue addresses/coordinates on 2026-10-19. They never
// replace an event's coordinates or invent an address.
const CITY_AREAS = [
  ['Bratislava', 'SK', 48.1436469, 17.1099919, 30],
  ['Košice', 'SK', 48.7170867, 21.2542489, 25],
  ['Žiar nad Hronom', 'SK', 48.5861783, 18.8514806, 15],
  ['Žilina', 'SK', 49.2239931, 18.7411769, 25],
  ['Trnava', 'SK', 48.3933728, 17.5946014, 25],
  ['Warszawa', 'PL', 52.2249236, 20.9799922, 35],
  ['Warsaw', 'PL', 52.2249236, 20.9799922, 35],
  ['Bělehrad', 'RS', 44.810926, 20.461906, 35],
  ['Belgrade', 'RS', 44.810926, 20.461906, 35]
];
const areas = new Map(CITY_AREAS.map(([city, ...area]) => [normalize(city), area]));
const code = value => /^[A-Z]{2}$/.test(String(value || '').trim().toUpperCase())
  ? String(value).trim().toUpperCase() : '';

export function smsticketCountryCode(event = {}, fallback = 'CZ') {
  // The public feed currently omits country, but accept an explicit provider
  // field if it becomes available. Legacy normalized CZ is handled below.
  const supplied = code(event.place?.country_code || event.place?.country?.code ||
    event.place?.country || event.country_code);
  if (supplied) return supplied;
  const city = event.place?.city || event.location?.city || event.venue?.city || '';
  let point = eventCoordinates(event);
  const rawPoint = event.place?.wgs84;
  if (!point && validCoordinates(rawPoint?.latitude, rawPoint?.longitude)) {
    point = { lat: Number(rawPoint.latitude), lon: Number(rawPoint.longitude) };
  }
  const area = areas.get(normalize(city));
  if (area && point && distanceKm(point.lat, point.lon, area[1], area[2]) <= area[3]) return area[0];
  // This provider venue has no GPS. Match its verified identity, not every
  // similarly named event or an unverified coordinate.
  if (String(event.place?.id) === '8655' && normalize(city) === 'luxor' &&
      normalize(event.place?.company || event.venue?.name) === 'chramy v luxoru') return 'EG';
  const existing = code(event.location?.country || event.venue?.country || event.country);
  // Known non-CZ country metadata is retained. Never override a conflicting
  // point using only an ambiguous city name.
  if (existing && existing !== 'CZ') return existing;
  if (!area || !point) {
    const known = guessCountryCodeFromCity(city);
    if (known) return known;
  }
  return existing || code(fallback);
}

// Compatibility for cached snapshots as well as fresh imports. Commercial
// URLs, dates, prices and venue coordinates are preserved verbatim.
export function withSmsticketCountry(event = {}) {
  const country = smsticketCountryCode(event, '');
  if (!country || (event.country === country && event.location?.country === country &&
      event.venue?.country === country && event.venue?.address?.country === country)) return event;
  return { ...event, country,
    location: { ...event.location, country },
    venue: { ...event.venue, country, address: { ...event.venue?.address, country } }
  };
}
