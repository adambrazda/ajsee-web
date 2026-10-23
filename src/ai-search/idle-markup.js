function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared by the static HTML and the interactive controller. The brand mark is
// the repository's trusted SVG, supplied by the build or Vite's raw import.
export function renderAiSearchIdleMarkup({ copy, brandMark }) {
  return `
    <div class="ai-event-search__brand" role="img" aria-label="AJSEE AI">
      <span class="ai-event-search__brand-mark" aria-hidden="true">${brandMark}</span>
      <span class="ai-event-search__brand-name" aria-hidden="true">AJSEE</span>
      <span class="ai-event-search__badge" data-ai-search-badge aria-hidden="true">${escapeHtml(copy.badge)}</span>
    </div>
    <div class="ai-event-search__heading">
      <label class="ai-event-search__label" for="ai-event-search-query" data-ai-search-label>${escapeHtml(copy.label)}</label>
    </div>
    <p class="ai-event-search__helper" id="ai-event-search-help" data-ai-search-helper>${escapeHtml(copy.helper)}</p>
    <div class="ai-event-search__controls">
      <input id="ai-event-search-query" class="ai-event-search__input" type="search"
        autocomplete="off" enterkeyhint="search" minlength="2" maxlength="800"
        placeholder="${escapeHtml(copy.placeholder)}"
        aria-describedby="ai-event-search-help ai-event-search-status" />
      <button class="ai-event-search__submit" type="button" data-ai-search-submit>${escapeHtml(copy.submit)}</button>
    </div>
    <p class="ai-event-search__status" id="ai-event-search-status" data-ai-search-status
      role="status" aria-live="polite" aria-atomic="true"></p>
  `;
}
