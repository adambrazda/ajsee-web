// Canonical event identity is optional and shared by all review translations.
// Preserve the existing generic Event output for legacy reviews.
function clean(value) {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function buildReviewEventSubject({
  review = {}, subjectDate, subjectName, eventVenue, eventCity, eventCountry
}) {
  const fallbackLocation = eventVenue || eventCity
    ? {
        '@type': 'Place',
        name: eventVenue || undefined,
        address: [eventCity, eventCountry].filter(Boolean).join(', ') || undefined
      }
    : undefined;
  const subject = {
    '@type': 'Event',
    name: subjectName,
    location: fallbackLocation,
    startDate: subjectDate
  };
  const metadata = review.eventSchema;
  // Opt-in for dance reviews only; unknown types retain the legacy schema.
  if (metadata?.type !== 'DanceEvent') return subject;

  subject['@type'] = 'DanceEvent';
  const place = metadata.location;
  if (clean(place?.name)) {
    const address = {
      streetAddress: clean(place.streetAddress),
      addressLocality: clean(place.addressLocality),
      postalCode: clean(place.postalCode),
      addressCountry: clean(place.addressCountry)
    };
    subject.location = {
      '@type': 'Place',
      name: clean(place.name),
      alternateName: clean(place.alternateName),
      sameAs: httpsUrl(place.sameAs),
      address: Object.values(address).some(Boolean)
        ? { '@type': 'PostalAddress', ...address }
        : fallbackLocation?.address
    };
  }
  const performer = metadata.performer;
  if (clean(performer?.name)) {
    subject.performer = {
      '@type': 'PerformingGroup',
      name: clean(performer.name),
      alternateName: clean(performer.alternateName),
      sameAs: httpsUrl(performer.sameAs)
    };
  }
  return subject;
}
