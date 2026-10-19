import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { CONTEST, getContestState, renderContest, contestPath } from '../src/contests/colosseum-contest.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const promo = JSON.parse(read('src/content/colosseum-contest-promo.json'));
const langs = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

test('the competition uses Prague time across the October daylight-saving change', () => {
  assert.equal(getContestState('2026-10-20T16:59:59Z'), 'upcoming');
  assert.equal(getContestState('2026-10-20T17:00:00Z'), 'active');
  assert.equal(getContestState('2026-11-01T23:59:59.999+01:00'), 'active');
  assert.equal(getContestState('2026-11-02T00:00:00+01:00'), 'ended');
  assert.equal(getContestState('2027-05-30T19:00:00+02:00'), 'ended');
});

for (const lang of langs) {
  test(`${lang}: the banner links to local rules before opening, Instagram when open, and hides when closed`, () => {
    const dom = new JSDOM(read('index.html'), { url: `https://ajsee.cz${lang === 'cs' ? '/' : `/${lang}/`}` });
    const banner = dom.window.document.querySelector('[data-contest-banner]');
    assert.equal(banner.hidden, true, 'No stale promotion should be shown without JavaScript.');
    renderContest(banner, promo[lang], { lang, now: '2026-10-19T13:00:00+02:00' });
    assert.equal(banner.hidden, false);
    assert.equal(new URL(banner.querySelector('[data-contest-primary]').href).pathname, contestPath(lang));
    assert.equal(banner.querySelector('[data-contest-status]').textContent, promo[lang].statusUpcoming);
    renderContest(banner, promo[lang], { lang, now: '2026-10-20T19:00:00+02:00' });
    assert.equal(banner.querySelector('[data-contest-primary]').href, CONTEST.instagram);
    assert.equal(banner.querySelector('[data-contest-primary]').target, '_blank');
    assert.equal(banner.querySelector('[data-contest-status]').textContent, promo[lang].statusActive);
    assert.equal(new URL(banner.querySelector('[data-contest-rules]').href).pathname, contestPath(lang));
    renderContest(banner, promo[lang], { lang, now: CONTEST.end });
    assert.equal(banner.hidden, true);
    // Restoring an old tab must also restore its correct links and state.
    renderContest(banner, promo[lang], { lang, now: '2026-10-19T13:00:00+02:00' });
    assert.equal(banner.querySelector('[data-contest-primary]').hasAttribute('target'), false);
    dom.window.close();
  });

  test(`${lang}: all 13 sections, entry steps and personal-data provisions are present`, () => {
    const { contestRules: rules } = JSON.parse(read(`src/locales/${lang}/colosseum-contest.json`));
    const cs = JSON.parse(read('src/locales/cs/colosseum-contest.json')).contestRules;
    for (let section = 1; section <= 13; section++) {
      assert.ok(rules[`section${section}Title`].startsWith(`${section}. `));
      const doc = new JSDOM(rules[`section${section}Body`]).window.document;
      const sourceDoc = new JSDOM(cs[`section${section}Body`]).window.document;
      assert.equal(doc.querySelectorAll('p').length, sourceDoc.querySelectorAll('p').length, `Section ${section}: no missing paragraphs`);
      assert.equal(doc.querySelectorAll('li').length, sourceDoc.querySelectorAll('li').length, `Section ${section}: no missing list items`);
      assert.equal(doc.querySelectorAll('script,iframe,form,input').length, 0);
    }
    assert.equal(new JSDOM(rules.section4Body).window.document.querySelectorAll('ol > li').length, 3);
    assert.match(rules.section1Body, /17105762/);
    assert.match(rules.section1Body, /26480981/);
    assert.match(rules.section2Body, /Europe\/Prague/);
    assert.match(rules.section2Body, /2026/);
    assert.match(rules.section3Body, /18/);
    assert.match(rules.section6Body, /2027/);
    assert.match(rules.section8Body, /@ajseeofficial/);
    assert.match(rules.section11Body, /https:\/\/colosseum.eu\/gdpr/);
    assert.match(rules.section11Body, /https:\/\/ajsee.cz\/privacy-policy/);
    assert.match(rules.section12Body, /Instagram/);
    if (lang !== 'cs') assert.notEqual(rules.section11Body, cs.section11Body);
  });
}

test('the rules remain readable without JavaScript and have an in-page table of contents', () => {
  const dom = new JSDOM(read('souteze/filmovy-orchestr-praha/index.html'));
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.contest-rule').length, 13);
  assert.equal(doc.querySelectorAll('.contest-toc a[href^="#section-"]').length, 13);
  assert.equal(doc.querySelector('.contest-rules-content').hasAttribute('hidden'), false);
  assert.match(doc.querySelector('.contest-rules-content').textContent, /sedm kalendářních dnů/);
  assert.equal(doc.querySelector('form'), null, 'Entries belong on Instagram.');
  dom.window.close();
});
