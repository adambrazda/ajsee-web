import { AI_SEARCH_COPY } from './ui-copy.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function getAiEventSearchMarkup(brandMark = '', locale = 'cs') {
  const copy = AI_SEARCH_COPY[locale] || AI_SEARCH_COPY.cs;
  return `
    <div class="ai-event-search__brand" role="img" aria-label="AJSEE AI">
      <span class="ai-event-search__brand-mark" aria-hidden="true">${brandMark}</span>
      <span class="ai-event-search__brand-name" aria-hidden="true">AJSEE</span>
      <span class="ai-event-search__badge" data-ai-search-badge aria-hidden="true">${escape(copy.badge)}</span>
    </div>

    <div class="ai-event-search__heading">
      <label
        class="ai-event-search__label"
        for="ai-event-search-query"
        data-ai-search-label
      >${escape(copy.label)}</label>

    </div>

    <p
      class="ai-event-search__helper"
      id="ai-event-search-help"
      data-ai-search-helper
    >${escape(copy.helper)}</p>

    <div class="ai-event-search__controls">
      <input
        id="ai-event-search-query"
        class="ai-event-search__input"
        type="search"
        autocomplete="off"
        placeholder="${escape(copy.placeholder)}"
        enterkeyhint="search"
        minlength="2"
        maxlength="800"
        aria-describedby="ai-event-search-help ai-event-search-status"
      />

      <button
        class="ai-event-search__submit"
        type="button"
        data-ai-search-submit
      >${escape(copy.submit)}</button>
    </div>

    <p
      class="ai-event-search__status"
      id="ai-event-search-status"
      data-ai-search-status
      role="status"
      aria-live="polite"
      aria-atomic="true"
    ></p>

    <div
      class="ai-event-search__feedback"
      data-ai-search-feedback
      role="group"
      aria-labelledby="ai-event-search-feedback-question"
      hidden
    >
      <p
        class="ai-event-search__feedback-question"
        id="ai-event-search-feedback-question"
        data-ai-search-feedback-question
      ></p>

      <div
        class="ai-event-search__feedback-actions"
      >
        <button
          class="ai-event-search__feedback-button"
          type="button"
          data-ai-search-feedback-value="helpful"
          aria-pressed="false"
        ></button>

        <button
          class="ai-event-search__feedback-button"
          type="button"
          data-ai-search-feedback-value="not_helpful"
          aria-pressed="false"
        ></button>
      </div>
    </div>

    <div
      class="ai-event-search__clarification-actions"
      data-ai-search-clarification-actions
      role="group"
      hidden
    >
      <button
        class="ai-event-search__clarification-action ai-event-search__clarification-action--yes"
        type="button"
        data-ai-search-clarification-yes
      ></button>

      <button
        class="ai-event-search__clarification-action ai-event-search__clarification-action--edit"
        type="button"
        data-ai-search-clarification-edit
      ></button>
    </div>

    <div
      id="ajsee-ai-turnstile"
      class="ai-event-search__turnstile"
      data-ai-search-turnstile
    ></div>
  `;
}
