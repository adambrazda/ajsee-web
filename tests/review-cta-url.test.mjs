import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { buildReviewCtaDestination, isFirstPartyReviewDestination } from '../scripts/review-cta-url.mjs';

const routes = {
  cs: '/londynske-muzikaly/',
  en: '/en/london-musicals/',
  sk: '/sk/londynske-muzikaly/',
  de: '/de/london-musicals/',
  pl: '/pl/londynskie-musicale/',
  hu: '/hu/londoni-musicalek/'
};

test('all six internal Mary Poppins CTA routes remain untagged', () => {
  for (const [lang, route] of Object.entries(routes)) {
    const raw = `https://ajsee.cz${route}?utm_source=chatgpt.com&utm_content=old`;
    assert.equal(isFirstPartyReviewDestination(raw), true);
    assert.equal(buildReviewCtaDestination(raw, lang), `https://ajsee.cz${route}`);
    assert.equal(buildReviewCtaDestination(route, lang), `https://ajsee.cz${route}`);
  }
});

test('external partner links retain language attribution', () => {
  assert.equal(isFirstPartyReviewDestination('https://ajsee.tixculture.com/'), false);
  assert.equal(buildReviewCtaDestination('https://ajsee.tixculture.com/show', 'de'),
    'https://ajsee.tixculture.com/show?utm_content=de');
  assert.equal(isFirstPartyReviewDestination('https://ajsee.cz.attacker.example/foo'), false);
});

test('ColosseumTicket links keep the existing safety redirect', () => {
  const href = buildReviewCtaDestination('https://colosseumticket.sk/sk?foo=bar&a_box=secret', 'sk');
  const parsed = new URL(href, 'https://ajsee.cz');
  assert.equal(parsed.pathname, '/.netlify/functions/colosseumOutbound');
  assert.equal(parsed.searchParams.get('source'), 'review');
  assert.equal(parsed.searchParams.get('placement'), 'review_cta');
  assert.equal(parsed.searchParams.get('lang'), 'sk');
  const target = new URL(parsed.searchParams.get('to'));
  assert.equal(target.searchParams.get('foo'), 'bar');
  assert.equal(target.searchParams.has('a_box'), false);
});

test('review builder renders AJSEE internal CTAs without sponsored new-window attributes', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts', 'build-review-details.mjs'), 'utf8');
  assert.match(source, /isFirstPartyReviewDestination\(rawTicketUrl\)/);
  assert.match(source, /isInternalCta \? '' : ' target="_blank" rel="noopener sponsored"'/);
});
