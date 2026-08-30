import {
  MAX_CLARIFICATION_ROUNDS
} from './clarification-context.js';

import '../styles/partials/_ai-event-search.scss';

const AI_SEARCH_ENDPOINT =
  '/api/ai-event-search';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TURNSTILE_TEST_SITEKEY =
  '1x00000000000000000000AA';

const TURNSTILE_ACTION =
  'ai_event_search';

const DEPLOY_PREVIEW_HOST_RE =
  /^deploy-preview-\d+--ajsee-demo\.netlify\.app$/i;

const SUPPORTED_LOCALES =
  new Set([
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]);

const COPY = {
  cs: {
    badge: 'AI',
    label: 'Co byste chtěli zažít?',
    helper:
      'Popište zážitek vlastními slovy. AI převede váš požadavek na filtry AJSEE.',
    placeholder:
      'Např. koncert v Praze tento víkend',
    submit:
      'Najít pomocí AI',
    loading:
      'Rozumím dotazu…',
    invalid:
      'Napište alespoň 2 znaky.',
    clarification:
      'Potřebuji ještě malé upřesnění.',
    success:
      'Dotaz jsem pochopil. AI spojení funguje; v dalším kroku použijeme rozpoznané filtry.',
    temporary:
      'AI vyhledávání je teď dočasně nedostupné. Zkuste to za chvíli.',
    generic:
      'Dotaz se nepodařilo zpracovat. Zkuste jej prosím upravit.'
  },

  en: {
    badge: 'AI',
    label: 'What would you like to experience?',
    helper:
      'Describe it in your own words. AI will translate your request into AJSEE filters.',
    placeholder:
      'E.g. concert in Prague this weekend',
    submit:
      'Find with AI',
    loading:
      'Understanding your request…',
    invalid:
      'Enter at least 2 characters.',
    clarification:
      'I need one more detail.',
    success:
      'I understood your request. The AI connection works; next we will apply the recognized filters.',
    temporary:
      'AI search is temporarily unavailable. Please try again shortly.',
    generic:
      'Your request could not be processed. Please try rephrasing it.'
  },

  de: {
    badge: 'AI',
    label: 'Was möchten Sie erleben?',
    helper:
      'Beschreiben Sie Ihren Wunsch mit eigenen Worten. Die KI überträgt ihn in AJSEE-Filter.',
    placeholder:
      'Z. B. Konzert in Prag am Wochenende',
    submit:
      'Mit KI suchen',
    loading:
      'Anfrage wird verstanden…',
    invalid:
      'Bitte mindestens 2 Zeichen eingeben.',
    clarification:
      'Ich brauche noch eine kleine Präzisierung.',
    success:
      'Die Anfrage wurde verstanden. Die KI-Verbindung funktioniert; als Nächstes wenden wir die erkannten Filter an.',
    temporary:
      'Die KI-Suche ist vorübergehend nicht verfügbar. Bitte versuchen Sie es gleich noch einmal.',
    generic:
      'Die Anfrage konnte nicht verarbeitet werden. Bitte formulieren Sie sie anders.'
  },

  sk: {
    badge: 'AI',
    label: 'Čo by ste chceli zažiť?',
    helper:
      'Opíšte zážitok vlastnými slovami. AI prevedie vašu požiadavku na filtre AJSEE.',
    placeholder:
      'Napr. koncert v Prahe tento víkend',
    submit:
      'Nájsť pomocou AI',
    loading:
      'Rozumiem požiadavke…',
    invalid:
      'Napíšte aspoň 2 znaky.',
    clarification:
      'Potrebujem ešte malé upresnenie.',
    success:
      'Požiadavku som pochopil. AI spojenie funguje; v ďalšom kroku použijeme rozpoznané filtre.',
    temporary:
      'AI vyhľadávanie je dočasne nedostupné. Skúste to o chvíľu.',
    generic:
      'Požiadavku sa nepodarilo spracovať. Skúste ju prosím upraviť.'
  },

  pl: {
    badge: 'AI',
    label: 'Czego chcesz doświadczyć?',
    helper:
      'Opisz to własnymi słowami. AI przełoży Twoją prośbę na filtry AJSEE.',
    placeholder:
      'Np. koncert w Pradze w ten weekend',
    submit:
      'Znajdź z AI',
    loading:
      'Rozumiem zapytaniu…',
    invalid:
      'Wpisz co najmniej 2 znaki.',
    clarification:
      'Potrzebuję jeszcze jednej informacji.',
    success:
      'Zapytanie zostało zrozumiane. Połączenie AI działa; w kolejnym kroku zastosujemy rozpoznane filtry.',
    temporary:
      'Wyszukiwanie AI jest chwilowo niedostępne. Spróbuj ponownie za chwilę.',
    generic:
      'Nie udało się przetworzyć zapytania. Spróbuj sformułować je inaczej.'
  },

  hu: {
    badge: 'AI',
    label: 'Milyen élményt keresel?',
    helper:
      'Írd le saját szavaiddal. Az AI AJSEE-szűrőkké alakítja a kérésedet.',
    placeholder:
      'Pl. koncert Prágában hétvégén',
    submit:
      'Keresés AI-val',
    loading:
      'Értelmezem a kérést…',
    invalid:
      'Írj be legalább 2 karaktert.',
    clarification:
      'Még egy kis pontosításra van szükségem.',
    success:
      'A kérést megértettem. Az AI-kapcsolat működik; a következő lépésben alkalmazzuk a felismert szűrőket.',
    temporary:
      'Az AI-keresés átmenetileg nem érhető el. Próbáld újra rövidesen.',
    generic:
      'A kérést nem sikerült feldolgozni. Próbáld másképp megfogalmazni.'
  }
};

const CLARIFICATION_COPY = {
  cs: {
    placeholder:
      'Odpovězte nebo upřesněte požadavek…',
    submit:
      'Odeslat odpověď',
    yes:
      'Ano',
    edit:
      'Ne, upravím',
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
      'No, I’ll clarify',
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
      'Nein, ich präzisiere',
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
      'Nie, upravím',
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
      'Nie, doprecyzuję',
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
      'Nem, pontosítom',
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

function isDeployPreviewHost() {
  return DEPLOY_PREVIEW_HOST_RE.test(
    String(
      globalThis.location?.hostname ||
      ''
    )
  );
}

function loadTurnstile() {
  if (
    globalThis.turnstile &&
    typeof globalThis.turnstile.render ===
      'function'
  ) {
    return Promise.resolve(
      globalThis.turnstile
    );
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise =
    new Promise(
      (resolve, reject) => {
        const timeout =
          globalThis.setTimeout(
            () => {
              turnstileScriptPromise =
                null;

              reject(
                new Error(
                  'TURNSTILE_LOAD_TIMEOUT'
                )
              );
            },
            15_000
          );

        const finish = () => {
          if (
            globalThis.turnstile &&
            typeof globalThis.turnstile
              .render ===
              'function'
          ) {
            globalThis.clearTimeout(
              timeout
            );

            resolve(
              globalThis.turnstile
            );

            return;
          }

          globalThis.clearTimeout(
            timeout
          );

          turnstileScriptPromise =
            null;

          reject(
            new Error(
              'TURNSTILE_UNAVAILABLE'
            )
          );
        };

        const fail = () => {
          globalThis.clearTimeout(
            timeout
          );

          turnstileScriptPromise =
            null;

          reject(
            new Error(
              'TURNSTILE_LOAD_FAILED'
            )
          );
        };

        const existing =
          document.querySelector(
            'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'
          );

        if (existing) {
          existing.addEventListener(
            'load',
            finish,
            {
              once:
                true
            }
          );

          existing.addEventListener(
            'error',
            fail,
            {
              once:
                true
            }
          );

          globalThis.setTimeout(
            () => {
              if (
                globalThis.turnstile
              ) {
                finish();
              }
            },
            0
          );

          return;
        }

        const script =
          document.createElement(
            'script'
          );

        script.src =
          TURNSTILE_SCRIPT_URL;

        script.async =
          true;

        script.defer =
          true;

        script.dataset
          .ajseeTurnstileApi =
          'v1';

        script.addEventListener(
          'load',
          finish,
          {
            once:
              true
          }
        );

        script.addEventListener(
          'error',
          fail,
          {
            once:
              true
          }
        );

        (
          document.head ||
          document.documentElement
        ).appendChild(
          script
        );
      }
    );

  return turnstileScriptPromise;
}

function createTokenProvider(
  container
) {
  let widgetId =
    null;

  let pending =
    null;

  const settle = (
    type,
    value
  ) => {
    if (!pending) {
      return;
    }

    const current =
      pending;

    pending =
      null;

    globalThis.clearTimeout(
      current.timeout
    );

    if (type === 'resolve') {
      current.resolve(
        value
      );

      return;
    }

    current.reject(
      value instanceof Error
        ? value
        : new Error(
            String(
              value ||
              'TURNSTILE_FAILED'
            )
          )
    );
  };

  return async function getToken() {
    if (pending) {
      throw new Error(
        'TURNSTILE_BUSY'
      );
    }

    const turnstile =
      await loadTurnstile();

    return new Promise(
      (resolve, reject) => {
        const timeout =
          globalThis.setTimeout(
            () => {
              settle(
                'reject',
                new Error(
                  'TURNSTILE_TIMEOUT'
                )
              );
            },
            30_000
          );

        pending = {
          resolve,
          reject,
          timeout
        };

        try {
          if (widgetId === null) {
            widgetId =
              turnstile.render(
                container,
                {
                  sitekey:
                    TURNSTILE_TEST_SITEKEY,

                  action:
                    TURNSTILE_ACTION,

                  execution:
                    'execute',

                  appearance:
                    'interaction-only',

                  theme:
                    'auto',

                  language:
                    'auto',

                  callback:
                    token => {
                      settle(
                        'resolve',
                        token
                      );
                    },

                  'error-callback':
                    errorCode => {
                      settle(
                        'reject',
                        new Error(
                          `TURNSTILE_ERROR_${errorCode}`
                        )
                      );

                      return true;
                    },

                  'expired-callback':
                    () => {
                      settle(
                        'reject',
                        new Error(
                          'TURNSTILE_EXPIRED'
                        )
                      );
                    },

                  'timeout-callback':
                    () => {
                      settle(
                        'reject',
                        new Error(
                          'TURNSTILE_CHALLENGE_TIMEOUT'
                        )
                      );
                    }
                }
              );
          } else {
            turnstile.reset(
              widgetId
            );
          }

          turnstile.execute(
            container
          );
        } catch (error) {
          settle(
            'reject',
            error
          );
        }
      }
    );
  };
}

function setState(
  root,
  {
    state,
    message = ''
  }
) {
  root.dataset.state =
    state;

  root.setAttribute(
    'aria-busy',
    state === 'loading'
      ? 'true'
      : 'false'
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

function temporaryFailure(
  status
) {
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
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
    null
} = {}) {
  /*
   * V1 rollout is deliberately fail-closed:
   * the UI exists only on Netlify Deploy Previews.
   * Production gets no AI control until a real
   * Turnstile sitekey is configured.
   */
  if (
    !form ||
    !isDeployPreviewHost()
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

  root.innerHTML = `
    <div class="ai-event-search__heading">
      <label
        class="ai-event-search__label"
        for="ai-event-search-query"
        data-ai-search-label
      ></label>

      <span
        class="ai-event-search__badge"
        data-ai-search-badge
        aria-hidden="true"
      ></span>
    </div>

    <p
      class="ai-event-search__helper"
      id="ai-event-search-help"
      data-ai-search-helper
    ></p>

    <div class="ai-event-search__controls">
      <input
        id="ai-event-search-query"
        class="ai-event-search__input"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        minlength="2"
        maxlength="800"
        aria-describedby="ai-event-search-help ai-event-search-status"
      />

      <button
        class="ai-event-search__submit"
        type="button"
        data-ai-search-submit
      ></button>
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

    <p
      class="ai-event-search__status"
      id="ai-event-search-status"
      data-ai-search-status
      role="status"
      aria-live="polite"
      aria-atomic="true"
    ></p>
  `;

  form.prepend(
    root
  );

  const input =
    root.querySelector(
      '#ai-event-search-query'
    );

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

  let pendingClarification =
    null;

  const getClarificationCopy =
    locale =>
      CLARIFICATION_COPY[locale] ||
      CLARIFICATION_COPY.cs;

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
      copy:
        COPY[locale] ||
        COPY.cs
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

    label.textContent =
      copy.label;

    helper.textContent =
      copy.helper;

    badge.textContent =
      copy.badge;

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

  const getTurnstileToken =
    createTokenProvider(
      turnstileContainer
    );

  const runSearch =
    async (
      queryOverride =
        null
    ) => {
      if (
        root.dataset.state ===
        'loading'
      ) {
        return;
      }

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

      if (
        query.length < 2
      ) {
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
            copy.loading
        }
      );

      try {
        const turnstileToken =
          await getTurnstileToken();

        if (
          !turnstileToken
        ) {
          throw new Error(
            'EMPTY_TURNSTILE_TOKEN'
          );
        }

        const response =
          await fetch(
            AI_SEARCH_ENDPOINT,
            {
              method:
                'POST',

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
                    new Date()
                      .toISOString(),

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

        let data =
          null;

        try {
          data =
            await response.json();
        } catch {
          data =
            null;
        }

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

          pendingClarification = {
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
          };

          root.setAttribute(
            'data-clarification-round',
            String(
              nextRound
            )
          );

          if (clarificationActions) {
            clarificationActions.hidden =
              false;
          }

          input.value =
            '';

          refreshCopy();

          setState(
            root,
            {
              state:
                'clarification',

              message:
                pendingClarification
                  .question
            }
          );

          input.focus();

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
                locale
              }
            );
        }

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

        setState(
          root,
          {
            state:
              'success',

            message:
                unsupportedPreferences.length > 0
                  ? applyCopy.partial
                  : applyCopy.success
          }
        );
      } catch (error) {
        const {
          copy:
            latestCopy
        } =
          getCopy();

        setState(
          root,
          {
            state:
              'error',

            message:
              temporaryFailure(
                Number(
                  error?.status
                )
              )
                ? latestCopy
                    .temporary
                : latestCopy
                    .generic
          }
        );
      } finally {
        const {
          copy:
            latestCopy
        } =
          getCopy();

        submit.disabled =
          false;

        const latestLocale =
          normalizeLocale(
            getLocale?.()
          );

        const latestClarificationCopy =
          getClarificationCopy(
            latestLocale
          );

        submit.textContent =
          pendingClarification
            ? latestClarificationCopy
                .submit
            : latestCopy.submit;
      }
    };

  submit.addEventListener(
    'click',
    () => {
      void runSearch();
    }
  );

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

        input.value =
          '';

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
      clearPendingClarification();

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

  return true;
}