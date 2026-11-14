import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { trackPartnerOutboundLink } from '../src/partner-outbound.js';
import { CONSENT_KEY, GA4_MEASUREMENT_ID } from '../src/utils/analytics-config.js';

const { outputFiles: [enabledBundle] } = await build({
  stdin: {
    contents: `export * from './src/utils/consent.js';
      export { trackPartnerOutboundLink } from './src/partner-outbound.js';`,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  write: false,
  define: { 'import.meta.env': JSON.stringify({ VITE_GTM_ENABLED: 'true' }) },
});
const enabledModuleUrl = `data:text/javascript;base64,${Buffer.from(enabledBundle.contents).toString('base64')}`;

async function environment(run, { gtmEnabled = false } = {}) {
  const dom = new JSDOM('<html><head><title>Test</title></head><body data-page="events"><a href="https://www.smsticket.cz/vstupenky/1">Tickets</a></body></html>', { url: 'https://ajsee.cz/events' });
  const names = ['window', 'document', 'location', 'localStorage', 'sessionStorage', 'CustomEvent'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  try {
    const moduleUrl = gtmEnabled ? enabledModuleUrl : '../src/utils/consent.js';
    const module = await import(`${moduleUrl}#test=${Math.random()}`);
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
    assert.equal(typeof win.gtag, 'function');
    assert.equal(win.document.documentElement.dataset.ajseeMarketingConsent, 'denied');
    const consentDefault = win.dataLayer.find(command => command[0] === 'consent' && command[1] === 'default');
    assert.deepEqual(consentDefault[2], {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
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
    assert.equal(scripts.length, 1);
    assert.match(scripts[0].src, /\/gtag\/js\?/);
    for (const script of scripts) script.onload();
    await pending;
    await module.applyConsent(module.readConsent());
    assert.equal(win.document.scripts.length, 1);
    assert.equal(win.__AJSEE_CONSENT_DEBUG__.gtmRequested, false);
    assert.equal(win.dataLayer.some(c => c?.event === 'gtm.js' || c?.event === 'ajsee_consent_updated'), false);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'page_view').length, 1);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'ajsee_partner_click').length, 1);
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_partner_click').length, 0);
    const ready = win.dataLayer.find(c => c[0] === 'event' && c[1] === 'ajsee_analytics_ready')[2];
    assert.equal(ready.analytics_init_source, 'consent_js_direct_ga4');
    assert.equal(Object.hasOwn(ready, 'source'), false, 'Diagnostic metadata must not override acquisition source.');
    assert.equal(Object.hasOwn(ready, 'debug_mode'), false, 'Ordinary visitors must not be flagged as debug traffic.');
  });
});

test('withdrawal disables GA4, stops clickouts and prevents pending loaders from granting consent again', async () => {
  await environment(async (module, win) => {
    const pending = module.applyConsent(module.writeConsent({ analytics: true }));
    win.sessionStorage.setItem('ajsee:lastPartnerClick', 'legacy');
    win.sessionStorage.setItem('ajsee:lastLondonMusicalsEvent', 'legacy');
    await module.applyConsent(module.writeConsent({ analytics: false }));
    assert.equal(win['ga-disable-' + GA4_MEASUREMENT_ID], true);
    const update = win.dataLayer.findLast(c => c[0] === 'consent' && c[1] === 'update');
    assert.equal(update[2].analytics_storage, 'denied');
    trackPartnerOutboundLink(win.document.querySelector('a'));
    for (const script of win.document.scripts) script.onload();
    await pending;
    assert.equal(win.dataLayer.filter(c => c[0] === 'event').length, 0);
    assert.equal(win.dataLayer.some(c => c?.event === 'ajsee_consent_updated'), false);
    assert.equal(win.sessionStorage.length, 0);
    assert.equal(JSON.parse(win.localStorage.getItem(CONSENT_KEY)).analytics, false);
  });
});

test('marketing consent is saved without requesting a disabled GTM container', async () => {
  await environment(async (module, win) => {
    const link = win.document.querySelector('a');
    const marketingOnly = module.applyConsent(module.writeConsent({ marketing: true }));
    assert.equal(win.document.scripts.length, 0);
    assert.equal(await marketingOnly, false);
    assert.equal(module.readConsent().marketing, true);
    assert.equal(await module.loadGTM(), false);
    assert.equal(win.dataLayer.some(c => c?.event), false);
    trackPartnerOutboundLink(link);
    assert.equal(win.dataLayer.some(c => c?.event === 'ajsee_partner_click_gtm'), false);

    const pending = module.applyConsent(module.writeConsent({ analytics: true, marketing: true }));
    assert.equal(win.document.scripts.length, 1);
    assert.match(win.document.scripts[0].src, /\/gtag\/js\?/);
    trackPartnerOutboundLink(link);
    win.document.scripts[0].onload();
    assert.equal(await pending, true);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'ajsee_partner_click').length, 1);
    assert.equal(win.dataLayer.some(c => c?.event), false);
  });
});

test('with GTM enabled, marketing-only consent loads only the GTM container', async () => {
  await environment(async (module, win) => {
    const pending = module.applyConsent(module.writeConsent({ analytics: false, marketing: true }));
    assert.equal(win.document.scripts.length, 1);
    assert.match(win.document.scripts[0].src, /gtm\.js/);
    const update = [...win.dataLayer].reverse().find(command => command[0] === 'consent' && command[1] === 'update');
    assert.equal(update[2].analytics_storage, 'denied');
    assert.equal(update[2].ad_storage, 'granted');
    assert.equal(update[2].ad_user_data, 'granted');
    assert.equal(update[2].ad_personalization, 'denied');
    assert.equal(win.document.documentElement.dataset.ajseeMarketingConsent, 'granted');
    const bootstrap = win.dataLayer.findIndex(c => c?.event === 'gtm.js');
    const notice = win.dataLayer.findIndex(c => c?.event === 'ajsee_consent_updated');
    assert.ok(bootstrap >= 0 && notice > bootstrap);
    assert.ok(bootstrap > win.dataLayer.indexOf(update));
    assert.equal(win.dataLayer[notice].marketing_consent, 'granted');
    module.trackPartnerOutboundLink(win.document.querySelector('a'));
    assert.ok(win.dataLayer.findIndex(c => c?.event === 'ajsee_partner_click_gtm') > notice);
    win.document.scripts[0].onload();
    assert.equal(await pending, true);
  }, { gtmEnabled: true });
});

test('marketing can be added and withdrawn while the existing GTM container is active', async () => {
  await environment(async (module, win) => {
    const readyNotifications = [];
    win.addEventListener('ajsee:analytics-ready', (event) => readyNotifications.push(event.detail));
    const initial = module.applyConsent(module.writeConsent({ analytics: true }));
    const repeat = module.applyConsent(module.readConsent());
    assert.equal(win.document.scripts.length, 1);
    assert.match(win.document.scripts[0].src, /\/gtag\/js\?/);
    assert.equal(win.dataLayer.some(c => c?.event === 'gtm.js'), false);
    assert.equal(win.__AJSEE_CONSENT_DEBUG__.gtmLoaded ?? false, false);
    for (const script of win.document.scripts) script.onload();
    await Promise.all([initial, repeat]);

    const added = module.applyConsent(module.writeConsent({ analytics: true, marketing: true }));
    const repeated = module.applyConsent(module.readConsent());
    assert.equal(win.document.scripts.length, 2);
    assert.equal(win.dataLayer.filter(c => c?.event === 'gtm.js').length, 1);
    assert.equal(win.document.documentElement.dataset.ajseeMarketingConsent, 'granted');
    module.trackPartnerOutboundLink(win.document.querySelector('a'));
    const update = win.dataLayer.findIndex(c => c[0] === 'consent' && c[1] === 'update' && c[2]?.ad_storage === 'granted');
    const notice = win.dataLayer.findIndex(c => c?.event === 'ajsee_consent_updated' && c.marketing_consent === 'granted');
    assert.ok(update >= 0 && notice > update);
    assert.ok(win.dataLayer.findIndex(c => c?.event === 'ajsee_partner_click_gtm') > notice);
    win.document.querySelector('script[src*="/gtm.js?"]').onload();
    await Promise.all([added, repeated]);

    await module.applyConsent(module.writeConsent({ analytics: true, marketing: false }));
    assert.equal(win.document.documentElement.dataset.ajseeMarketingConsent, 'denied');
    module.trackPartnerOutboundLink(win.document.querySelector('a'));
    assert.equal(win.document.scripts.length, 2);
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_partner_click_gtm').length, 1);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'ajsee_partner_click').length, 2);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'page_view').length, 1);
    assert.equal(win.dataLayer.filter(c => c[0] === 'event' && c[1] === 'ajsee_analytics_ready').length, 1);
    assert.deepEqual(readyNotifications, [
      { measurementId: GA4_MEASUREMENT_ID, eventName: 'ajsee_analytics_ready' },
    ]);
    assert.deepEqual(win.dataLayer.filter(c => c?.event === 'ajsee_consent_updated').map(c => c.marketing_consent), ['granted', 'denied']);
  }, { gtmEnabled: true });
});

test('the current marketing choice is denied when a pending GTM download processes old events', async () => {
  await environment(async (module, win) => {
    const pending = module.applyConsent(module.writeConsent({ marketing: true }));
    module.trackPartnerOutboundLink(win.document.querySelector('a'));
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_partner_click_gtm').length, 1);

    await module.applyConsent(module.writeConsent({ marketing: false }));
    assert.equal(win.document.documentElement.dataset.ajseeMarketingConsent, 'denied');
    win.document.scripts[0].onload();
    assert.equal(await pending, false);
  }, { gtmEnabled: true });
});

test('GTM can retry a failed download without queuing a second bootstrap or consent notice', async () => {
  await environment(async (module, win) => {
    const firstAttempt = module.applyConsent(module.writeConsent({ marketing: true }));
    const failedScript = win.document.scripts[0];
    failedScript.onerror();
    assert.equal(await firstAttempt, false);
    assert.equal(win.document.scripts.length, 0);

    const secondAttempt = module.applyConsent(module.readConsent());
    assert.equal(win.document.scripts.length, 1);
    assert.notEqual(win.document.scripts[0], failedScript);
    assert.equal(win.dataLayer.filter(c => c?.event === 'gtm.js').length, 1);
    assert.equal(win.dataLayer.filter(c => c?.event === 'ajsee_consent_updated').length, 1);
    win.document.scripts[0].onload();
    assert.equal(await secondAttempt, true);
  }, { gtmEnabled: true });
});

test('public source templates cannot independently load Google Analytics before consent', () => {
  for (const name of ['blog-detail.html', 'microguides/index.html', 'coming-soon/index.html', 'coming-soon/thanks.html']) {
    const source = fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /googletagmanager\.com\/(?:gtag\/js|gtm\.js)/, name);
  }
});
