import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { initReviewEngagement } from '../src/review-engagement.js';

const root = process.cwd();
const builderPath = path.join(root, 'scripts', 'build-review-details.mjs');

const expected = {
  cs: {
    preview: ['Sdílet článek', 'Pošlete článek někomu, koho by mohl zaujmout.'],
    review: ['Sdílet recenzi', 'Pošlete ji někomu, koho by mohla zaujmout.']
  },
  en: {
    preview: ['Share this article', 'Send it to someone who might enjoy it.'],
    review: ['Share this review', 'Send it to someone who might enjoy it.']
  },
  de: {
    preview: ['Artikel teilen', 'Senden Sie ihn an jemanden, den er interessieren könnte.'],
    review: ['Rezension teilen', 'Senden Sie sie an jemanden, den sie interessieren könnte.']
  },
  sk: {
    preview: ['Zdieľať článok', 'Pošlite článok niekomu, koho by mohol zaujať.'],
    review: ['Zdieľať recenziu', 'Pošlite ju niekomu, koho by mohla zaujať.']
  },
  pl: {
    preview: ['Udostępnij artykuł', 'Wyślij go komuś, kogo może zainteresować.'],
    review: ['Udostępnij recenzję', 'Wyślij ją komuś, kogo może zainteresować.']
  },
  hu: {
    preview: ['Cikk megosztása', 'Küldje el a cikket valakinek, akit érdekelhet.'],
    review: ['Kritika megosztása', 'Küldje el valakinek, akit érdekelhet.']
  }
};

function renderPanel(language, contentType) {
  const attribute = contentType
    ? ` data-review-content-type="${contentType}"`
    : '';

  const dom = new JSDOM(
    `<!doctype html>
      <html lang="${language}">
        <head>
          <link rel="canonical" href="https://ajsee.cz/reviews/test/" />
        </head>
        <body>
          <article class="review-detail" data-review-slug="test"${attribute}>
            <h1>Test title</h1>
            <div class="blog-content"><p>Body</p></div>
          </article>
        </body>
      </html>`,
    { url: 'https://ajsee.cz/reviews/test/' }
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true
  });

  const panel = initReviewEngagement();

  return {
    dom,
    heading: panel.querySelector('.review-engagement__title').textContent,
    description: panel.querySelector('.review-engagement__description').textContent
  };
}

test('review detail builder exposes the normalized content type', () => {
  const source = fs.readFileSync(builderPath, 'utf8');

  assert.match(
    source,
    /data-review-content-type="\$\{escapeAttr\(review\.contentType === 'preview' \? 'preview' : 'review'\)\}"/
  );
});

test('theatre previews use localized article sharing copy', () => {
  for (const [language, labels] of Object.entries(expected)) {
    const result = renderPanel(language, 'preview');

    assert.equal(result.heading, labels.preview[0], `${language} heading`);
    assert.equal(
      result.description,
      labels.preview[1],
      `${language} description`
    );

    result.dom.window.close();
  }
});

test('reviews keep the existing localized review sharing copy', () => {
  for (const [language, labels] of Object.entries(expected)) {
    const result = renderPanel(language, 'review');

    assert.equal(result.heading, labels.review[0], `${language} heading`);
    assert.equal(
      result.description,
      labels.review[1],
      `${language} description`
    );

    result.dom.window.close();
  }
});

test('missing content type safely falls back to review copy', () => {
  const result = renderPanel('cs', '');

  assert.equal(result.heading, expected.cs.review[0]);
  assert.equal(result.description, expected.cs.review[1]);

  result.dom.window.close();
});
