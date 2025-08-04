// /src/adapters/ticketmaster.js

export async function fetchEvents({ locale = 'cs', filters = {} } = {}) {
  const countryCode = filters.countryCode || 'CZ';
  const keyword = filters.keyword || '';

  // Priorita jazyků: uživatelský -> cs -> en
  const localesToTry = [locale];
  if (!['cs', 'en'].includes(locale)) {
    localesToTry.push('cs', 'en');
  } else if (locale === 'cs') {
    localesToTry.push('en');
  } else if (locale === 'en') {
    localesToTry.push('cs');
  }

  for (const loc of localesToTry) {
    const url = `/.netlify/functions/ticketmasterEvents?countryCode=${countryCode}&locale=${loc}&keyword=${encodeURIComponent(keyword)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data._embedded && data._embedded.events && data._embedded.events.length) {
        // Mapuj výsledky a použij jazyk dat (ne to co chtěl uživatel)
        return data._embedded.events.map(ev => ({
          id: `ticketmaster-${ev.id}`,
          title: { [loc]: ev.name },
          description: { [loc]: ev.info || ev.pleaseNote || '' },
          category: ev.classifications?.[0]?.segment?.name?.toLowerCase() || 'other',
          datetime: ev.dates?.start?.dateTime || ev.dates?.start?.localDate || '',
          location: {
            city: ev._embedded?.venues?.[0]?.city?.name || '',
            country: ev._embedded?.venues?.[0]?.country?.countryCode || ''
          },
          image: ev.images?.[0]?.url || "",
          partner: "ticketmaster",
          url: ev.url || "",
          priceFrom: null,
          promo: null,
          tickets: ev.url || ""
        }));
      }
    } catch (e) {
      console.error('Chyba načítání Ticketmaster událostí:', e, loc);
      continue;
    }
  }
  // Pokud vůbec nic nenajdeš
  return [];
}
