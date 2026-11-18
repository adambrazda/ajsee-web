import { formatAiResultSummary } from './result-summary.js';
import {
  MAX_CLARIFICATION_ROUNDS,
  normalizeClarificationContext
} from './clarification-context.js';
import {
  formatLocalIsoWithOffset,
  resolveAiSearchClientConfig
} from './runtime-config.js';
import {
  trackAiSearchOutcome,
  trackAiSearchStep
} from './analytics.js';
import {
  recordAiSearchFeedback
} from './learning.js';

import {
  hasAnalyticsConsent
} from '../utils/consent.js';

import { getAiSearchCopy } from './copy.js';
import { recognizeFallbackFilters } from './fallback-filters.js';
import { renderAiSearchIdleMarkup } from './idle-markup.js';
import { isOpenEndedSearch, needsSearchGuidance } from './search-guidance.js';
import aiBrandMark from '../assets/ajsee-ai-mark.svg?raw';

const AI_SEARCH_ENDPOINT =
  '/api/ai-event-search';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TURNSTILE_ACTION =
  'ai_event_search';

const AI_SEARCH_CLIENT_TIMEOUT_MS =
  20_000;

const SUPPORTED_LOCALES =
  new Set([
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]);


const CLARIFICATION_COPY = {
  cs: {
    placeholder:
      'Odpovězte nebo upřesněte požadavek…',
    submit:
      'Odeslat odpověď',
    yes:
      'Ano',
    edit:
      'Upravit původní dotaz',
    actionsLabel:
      'Možnosti odpovědi',
    limit:
      'Potřebuji přesnější zadání. Napište prosím požadavek znovu celou větou.',
    affirmativeReply:
      'ano'
  },

  en: {
    placeholder:
      'Reply or clarify your request…',
    submit:
      'Send reply',
    yes:
      'Yes',
    edit:
      'Edit original search',
    actionsLabel:
      'Reply options',
    limit:
      'I need a more precise request. Please write your request again as a complete sentence.',
    affirmativeReply:
      'yes'
  },

  de: {
    placeholder:
      'Antworten oder Wunsch präzisieren…',
    submit:
      'Antwort senden',
    yes:
      'Ja',
    edit:
      'Ursprüngliche Anfrage bearbeiten',
    actionsLabel:
      'Antwortoptionen',
    limit:
      'Ich brauche eine genauere Anfrage. Bitte formulieren Sie Ihren Wunsch noch einmal als vollständigen Satz.',
    affirmativeReply:
      'ja'
  },

  sk: {
    placeholder:
      'Odpovedzte alebo spresnite požiadavku…',
    submit:
      'Odoslať odpoveď',
    yes:
      'Áno',
    edit:
      'Upraviť pôvodnú požiadavku',
    actionsLabel:
      'Možnosti odpovede',
    limit:
      'Potrebujem presnejšie zadanie. Napíšte prosím svoju požiadavku znova celou vetou.',
    affirmativeReply:
      'áno'
  },

  pl: {
    placeholder:
      'Odpowiedz lub doprecyzuj prośbę…',
    submit:
      'Wyślij odpowiedź',
    yes:
      'Tak',
    edit:
      'Edytuj pierwotne zapytanie',
    actionsLabel:
      'Opcje odpowiedzi',
    limit:
      'Potrzebuję dokładniejszego opisu. Napisz proszę swoją prośbę ponownie pełnym zdaniem.',
    affirmativeReply:
      'tak'
  },

  hu: {
    placeholder:
      'Válaszolj vagy pontosítsd a kérést…',
    submit:
      'Válasz küldése',
    yes:
      'Igen',
    edit:
      'Eredeti keresés szerkesztése',
    actionsLabel:
      'Válaszlehetőségek',
    limit:
      'Pontosabb kérésre van szükségem. Kérlek, írd le újra a kérésedet egy teljes mondatban.',
    affirmativeReply:
      'igen'
  }
};


const APPLY_COPY = {
  cs: {
    success:
      'Hotovo — upravil jsem filtry podle vašeho zadání.',
    partial:
      'Filtry jsem upravil, ale část požadavku zatím AJSEE neumí použít.'
  },

  en: {
    success:
      'Done — I updated the filters based on your request.',
    partial:
      'I updated the filters, but AJSEE cannot apply part of your request yet.'
  },

  de: {
    success:
      'Fertig — ich habe die Filter entsprechend Ihrer Anfrage angepasst.',
    partial:
      'Die Filter wurden angepasst, aber einen Teil Ihrer Anfrage kann AJSEE noch nicht anwenden.'
  },

  sk: {
    success:
      'Hotovo — filtre som upravil podľa vašej požiadavky.',
    partial:
      'Filtre som upravil, ale časť požiadavky zatiaľ AJSEE nevie použiť.'
  },

  pl: {
    success:
      'Gotowe — filtry zostały dostosowane do Twojego zapytania.',
    partial:
      'Filtry zostały dostosowane, ale AJSEE nie może jeszcze zastosować części zapytania.'
  },

  hu: {
    success:
      'Kész — a szűrőket a kérésed alapján módosítottam.',
    partial:
      'A szűrőket módosítottam, de a kérés egy részét az AJSEE még nem tudja alkalmazni.'
  }
};

const FEEDBACK_COPY = {
  cs: {
    question:
      'Pomohlo v\u00e1m toto vyhled\u00e1v\u00e1n\u00ed?',
    helpful:
      'Ano',
    notHelpful:
      'Ne'
  },

  en: {
    question:
      'Did this search help you?',
    helpful:
      'Yes',
    notHelpful:
      'No'
  },

  de: {
    question:
      'Hat Ihnen diese Suche geholfen?',
    helpful:
      'Ja',
    notHelpful:
      'Nein'
  },

  sk: {
    question:
      'Pomohlo v\u00e1m toto vyh\u013ead\u00e1vanie?',
    helpful:
      '\u00c1no',
    notHelpful:
      'Nie'
  },

  pl: {
    question:
      'Czy to wyszukiwanie by\u0142o pomocne?',
    helpful:
      'Tak',
    notHelpful:
      'Nie'
  },

  hu: {
    question:
      'Seg\u00edtett ez a keres\u00e9s?',
    helpful:
      'Igen',
    notHelpful:
      'Nem'
  }
};

let turnstileScriptPromise =
  null;

function normalizeLocale(value) {
  let locale =
    String(
      value ||
      document.documentElement.lang ||
      'cs'
    )
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

  if (locale === 'cz') {
    locale = 'cs';
  }

  return SUPPORTED_LOCALES.has(locale)
    ? locale
    : 'cs';
}

function loadTurnstile() {
  if (typeof globalThis.turnstile?.render === 'function') {
    return Promise.resolve(globalThis.turnstile);
  }
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.ajseeTurnstileApi = 'v1';

    const timeout = globalThis.setTimeout(() => fail('TURNSTILE_LOAD_TIMEOUT'), 15_000);
    function fail(code) {
      globalThis.clearTimeout(timeout);
      script.remove();
      reject(new Error(code));
    }

    script.addEventListener('load', () => {
      globalThis.clearTimeout(timeout);
      if (typeof globalThis.turnstile?.render === 'function') resolve(globalThis.turnstile);
      else fail('TURNSTILE_UNAVAILABLE');
    }, { once: true });
    script.addEventListener('error', () => fail('TURNSTILE_LOAD_FAILED'), { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

function createTokenProvider(container, sitekey) {
  return function getToken({ signal, onInteractive }) {
    return new Promise((resolve, reject) => {
      let turnstile;
      let widgetId;
      let settled = false;
      let timeout;
      let interactive = false;

      function removeWidget() {
        if (widgetId == null) return;
        try { turnstile.remove(widgetId); } catch { /* Already removed. */ }
        widgetId = null;
      }

      function finish(error, token) {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        globalThis.clearTimeout(timeout);
        removeWidget();
        if (error) reject(error);
        else resolve(token);
      }

      const abort = () => finish(signal.reason);
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });

      loadTurnstile().then(api => {
        if (settled) return;
        turnstile = api;
        timeout = globalThis.setTimeout(() => finish(new Error('TURNSTILE_TIMEOUT')), 30_000);
        widgetId = turnstile.render(container, {
          sitekey,
          action: TURNSTILE_ACTION,
          execution: 'execute',
          appearance: 'interaction-only',
          theme: 'auto',
          language: 'auto',
          callback: token => finish(null, token),
          'before-interactive-callback': () => {
            if (settled || interactive) return;
            interactive = true;
            onInteractive();
          },
          'error-callback': () => {
            finish(new Error('TURNSTILE_WIDGET_ERROR'));
            return true;
          },
          'expired-callback': () => finish(new Error('TURNSTILE_EXPIRED')),
          'timeout-callback': () => finish(new Error('TURNSTILE_CHALLENGE_TIMEOUT'))
        });

        if (settled) removeWidget();
        else turnstile.execute(container);
      }).catch(error => finish(error));
    });
  };
}

function setState(
  root,
  {
    state,
    message = '',
    busy = state === 'loading'
  }
) {
  root.dataset.state =
    state;

  root.setAttribute(
    'aria-busy',
    String(busy)
  );

  const status =
    root.querySelector(
      '[data-ai-search-status]'
    );

  if (status) {
    status.textContent =
      message;
  }
}

export function initAiEventSearch({
  form =
    document.getElementById(
      'events-filters-form'
    ),

  getLocale =
    () =>
      document.documentElement.lang,

  onIntent =
    null,

  onCatalogueSearch = null,
  onFallback = null,
  initialQuery = '',
  initialRefinement = null
} = {}) {
  const clientConfig =
    resolveAiSearchClientConfig({
      hostname:
        globalThis.location?.hostname ||
        '',

      enabled:
        import.meta.env
          ?.VITE_AI_SEARCH_ENABLED,

      sitekey:
        import.meta.env
          ?.VITE_TURNSTILE_SITE_KEY
    });

  if (
    !form ||
    !clientConfig.enabled
  ) {
    return false;
  }

  const existing =
    form.querySelector(
      '[data-ajsee-ai-event-search]'
    );

  if (existing) {
    return true;
  }

  const root =
    document.createElement(
      'div'
    );

  root.className =
    'ai-event-search';

  root.dataset
    .ajseeAiEventSearch =
    'v1';

  root.dataset.state =
    'idle';

  root.setAttribute(
    'aria-busy',
    'false'
  );

  const home = form.ownerDocument.body?.dataset.page === 'home';
  if (!home) root.id = 'events-ai-search';
  root.innerHTML = `
    ${renderAiSearchIdleMarkup({ copy: getAiSearchCopy(normalizeLocale(getLocale()), { home }), brandMark: aiBrandMark })}

    <div class="ai-event-search__clarification-actions" data-ai-search-guidance hidden>
      <button
        class="ai-event-search__clarification-action ai-event-search__clarification-action--edit"
        type="button"
        data-ai-search-guidance-example
      ></button>
    </div>

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

    <button
      class="ai-event-search__manual ai-event-search__clarification-action ai-event-search__clarification-action--edit"
      type="button"
      data-ai-search-manual
      hidden
    ></button>

    <div
      id="ajsee-ai-turnstile"
      class="ai-event-search__turnstile"
      data-ai-search-turnstile
    ></div>
  `;

  form.querySelector('[data-ai-static-intro]')?.remove();

  form.prepend(
    root
  );

  const input =
    root.querySelector(
      '#ai-event-search-query'
    );
  input.value = initialQuery;
  const guidance = root.querySelector('[data-ai-search-guidance]');
  const guidanceExample = root.querySelector('[data-ai-search-guidance-example]');

  const submit =
    root.querySelector(
      '[data-ai-search-submit]'
    );

  const label =
    root.querySelector(
      '[data-ai-search-label]'
    );

  const helper =
    root.querySelector(
      '[data-ai-search-helper]'
    );

  const badge =
    root.querySelector(
      '[data-ai-search-badge]'
    );

  const turnstileContainer =
    root.querySelector(
      '[data-ai-search-turnstile]'
    );
  const manualButton = root.querySelector('[data-ai-search-manual]');
  let activeAttempt = null;

  function endVerification(attempt) {
    attempt.verifying = false;
    if (document.activeElement === manualButton) input.focus();
    manualButton.hidden = true;
  }

  manualButton.addEventListener('click', () => {
    if (!activeAttempt?.verifying) return;
    activeAttempt.manual = true;
    activeAttempt.controller.abort();
  });

  const clarificationActions =
    root.querySelector(
      '[data-ai-search-clarification-actions]'
    );

  const clarificationYes =
    root.querySelector(
      '[data-ai-search-clarification-yes]'
    );

  const clarificationEdit =
    root.querySelector(
      '[data-ai-search-clarification-edit]'
    );

  const feedback =
    root.querySelector(
      '[data-ai-search-feedback]'
    );

  const feedbackQuestion =
    root.querySelector(
      '[data-ai-search-feedback-question]'
    );

  const feedbackButtons =
    Array.from(
      root.querySelectorAll(
        '[data-ai-search-feedback-value]'
      )
    );

  let pendingClarification =
    null;

  const getClarificationCopy =
    locale =>
      CLARIFICATION_COPY[locale] ||
      CLARIFICATION_COPY.cs;

  const getFeedbackCopy =
    locale =>
      FEEDBACK_COPY[locale] ||
      FEEDBACK_COPY.cs;

  const updateFeedbackCopy =
    locale => {
      const feedbackCopy =
        getFeedbackCopy(
          locale
        );

      if (feedbackQuestion) {
        feedbackQuestion.textContent =
          feedbackCopy.question;
      }

      for (
        const button
        of feedbackButtons
      ) {
        button.textContent =
          button.dataset
            .aiSearchFeedbackValue ===
          'helpful'
            ? feedbackCopy.helpful
            : feedbackCopy.notHelpful;
      }
    };

  const setFeedbackValue =
    value => {
      if (!feedback) {
        return;
      }

      feedback.dataset
        .feedbackValue =
        value;

      for (
        const button
        of feedbackButtons
      ) {
        button.setAttribute(
          'aria-pressed',
          button.dataset
            .aiSearchFeedbackValue ===
            value
            ? 'true'
            : 'false'
        );
      }
    };

  const hideFeedback =
    () => {
      if (!feedback) {
        return;
      }

      feedback.hidden =
        true;

      feedback.removeAttribute(
        'data-feedback-value'
      );

      for (
        const button
        of feedbackButtons
      ) {
        button.setAttribute(
          'aria-pressed',
          'false'
        );
      }
    };

  const showFeedback =
    locale => {
      updateFeedbackCopy(
        locale
      );

      if (
        !feedback ||
        !hasAnalyticsConsent()
      ) {
        hideFeedback();
        return;
      }

      feedback.hidden =
        false;
    };

  const hideClarificationActions =
    () => {
      if (clarificationActions) {
        clarificationActions.hidden =
          true;
      }
    };

  const clearPendingClarification =
    () => {
      pendingClarification =
        null;

      root.removeAttribute(
        'data-clarification-round'
      );

      hideClarificationActions();
    };

  const getCopy = () => {
    const locale =
      normalizeLocale(
        getLocale?.()
      );

    return {
      locale,
      copy: getAiSearchCopy(locale, { home })
    };
  };

  const refreshCopy = () => {
    const {
      locale,
      copy
    } =
      getCopy();

    const clarificationCopy =
      getClarificationCopy(
        locale
      );

    updateFeedbackCopy(
      locale
    );

    label.textContent =
      copy.label;

    helper.textContent =
      pendingClarification?.originalQuery || copy.helper;

    badge.textContent =
      copy.badge;
    manualButton.textContent = copy.manualFallback;
    guidanceExample.textContent = copy.guidanceExample;

    input.placeholder =
      pendingClarification
        ? clarificationCopy
            .placeholder
        : copy.placeholder;

    if (clarificationYes) {
      clarificationYes.textContent =
        clarificationCopy.yes;
    }

    if (clarificationEdit) {
      clarificationEdit.textContent =
        clarificationCopy.edit;
    }

    if (clarificationActions) {
      clarificationActions.setAttribute(
        'aria-label',
        clarificationCopy
          .actionsLabel
      );
    }

    if (
      root.dataset.state !==
      'loading'
    ) {
      submit.textContent =
        pendingClarification
          ? clarificationCopy
              .submit
          : copy.submit;
    }
  };

  refreshCopy();

  const showSearchGuidance = ({ message = getCopy().copy.guidance, example = true, focus = true } = {}) => {
    clearPendingClarification();
    hideFeedback();
    refreshCopy();
    guidance.hidden = !example;
    setState(root, { state: 'guidance', message });
    if (focus) input.focus();
  };

  const showClarification = (context, { focus = true } = {}) => {
    pendingClarification = context;
    guidance.hidden = true;
    root.setAttribute('data-clarification-round', String(context.round));
    clarificationActions.hidden = false;
    input.value = '';
    refreshCopy();
    setState(root, { state: 'clarification', message: context.question });
    if (focus) input.focus();
  };

  const getTurnstileToken =
    createTokenProvider(
      turnstileContainer,
      clientConfig.sitekey
    );

  const runSearch =
    async (
      queryOverride =
        null
    ) => {
      if (activeAttempt) return;
      guidance.hidden = true;

      const query =
        String(
          queryOverride ??
          input.value ??
          ''
        )
          .replace(
            /\s+/g,
            ' '
          )
          .trim();

      const {
        locale,
        copy
      } =
        getCopy();

      const requestClarificationContext =
        pendingClarification
          ? {
              originalQuery:
                pendingClarification
                  .originalQuery,

              question:
                pendingClarification
                  .question,

              round:
                pendingClarification
                  .round,

              previousIntent:
                pendingClarification
                  .previousIntent
            }
          : null;

      if (!query || (query.length < 2 && !onCatalogueSearch)) {
        setState(
          root,
          {
            state:
              'error',

            message:
              copy.invalid
          }
        );

        input.focus();

        return;
      }

      const startedAt =
        Date.now();

      if (hasAnalyticsConsent()) trackAiSearchStep('start', { locale }, globalThis);
      if (!requestClarificationContext && (query.length < 2 || isOpenEndedSearch(query, locale))) {
        if (onCatalogueSearch) await onCatalogueSearch({ query, locale, needsDetails: true });
        else showSearchGuidance();
        trackAiSearchOutcome({ outcome: 'guidance', locale }, globalThis, {
          pushToDataLayer: hasAnalyticsConsent()
        });
        return;
      }

      let telemetryOutcome =
        '';

      let telemetryStatus =
        0;

      let telemetryErrorCode =
        '';

      let telemetryRound =
        requestClarificationContext
          ?.round ||
        0;

      let fallbackRequest = null;
      const attempt = { controller: new AbortController(), verifying: true, manual: false };
      activeAttempt = attempt;
      manualButton.hidden = typeof onFallback !== 'function';

      hideFeedback();

      submit.disabled =
        true;

      submit.textContent =
        copy.loading;

      setState(
        root,
        {
          state:
            'loading',

          message:
            copy.verifying,
          busy: false
        }
      );

      try {
        const turnstileToken =
          await getTurnstileToken({
            signal: attempt.controller.signal,
            onInteractive: () => {
              if (hasAnalyticsConsent()) trackAiSearchStep('challenge', { locale }, globalThis);
            }
          });
        if (activeAttempt !== attempt) return;

        if (
          !turnstileToken
        ) {
          throw new Error(
            'EMPTY_TURNSTILE_TOKEN'
          );
        }

        endVerification(attempt);
        setState(root, { state: 'loading', message: copy.loading });

        const requestController = attempt.controller;

        const requestTimeout =
          globalThis.setTimeout(
            () => {
              requestController.abort();
            },
            AI_SEARCH_CLIENT_TIMEOUT_MS
          );

        let response;
        let data;

        try {
          response =
            await fetch(
              AI_SEARCH_ENDPOINT,
              {
                method:
                  'POST',

                signal:
                  requestController.signal,

                headers: {
                  'Content-Type':
                    'application/json',

                  Accept:
                    'application/json'
                },

                body:
                  JSON.stringify({
                    query,
                    locale,
                    now:
                      formatLocalIsoWithOffset(
                        new Date()
                      ),

                    turnstileToken,

                    ...(
                      requestClarificationContext
                        ? {
                            clarificationContext:
                              requestClarificationContext
                          }
                        : {}
                    )
                  })
              }
            );
          telemetryStatus = response.status;
          try {
            data = await response.json();
          } catch (error) {
            if (requestController.signal.aborted) throw error;
            data = null;
          }
        } finally {
          globalThis.clearTimeout(
            requestTimeout
          );
        }

        if (activeAttempt !== attempt) return;

        if (
          !response.ok ||
          !data?.ok ||
          !data?.intent
        ) {
          const error =
            new Error(
              'AI_SEARCH_REQUEST_FAILED'
            );

          error.status =
            response.status;

          error.code =
            data?.code ||
            '';

          throw error;
        }

        const needsDetails = data.needsDetails === true ||
          needsSearchGuidance(data.intent, { needsClarification: data.needsClarification, locale });
        if (onCatalogueSearch) {
          const outcome = await onCatalogueSearch({
            intent: data.intent,
            needsClarification: data.needsClarification === true,
            needsDetails,
            query,
            locale,
            signal: requestController.signal
          });
          if (activeAttempt !== attempt) return;
          telemetryOutcome = outcome;
          telemetryRound = outcome === 'clarification' ? 1 : 0;
          setState(root, { state: 'idle' });
          return;
        }

        if (needsDetails) {
          telemetryOutcome = 'guidance';
          showSearchGuidance();
          return;
        }

        if (
          data.needsClarification
        ) {
          const question =
            String(
              data.intent
                ?.clarification
                ?.question ||
              ''
            ).trim();

          const clarificationCopy =
            getClarificationCopy(
              locale
            );

          if (
            requestClarificationContext &&
            requestClarificationContext
              .round >=
                MAX_CLARIFICATION_ROUNDS
          ) {
            telemetryOutcome =
              'error';

            telemetryErrorCode =
              'clarification-limit';

            clearPendingClarification();

            input.value =
              '';

            refreshCopy();

            setState(
              root,
              {
                state:
                  'clarification',

                message:
                  clarificationCopy
                    .limit
              }
            );

            input.focus();

            return;
          }

          const nextRound =
            requestClarificationContext
              ? requestClarificationContext
                  .round +
                1
              : 1;

          telemetryOutcome =
            'clarification';

          telemetryRound =
            nextRound;

          showClarification({
            originalQuery:
              requestClarificationContext
                ?.originalQuery ||
              query,

            question:
              question ||
              copy.clarification,

            round:
              nextRound,

            previousIntent:
              data.intent
          });

          return;
        }

        clearPendingClarification();

        if (
          requestClarificationContext
        ) {
          input.value =
            '';
        }

        refreshCopy();

        let applicationResult =
          null;

        if (
          typeof onIntent ===
          'function'
        ) {
          applicationResult =
            await onIntent(
              data.intent,
              {
                query,
                originalQuery: requestClarificationContext?.originalQuery || query,
                locale,
                signal: requestController.signal
              }
            );
        }

        if (activeAttempt !== attempt) return;
        const unsupportedPreferences =
          Array.isArray(
            applicationResult
              ?.unsupportedPreferences
          )
            ? applicationResult
                .unsupportedPreferences
            : [];

        const applyCopy =
          APPLY_COPY[locale] ||
          APPLY_COPY.cs;

        telemetryOutcome =
          unsupportedPreferences.length > 0
            ? 'partial'
            : 'success';

        setState(
          root,
          {
            state:
              'success',

            message: [
              formatAiResultSummary(applicationResult, locale),
              unsupportedPreferences.length > 0 ? applyCopy.partial : ''
            ].filter(Boolean).join(' ') || applyCopy.success
          }
        );

        showFeedback(
          locale
        );
      } catch (error) {
        if (activeAttempt !== attempt) return;

        const reason = attempt.manual
          ? 'manual'
          : attempt.verifying
            ? (/TIMEOUT$/.test(error?.message) ? 'verification-timeout' : 'verification-error')
            : (error?.name === 'AbortError' ? 'service-timeout' : 'service-error');

        telemetryOutcome = attempt.manual ? 'manual' : 'error';
        if (!attempt.manual) {
          telemetryErrorCode = error?.name === 'AbortError'
            ? 'client-timeout'
            : (Number(error?.status) >= 100 ? 'api-error' : 'client-error');
        }
        const fallbackQuery = requestClarificationContext?.originalQuery || query;
        clearPendingClarification();
        input.value = fallbackQuery;
        refreshCopy();
        setState(root, { state: 'error', message: getCopy().copy.generic });

        if (typeof onFallback === 'function') {
          fallbackRequest = { query: fallbackQuery, locale, reason };
        }
      } finally {
        if (activeAttempt === attempt) {
          activeAttempt = null;
          if (attempt.verifying) endVerification(attempt);
          if (telemetryOutcome) {
            trackAiSearchOutcome({
              outcome: telemetryOutcome,
              locale,
              durationMs: Date.now() - startedAt,
              httpStatus: telemetryStatus,
              errorCode: telemetryErrorCode,
              clarificationRound: telemetryRound
            }, globalThis, {
              pushToDataLayer: hasAnalyticsConsent()
            });
          }
          submit.disabled = false;
          const latest = getCopy();
          submit.textContent = pendingClarification
            ? getClarificationCopy(latest.locale).submit
            : latest.copy.submit;
        }
      }
      if (fallbackRequest) {
        if (hasAnalyticsConsent()) trackAiSearchStep('fallback', fallbackRequest, globalThis);
        const filters = recognizeFallbackFilters(fallbackRequest.query, locale);
        onFallback({
          ...fallbackRequest,
          filters,
          fallbackFields: ['category', 'city'].filter(field => filters[field]),
          notice: attempt.manual ? 'manual' : 'failed'
        });
        setState(root, { state: 'idle' });
      }
    };

  for (
    const feedbackButton
    of feedbackButtons
  ) {
    feedbackButton.addEventListener(
      'click',
      () => {
        if (
          !feedback ||
          feedback.hidden
        ) {
          return;
        }

        if (
          !hasAnalyticsConsent()
        ) {
          hideFeedback();
          return;
        }

        const value =
          feedbackButton.dataset
            .aiSearchFeedbackValue;

        const recorded =
          recordAiSearchFeedback(
            value
          );

        if (!recorded) {
          return;
        }

        setFeedbackValue(
          value
        );
      }
    );
  }

  submit.addEventListener(
    'click',
    () => {
      void runSearch();
    }
  );

  guidanceExample.addEventListener('click', () => {
    input.value = getCopy().copy.guidanceExample;
    void runSearch();
  });

  input.addEventListener('input', () => {
    if (root.dataset.state !== 'guidance') return;
    guidance.hidden = true;
    setState(root, { state: 'idle' });
  });

  clarificationYes
    ?.addEventListener(
      'click',
      () => {
        if (
          !pendingClarification
        ) {
          return;
        }

        const {
          locale
        } =
          getCopy();

        const reply =
          getClarificationCopy(
            locale
          ).affirmativeReply;

        void runSearch(
          reply
        );
      }
    );

  clarificationEdit
    ?.addEventListener(
      'click',
      () => {
        if (
          !pendingClarification
        ) {
          return;
        }

        input.value = pendingClarification.originalQuery;
        clearPendingClarification();
        refreshCopy();
        setState(root, { state: 'idle' });
        input.focus();
      }
    );

  input.addEventListener(
    'keydown',
    event => {
      if (
        event.key !==
        'Enter'
      ) {
        return;
      }

      event.preventDefault();

      void runSearch();
    }
  );

  const resetClarificationFlow =
    () => {
      if (activeAttempt) {
        const attempt = activeAttempt;
        activeAttempt = null;
        attempt.controller.abort();
        if (attempt.verifying) endVerification(attempt);
        submit.disabled = false;
      }
      clearPendingClarification();
      hideFeedback();
      guidance.hidden = true;

      input.value =
        '';

      setState(
        root,
        {
          state:
            'idle',

          message:
            ''
        }
      );

      refreshCopy();
    };

  form.addEventListener(
    'reset',
    resetClarificationFlow
  );
  form.addEventListener('ajsee:catalogue-refinement-complete', resetClarificationFlow);

  const handleGlobalClear =
    event => {
      const target =
        event.target;

      if (
        !target ||
        typeof target.closest !==
          'function'
      ) {
        return;
      }

      if (
        target.closest(
          '#chipClear'
        )
      ) {
        resetClarificationFlow();
      }
    };

  globalThis.addEventListener(
    'click',
    handleGlobalClear
  );

  const handleLanguageChange =
    () => {
      resetClarificationFlow();
    };

  globalThis.addEventListener(
    'AJSEE:langChanged',
    handleLanguageChange
  );

  globalThis.addEventListener(
    'ajsee:lang-changed',
    handleLanguageChange
  );

  if (initialRefinement) {
    const { value: context } = normalizeClarificationContext({
      originalQuery: initialQuery,
      question: initialRefinement.question,
      round: 1,
      previousIntent: initialRefinement.previousIntent
    }, { locale: getCopy().locale });
    if (context) showClarification(context, { focus: false });
    else showSearchGuidance({ message: initialRefinement.message, example: initialRefinement.example, focus: false });
  }

  return true;
}
