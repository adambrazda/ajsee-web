import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('all localized home/search pages preload compiled calendar styles with a no-JS fallback', () => {
  for (const lang of ['cs','en','de','sk','pl','hu']) {
    for (const page of ['', 'events/']) {
      const file = lang === 'cs' ? (page ? 'events.html' : 'index.html') : `${lang}/${page}index.html`;
      const dom = new JSDOM(fs.readFileSync('dist/' + file, 'utf8'));
      try {
        const doc = dom.window.document;
        const link = doc.querySelector('link[rel="preload"][as="style"][href^="/assets/date-overlay-"]');
        assert.ok(link, file);
        assert.match(link.getAttribute('onload'), /rel='stylesheet'/, file);
        assert.ok(fs.statSync('dist' + link.getAttribute('href')).size > 0, file);
        assert.ok(doc.querySelector(`noscript link[rel="stylesheet"][href="${link.getAttribute('href')}"]`), file);
        assert.equal(doc.querySelectorAll('link[href*=".scss"],link[href^="data:"]').length, 0, file);
      } finally { dom.window.close(); }
    }
  }
});
