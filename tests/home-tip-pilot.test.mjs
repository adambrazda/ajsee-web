import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderHomeFeaturedMarkup } from '../src/home-featured.js';
import { ensureSharedEventGridStyles } from '../src/event-card.js';
import { homeTipVariantScript, initPartnerOutboundTracking } from '../src/partner-outbound.js';
import { CONSENT_KEY } from '../src/utils/analytics-config.js';
import policy from '../content/home/featured.json' with { type: 'json' };

const now = new Date('2099-01-01T12:00:00Z');

function event(id, partner, bucket, tickets, extra = {}) {
  return {
    id, partner, title: id, date: '2099-01-10', time: '19:00', datetime: '2099-01-10T19:00:00',
    location: { city: 'Brno', country: 'CZ' }, venue: { name: 'Venue', city: 'Brno' },
    image: 'https://www.smsticket.cz/cdn/events/image.jpg',
    types: [bucket === 'stage' ? 'Divadlo' : bucket === 'sport' ? 'Sport' : 'Koncert'],
    taxonomy: { domains: [bucket === 'concert' ? 'music' : bucket], eventTypes: [bucket] },
    tickets, ...extra,
  };
}

const musical = event('colosseumticket-5470841-next', 'colosseumticket', 'stage',
  'https://colosseumticket.cz/cs/akce/5470841-jesus-christ-superstar?a_box=fixture',
  { providerEventId: '5470841', title: 'Jesus Christ Superstar (NDM)' });
const concert = event('ticketmaster-Z698xZu0Z16v0krAvb', 'ticketmaster', 'concert',
  '/.netlify/functions/tmOutbound?to=https%3A%2F%2Fticketmaster.cz%2Fevent%2Fsarah');
const hockey = event('ticketmaster-Z698xZu0Z16GSj9A9', 'ticketmaster', 'sport',
  '/.netlify/functions/tmOutbound?to=https%3A%2F%2Fticketmaster.cz%2Fevent%2Fsparta');
const other = { ...musical, id: 'colosseumticket-other', providerEventId: 'other' };
const events = [musical, concert, hockey, other];
const snapshot = { events, policy, recommendedIds: events.map(item => item.id) };

function homepage({ lang = 'cs', origin = 'https://ajsee.cz', withEditorialReasons = true } = {}) {
  const { markup } = renderHomeFeaturedMarkup(snapshot, lang, { now, withEditorialReasons });
  return new JSDOM(`<html lang="${lang}"><body data-page="home"><div id="eventsList">${markup}</div></body></html>`,
    { url: origin, runScripts: 'outside-only', pretendToBeVisual: true });
}

test('approved copy follows the exact production or event in each locale', () => {
  const keys = ['colosseumticket-5470841', concert.id, hockey.id];
  assert.equal(policy.editorialReasons[keys[0]].cs, 'Rocková opera, kterou jsme v Ostravě viděli už mnohokrát.');
  for (const lang of ['cs', 'en', 'de', 'sk', 'pl', 'hu']) {
    const { window } = homepage({ lang });
    const cards = [...window.document.querySelectorAll('.event-card')];
    assert.deepEqual(cards.map(card => card.dataset.eventId), snapshot.recommendedIds);
    assert.deepEqual(cards.slice(0, 3).map(card => card.querySelector('.event-editorial-reason')?.textContent),
      keys.map(key => policy.editorialReasons[key][lang]));
    assert.ok(cards.slice(0, 3).every(card => card.hasAttribute('data-home-tip-pilot')));
    assert.equal(cards[3].querySelector('.event-editorial-reason'), null);
    window.close();
  }
  const { window } = homepage({ withEditorialReasons: false });
  assert.equal(window.document.querySelector('[data-home-tip-pilot]'), null);
  window.close();
});

test('pre-paint assignment hides the copy in control and reuses a consenting session group', () => {
  const { window } = homepage();
  const { document } = window;
  const reason = document.querySelector('.event-editorial-reason');
  ensureSharedEventGridStyles(document);
  window.Math.random = () => .25;
  window.eval(homeTipVariantScript());
  assert.equal(document.documentElement.dataset.homeTipVariant, 'control');
  assert.equal(window.getComputedStyle(reason).display, 'none');
  assert.equal(window.sessionStorage.length, 0);

  window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true }));
  window.sessionStorage.setItem('ajsee.home-tip-variant.v1', 'reason');
  window.eval(homeTipVariantScript());
  assert.equal(document.documentElement.dataset.homeTipVariant, 'reason');
  assert.notEqual(window.getComputedStyle(reason).display, 'none');
  window.close();
});

function activate(win, link) {
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  link.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

test('pilot metrics count visible cards and one ticket activation per card with consent', () => {
  const { window } = homepage();
  const { document } = window;
  const commands = [];
  const observed = new Set();
  let intersection;
  window.gtag = (...args) => commands.push(args);
  window.IntersectionObserver = class {
    constructor(callback) { intersection = callback; }
    observe(card) { observed.add(card); }
    disconnect() { observed.clear(); }
  };
  window.Math.random = () => .25;
  window.eval(homeTipVariantScript());
  initPartnerOutboundTracking(document);
  assert.equal(observed.size, 3);
  const [card, unviewed] = observed;
  const enter = (target, intersectionRatio) => intersection([{ target, isIntersecting: true, intersectionRatio }]);

  enter(card, .9);
  activate(window, card.querySelector('.js-partner-click'));
  assert.equal(commands.length, 0);
  assert.equal(window.sessionStorage.length, 0);

  window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true }));
  enter(card, .4);
  card.style.visibility = 'hidden';
  enter(card, .9);
  assert.equal(commands.length, 0);

  card.style.visibility = 'visible';
  enter(card, .9);
  enter(card, .9);
  const link = card.querySelector('.js-partner-click');
  activate(window, link);
  activate(window, link);
  activate(window, unviewed.querySelector('.js-partner-click'));
  assert.deepEqual(commands.map(command => command[1]), [
    'ajsee_home_tip_view_control', 'ajsee_partner_click', 'ajsee_home_tip_ticket_control',
    'ajsee_partner_click', 'ajsee_partner_click', 'ajsee_home_tip_view_control', 'ajsee_home_tip_ticket_control',
  ]);
  assert.equal(commands[0][2].partner_event_id, musical.id);
  assert.equal(commands[5][2].partner_event_id, concert.id);
  assert.equal(window.sessionStorage.getItem('ajsee.home-tip-variant.v1'), 'control');
  window.close();
});

test('preview ticket activations leave the pilot data in production unchanged', () => {
  const { window } = homepage({ origin: 'https://preview.netlify.app' });
  const { document } = window;
  const names = [];
  window.gtag = (_, name) => names.push(name);
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true }));
  window.eval(homeTipVariantScript());
  initPartnerOutboundTracking(document);
  activate(window, document.querySelector('.js-partner-click'));
  assert.deepEqual(names, ['ajsee_partner_click']);
  window.close();
});
