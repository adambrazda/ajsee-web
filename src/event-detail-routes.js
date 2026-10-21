export const EVENT_DETAIL_ROUTES = {
  'colosseumticket-5470841-4205829': 'jesus-christ-superstar-ostrava-2026-12-13',
  'ticketmaster-Z698xZu0Z16vow_8_9': 'korn-praha-2026-11-16',
  'smsticket-68785': 'folk-country-cesky-krumlov-2027-04-24',
  'smsticket-76162': 'tohle-je-box-brno-2026-11-21'
};
export function eventDetailHref(event, lang = 'cs') {
  const slug = EVENT_DETAIL_ROUTES[event?.id];
  if (!slug) return '';
  const language = ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(lang) ? lang : 'cs';
  return `${language === 'cs' ? '' : '/' + language}/udalosti/${slug}/`;
}
