import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { compile } from 'sass-embedded';

const html = readFileSync(new URL('../events.html', import.meta.url), 'utf8');
const document = new JSDOM(html).window.document;
const hero = document.querySelector('.events-hero');
const styles = readFileSync(new URL('../src/styles/partials/_events-hero-premium.scss', import.meta.url), 'utf8');
const locales = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

test('hero ends directly above the unchanged event search section', () => {
  assert.equal(hero.nextElementSibling.id, 'upcoming-events');
  assert.equal(hero.querySelector('.events-cta-btn').getAttribute('href'), '#events-filters-form');
  assert.ok(document.querySelector('#events-filters-form[role="search"]'));
  assert.equal(hero.querySelectorAll('h1').length, 1);
  assert.equal(hero.querySelectorAll('h2').length, 0);
  assert.doesNotMatch(hero.textContent, /Najděte si svůj příští zážitek/);
  assert.equal(document.querySelectorAll('#events-filters-form').length, 1);
});

test('London link is an internal landing page with its own accessible content', () => {
  const london = hero.querySelector('.events-hero-london');
  assert.equal(london.getAttribute('href'), '/londynske-muzikaly/');
  assert.equal(london.closest('[aria-hidden="true"]'), null);
  assert.match(london.textContent, /Muzikály v Londýně/);
  assert.equal(london.querySelector('svg').closest('[aria-hidden="true"]').className, 'events-hero-london-arrow');
});

test('both responsive eye placements preserve the exact original image', () => {
  const eyes = hero.querySelectorAll('.events-hero-eye');
  assert.equal(eyes.length, 2);
  for (const eye of eyes) {
    assert.equal(eye.getAttribute('src'), '/images/ajsee-events-eye.jpg');
    assert.equal(eye.getAttribute('width'), '1254');
    assert.equal(eye.getAttribute('height'), '1254');
    assert.equal(eye.alt, '');
    assert.ok(eye.closest('[aria-hidden="true"]'));
  }
  const image = readFileSync(new URL('../public/images/ajsee-events-eye.jpg', import.meta.url));
  assert.equal(createHash('sha256').update(image).digest('hex'), '0e2b82ebe55ef267242de27feb51744d9b5c8412d7795fb1b5d59293b17e40fe');
  const mask = readFileSync(new URL('../public/images/ajsee-events-eye-mask.webp', import.meta.url));
  assert.equal(createHash('sha256').update(mask).digest('hex'), '3a25910d0a5cad85c906702bc1031aacb5386b2addf13ca9b23d56a9cb6c6a97');
});

test('every hero copy key is available in all six languages', () => {
  const keys = [...hero.querySelectorAll('[data-i18n-key]')].map(element => element.dataset.i18nKey);
  for (const lang of locales) {
    const dictionary = JSON.parse(readFileSync(new URL('../src/locales/' + lang + '.json', import.meta.url), 'utf8'));
    const staticDictionary = JSON.parse(readFileSync(new URL('../public/locales/' + lang + '.json', import.meta.url), 'utf8'));
    for (const key of keys) {
      assert.ok(dictionary[key]?.trim(), lang + ': ' + key);
      assert.equal(staticDictionary[key], dictionary[key], lang + ': static hero copy must not be stale');
    }
    assert.doesNotMatch(dictionary['events-hero-title'] + dictionary['events-hero-title-live'], /[<>]/);
  }
});

test('hero CSS is scoped, keeps image and London panel in flow, and supports both appearances', () => {
  const css = compile(new URL('../src/styles/partials/_events-hero-premium.scss', import.meta.url).pathname).css;
  assert.ok(css.startsWith('body[data-page=events] main#main .events-hero'));
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /mask-mode: alpha/);
  assert.match(styles, /prefers-color-scheme: dark/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /margin-top:\s*-|scale\(/);
  assert.doesNotMatch(css, /\.events-hero-(?:eye-space|london)\s*\{[^}]*position:\s*absolute/);
  assert.doesNotMatch(styles, /event-modal|\.event-card\b|#events-filters-form/);
});

test('CTA text keeps strong contrast in light and dark appearances', () => {
  const luminance = hex => {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    return channels.reduce((sum, value, index) => sum + [.2126, .7152, .0722][index] * (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4), 0);
  };
  for (const [foreground, colors] of [
    ['#ffffff', ['#164b5a', '#103448', '#15535d']],
    ['#f3fcfc', ['#216374', '#164457', '#1a5b65']]
  ]) {
    for (const color of colors) {
      const [low, high] = [luminance(foreground), luminance(color)].sort((a, b) => a - b);
      assert.ok((high + .05) / (low + .05) >= 4.5);
    }
  }
});
