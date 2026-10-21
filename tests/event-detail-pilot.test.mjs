import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { validatePilot, renderEventDetail, buildEventSchema, eventState, PREVIEW_ROOT } from '../scripts/event-detail-pilot.mjs';
import { initPartnerOutboundTracking } from '../src/partner-outbound.js';
import { CONSENT_KEY } from '../src/utils/analytics-config.js';
import { handler as colosseumOutbound } from '../netlify/functions/colosseumOutbound.js';

const pilot = JSON.parse(fs.readFileSync(new URL('../content/event-detail-pilot.json', import.meta.url)));
const now = new Date('2026-10-20T13:00:00Z');
const events = validatePilot(pilot.events);

test('Colosseum resolves to the verified production and adds its configured affiliate identity on the server', async () => {
  const event = events.find(e => e.partner === 'colosseumticket');
  const link = new URL(event.tickets, 'https://ajsee.cz');
  const destination = link.searchParams.get('to');
  assert.equal(destination, event.evidence.sellerUrl);
  assert.equal(new URL(destination).searchParams.has('a_box'), false);
  const previous = process.env.COLOSSEUMTICKET_A_BOX;
  try {
    process.env.COLOSSEUMTICKET_A_BOX = 'pilot-test-box';
    const response = await colosseumOutbound({ httpMethod: 'GET', queryStringParameters: Object.fromEntries(link.searchParams) });
    assert.equal(response.statusCode, 302);
    const target = new URL(response.headers.Location);
    assert.equal(target.searchParams.get('a_box'), 'pilot-test-box');
    target.searchParams.delete('a_box');
    assert.equal(target.href, destination);
  } finally {
    if (previous === undefined) delete process.env.COLOSSEUMTICKET_A_BOX;
    else process.env.COLOSSEUMTICKET_A_BOX = previous;
  }
});

for (const event of events) {
  test(`${event.id}: HTML and schema share the verified occurrence and original affiliate URL`, () => {
    const dom = new JSDOM(`<body data-page="event-detail">${renderEventDetail(event, { now })}</body>`);
    const doc = dom.window.document, schema = buildEventSchema(event);
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.ok(doc.querySelector('h1').textContent.replace(/\s/g, ' ').startsWith(event.title));
    assert.equal(doc.querySelector('time').dateTime, schema.startDate);
    assert.equal(doc.querySelector('.detail-cta').getAttribute('href'), event.tickets);
    assert.equal(doc.querySelector('.detail-cta').dataset.eventId, event.id);
    assert.equal(doc.querySelector('.detail-cta').dataset.placement, 'event_detail');
    assert.ok(doc.querySelector('.detail-facts').textContent.replace(/\s/g, ' ').includes(schema.location.name));
    assert.equal(doc.querySelector('.detail-image').getAttribute('src'), schema.image[0]);
    assert.equal(schema.location.address.addressLocality, event.venue.city);
    assert.equal(schema.url, `https://ajsee.cz/udalosti/${event.slug}/`);
    assert.equal(schema.offers, undefined, 'Frozen preview prices must not claim live offers or availability.');
    assert.equal(schema.endDate, undefined, 'No guessed end time.');
    assert.notEqual(schema.organizer?.name, 'Ticketmaster', 'Seller is not the organizer by default.');
    assert.ok(doc.querySelector('.detail-purchase-note').textContent.includes('vstupenky koupíte'));
    dom.window.close();
  });

  test(`${event.id}: completed purchase-link click is counted once after consent, never before`, () => {
    const dom = new JSDOM(`<html lang="cs"><body data-page="event-detail">${renderEventDetail(event, { now })}</body></html>`, { url: `https://ajsee.cz/udalosti/${event.slug}/` });
    const win = dom.window, doc = win.document, commands = [];
    win.gtag = (...args) => commands.push(args);
    initPartnerOutboundTracking(doc); initPartnerOutboundTracking(doc);
    const link = doc.querySelector('.detail-cta');
    link.addEventListener('click', activation => activation.preventDefault());
    const click = () => link.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    click(); assert.equal(commands.length, 0);
    win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true }));
    click(); assert.equal(commands.length, 1);
    assert.equal(commands[0][1], 'ajsee_partner_click');
    assert.equal(commands[0][2].partner_event_id, event.id);
    assert.equal(commands[0][2].partner, event.partner);
    assert.equal(commands[0][2].placement, 'event_detail');
    assert.equal(commands[0][2].page_type, 'event-detail');
    assert.equal(commands[0][2].page_language, 'cs');
    assert.equal(commands[0][2].product_type, 'tickets');
    assert.equal(link.getAttribute('href'), event.tickets);
    dom.window.close();
  });
}

test('Prague winter and summer offsets retain the advertised local time', () => {
  assert.equal(events.find(e => e.partner === 'ticketmaster').startDate, '2026-11-16T19:30:00+01:00');
  assert.equal(events.find(e => e.id === 'smsticket-68785').startDate, '2027-04-24T14:00:00+02:00');
  assert.throws(() => validatePilot([{ ...events[0], startDate: '2026-12-13T16:00:00+02:00' }]), /Prague offset/);
});

test('missing feed record preserves an occurrence rather than announcing cancellation', () => {
  const event = { ...events[0], evidence: { ...events[0].evidence, inCurrentFeed: false } };
  assert.equal(eventState(event, now), 'scheduled');
  assert.match(renderEventDetail(event, { now }), /class="detail-cta"/);
  assert.equal(buildEventSchema(event).eventStatus, 'https://schema.org/EventScheduled');
});

test('past, explicitly cancelled and postponed occurrences remain useful without a purchase CTA', () => {
  for (const [event, date, state] of [
    [events[0], new Date('2026-12-14T00:01:00+01:00'), 'past'],
    [{ ...events[0], status: 'cancelled' }, now, 'cancelled'],
    [{ ...events[0], status: 'postponed' }, now, 'postponed']
  ]) {
    assert.equal(eventState(event, date), state);
    const dom = new JSDOM(renderEventDetail(event, { now: date }));
    assert.equal(dom.window.document.querySelector('.detail-cta'), null);
    assert.ok(dom.window.document.querySelector('.detail-status'));
    assert.ok(dom.window.document.querySelector('.detail-related a[href]'));
    dom.window.close();
  }
});

test('unknown price is never presented as free; malformed prices and duplicate occurrence IDs fail closed', () => {
  const korn = events.find(e => e.partner === 'ticketmaster');
  assert.match(renderEventDetail(korn, { now }), /Cenu ověříte u&nbsp;prodejce/);
  assert.throws(() => validatePilot([{ ...korn, price: { minimum: 0, currency: 'CZK', checkedAt: '2026-10-20' } }]), /positive verified/);
  assert.throws(() => validatePilot([events[0], events[0]]), /identity/);
});

test('editorial copy and Czech prepositions stay escaped and readable without JavaScript', () => {
  const event = { ...events[0], introduction: 'Večer v Ostravě a hudba <script>alert(1)</script>' };
  const dom = new JSDOM(renderEventDetail(event, { now }));
  assert.equal(dom.window.document.querySelector('script'), null);
  assert.match(dom.window.document.querySelector('.detail-lead').textContent, /v\u00a0Ostravě a\u00a0hudba/);
  assert.equal(dom.window.document.querySelectorAll('.detail-editorial p').length, 3);
  dom.window.close();
});

test('production mode skips the preview builder without creating files or requiring preview content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ajsee-event-preview-'));
  try {
    const result = spawnSync(process.execPath, [new URL('../scripts/build-event-detail-preview.mjs', import.meta.url).pathname], {
      cwd: directory, env: { ...process.env, CONTEXT: 'production', EVENT_DETAIL_PREVIEW: '' }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

if (process.env.EVENT_DETAIL_BUILT === '1') {
  test('built preview has eight complete noindex frames and never enters the public sitemap', () => {
    const sitemap = fs.readFileSync('dist/sitemap.xml', 'utf8');
    assert.doesNotMatch(sitemap, /\/previews\//);
    assert.equal((sitemap.match(/<loc>/g) || []).length, 222);
    const template = new JSDOM(fs.readFileSync('dist/templates/event-detail-preview.html', 'utf8'));
    assert.match(template.window.document.querySelector('meta[name="robots"]').content, /noindex/);
    template.window.close();
    for (const event of events) for (const theme of ['light', 'dark']) {
      const html = fs.readFileSync(`dist${PREVIEW_ROOT}/${event.slug}-${theme}.html`, 'utf8');
      const dom = new JSDOM(html), doc = dom.window.document;
      assert.equal(doc.documentElement.lang, 'cs');
      assert.match(doc.querySelector('meta[name="robots"]').content, /noindex/);
      assert.equal(doc.querySelectorAll('link[hreflang]').length, 0);
      assert.ok(doc.querySelector('footer').textContent.includes('2026'));
      assert.ok(doc.querySelector('footer a[href="mailto:info@ajsee.cz"]'));
      assert.ok(doc.querySelector('[data-open-cookie-settings]'));
      const scripts = [...doc.querySelectorAll('script[src]')];
      assert.ok(scripts.length > 0, 'Bundled shared consent/navigation must be present.');
      for (const script of scripts) assert.ok(fs.existsSync('dist' + script.getAttribute('src')));
      for (const link of doc.querySelectorAll('link[rel="stylesheet"][href^="/"]')) assert.ok(fs.existsSync('dist' + link.getAttribute('href')));
      assert.equal(JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent).startDate, event.startDate);
      assert.equal(doc.querySelector('.detail-cta').getAttribute('href'), event.tickets);
      dom.window.close();
    }
  });
}
