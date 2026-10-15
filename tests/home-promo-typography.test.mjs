import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

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
