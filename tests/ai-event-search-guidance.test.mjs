import assert from 'node:assert/strict';
import test from 'node:test';
import { matchSearchCity } from '../shared/city/canonical.js';
import { readExplicitEventQuery } from '../src/ai-search/explicit-query.js';
import { createEmptyFilterIntent } from '../src/ai-search/intent-schema.js';
import { isOpenEndedSearch, needsSearchGuidance } from '../src/ai-search/search-guidance.js';
import { getAiSearchCopy } from '../src/ai-search/copy.js';

const now = '2026-11-17T20:50:00+01:00';
const parse = (query, locale = 'cs', cityCatalog = []) => readExplicitEventQuery({ query, locale, now, cityCatalog }).intent;

test('open-ended searches in each locale are recognized regardless of accents and punctuation', () => {
  for (const [locale, query] of [
    ['cs', 'Nevím, co hledám!'], ['cs', 'NEVIM CO HLEDAM'], ['en', 'I don’t know what to look for.'],
    ['de', 'Ich weiß nicht, was ich suche.'], ['sk', 'Neviem, čo hľadám.'],
    ['pl', 'Nie wiem, czego szukam.'], ['hu', 'Nem tudom, mit keresek.']
  ]) {
    assert.equal(isOpenEndedSearch(query, locale), true, query);
    assert.ok(parse(getAiSearchCopy(locale).guidanceExample, locale));
  }
  for (const query of ['Nevím, co hledám, ale něco v Brně', 'něco tento víkend', 'rock', 'Mamma Mia', 'v Praze']) {
    assert.equal(isOpenEndedSearch(query, 'cs'), false, query);
  }
});

test('empty AI results and unsupported-only suggestions are not catalogue searches', () => {
  const intent = { ...createEmptyFilterIntent('cs'), sort: 'relevance', searchMode: 'discovery' };
  assert.equal(needsSearchGuidance(intent), true);
  assert.equal(needsSearchGuidance({ ...intent, keyword: 'něco' }), true);
  assert.equal(needsSearchGuidance({ ...intent, unsupportedPreferences: [{ type: 'mood', value: 'romantické' }] }), true);
  assert.equal(needsSearchGuidance({
    ...intent,
    clarification: { required: true, question: 'Máte zájem o Prahu nebo Brno?', fields: ['place'] }
  }, { needsClarification: true }), false);
  for (const filters of [
    { keyword: 'Elisabeth' },
    { date: { type: 'preset', preset: 'weekend' } },
    { place: { type: 'near_me' } },
    { place: { type: 'city', label: 'Brno', countryCode: 'CZ' } },
    { category: 'theatre' },
    { unsupportedPreferences: [{ type: 'max_price', value: 0, currency: 'CZK' }] }
  ]) {
    assert.equal(needsSearchGuidance({ ...intent, ...filters }), false);
  }
});

test('recognized city case forms preserve the localized name and the rest of the request', () => {
  for (const [locale, query, city, countryCode] of [
    ['cs', 'divadlo v Hradci Kralove', 'Hradec Králové', 'CZ'],
    ['cs', 'koncert v Ceskych Budejovicich', 'České Budějovice', 'CZ'],
    ['cs', 'koncert do Londyna', 'Londýn', 'GB'],
    ['cs', 'akce v Plzni', 'Plzeň', 'CZ'],
    ['sk', 'koncert v Kosiciach', 'Košice', 'SK'],
    ['pl', 'koncert w Wroclawiu', 'Wrocław', 'PL'],
    ['hu', 'koncert Pragaban', 'Prága', 'CZ']
  ]) {
    const intent = parse(query, locale);
    assert.equal(intent?.place.label, city, query);
    assert.equal(intent.place.countryCode, countryCode, query);
  }

  const typo = parse('koncet v Ostrvae tento vikned do 800 Kc');
  assert.equal(typo?.category, 'concert');
  assert.equal(typo.place.label, 'Ostrava');
  assert.equal(typo.date.preset, 'weekend');
  assert.deepEqual(typo.unsupportedPreferences[0], { type: 'max_price', value: 800, currency: 'CZK', unit: '' });
  assert.equal(parse('koncert v Prhae').place.label, 'Praha');
  assert.equal(parse('Brne').place.label, 'Brno');
  assert.equal(parse('Ostrava tento vikend').date.preset, 'weekend');
});

test('the event catalogue keeps real towns and refuses multiple plausible city spellings', () => {
  const catalog = [
    { city: 'Kyjov', countryCode: 'CZ' },
    { city: 'Tábor', countryCode: 'CZ' },
    { city: 'Javor', countryCode: 'CZ' },
    { city: 'Žilina', countryCode: 'CZ' },
    { city: 'Žilina', countryCode: 'SK' }
  ];
  assert.equal(parse('akce v Kyjov', 'cs', catalog)?.place.label, 'Kyjov');
  assert.equal(matchSearchCity('tabor', { catalog, allowTypo: true })?.label, 'Tábor');
  assert.equal(matchSearchCity('Tavor', { catalog, allowTypo: true }), null);
  const similarlyNamed = [
    { city: 'Radošov', countryCode: 'CZ' },
    { city: 'Radešov', countryCode: 'CZ' }
  ];
  assert.equal(matchSearchCity('Radušov', { catalog: similarlyNamed, allowTypo: true }), null);
  assert.equal(matchSearchCity('Londýn', { countryCode: 'CZ', catalog, allowTypo: true }), null);
  assert.equal(matchSearchCity('Žilina', { catalog, allowTypo: true }), null);
  assert.equal(matchSearchCity('Zilina', { countryCode: 'SK', catalog, allowTypo: true })?.label, 'Žilina');
  assert.equal(parse('koncert v Brně nebo v Praze', 'cs', catalog), null);
  assert.equal(parse('koncert v okolí Brna', 'cs', catalog), null);
  assert.equal(parse('Mamma Mia v Londýně', 'cs', catalog), null);
});
