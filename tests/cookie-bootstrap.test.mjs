import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { CONSENT_KEY } from '../src/utils/analytics-config.js';

const bundle = await build({
  stdin: {
    contents: `import './src/identity-init.js';
      import { initCookieBanner } from './src/utils/cookie-banner.js';
      window.testInitCookieBanner = initCookieBanner;`,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  bundle: true,
  format: 'iife',
  write: false,
});
const script = bundle.outputFiles[0].text;
const titles = {
  cs: 'Používáme cookies', en: 'We use cookies', de: 'Wir verwenden Cookies',
  sk: 'Používame cookies', pl: 'Używamy plików cookies', hu: 'Sütiket használunk',
};

async function page(template, lang, consent = null) {
  const html = fs.readFileSync(new URL('../' + template, import.meta.url), 'utf8');
  const path = template === 'index.html' ? '/' : template === 'accommodation.html' ? '/accommodation/' : '/londynske-muzikaly/';
  const dom = new JSDOM(html, { url: `https://ajsee.cz${path}?lang=${lang}`, runScripts: 'outside-only' });
  if (consent !== null) dom.window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: consent }));
  dom.window.eval(script);
  if (dom.window.document.readyState === 'loading') {
    await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  return dom;
}

for (const template of ['index.html', 'londynske-muzikaly/index.html', 'accommodation.html']) {
  for (const [lang, title] of Object.entries(titles)) {
    test(`${template}: direct arrival in ${lang} can reject, reopen and accept analytics`, async () => {
      const dom = await page(template, lang);
      try {
        const win = dom.window;
        const doc = win.document;
        assert.equal(doc.querySelector('#cookie-banner-title').textContent, title);
        assert.equal(doc.querySelectorAll('script[src*="googletagmanager.com"]').length, 0);
        doc.querySelector('#cookie-banner [data-action="reject"]').click();
        assert.equal(JSON.parse(win.localStorage.getItem(CONSENT_KEY)).analytics, false);
        assert.equal(doc.querySelector('#cookie-banner'), null);
        doc.querySelector('[data-open-cookie-settings]').click();
        assert.equal(doc.querySelector('#cookie-preferences').classList.contains('is-hidden'), false);
        assert.equal(doc.querySelector('#cookie-analytics-toggle').checked, false);
        doc.querySelector('#cookie-analytics-toggle').click();
        doc.querySelector('#cookie-preferences [data-action="save"]').click();
        assert.equal(JSON.parse(win.localStorage.getItem(CONSENT_KEY)).analytics, true);
        assert.equal(doc.querySelector('#cookie-preferences'), null);
        assert.equal(doc.querySelectorAll('script[src*="googletagmanager.com"]').length, 2);
      } finally { dom.window.close(); }
    });
  }
}

test('returning visitor can reopen preferences without showing the banner or enabling analytics', async () => {
  const dom = await page('accommodation.html', 'en', false);
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector('#cookie-banner'), null);
    doc.querySelector('[data-open-cookie-settings]').click();
    assert.equal(doc.querySelector('#cookie-modal-title').textContent, 'Cookie settings');
    assert.equal(doc.querySelector('#cookie-analytics-toggle').checked, false);
    assert.equal(doc.querySelectorAll('script[src*="googletagmanager.com"]').length, 0);
  } finally { dom.window.close(); }
});

test('regular page bootstrap and language changes keep a single working consent interface', async () => {
  const dom = await page('accommodation.html', 'cs');
  try {
    const win = dom.window;
    const doc = win.document;
    win.testInitCookieBanner({ lang: 'cs' });
    win.testInitCookieBanner({ lang: 'cs' });
    assert.equal(doc.querySelectorAll('#cookie-banner').length, 1);
    assert.equal(doc.querySelectorAll('#cookie-preferences').length, 1);
    doc.querySelector('[data-open-cookie-settings]').click();
    doc.querySelector('#cookie-analytics-toggle').click();
    win.dispatchEvent(new win.CustomEvent('ajsee:lang-changed', { detail: { lang: 'en' } }));
    assert.equal(doc.querySelector('#cookie-modal-title').textContent, 'Cookie settings');
    assert.equal(doc.querySelector('#cookie-preferences').classList.contains('is-hidden'), false);
    assert.equal(doc.querySelector('#cookie-analytics-toggle').checked, true);
    assert.equal(doc.querySelectorAll('#cookie-banner').length, 1);
    assert.equal(doc.querySelectorAll('#cookie-preferences').length, 1);
  } finally { dom.window.close(); }
});

for (const [lang, title] of Object.entries(titles)) {
  test(`${lang}: late bootstrap preserves the banner and an open, unsaved preference`, async () => {
    const dom = await page('accommodation.html', lang);
    try {
      const win = dom.window;
      const doc = win.document;
      const banner = doc.querySelector('#cookie-banner');
      const description = doc.querySelector('#cookie-banner-desc');
      const modal = doc.querySelector('#cookie-preferences');
      const observer = new win.MutationObserver(() => {});
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });

      win.testInitCookieBanner({ lang });
      win.dispatchEvent(new win.CustomEvent('ajsee:lang-changed', { detail: { lang } }));
      assert.equal(doc.querySelector('#cookie-banner'), banner);
      assert.equal(doc.querySelector('#cookie-banner-desc'), description);
      assert.equal(observer.takeRecords().length, 0, 'unchanged copy must not rebuild or rewrite the UI');
      observer.disconnect();
      assert.equal(doc.querySelector('#cookie-banner-title').textContent, title);

      banner.querySelector('[data-action="settings"]').click();
      const toggle = doc.querySelector('#cookie-analytics-toggle');
      toggle.click();
      toggle.focus();

      win.testInitCookieBanner({ lang });
      const nextLang = lang === 'en' ? 'cs' : 'en';
      win.dispatchEvent(new win.CustomEvent('ajsee:lang-changed', { detail: { lang: nextLang } }));
      win.testInitCookieBanner({ lang: nextLang });

      assert.equal(doc.querySelector('#cookie-preferences'), modal);
      assert.equal(doc.querySelector('#cookie-analytics-toggle'), toggle);
      assert.equal(modal.classList.contains('is-hidden'), false);
      assert.equal(banner.hidden, true);
      assert.equal(toggle.checked, true);
      assert.equal(doc.activeElement, toggle);
      assert.equal(doc.querySelector('#cookie-banner-title').textContent, titles[nextLang]);
      assert.equal(new URL(banner.querySelector('a').href).searchParams.get('lang'), nextLang === 'cs' ? null : nextLang);
      assert.equal(doc.querySelectorAll('script[src*="googletagmanager.com"]').length, 0);

      modal.querySelector('[data-action="save"]').click();
      assert.equal(JSON.parse(win.localStorage.getItem(CONSENT_KEY)).analytics, true);
      assert.equal(doc.querySelector('#cookie-banner'), null);
      assert.equal(doc.querySelector('#cookie-preferences'), null);
    } finally { dom.window.close(); }
  });
}

test('late translated copy updates in place without losing an unsaved preference or focus', async () => {
  const dom = await page('accommodation.html', 'cs');
  try {
    const win = dom.window;
    const doc = win.document;
    const banner = doc.querySelector('#cookie-banner');
    const description = doc.querySelector('#cookie-banner-desc');
    banner.querySelector('[data-action="settings"]').click();
    const toggle = doc.querySelector('#cookie-analytics-toggle');
    toggle.click();
    toggle.focus();
    win.translations = { 'cookie-banner': { desc: 'Aktualizované vysvětlení z načteného překladu.' } };

    win.testInitCookieBanner({ lang: 'cs' });

    assert.equal(doc.querySelector('#cookie-banner'), banner);
    assert.equal(doc.querySelector('#cookie-banner-desc'), description);
    assert.equal(description.textContent, win.translations['cookie-banner'].desc);
    assert.equal(doc.querySelector('#cookie-preferences').classList.contains('is-hidden'), false);
    assert.equal(toggle.checked, true);
    assert.equal(doc.activeElement, toggle);
    assert.equal(doc.querySelectorAll('script[src*="googletagmanager.com"]').length, 0);
  } finally { dom.window.close(); }
});
