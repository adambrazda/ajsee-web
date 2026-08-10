function text(value) {
  return String(value ?? '').trim();
}

function comparable(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '');
}

export function resolveEventLocation(event = {}) {
  const location =
    event?.location && typeof event.location === 'object'
      ? event.location
      : {};

  const venue =
    event?.venue && typeof event.venue === 'object'
      ? event.venue
      : {};

  const place =
    event?.place && typeof event.place === 'object'
      ? event.place
      : {};

  const locationString =
    typeof event?.location === 'string'
      ? text(event.location)
      : '';

  const venueName = text(
    venue?.name ||
    place?.company ||
    event?.venueName ||
    place?.name ||
    ''
  );

  const city = text(
    location?.city ||
    venue?.city ||
    place?.city ||
    locationString ||
    ''
  );

  const actualCity = text(
    location?.actualCity ||
    venue?.city ||
    place?.city ||
    city
  );

  const country = text(
    location?.country ||
    venue?.country ||
    place?.country ||
    event?.countryCode ||
    ''
  );

  return {
    venueName,
    city,
    actualCity,
    country
  };
}

export function formatEventVenueLine(event = {}) {
  const {
    venueName,
    city
  } = resolveEventLocation(event);

  if (!venueName) return city;
  if (!city) return venueName;

  if (comparable(venueName) === comparable(city)) {
    return venueName;
  }

  return `${venueName} · ${city}`;
}
export function formatEventCalendarLocation(event = {}) {
  const {
    venueName,
    city,
    actualCity,
    country
  } = resolveEventLocation(event);

  const rawParts = [
    venueName,
    actualCity || city,
    country
  ].filter(Boolean);

  const seen = new Set();

  return rawParts
    .filter((part) => {
      const key = comparable(part);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(', ');
}