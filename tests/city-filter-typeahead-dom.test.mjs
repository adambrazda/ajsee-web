import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setupCityTypeahead } from '../src/city/typeahead.js';
import { suggestCities } from '../src/city/suggestClient.js';

let dom, input, mobile, selected, nearMeCalls, remote, saved;
const feedItems = ['Hodonín', 'Kyjov', 'Pardubice', 'Kroměříž', 'Brandýs nad Labem-Stará Boleslav']
  .map(city => ({ city, countryCode: 'CZ', aliases: [city] }));

async function until(predicate) {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Autocomplete did not reach the expected state');
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html lang="cs"><head></head><body><div><input id="city"></div></body></html>',
    { url: 'https://ajsee.cz/events', pretendToBeVisual: true });
  mobile = false;
  selected = [];
  nearMeCalls = 0;
  remote = async () => ({ ok: true, json: async () => ({ items: [] }) });
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({ get matches() { return mobile; }, addEventListener() {}, removeEventListener() {} });
  const values = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, AbortController: dom.window.AbortController,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    fetch: async (url) => String(url) === '/data/event-cities.json'
      ? { ok: true, json: async () => ({ items: feedItems }) } : remote(url) };
  saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  input = dom.window.document.querySelector('input');
  suggestCities.__cache?.clear();
});

afterEach(() => {
  input.__ajseeTypeaheadCleanup?.();
  dom.window.close();
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

function bind(locale = 'cs') {
  setupCityTypeahead(input, { locale, debounceMs: 0,
    onChoose: item => { selected.push(item); input.value = item.city; },
    onNearMe: () => { nearMeCalls++; } });
}
function type(element, value) { element.value = value; element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
const options = () => [...dom.window.document.querySelectorAll('.typeahead-item')].map(element => element.textContent.trim());

test('desktop offers a feed city from a two-letter prefix and selects its real country', async () => {
  bind();
  input.focus();
  type(input, 'Ho');
  await until(() => options().some(text => text.includes('Hodonín')));
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(selected[0].city, 'Hodonín');
  assert.equal(selected[0].countryCode, 'CZ');
  assert.equal(nearMeCalls, 0);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
});

test('a pending older remote query cannot replace a newer short city prefix', async () => {
  let finish, started = false;
  remote = () => new Promise(resolve => { started = true; finish = resolve; });
  bind(); input.focus(); type(input, 'London');
  await until(() => started);
  type(input, 'Ho');
  await until(() => options().some(text => text.includes('Hodonín')));
  finish({ ok: true, json: async () => ({ items: [{ city: 'London', countryCode: 'GB' }] }) });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(options().some(text => text.includes('Hodonín')));
  assert.ok(options().every(text => !text.includes('Londýn')));
});

test('an unknown typed place never makes Enter silently select Near Me', async () => {
  bind(); input.focus(); type(input, 'Město bez dat');
  await until(() => !dom.window.document.querySelector('.typeahead-loading'));
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(selected.length, 0);
  assert.equal(nearMeCalls, 0);
  assert.equal(input.value, 'Město bez dat');
});

test('localized countries keep country identity instead of becoming a city', async () => {
  bind(); input.focus(); type(input, 'CZ');
  await until(() => options().some(text => text.includes('Česko')));
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(selected[0].type, 'country');
  assert.equal(selected[0].isCountry, true);
  assert.equal(selected[0].countryCode, 'CZ');
});

test('mobile typing removes stale options before the delayed lookup runs', async () => {
  mobile = true;
  setupCityTypeahead(input, { debounceMs: 100, onChoose: item => selected.push(item) });
  input.click();
  const search = dom.window.document.querySelector('.city-sheet__search');
  type(search, 'Ho');
  await until(() => [...dom.window.document.querySelectorAll('.city-sheet__option')].some(option => option.textContent.includes('Hodonín')));
  type(search, 'Ky');
  const choices = [...dom.window.document.querySelectorAll('.city-sheet__option')];
  assert.ok(choices.every(option => !option.textContent.includes('Hodonín')));
  choices.find(option => option.textContent.includes('Kyjov')).click();
  assert.equal(selected[0].city, 'Kyjov');
});

for (const locale of ['cs', 'sk', 'en', 'de', 'pl', 'hu']) {
  test(`mobile picker finds and selects a regional city in ${locale}`, async () => {
    mobile = true;
    dom.window.document.documentElement.classList.add('dark');
    bind(locale);
    input.click();
    const search = dom.window.document.querySelector('.city-sheet__search');
    assert.ok(search);
    type(search, 'pardub');
    await until(() => [...dom.window.document.querySelectorAll('.city-sheet__option')].some(option => option.textContent.includes('Pardubice')));
    const choice = [...dom.window.document.querySelectorAll('.city-sheet__option')].find(option => option.textContent.includes('Pardubice'));
    choice.click();
    assert.equal(selected[0].city, 'Pardubice');
    assert.equal(selected[0].countryCode, 'CZ');
    assert.equal(input.value, 'Pardubice');
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.ok(!dom.window.document.body.classList.contains('city-picker-open'));
  });
}
