import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { loadEnv } from 'vite';
import { getSharedEventFiltersMarkup, syncSharedEventFilterDisclosureCopy } from '../src/event-filters.js';
import { getAiEventSearchMarkup } from '../src/ai-search/ui-markup.js';
import { getAiSearchFirstPaintScript } from '../src/ai-search/runtime-config.js';

const languages = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const valueAt = (dictionary, key) => dictionary[key] ?? key.split('.').reduce((value, part) => value?.[part], dictionary);

export function renderEventFilters(html, { locale = 'cs', dictionary = {}, brandMark = '', enabled = '', sitekey = '' } = {}) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const form = doc.getElementById('events-filters-form');
  if (!form || doc.body.dataset.page !== 'events') { dom.window.close(); return html; }
  const intro = form.querySelector('[data-ai-static-intro]')?.outerHTML;
  if (!intro) throw new Error('Events AI explanation is missing');
  form.innerHTML = intro + getSharedEventFiltersMarkup();
  form.dataset.ajseeSharedEventFilters = 'v1';
  form.dataset.ajseePrerenderedFilters = 'v1';
  form.dataset.ajseeFilterDetailsExpanded = 'false';
  for (const element of form.querySelectorAll('[data-i18n-key]')) {
    const value = valueAt(dictionary, element.dataset.i18nKey);
    if (typeof value === 'string' && value.trim()) element.textContent = value;
  }
  for (const [attribute, target] of [['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria', 'aria-label']]) {
    for (const element of form.querySelectorAll(`[${attribute}]`)) {
      const value = valueAt(dictionary, element.getAttribute(attribute));
      if (typeof value === 'string' && value.trim()) element.setAttribute(target, value);
    }
  }
  syncSharedEventFilterDisclosureCopy(doc);

  const template = doc.createElement('template');
  template.setAttribute('data-ai-first-paint-template', '');
  template.innerHTML = `<div class="ai-event-search" data-ai-static-intro data-ai-first-paint data-state="idle" aria-busy="false">${getAiEventSearchMarkup(brandMark, locale)}</div>`;
  for (const control of template.content.querySelectorAll('input, button')) control.disabled = true;
  form.append(template);
  doc.querySelector('[data-event-filters-first-paint]')?.remove();
  const script = doc.createElement('script');
  script.setAttribute('data-event-filters-first-paint', '');
  script.textContent = getAiSearchFirstPaintScript({ enabled, sitekey });
  form.after(script);
  const result = dom.serialize();
  dom.window.close();
  return result;
}

export async function renderBuiltEventFilters(root = process.cwd(), env = process.env) {
  const brandMark = await readFile(path.join(root, 'src/assets/ajsee-ai-mark.svg'), 'utf8');
  let count = 0;
  for (const locale of languages) {
    const base = JSON.parse(await readFile(path.join(root, `src/locales/${locale}.json`), 'utf8'));
    let page = {};
    try { page = JSON.parse(await readFile(path.join(root, `src/locales/${locale}/events.json`), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const dictionary = { ...base, ...page, filters: { ...base.filters, ...page.filters } };
    const prefix = locale === 'cs' ? 'dist' : `dist/${locale}`;
    for (const relative of [`${prefix}/events.html`, `${prefix}/events/index.html`]) {
      const file = path.join(root, relative);
      try { await access(file); } catch { continue; }
      const html = await readFile(file, 'utf8');
      await writeFile(file, renderEventFilters(html, { locale, dictionary, brandMark,
        enabled: env.VITE_AI_SEARCH_ENABLED, sitekey: env.VITE_TURNSTILE_SITE_KEY }));
      count++;
    }
  }
  if (count < languages.length) throw new Error('Some localized Events pages were not rendered');
  return count;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(`[event-filters] ${await renderBuiltEventFilters(process.cwd(), loadEnv('production', process.cwd(), 'VITE_'))} initial forms rendered`);
}
