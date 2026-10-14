// The unfiltered homepage introduces distinct experiences. Searches keep the
// shared listing order, including separate performances and time slots.
export function isHomeDiscovery(filters = {}) {
  return !(
    (filters.category && filters.category !== 'all') || filters.audience ||
    filters.placeType || filters.city || filters.dateFrom || filters.dateTo ||
    filters.keyword || filters.searchMode || filters.aiQuery ||
    (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice !== '') ||
    filters.nearMeLat !== null && filters.nearMeLat !== undefined ||
    filters.nearMeLon !== null && filters.nearMeLon !== undefined
  );
}

export function selectHomeDiscoveryEvents(events, limit = 6) {
  const seen = new Set();
  const result = [];
  const normalize = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  for (const event of events || []) {
    const title = typeof event.title === 'string' ? event.title
      : event.title?.cs || event.title?.en || Object.values(event.title || {})[0] || event.id;
    const venue = typeof event.venue === 'string' ? event.venue : event.venue?.name;
    const city = typeof event.city === 'string' ? event.city : event.city?.name;
    const key = [title, venue || event.venueName, city || event.cityName].map(normalize).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
    if (result.length === limit) break;
  }
  return result;
}
