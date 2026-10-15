import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parse } from 'acorn';

const expected = {
  'home.london.title': 'Muzikály v\u00a0Londýně',
  'home.stay.title': 'Ubytování k\u00a0vašemu výletu',
};

test('Czech homepage promo headings keep one-letter prepositions with the following word', () => {
  const page = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  for (const [key, text] of Object.entries(expected)) {
    const heading = page.window.document.querySelector(`h2[data-i18n-key="${key}"]`);
    assert.equal(heading.textContent, text);
    assert.equal(heading.querySelector('br'), null, 'Wrapping must stay responsive, not forced.');
  }
  page.window.close();
});

for (const directory of ['src/locales', 'public/locales']) {
  test(`${directory} preserves Czech non-breaking spaces when translations are applied`, () => {
    const translations = JSON.parse(readFileSync(new URL(`../${directory}/cs.json`, import.meta.url), 'utf8'));
    for (const [key, text] of Object.entries(expected)) assert.equal(translations[key], text);
  });
}

const entry = readFileSync(new URL('../src/home-entry.js', import.meta.url), 'utf8');
const entryFunctions = parse(entry, { sourceType: 'module', ecmaVersion: 'latest' }).body;
const formatter = entryFunctions.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'formatHomePromoTitle');
assert.ok(formatter, 'The live translation path must protect the promo headings too.');
const formatTitle = new Function(`return (${entry.slice(formatter.start, formatter.end)});`)();

test('old cached Czech translations cannot restore stranded prepositions', () => {
  for (const [key, text] of Object.entries(expected)) {
    assert.equal(formatTitle(key, text.replaceAll('\u00a0', ' '), 'cs'), text);
    assert.equal(formatTitle(key, text, 'cs'), text, 'Formatting is idempotent.');
  }
});

test('the cached-translation safeguard leaves other languages and text untouched', () => {
  assert.equal(formatTitle('home.london.title', 'Muzikály v Londýne', 'sk'), 'Muzikály v Londýne');
  assert.equal(formatTitle('home.stay.title', 'Unterkunft für Ihre Reise', 'de'), 'Unterkunft für Ihre Reise');
  assert.equal(formatTitle('home.london.text', 'Muzikály v Londýně', 'cs'), 'Muzikály v Londýně');
});
