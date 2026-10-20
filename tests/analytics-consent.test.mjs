import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { trackPartnerOutboundLink } from '../src/partner-outbound.js';
import { CONSENT_KEY, GA4_MEASUREMENT_ID } from '../src/utils/analytics-config.js';

async function environment(run) {
  const dom = new JSDOM('<html><head><title>Test</title></head><body data-page="events"><a href="https://www.smsticket.cz/vstupenky/1">Tickets</a></body></html>', { url: 'https://ajsee.cz/events' });
  const names = ['window', 'document', 'location', 'localStorage', 'sessionStorage', 'CustomEvent'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  try {
    const module = await import('../src/utils/consent.js?test=' + Math.random());
    await run(module, dom.window);
  } finally {
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  }
}

test('rejecting or missing consent loads no Google scripts, including manual loaders', async () => {
  await environment(async (module, win) => {
    assert.equal(await module.applyConsent(null), false);
    assert.equal(await module.applyConsent(module.writeConsent({ analytics: false })), false);
    assert.equal(await module.loadGA4Direct(), false);
    assert.equal(await module.loadGTM(), false);
    assert.equal(win.document.scripts.length, 0);
    assert.equal(win.gtag, undefined);
  });
});

test('configuration precedes a fast click during script loading and repeated bootstrap does not duplicate page views', async () => {
  await environment(async (module, win) => {
    const pending = module.applyConsent(module.writeConsent({ analytics: true }));
    const configIndex = win.dataLayer.findIndex(command => command[0] === 'config' && command[1] === GA4_MEASUREMENT_ID);
    assert.ok(configIndex >= 0);
    trackPartnerOutboundLink(win.document.querySelector('a'));
    const clickIndex = win.dataLayer.findIndex(command => command[0] === 'event' && command[1] === 'ajsee_partner_click');
    assert.ok(clickIndex > configIndex);
    const scripts = [...win.document.scripts];
    assert.equal(scripts.length, 2);
    for (const script of scripts) script.onload();
    await pending;
    await module.applyConsent(module.readConsent());
    assert.equal(win.document.scripts.length, 2);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'page_view').length, 1);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'ajsee_partner_click').length, 1);
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_partner_click').length, 0);
  });
});

test('withdrawal disables GA4, stops clickouts and prevents pending loaders from granting consent again', async () => {
  await environment(async (module, win) => {
    const pending = module.applyConsent(module.writeConsent({ analytics: true }));
    win.sessionStorage.setItem('ajsee:lastPartnerClick', 'legacy');
    win.sessionStorage.setItem('ajsee:lastLondonMusicalsEvent', 'legacy');
    await module.applyConsent(module.writeConsent({ analytics: false }));
    assert.equal(win['ga-disable-' + GA4_MEASUREMENT_ID], true);
    const last = win.dataLayer.at(-1);
    assert.deepEqual([...last].slice(0, 2), ['consent', 'update']);
    assert.equal(last[2].analytics_storage, 'denied');
    trackPartnerOutboundLink(win.document.querySelector('a'));
    for (const script of win.document.scripts) script.onload();
    await pending;
    assert.equal(win.dataLayer.filter(c => c[0] === 'event').length, 0);
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_consent_analytics_granted').length, 0);
    assert.equal(win.sessionStorage.length, 0);
    assert.equal(JSON.parse(win.localStorage.getItem(CONSENT_KEY)).analytics, false);
  });
});

test('public source templates cannot independently load Google Analytics before consent', () => {
  for (const name of ['blog-detail.html', 'microguides/index.html', 'coming-soon/index.html', 'coming-soon/thanks.html']) {
    const source = fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /googletagmanager\.com\/(?:gtag\/js|gtm\.js)/, name);
  }
});
