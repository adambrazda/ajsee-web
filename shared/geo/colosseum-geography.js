import { COLOSSEUM_VENUE_LOCATIONS } from './colosseum-venue-locations.js';
import { eventCoordinates } from './coordinates.js';
import { canonForInputCity } from '../city/canonical.js';

const fold = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}/]+/gu, ' ').trim();

export function colosseumVenueKey({ city, venue, street } = {}) {
  return [canonForInputCity(city) || city, venue, street].map(fold).join('|');
}

const venues = new Map();
for (const venue of COLOSSEUM_VENUE_LOCATIONS) {
  for (const city of [venue.city, ...(venue.cityAliases || [])]) {
    for (const street of [venue.street, ...(venue.streetAliases || [])]) {
      venues.set(colosseumVenueKey({ ...venue, city, street }), venue);
    }
  }
}

export function withColosseumGeography(event = {}) {
  if (eventCoordinates(event)) return event;
  const country = String(event.location?.country || event.venue?.country || '').trim().toUpperCase();
  if (country && country !== 'CZ') return event;
  const match = venues.get(colosseumVenueKey({
    city: event.location?.city || event.venue?.city,
    venue: event.venue?.name,
    street: event.venue?.address?.street
  }));
  if (!match) return event;
  return {
    ...event,
    location: { ...event.location, country: 'CZ', lat: match.lat, lon: match.lon },
    venue: { ...event.venue, country: 'CZ', location: { ...event.venue?.location, lat: match.lat, lon: match.lon } },
    sourceMeta: { ...event.sourceMeta, geography: {
      source: match.source || 'ruian-address', precision: match.precision || 'address', verifiedAt: match.verifiedAt,
      matchedAddress: match.matchedAddress, verificationUrl: match.verificationUrl
    } }
  };
}
