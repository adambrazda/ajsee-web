import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  buildPartnerOutboundPayload,
  trackPartnerOutboundLink,
  initPartnerOutboundTracking
} from '../src/partner-outbound.js';
import { renderSharedEventCard, wireSharedEventCardAnalytics } from '../src/event-card.js';
import { CONSENT_KEY, GA4_MEASUREMENT_ID } from '../src/utils/analytics-config.js';

function fixture({ path = '/events', lang = 'cs', page = 'events', markup = '', consent = true } = {}) {
  const dom = new JSDOM(`<html lang="${lang}"><body data-page="${page}">${markup}</body></html>`, {
    url: 'https://ajsee.cz' + path
  });
  const win = dom.window;
  if (consent !== null) win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: consent }));
  const commands = [];
  win.gtag = (...args) => commands.push(args);
  initPartnerOutboundTracking(win.document);
  return { dom, win, doc: win.document, commands };
}

function activate(win, link, { type = 'click', button = 0 } = {}) {
  // Suppress jsdom navigation after the production capture handler has run.
  link.addEventListener(type, event => event.preventDefault(), { once: true });
  const event = new win.MouseEvent(type, { bubbles: true, cancelable: true, button });
  link.dispatchEvent(event);
  return event;
}

const cardMarkup = () => renderSharedEventCard({
  event: { partner: 'colosseumticket', location: { city: 'Ostrava' } },
  modalId: 'colosseumticket-elisabeth-2027', titleRaw: 'Elisabeth', titleHtml: 'Elisabeth',
  ticketsHref: 'https://colosseumticket.cz/cs/akce/elisabeth?a_box=confirmed-box', ticketLabelHtml: 'Vstupenky'
});

test('completed clicks count once each across global and repeated card bindings; pointerdown never counts', () => {
  const { win, doc, commands, dom } = fixture({ markup: cardMarkup() });
  wireSharedEventCardAnalytics(doc);
  wireSharedEventCardAnalytics(doc);
  initPartnerOutboundTracking(doc);
  const link = doc.querySelector('.js-partner-click');
  const originalHref = link.href;
  link.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true }));
  link.dispatchEvent(new win.MouseEvent('pointercancel', { bubbles: true }));
  assert.equal(commands.length, 0);
  activate(win, link);
  activate(win, link);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0].slice(0, 2), ['event', 'ajsee_partner_click']);
  assert.equal(commands[0][2].partner_event_id, 'colosseumticket-elisabeth-2027');
  assert.equal(commands[0][2].partner, 'colosseumticket');
  assert.equal(commands[0][2].placement, 'event_card');
  assert.equal(commands[0][2].send_to, GA4_MEASUREMENT_ID);
  assert.equal(link.href, originalHref);
  assert.equal(new URL(link.href).searchParams.get('a_box'), 'confirmed-box');
  assert.equal(win.sessionStorage.length, 0);
  assert.equal(win.dataLayer.filter(item => item?.event === 'ajsee_partner_click').length, 0,
    'No GTM custom event may accompany the direct GA4 command.');
  dom.window.close();
});

test('middle click is measured; right click and cancelled touch are not', () => {
  const { win, doc, commands, dom } = fixture({ markup: cardMarkup() });
  const link = doc.querySelector('a');
  activate(win, link, { type: 'auxclick', button: 2 });
  activate(win, link, { type: 'click', button: 2 });
  assert.equal(commands.length, 0);
  activate(win, link, { type: 'auxclick', button: 1 });
  assert.equal(commands.length, 1);
  dom.window.close();
});

for (const consent of [null, false, 'true']) {
  test(`no analytics or rich storage before valid consent (${consent}) and no replay after acceptance`, () => {
    const { win, doc, commands, dom } = fixture({ markup: cardMarkup(), consent });
    const link = doc.querySelector('a');
    activate(win, link);
    assert.equal(commands.length, 0);
    assert.equal(win.dataLayer, undefined);
    assert.equal(win.sessionStorage.length, 0);
    assert.equal(win.__ajsee, undefined);
    win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true }));
    activate(win, link);
    assert.equal(commands.length, 1);
    win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: false }));
    activate(win, link);
    assert.equal(commands.length, 1);
    dom.window.close();
  });
}

test('home and Events share a payload contract while preserving source page and event context', () => {
  for (const [path, page] of [['/', 'home'], ['/events', 'events']]) {
    const { win, doc, commands, dom } = fixture({ path, page, markup: cardMarkup() });
    activate(win, doc.querySelector('a'));
    const p = commands[0][2];
    assert.equal(p.source_page_path, path);
    assert.equal(p.page_type, page);
    assert.equal(p.partner_city, 'Ostrava');
    assert.equal(p.event_title, 'Elisabeth');
    assert.equal(p.partner_event_name, 'Elisabeth');
    assert.equal(p.product_type, 'tickets');
    dom.window.close();
  }
});

for (const lang of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) {
  test(`localized review CTA keeps title-specific white-label URL and records its article (${lang})`, () => {
    const path = (lang === 'cs' ? '' : '/' + lang) + '/reviews/phantom-of-the-opera-2026/';
    const { win, doc, commands, dom } = fixture({ path, lang, page: 'blog-detail', markup: `
      <article data-review-slug="phantom-of-the-opera-2026"><h1>The Phantom of the Opera</h1>
        <p class="review-cta"><a href="https://ajsee.tixculture.com/london/shows/308-the-phantom-of-the-opera?utm_source=ajsee">Tickets</a></p>
      </article>` });
    const link = doc.querySelector('a');
    const href = link.href;
    activate(win, link);
    const p = commands[0][2];
    assert.equal(p.partner, 'todaytix');
    assert.equal(p.page_language, lang);
    assert.equal(p.placement, 'review_cta');
    assert.equal(p.content_slug, 'phantom-of-the-opera-2026');
    assert.equal(p.event_title, 'The Phantom of the Opera');
    assert.equal(p.partner_event_id, '', 'An editorial slug must not pretend to be a performance ID.');
    assert.match(p.destination_host, /^ajsee\.tixculture\.com$/);
    assert.equal(link.href, href);
    dom.window.close();
  });
}

test('both London purchase CTAs and the accommodation banner are tracked without per-page listeners', () => {
  const { win, doc, commands, dom } = fixture({ page: 'london-musicals', path: '/londynske-muzikaly/', markup: `
    <a class="js-lm-partner-click js-lm-purchase-link" data-placement="london_musicals_hero" href="https://ajsee.tixculture.com/?utm_source=ajsee">Tickets</a>
    <a class="js-lm-purchase-link" data-placement="london_musicals_popular" href="https://ajsee.tixculture.com/?utm_source=ajsee">All shows</a>
    <a data-placement="london_musicals_accommodation" href="https://www.trustedstays.co.uk/book-a-home?utm_source=ajsee">Stay</a>` });
  for (const link of doc.querySelectorAll('a')) activate(win, link);
  assert.equal(commands.length, 3);
  assert.deepEqual(commands.map(c => c[2].placement), ['london_musicals_hero', 'london_musicals_popular', 'london_musicals_accommodation']);
  assert.equal(commands[2][2].partner, 'trustedstays');
  assert.equal(commands[2][2].product_type, 'accommodation');
  dom.window.close();
});

test('UK and France accommodation CTAs keep separate placements and survive DOM replacement', () => {
  const { win, doc, commands, dom } = fixture({ path: '/accommodation/', page: 'accommodation', markup: `
    <main><a data-trustedstays-outbound data-track-source="destination_uk" href="https://www.trustedstays.co.uk/book-a-home?utm_campaign=ajsee_accommodation_launch">UK</a>
    <a data-trustedstays-outbound data-track-source="destination_france" href="https://www.trustedstays.co.uk/book-a-home?utm_campaign=ajsee_accommodation_launch">France</a></main>` });
  for (const link of doc.querySelectorAll('a')) activate(win, link);
  doc.querySelector('main').innerHTML = '<a data-track-source="france_information" href="https://www.trustedstays.co.uk/book-a-home">France info</a>';
  activate(win, doc.querySelector('a'));
  assert.deepEqual(commands.map(c => c[2].placement), ['destination_uk', 'destination_france', 'france_information']);
  assert.ok(commands.every(c => c[1] === 'ajsee_partner_click' && c[2].partner === 'trustedstays'));
  dom.window.close();
});

test('Ticketmaster redirect reports the seller, retains Impact input and omits search text or coordinates', () => {
  const to = 'https://www.ticketmaster.cz/event/123456?irclickid=affiliate&note=private';
  const href = 'https://ajsee.cz/.netlify/functions/tmOutbound?to=' + encodeURIComponent(to) + '&placement=event_card&source_page=home_page';
  const { win, doc, commands, dom } = fixture({ path: '/events?keyword=private@example.com&nearMeLat=49.123&nearMeLon=16.456#private', markup: '<a data-event-id="123456">Tickets</a>' });
  const link = doc.querySelector('a');
  link.href = href;
  activate(win, link);
  const p = commands[0][2];
  assert.equal(p.partner, 'ticketmaster');
  assert.equal(p.destination_host, 'www.ticketmaster.cz');
  assert.equal(p.outbound_url, 'https://www.ticketmaster.cz/event/123456');
  assert.equal(p.clicked_href, 'https://ajsee.cz/.netlify/functions/tmOutbound');
  assert.equal(p.page_path, '/events');
  assert.doesNotMatch(JSON.stringify(p), /private|49\.123|16\.456|irclickid/);
  assert.equal(link.href, href);
  assert.equal(new URL(link.href).searchParams.get('to'), to);
  dom.window.close();
});

test('internal promotions, disabled CTAs and unrelated domains never count as partner clickouts', () => {
  const { win, doc, commands, dom } = fixture({ markup: `
    <a href="/accommodation/" data-partner="trustedstays">Accommodation</a>
    <a href="/londynske-muzikaly/">London</a>
    <a aria-disabled="true" href="https://www.smsticket.cz/vstupenky/1">Sold out</a>
    <a href="https://nottrustedstays.co.uk/book-a-home">Unrelated</a>
    <a href="mailto:info@ajsee.cz">Mail</a>` });
  for (const link of doc.querySelectorAll('a')) activate(win, link);
  assert.equal(commands.length, 0);
  dom.window.close();
});

test('blocked analytics cannot throw, prevent navigation or rewrite the affiliate link', () => {
  const { win, doc, dom } = fixture({ markup: cardMarkup() });
  win.gtag = () => { throw new Error('Blocked'); };
  const link = doc.querySelector('a');
  const href = link.href;
  assert.doesNotThrow(() => trackPartnerOutboundLink(link));
  assert.equal(link.href, href);
  assert.equal(win.sessionStorage.length, 0);
  const payload = buildPartnerOutboundPayload(link);
  assert.ok(Object.keys(payload).length + 1 <= 25, 'Keep payload under GA4 parameter limits.');
  dom.window.close();
});
