import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const languages = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));

test('all six languages expose independent analytics and marketing consent copy', () => {
  for (const language of languages) {
    const locale = readJson(`src/locales/${language}.json`);
    const banner = locale['cookie-banner'];
    for (const key of ['analyticsTitle', 'allowAnalytics', 'marketingTitle', 'marketingText', 'allowMarketing']) {
      assert.equal(typeof banner[key], 'string', `${language}: ${key}`);
      assert.ok(banner[key].trim(), `${language}: ${key} must not be empty`);
    }
  }
});

test('cookie and privacy policies describe consent-gated Google Ads in every language', () => {
  for (const language of languages) {
    const cookies = readJson(`src/locales/${language}/cookies-policy.json`).cookies;
    const privacy = readJson(`src/locales/${language}/privacy-policy.json`).privacy;
    assert.match(cookies.types.cards['5'].text, /Google Ads/);
    assert.match(`${cookies.tools.items['6'].label} ${cookies.tools.items['6'].text}`, /Google Ads/);
    assert.match(privacy.purposes.cards['8'].text, /Google Ads/);
    assert.match(privacy.cookies.items['6'], /Google Ads/);
  }
});

test('source policy pages render the new localized policy keys', () => {
  const cookies = fs.readFileSync(new URL('cookies-policy.html', root), 'utf8');
  const privacy = fs.readFileSync(new URL('privacy-policy.html', root), 'utf8');
  assert.match(cookies, /data-i18n-key="cookies\.types\.cards\.5\.title"/);
  assert.match(cookies, /data-i18n-key="cookies\.tools\.items\.6\.label"/);
  assert.match(privacy, /data-i18n-key="privacy\.purposes\.cards\.8\.title"/);
  assert.match(privacy, /data-i18n-key="privacy\.cookies\.items\.6"/);
});
