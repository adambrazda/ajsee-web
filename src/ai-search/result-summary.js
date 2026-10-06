const RESULT_LABELS = {
  cs: 'Načtené akce', en: 'Loaded events', de: 'Geladene Veranstaltungen',
  sk: 'Načítané akcie', pl: 'Wczytane wydarzenia', hu: 'Betöltött események'
};

export function formatAiResultSummary(result, locale = 'cs') {
  if (!Number.isInteger(result?.resultCount) || result.resultCount < 0) return '';
  const label = RESULT_LABELS[locale] || RESULT_LABELS.cs;
  return `${label}: ${result.resultCount}${result.resultCountIsLowerBound && result.resultCount > 0 ? '+' : ''}.`;
}
