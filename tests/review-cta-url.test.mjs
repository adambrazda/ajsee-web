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

test('unsafe URL schemes cannot be emitted as editorial CTAs', () => {
  assert.equal(buildReviewCtaDestination('javascript:alert(1)', 'cs'), '');
  assert.equal(buildReviewCtaDestination('data:text/html,unsafe', 'cs'), '');
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

test('Mary Poppins draft contains six localized internal CTAs and complete metadata', () => {
  const file = path.join(process.cwd(), 'content/reviews/items/mary-poppins-from-film-to-west-end-stage.json');
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(article.slug, 'mary-poppins-from-film-to-west-end-stage');
  assert.equal(article.contentType, 'article');
  assert.equal(article.category, 'theatre');
  for (const [lang, route] of Object.entries(routes)) {
    const translation = article.translations[lang];
    assert.ok(translation?.body?.length > 5000, lang + ' full body');
    assert.equal((translation.body.match(/^## /gm) || []).length, 5, lang + ' chapter count');
    assert.ok(translation.seoTitle && translation.seoDescription, lang + ' SEO fields');
    assert.equal(translation.ticketUrl, 'https://ajsee.cz' + route);
    assert.equal(translation.galleryAlts?.length, article.gallery.length, lang + ' localized photo alts');
    assert.ok(!/utm_[a-z]+=/i.test(translation.ticketUrl), lang + ' tracking-free internal link');
  }
});

import { buildReviewEventSubject } from '../scripts/review-event-schema.mjs';

test('legacy dated reviews retain their generic Event schema', () => {
  const args = {
    review: {}, subjectDate: '2026-01-01', subjectName: 'Example',
    eventVenue: 'Theatre', eventCity: 'London', eventCountry: 'United Kingdom'
  };
  assert.deepEqual(buildReviewEventSubject(args), {
    '@type': 'Event', name: 'Example',
    location: { '@type': 'Place', name: 'Theatre', address: 'London, United Kingdom' },
    startDate: '2026-01-01'
  });
  assert.deepEqual(buildReviewEventSubject({ ...args, review: { eventSchema: { type: 'Unknown' } } }), buildReviewEventSubject(args));
});

test('Who Cares uses localized CTA routes and canonical dance event identity across languages', () => {
  const review = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/reviews/items/who-cares-ballet-prague-2026.json'), 'utf8'));
  const subjects = [];
  for (const lang of ['cs', 'en', 'sk', 'de', 'pl', 'hu']) {
    const t = review.translations[lang];
    const route = lang === 'cs' ? '/events' : '/' + lang + '/events/';
    assert.equal(buildReviewCtaDestination(t.ticketUrl, lang), 'https://ajsee.cz' + route);
    assert.ok(t.body && t.subtitle && t.seoTitle && t.seoDescription && t.coverAlt);
    assert.equal(t.galleryAlts.length, review.gallery.length);
    const subject = buildReviewEventSubject({
      review, subjectDate: review.performanceDate, subjectName: review.productionTitle,
      eventVenue: t.venue, eventCity: t.city, eventCountry: t.country
    });
    subjects.push(JSON.parse(JSON.stringify(subject)));
  }
  for (const subject of subjects) assert.deepEqual(subject, subjects[0]);
  assert.deepEqual(subjects[0], {
    '@type': 'DanceEvent', name: 'Who Cares?',
    startDate: '2026-11-05T19:00:00+01:00',
    location: {
      '@type': 'Place', name: 'Státní opera', alternateName: 'State Opera',
      sameAs: 'https://www.narodni-divadlo.cz/cs/budovy/statni-opera',
      address: { '@type': 'PostalAddress', streetAddress: 'Wilsonova 4', addressLocality: 'Praha 1', postalCode: '110 00', addressCountry: 'CZ' }
    },
    performer: {
      '@type': 'PerformingGroup', name: 'Balet Národního divadla', alternateName: 'Czech National Ballet',
      sameAs: 'https://www.narodni-divadlo.cz/cs/soubory/balet/o-nas'
    }
  });
  assert.equal(review.rating, null);
});

test('dance event enrichment omits unsafe sameAs URLs and unknown metadata', () => {
  const subject = buildReviewEventSubject({
    review: { eventSchema: { type: 'DanceEvent', location: { name: 'Venue', sameAs: 'javascript:alert(1)' }, performer: { name: 'Company', sameAs: 'http://example.com' } } },
    subjectName: 'Example', subjectDate: '2026-01-01', eventCity: 'Prague'
  });
  assert.equal(subject.location.sameAs, undefined);
  assert.equal(subject.performer.sameAs, undefined);
  assert.equal(subject.location.address, 'Prague');
});

import { insertReviewInlineImages } from '../scripts/review-inline-images.mjs';

test('Who Cares official photographs preserve both Oya gallery images and localized inline placement', () => {
  const review = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/reviews/items/who-cares-ballet-prague-2026.json'), 'utf8'));
  assert.match(review.cover, /5041-serghei-gherciu\.webp$/);
  assert.equal(review.gallery.length, 2);
  assert.ok(review.gallery.every(item => item.image.includes('oya-canli')));
  assert.ok(review.coverCredit.includes('The George Balanchine Trust'));
  for (const asset of [review.cover, ...review.inlineImages.map(i => i.image), ...review.gallery.map(i => i.image)]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', asset.replace(/^\//, ''))));
  }
  const body = '<h2>First</h2><p>One</p><h2>Second</h2><p>Two</p><h2>Third</h2>';
  assert.equal(insertReviewInlineImages(body, [], [], 'en'), body);
  for (const [lang, t] of Object.entries(review.translations)) {
    assert.equal(t.inlineImageAlts.length, 2);
    assert.equal(t.galleryAlts.length, 2);
    const html = insertReviewInlineImages(body, review.inlineImages, t.inlineImageAlts, lang);
    assert.equal((html.match(/class="review-inline-photo"/g) || []).length, 2);
    assert.equal((html.match(/loading="lazy"/g) || []).length, 2);
    assert.ok(html.indexOf('5031-serghei') < html.indexOf('<h2>Second'));
    assert.ok(html.indexOf('5039-serghei') > html.indexOf('<h2>Second'));
    assert.ok(html.indexOf('5039-serghei') < html.indexOf('<h2>Third'));
    assert.ok(html.includes('width="1280" height="853"'));
    assert.ok(html.includes('The George Balanchine Trust'));
  }
});
