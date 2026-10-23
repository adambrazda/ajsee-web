import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { AI_SEARCH_COPY } from '../src/ai-search/copy.js';
import { renderAiSearchIdleMarkup } from '../src/ai-search/idle-markup.js';
import {
  getSharedEventFiltersMarkup,
  syncSharedEventFilterDisclosureCopy
} from '../src/event-filters.js';

const root = process.cwd();
const brandMark = await readFile(path.join(root, 'src/assets/ajsee-ai-mark.svg'), 'utf8');

// Prerender the same idle shell as the controller. Waiting for translations or
// event data must not change the height of the search form after first paint.
for (const [lang, copy] of Object.entries(AI_SEARCH_COPY)) {
  const dictionary = JSON.parse(await readFile(path.join(root, `src/locales/${lang}.json`), 'utf8'));
  const translated = key => dictionary[key] ?? key.split('.').reduce((value, part) => value?.[part], dictionary);
  const files = lang === 'cs'
    ? ['index.html', 'events.html', 'events/index.html']
    : [`${lang}/index.html`, `${lang}/events/index.html`];

  for (const file of files) {
    const output = path.join(root, 'dist', file);
    const dom = new JSDOM(await readFile(output, 'utf8'));
    const document = dom.window.document;
    const form = document.getElementById('events-filters-form');
    if (!form?.querySelector('[data-ai-static-intro]')) {
      throw new Error(`Missing static search shell in ${file}`);
    }

    // Inert controls reserve their final space without accepting input before
    // the controller binds its handlers. Runtime replaces this pending shell.
    const intro = document.createElement('div');
    intro.className = 'ai-event-search';
    intro.dataset.aiStaticIntro = '';
    intro.dataset.state = 'idle';
    intro.setAttribute('inert', '');
    intro.innerHTML = renderAiSearchIdleMarkup({ copy, brandMark }) +
      '<div class="ai-event-search__turnstile"></div>';
    const explanation = document.createElement('span');
    explanation.className = 'sr-only';
    explanation.dataset.i18nKey = 'ai-search-static-intro';
    explanation.textContent = dictionary['ai-search-static-intro'];
    intro.append(explanation);

    form.innerHTML = getSharedEventFiltersMarkup();
    form.dataset.ajseeSharedEventFilters = 'v1';
    for (const node of form.querySelectorAll('[data-i18n-key]')) {
      const text = translated(node.dataset.i18nKey);
      if (typeof text === 'string' && text.trim()) node.textContent = text;
    }
    for (const [dataKey, attribute] of [['i18nPlaceholder', 'placeholder'], ['i18nAria', 'aria-label']]) {
      for (const node of form.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g, char => '-' + char.toLowerCase())}]`)) {
        const text = translated(node.dataset[dataKey]);
        if (typeof text === 'string' && text.trim()) node.setAttribute(attribute, text);
      }
    }
    syncSharedEventFilterDisclosureCopy(document);
    form.prepend(intro);
    writeFileSync(output, dom.serialize() + '\n');
    dom.window.close();
  }
}
console.log('Static search shells generated (12 localized pages and the Czech directory alias).');
