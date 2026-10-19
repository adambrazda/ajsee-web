import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { initFaq, normalizeFaqSearch } from '../src/faq.js';
import { createFaqSchema, syncFaqSchema } from '../src/faq-schema.js';
import { renderFaqSchema } from '../scripts/render-faq-schema.mjs';

const source = await fs.readFile(new URL('../faq.html', import.meta.url), 'utf8');
const languages = ['cs','en','de','sk','pl','hu'];
const dictionaries = Object.fromEntries(await Promise.all(languages.map(async (lang) => [lang,
  JSON.parse(await fs.readFile(new URL('../src/locales/' + lang + '/faq.json', import.meta.url), 'utf8'))
])));
function translate(doc, lang) {
  doc.documentElement.lang = lang;
  const pick = (key) => key.split('.').reduce((object, part) => object?.[part], dictionaries[lang]);
  for (const node of doc.querySelectorAll('[data-i18n-key^="faq."]')) {
    const text = pick(node.dataset.i18nKey); assert.equal(typeof text, 'string', lang + ': ' + node.dataset.i18nKey);
    node.textContent = text;
  }
  for (const [selector, key, attribute] of [['[data-i18n-placeholder]','i18nPlaceholder','placeholder'],['[data-i18n-aria]','i18nAria','aria-label'],['[data-i18n-content^="faq."]','i18nContent','content']]) {
    for (const node of doc.querySelectorAll(selector)) { const value = pick(node.dataset[key]); if (value) node.setAttribute(attribute, value); }
  }
}
function fixture(lang = 'cs') {
  const dom = new JSDOM(source, { url: 'https://ajsee.cz' + (lang === 'cs' ? '/faq' : '/' + lang + '/faq/'), pretendToBeVisual: true });
  translate(dom.window.document, lang);
  return { dom, doc: dom.window.document, root: dom.window.document.getElementById('faq') };
}
const visible = (doc) => [...doc.querySelectorAll('[data-faq-item]')].filter((node) => !node.hidden);
const schemaNodes = (doc) => [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => {
  const data = JSON.parse(node.textContent); return data['@graph'] || [data];
}).filter((node) => node['@type'] === 'FAQPage');

test('all six dictionaries cover the same fifteen questions, interface and metadata', () => {
  const expected = Object.keys(dictionaries.cs.faq.questions);
  for (const lang of languages) {
    const {dom, doc} = fixture(lang);
    assert.deepEqual(Object.keys(dictionaries[lang].faq.questions), expected);
    assert.equal(doc.querySelectorAll('[data-faq-item]').length, 15);
    assert.equal(doc.querySelectorAll('[data-faq-group]').length, 4);
    assert.equal(new Set([...doc.querySelectorAll('[id]')].map((node) => node.id)).size, doc.querySelectorAll('[id]').length);
    for (const id of expected) {
      const entry = dictionaries[lang].faq.questions[id]; assert.ok(entry.q && entry.a, lang + ': ' + id);
      assert.equal(doc.getElementById('faq-' + id).querySelector('[data-faq-question]').textContent, entry.q);
    }
    assert.equal(doc.title, dictionaries[lang].faq.seoTitle);
    assert.equal(doc.querySelector('.footer-contact a').href, 'mailto:info@ajsee.cz');
    assert.ok(doc.querySelector('.footer-copy').textContent.includes('2026'));
    dom.window.close();
  }
});

test('all answers and native controls are available without JavaScript', () => {
  const {dom, doc} = fixture();
  assert.equal(doc.querySelectorAll('details[data-faq-item] > summary').length, 15);
  assert.equal(doc.querySelectorAll('[data-faq-answer-text]').length, 15);
  assert.equal(doc.querySelectorAll('[data-faq-item][hidden]').length, 0);
  assert.ok(doc.getElementById('faq-how').hasAttribute('open'));
  assert.ok(!doc.querySelector('[data-faq-item] [aria-expanded]'));
  assert.ok(doc.querySelector('#faq noscript').textContent.includes('.faq-search'));
  dom.window.close();
});

test('search handles accents, Polish ł and multiple words', () => {
  assert.equal(normalizeFaqSearch('  PŘÍŠTÍ   VÍKEND '), 'pristi vikend');
  assert.equal(normalizeFaqSearch('PŁATNOŚĆ'), 'platnosc');
  assert.equal(normalizeFaqSearch('Szállás'), 'szallas');
});

test('search finds answer text, opens matching answers and restores previous disclosure state', () => {
  const {dom, doc, root} = fixture(), runtime = initFaq(root);
  const input = doc.querySelector('[data-faq-query]');
  doc.getElementById('faq-ai').open = true;
  input.value = 'provizi'; input.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(visible(doc).map((node) => node.id), ['faq-affiliate']);
  assert.equal(doc.getElementById('faq-affiliate').open, true);
  assert.equal(doc.querySelector('[data-faq-count]').textContent, '1');
  doc.querySelector('[data-faq-clear]').click();
  assert.equal(visible(doc).length, 15);
  assert.equal(doc.getElementById('faq-how').open, true);
  assert.equal(doc.getElementById('faq-ai').open, true);
  assert.equal(doc.getElementById('faq-affiliate').open, false);
  assert.equal(doc.activeElement, input);
  runtime.disconnect(); dom.window.close();
});

test('desktop topics, mobile selector and reset share one filter state', () => {
  const {dom, doc, root} = fixture(), runtime = initFaq(root);
  doc.querySelector('[data-faq-topic="tickets"]').click();
  assert.equal(visible(doc).length, 4);
  assert.equal(doc.querySelector('[data-faq-topic-select]').value, 'tickets');
  assert.equal(doc.querySelector('[data-faq-topic="tickets"]').getAttribute('aria-pressed'), 'true');
  const input = doc.querySelector('[data-faq-query]'); input.value = 'definitely-no-answer';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(visible(doc).length, 0); assert.equal(doc.querySelector('[data-faq-empty]').hidden, false);
  doc.querySelector('[data-faq-empty] [data-faq-reset]').click();
  assert.equal(visible(doc).length, 15); assert.equal(input.value, '');
  const select = doc.querySelector('[data-faq-topic-select]'); select.value = 'travel';
  select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(visible(doc).length, 3);
  assert.equal(doc.querySelector('[data-faq-topic="travel"]').getAttribute('aria-pressed'), 'true');
  input.value = 'ubytovani'; input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(visible(doc).length, 2);
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'Escape'}));
  assert.equal(visible(doc).length, 3); assert.equal(select.value, 'travel');
  runtime.disconnect(); dom.window.close();
});

test('AI search terms do not match unrelated words such as email or available', () => {
  const {dom, doc, root} = fixture('en'), runtime = initFaq(root);
  const input = doc.querySelector('[data-faq-query]'); input.value = 'AI?';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(visible(doc).map((node) => node.id), ['faq-ai']);
  runtime.disconnect(); dom.window.close();
});

test('deep links reveal the target even after filtering', () => {
  const {dom, doc, root} = fixture(), runtime = initFaq(root);
  doc.querySelector('[data-faq-topic="travel"]').click();
  dom.window.history.replaceState(null, '', '#faq-delivery');
  dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(doc.getElementById('faq-delivery').hidden, false);
  assert.equal(doc.getElementById('faq-delivery').open, true);
  assert.equal(doc.querySelector('[data-faq-topic-select]').value, 'all');
  runtime.disconnect(); dom.window.close();
});

test('filtering never removes questions from the underlying FAQ schema', () => {
  const {dom, doc, root} = fixture(), runtime = initFaq(root);
  doc.querySelector('[data-faq-topic="tickets"]').click();
  assert.equal(schemaNodes(doc).length, 1);
  assert.equal(schemaNodes(doc)[0].mainEntity.length, 15);
  runtime.disconnect(); dom.window.close();
});

test('static and runtime schema match localized visible questions and answers exactly', () => {
  for (const lang of languages) {
    const {dom, doc} = fixture(lang);
    const output = new JSDOM(renderFaqSchema(dom.serialize()));
    const result = schemaNodes(output.window.document);
    assert.equal(result.length, 1);
    assert.equal(result[0].inLanguage, lang);
    assert.equal(result[0].url, 'https://ajsee.cz' + (lang === 'cs' ? '/faq' : '/' + lang + '/faq/'));
    assert.equal(result[0].mainEntity.length, 15);
    const clean = (text) => text.replace(/\s+/g, ' ').trim();
    for (const [index, node] of [...doc.querySelectorAll('[data-faq-item]')].entries()) {
      assert.equal(result[0].mainEntity[index].name, clean(node.querySelector('[data-faq-question]').textContent));
      assert.equal(result[0].mainEntity[index].acceptedAnswer.text, clean(node.querySelector('[data-faq-answer-text]').textContent));
    }
    syncFaqSchema(output.window.document); assert.equal(schemaNodes(output.window.document).length, 1);
    output.window.close(); dom.window.close();
  }
  assert.throws(() => renderFaqSchema('<html><head></head><body></body></html>'), /Incomplete FAQ/);
});

test('language switching refreshes search and schema without duplicate handlers', async () => {
  const {dom, doc, root} = fixture('en'), runtime = initFaq(root);
  assert.equal(initFaq(root), null);
  doc.querySelector('[data-faq-topic="tickets"]').click();
  translate(doc, 'de');
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => dom.window.requestAnimationFrame(resolve)));
  assert.equal(schemaNodes(doc).length, 1);
  assert.equal(schemaNodes(doc)[0].inLanguage, 'de');
  assert.equal(schemaNodes(doc)[0].mainEntity[0].name, dictionaries.de.faq.questions.how.q);
  assert.equal(visible(doc).length, 4);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://ajsee.cz/de/faq/');
  runtime.disconnect(); dom.window.close();
});

test('query and structured-data strings cannot inject HTML', () => {
  const {dom, doc, root} = fixture(), runtime = initFaq(root);
  const input = doc.querySelector('[data-faq-query]'); input.value = '<img src=x onerror=alert(1)>';
  input.dispatchEvent(new dom.window.Event('input')); assert.equal(visible(doc).length, 0);
  assert.equal(doc.querySelectorAll('#faq-content img').length, 0);
  doc.querySelector('[data-faq-question]').textContent = '</script><script>alert(1)</script>';
  syncFaqSchema(doc);
  const node = doc.querySelector('script[data-faq-jsonld]');
  assert.ok(!node.textContent.includes('</script>'));
  assert.ok(JSON.parse(node.textContent).mainEntity[0].name.includes('<script>'));
  runtime.disconnect(); dom.window.close();
});

test('Czech and Slovak prepositions stay attached, including consecutive one-letter words', () => {
  for (const lang of ['cs','sk']) {
    const strings = Object.values(dictionaries[lang].faq.questions).flatMap((item) => [item.q, item.a]);
    for (const value of strings) assert.ok(!/(?<![\p{L}\p{N}_])([ksvzouai]) +(?=\S)/giu.test(value), value);
  }
});

test('small text and accent controls meet normal-text contrast in both themes', async () => {
  const css = await fs.readFile(new URL('../src/styles/partials/_faq-premium.scss', import.meta.url), 'utf8');
  const luminance = (hex) => {
    const x = hex.match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return x[0] * .2126 + x[1] * .7152 + x[2] * .0722;
  };
  for (const theme of ['light','dark']) {
    const block = css.match(new RegExp('@mixin faq-' + theme + ' \\{([\\s\\S]*?)\\}'))[1];
    const color = (key) => luminance(block.match(new RegExp('--faq-' + key + ': #([a-f\\d]{6})'))[1]);
    for (const [fg, bg] of [['muted','bg'],['muted','soft'],['text','soft'],['accent','accent-soft'],['accent','soft']]) {
      const a = color(fg), b = color(bg);
      assert.ok((Math.max(a,b) + .05) / (Math.min(a,b) + .05) >= 4.5, theme + ': ' + fg + '/' + bg);
    }
  }
});
