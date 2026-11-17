import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calendarMonthRange, readExplicitEventQuery } from '../src/ai-search/explicit-query.js';
import { createEmptyFilterIntent, validateFilterIntent } from '../src/ai-search/intent-schema.js';
import { mapIntentToFilters, selectCatalogueRefinementFilters } from '../src/ai-search/intent-to-filters.js';
import { syncCatalogueFilterParams } from '../src/catalogue-search.js';

const now = '2026-11-17T20:05:00+01:00';
const month = { type: 'range', preset: '', from: '2026-12-01', to: '2026-12-31' };

test('the exact homepage query reaches the catalogue with all four active filters', () => {
  const { intent } = readExplicitEventQuery({
    query: 'koncert v Ostravě příští měsíc do 800 Kč',
    locale: 'cs',
    now
  });
  assert.equal(validateFilterIntent(intent).needsClarification, false);
  const { filters, readyToApply } = mapIntentToFilters(intent);
  assert.equal(readyToApply, true);

  const params = new URLSearchParams();
  syncCatalogueFilterParams(params, filters);
  assert.deepEqual(Object.fromEntries(params), {
    segment: 'concert',
    city: 'Ostrava',
    cityCc: 'CZ',
    from: '2026-12-01',
    to: '2026-12-31',
    priceMax: '800',
    priceCurrency: 'CZK',
    searchMode: 'discovery',
    keywordMatch: 'soft',
    sort: 'relevance'
  });
});

for (const [locale, query, city, country, price, currency] of [
  ['cs', 'Příští měsíc hledám koncerty v Ostravě, maximálně 1 200 Kč.', 'Ostrava', 'CZ', 1200, 'CZK'],
  ['en', 'Find me a concert in London next month up to £45.50', 'London', 'GB', 45.5, 'GBP'],
  ['de', 'Konzert in Wien im nächsten Monat bis 1.200,50 €', 'Wien', 'AT', 1200.5, 'EUR'],
  ['sk', 'koncert v Bratislave budúci mesiac do 35 €', 'Bratislava', 'SK', 35, 'EUR'],
  ['pl', 'koncert w Warszawie w przyszłym miesiącu do 100 zł', 'Warszawa', 'PL', 100, 'PLN'],
  ['hu', 'koncert Budapesten jövő hónapban legfeljebb 5 000 Ft', 'Budapest', 'HU', 5000, 'HUF']
]) {
  test('recognizes explicit local month and budget in ' + locale, () => {
    const { intent, priceLimit } = readExplicitEventQuery({ query, locale, now });
    assert.ok(intent, query);
    assert.deepEqual(intent.date, month);
    assert.equal(intent.place.label, city);
    assert.equal(intent.place.countryCode, country);
    assert.equal(priceLimit.value, price);
    assert.equal(priceLimit.currency, currency);
  });
}

test('calendar month does not drift across local midnight, year boundaries or leap years', () => {
  assert.deepEqual(calendarMonthRange('2026-12-31T23:50:00-05:00', 1), { from: '2027-01-01', to: '2027-01-31' });
  assert.deepEqual(calendarMonthRange('2028-02-01T00:10:00+01:00', 0), { from: '2028-02-01', to: '2028-02-29' });
});

test('the previous weekend example also carries an explicit price without a question', () => {
  const { intent } = readExplicitEventQuery({
    query: 'koncert v Ostravě tento víkend do 800 Kč',
    locale: 'cs',
    now
  });
  assert.equal(intent.date.preset, 'weekend');
  assert.equal(validateFilterIntent(intent).needsClarification, false);
  assert.equal(mapIntentToFilters(intent).filters.maxPrice, 800);
});

test('additional requests and genuinely ambiguous prices still go to the model', () => {
  for (const query of [
    'koncert v Ostravě příští měsíc do 800',
    'koncert v Ostravě příští měsíc do 800 Kč nebo 1000 Kč',
    'koncert v Ostravě příští měsíc do 800 Kč celkem pro dva',
    'koncert v Ostravě příští měsíc do -800 Kč'
  ]) {
    assert.deepEqual(readExplicitEventQuery({ query, locale: 'cs', now }), { priceLimit: null, intent: null });
  }
  for (const query of [
    'jazzový koncert v Ostravě příští měsíc do 800 Kč',
    'koncert v Ostravě první víkend příští měsíc do 800 Kč',
    'koncert v Ostravě nebo v Praze příští měsíc do 800 Kč'
  ]) {
    const { intent, priceLimit } = readExplicitEventQuery({ query, locale: 'cs', now });
    assert.equal(intent, null);
    assert.equal(priceLimit.currency, 'CZK');
  }
});

test('catalogue refinement keeps confidently recognized fields while leaving the pending field open', () => {
  const intent = createEmptyFilterIntent('cs');
  intent.place = { type: 'city', label: 'Ostrava', countryCode: 'CZ', nearby: false, radiusKm: null };
  intent.category = 'concert';
  intent.date = month;
  intent.unsupportedPreferences = [{ type: 'max_price', value: 800, currency: '', unit: '' }];
  intent.confidence = { overall: 0.5, place: 0.98, category: 1, date: 0.97 };
  intent.clarification = {
    required: true,
    question: 'Myslíte maximální cenu 800 CZK?',
    fields: ['unsupportedPreferences']
  };

  const selected = selectCatalogueRefinementFilters(mapIntentToFilters(intent));
  const params = new URLSearchParams();
  syncCatalogueFilterParams(params, selected);
  assert.deepEqual(Object.fromEntries(params), {
    city: 'Ostrava', cityCc: 'CZ', segment: 'concert', from: '2026-12-01', to: '2026-12-31'
  });

  intent.clarification.fields = ['date.from'];
  assert.equal(selectCatalogueRefinementFilters(mapIntentToFilters(intent)).dateFrom, undefined);
});

test('catalogue landing removes only the focus outline on the noninteractive filter container', () => {
  const style = readFileSync(new URL('../src/styles/pages/events-page.scss', import.meta.url), 'utf8');
  assert.match(style, /#events-filters-details\[tabindex="-1"\]:focus\s*\{\s*outline: none;/);
  assert.doesNotMatch(style, /#events-filters-details:focus-within|#events-filters-details\s+\*\s*:focus/);
});
