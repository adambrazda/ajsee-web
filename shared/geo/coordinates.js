function coordinate(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return NaN;
  return Number(value);
}

export function validCoordinates(lat, lon) {
  const latitude = coordinate(lat), longitude = coordinate(lon);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  if (!validCoordinates(lat1, lon1) || !validCoordinates(lat2, lon2)) return Infinity;
  const radians = value => Number(value) * Math.PI / 180;
  const dLat = radians(Number(lat2) - Number(lat1));
  const dLon = radians(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) *
    Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  const bounded = Math.max(0, Math.min(1, a));
  return 6371 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export function eventCoordinates(event = {}) {
  // Never combine half a point from different provider objects.
  for (const point of [event.location, event.venue?.location, event]) {
    const lat = point?.lat ?? point?.latitude, lon = point?.lon ?? point?.longitude;
    if (validCoordinates(lat, lon)) return { lat: Number(lat), lon: Number(lon) };
  }
  return null;
}
