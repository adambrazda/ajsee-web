// Resolve calendar/timezone values once per sort, rather than on each comparison.
// This cache belongs to this call so refreshed or edited events never reuse old dates.
export function sortEventsByTime(events, timeFor, latest = false) {
  const times = new Map(events.map(event => [event, timeFor(event)]));
  return events.sort((left, right) => {
    const a = times.get(left), b = times.get(right);
    if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
    if (!Number.isFinite(a)) return 1;
    if (!Number.isFinite(b)) return -1;
    return latest ? b - a : a - b;
  });
}
