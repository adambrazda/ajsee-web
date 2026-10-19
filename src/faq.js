// Progressive enhancement only. Native disclosures work without this module.
import { syncFaqSchema } from './faq-schema.js';

export function normalizeFaqSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function initFaq(root = document.getElementById('faq')) {
  if (!root || root.dataset.faqEnhanced === '1') return null;
  root.dataset.faqEnhanced = '1';
  const doc = root.ownerDocument, win = doc.defaultView;
  const input = root.querySelector('[data-faq-query]');
  const items = [...root.querySelectorAll('[data-faq-item]')];
  const groups = [...root.querySelectorAll('[data-faq-group]')];
  const select = root.querySelector('[data-faq-topic-select]');
  let topic = 'all', searchOpenState = null;

  function render() {
    const tokens = normalizeFaqSearch(input.value).match(/[\p{L}\p{N}]+/gu) || [];
    if (tokens.length && !searchOpenState) searchOpenState = new Map(items.map((item) => [item, item.open]));
    if (!tokens.length && searchOpenState) {
      for (const [item, open] of searchOpenState) item.open = open;
      searchOpenState = null;
    }
    const matches = new Map(items.map((item) => {
      const text = normalizeFaqSearch(item.querySelector('[data-faq-question]').textContent + ' ' + item.querySelector('[data-faq-answer-text]').textContent);
      const words = new Set(text.match(/[\p{L}\p{N}]+/gu) || []);
      return [item, tokens.every((token) => token.length <= 2 ? words.has(token) : text.includes(token))];
    }));
    let count = 0;
    for (const item of items) {
      const group = item.closest('[data-faq-group]').dataset.faqGroup;
      item.hidden = !matches.get(item) || (topic !== 'all' && topic !== group);
      if (!item.hidden) { count++; if (tokens.length) item.open = true; }
    }
    for (const group of groups) group.hidden = ![...group.querySelectorAll('[data-faq-item]')].some((item) => !item.hidden);
    for (const button of root.querySelectorAll('[data-faq-topic]')) button.setAttribute('aria-pressed', String(button.dataset.faqTopic === topic));
    for (const badge of root.querySelectorAll('[data-faq-topic-count]')) {
      const key = badge.dataset.faqTopicCount;
      const value = items.filter((item) => matches.get(item) && (key === 'all' || item.closest('[data-faq-group]').dataset.faqGroup === key)).length;
      if (badge.textContent !== String(value)) badge.textContent = String(value);
    }
    select.value = topic;
    const counter = root.querySelector('[data-faq-count]');
    if (counter.textContent !== String(count)) counter.textContent = String(count);
    root.querySelector('[data-faq-empty]').hidden = count !== 0;
    root.querySelector('[data-faq-clear]').hidden = !input.value;
    for (const button of root.querySelectorAll('.faq-results-bar [data-faq-reset]')) button.hidden = !tokens.length && topic === 'all';
    root.dispatchEvent(new win.CustomEvent('ajsee:faq-filtered', { bubbles: true, detail: { count, topic } }));
    return count;
  }
  function reset() { topic = 'all'; input.value = ''; render(); }
  function revealHash() {
    let target;
    try { target = doc.getElementById(decodeURIComponent(win.location.hash.slice(1))); } catch { return; }
    if (!target?.matches('[data-faq-item]')) return;
    reset(); target.open = true;
    win.requestAnimationFrame(() => target.scrollIntoView?.({ block: 'start', behavior: 'auto' }));
  }
  root.querySelector('[data-faq-search-form]').addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { input.value = ''; render(); }
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-faq-topic], [data-faq-clear], [data-faq-reset]');
    if (!button) return;
    if (button.hasAttribute('data-faq-topic')) { topic = button.dataset.faqTopic; render(); }
    else if (button.hasAttribute('data-faq-clear')) { input.value = ''; render(); input.focus(); }
    else { reset(); input.focus(); }
  });
  select.addEventListener('change', () => { topic = select.value; render(); });
  win.addEventListener('hashchange', revealHash);

  // Language switching translates existing nodes; refresh after those changes settle.
  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    win.requestAnimationFrame(() => { scheduled = false; render(); syncFaqSchema(doc); });
  }
  const observer = new win.MutationObserver((records) => {
    if (records.some((record) => {
      const element = record.target.nodeType === 3 ? record.target.parentElement : record.target;
      return element?.closest?.('[data-i18n-key]');
    })) refresh();
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  render(); syncFaqSchema(doc); revealHash();
  return { render, reset, refresh, disconnect: () => observer.disconnect() };
}

function boot() { if (document.body?.dataset.page === 'faq') initFaq(); }
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
