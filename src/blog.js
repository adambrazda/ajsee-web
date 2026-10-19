import { loadBlogCards, filterBlogCards, normalizeBlogLang } from './blog-content.js';
import { blogCopy, articleCount } from './blog-ui.js';
import { renderBlogResults, blogTypography } from './blog-view.js';

function getLang() {
  const query = new URLSearchParams(window.location.search).get('lang');
  return normalizeBlogLang(query || document.documentElement.lang || 'cs');
}
const cardsCache = new Map();
let activeType = 'all', activeTopic = 'all', generation = 0;

function updateCopy(lang) {
  const copy = blogCopy(lang);
  document.querySelectorAll('[data-blog-copy]').forEach((node) => {
    const value = copy[node.dataset.blogCopy];
    if (typeof value === 'string') node.textContent = blogTypography(value, lang);
  });
  document.querySelectorAll('[data-blog-type]').forEach((button) => {
    button.textContent = blogTypography(copy.filters[button.dataset.blogType], lang);
    button.setAttribute('aria-pressed', String(button.dataset.blogType === activeType));
  });
  document.querySelectorAll('[data-blog-topic] option').forEach((option) => {
    option.textContent = option.value === 'all' ? copy.allTopics : copy.topics[option.value];
  });
  document.querySelector('[data-blog-filters]')?.setAttribute('aria-label', copy.filtersLabel);
}

async function render() {
  const ownGeneration = ++generation, lang = getLang();
  updateCopy(lang);
  if (!cardsCache.has(lang)) {
    // Full build-time content is visible immediately, even with JS disabled.
    try {
      const data = JSON.parse(document.getElementById('blog-initial-data')?.textContent || 'null');
      if (data?.lang === lang && Array.isArray(data.cards)) cardsCache.set(lang, data.cards);
    } catch { /* Fall back to the content endpoints if embedded data is invalid. */ }
  }
  if (!cardsCache.has(lang)) {
    cardsCache.set(lang, loadBlogCards(lang, async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Blog content: ${response.status}`);
      return response.json();
    }));
  }
  const cards = await cardsCache.get(lang);
  if (ownGeneration !== generation) return;
  const list = filterBlogCards(cards, activeType, activeTopic);
  const filtered = activeType !== 'all' || activeTopic !== 'all', copy = blogCopy(lang);
  const results = renderBlogResults(list, lang);
  document.querySelector('[data-blog-feature]').innerHTML = results.featured;
  document.querySelector('[data-blog-feature-section]').hidden = !list.length;
  document.querySelector('[data-blog-feature-label]').textContent = filtered ? copy.selection : copy.latest;
  document.querySelector('[data-blog-grid]').innerHTML = results.grid;
  document.getElementById('blog-list-title').textContent = filtered ? copy.filteredTitle : copy.listTitle;
  document.querySelector('[data-blog-list-section]').hidden = list.length === 1;
  document.querySelector('[data-blog-count]').textContent = articleCount(list.length, lang);
  document.querySelector('[data-blog-reset-filters]').hidden = !filtered;
  window.dispatchEvent(new CustomEvent('ajsee:blog-rendered', { detail: { lang, count: list.length } }));
}

function initBlog() {
  if (document.body?.dataset.page !== 'blog') return;
  document.querySelector('[data-blog-filters]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-blog-type]');
    if (!button) return;
    activeType = button.dataset.blogType;
    void render();
  });
  document.querySelector('[data-blog-topic]')?.addEventListener('change', (event) => {
    activeTopic = event.target.value;
    void render();
  });
  document.getElementById('blog')?.addEventListener('click', (event) => {
    if (!event.target.closest('[data-blog-reset], [data-blog-reset-filters]')) return;
    activeType = 'all'; activeTopic = 'all';
    document.querySelector('[data-blog-topic]').value = 'all';
    void render();
  });
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; void render(); });
  };
  window.addEventListener('AJSEE:langChanged', refresh);
  window.addEventListener('ajsee:lang-changed', refresh);
  window.addEventListener('popstate', refresh);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  void render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBlog, { once: true });
else initBlog();
