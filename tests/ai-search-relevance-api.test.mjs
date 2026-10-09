import test from 'node:test';
import assert from 'node:assert/strict';

// Real provider adapters and aggregator, with deterministic HTTP fixtures.
test('discovery preserves category/city/date and ranks after provider filtering; classic/exact remain strict', async () => {
  globalThis.window = { location: { hostname: 'ajsee.test', search: '' }, __ajsee: {}, dispatchEvent() {} };
  globalThis.document = { documentElement: { lang: 'cs' } };
  globalThis.location = { search: '' };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  const requests = [];
  const event = (id, title, day, city = 'Praha', category = 'theatre') => ({
    id: 'smsticket-' + id, sourceId: id, title: { cs: title }, description: { cs: title },
    category, datetime: `2099-01-${day}T20:00:00`, bookingEndsAt: '2099-01-31',
    location: { city, country: 'CZ' }, venue: { name: 'Test theatre', city },
    partner: 'smsticket', tickets: 'https://www.smsticket.cz/vstupenky/' + id
  });
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    if (url.includes('ticketmasterEvents')) return { ok: true, json: async () => ({ _embedded: { events: [] }, page: { totalPages: 0 } }) };
    if (url.includes('/data/smsticket-events')) return { ok: true, json: async () => ({ events: [
      event('early', 'Hamlet', '01'), event('best', 'Rockový muzikál', '03'),
      event('city', 'Rock musical Brno', '02', 'Brno'),
      event('date', 'Rock musical later', '20'),
      event('category', 'Rock concert', '02', 'Praha', 'concert')
    ] }) };
    if (url.includes('/data/colosseumticket-events')) return { ok: true, json: async () => ({ events: [
      {
        id: 'colosseumticket-ai-best',
        sourceId: 'ai-parent:ai-term',
        providerEventId: 'ai-parent',
        providerOccurrenceId: 'ai-term',
        partner: 'colosseumticket',
        source: 'colosseumticket',
        sourceName: 'ColosseumTicket',
        title: { cs: 'Rock musical' },
        description: { cs: 'Rock musical v Praze' },
        datetime: '2099-01-04T19:00:00',
        location: { city: 'Praha' },
        venue: { name: 'Test theatre', city: 'Praha' },
        categories: ['Muzikál'],
        types: ['Muzikál'],
        sourceMeta: { rawType: 'Muzikál', rawCategories: ['Muzikál'] },
        tickets: 'https://colosseumticket.cz/cs/akce/ai-test',
        url: 'https://colosseumticket.cz/cs/akce/ai-test'
      }
    ] }) };
    throw new Error('Unexpected request: ' + url);
  };
  const { fetchEvents } = await import('../src/api/eventsApi.js');
  const base = { countryCode: 'CZ', placeType: 'city', city: 'Praha', cityCountryCode: 'CZ', dateFrom: '2099-01-01', dateTo: '2099-01-10', category: 'theatre' };
  const discovery = await fetchEvents({ locale: 'cs', filters: { ...base, searchMode: 'discovery', keywordMatch: 'soft', keyword: 'rock musical', sort: 'relevance' } });
  assert.deepEqual(discovery.map(e => e.id), ['colosseumticket-ai-best', 'smsticket-best', 'smsticket-early']);
  assert.ok(requests.some(u => u.includes('/data/colosseumticket-events-praha.json')));
  assert.ok(requests.filter(u => u.includes('ticketmasterEvents')).every(u => !new URL(u, 'https://ajsee.test').searchParams.has('keyword')));
  for (const extra of [{}, { searchMode: 'exact', keywordMatch: 'strict', sort: 'relevance' }]) {
    const result = await fetchEvents({ locale: 'cs', filters: { ...base, keyword: 'Hamlet', ...extra } });
    assert.deepEqual(result.map(e => e.id), ['smsticket-early']);
  }
});
