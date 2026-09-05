import {
  resolveEventImageAnalysis
} from './event-image-analysis.js';

export const
  SMSTICKET_REQUEST_TIMEOUT_MS =
    45000;

export const
  SMSTICKET_MAX_ATTEMPTS =
    2;

export const
  SMSTICKET_RETRY_DELAY_MS =
    1000;

function wait(ms) {
  if (
    !Number.isFinite(ms) ||
    ms <= 0
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

export function
isRetryableSmsticketStatus(
  status
) {
  const normalized =
    Number(status);

  return (
    normalized === 408 ||
    normalized === 429 ||
    normalized >= 500
  );
}

function isRetryableNetworkError(
  error
) {
  return (
    error?.name ===
      'AbortError' ||
    error instanceof
      TypeError
  );
}

export async function
fetchSmsticketXml(
  url,
  {
    fetchImpl =
      globalThis.fetch,

    timeoutMs =
      SMSTICKET_REQUEST_TIMEOUT_MS,

    maxAttempts =
      SMSTICKET_MAX_ATTEMPTS,

    retryDelayMs =
      SMSTICKET_RETRY_DELAY_MS,

    onRetry =
      () => {}
  } = {}
) {
  if (
    typeof fetchImpl !==
    'function'
  ) {
    throw new TypeError(
      'fetchImpl must be a function.'
    );
  }

  const attempts =
    Math.max(
      1,
      Number(maxAttempts) ||
      1
    );

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    let timedOut =
      false;

    const timeout =
      setTimeout(
        () => {
          timedOut =
            true;

          controller.abort();
        },
        timeoutMs
      );

    try {
      const response =
        await fetchImpl(
          url,
          {
            signal:
              controller.signal,

            headers: {
              accept:
                'application/xml,text/xml;q=0.9,*/*;q=0.8',

              'user-agent':
                'AJSEE smsticket sync'
            }
          }
        );

      if (!response.ok) {
        const error =
          new Error(
            `smsticket API returned ${response.status}`
          );

        error.status =
          response.status;

        error.retryable =
          isRetryableSmsticketStatus(
            response.status
          );

        throw error;
      }

      /*
       * Keep the timeout active until the body has
       * been fully downloaded, not only until headers.
       */
      return await response.text();
    } catch (error) {
      let failure =
        error;

      if (timedOut) {
        failure =
          new Error(
            `smsticket request timed out after ${timeoutMs}ms`
          );

        failure.name =
          'TimeoutError';

        failure.retryable =
          true;

        failure.cause =
          error;
      }

      lastError =
        failure;

      const retryable =
        failure?.retryable ===
          true ||
        isRetryableNetworkError(
          failure
        );

      if (
        !retryable ||
        attempt >= attempts
      ) {
        throw failure;
      }

      onRetry({
        attempt,
        maxAttempts:
          attempts,
        error:
          failure
      });

      await wait(
        retryDelayMs *
        attempt
      );
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  throw (
    lastError ||
    new Error(
      'smsticket request failed'
    )
  );
}

export function
refreshSmsticketFallbackPayload(
  payload,
  imageAnalysisCache,
  refreshedAt =
    new Date().toISOString()
) {
  const existingEvents =
    Array.isArray(
      payload?.events
    )
      ? payload.events
      : [];

  const events =
    existingEvents.map(
      (event) => {
        if (
          !event ||
          typeof event !==
            'object'
        ) {
          return event;
        }

        /*
         * The tracked analysis cache is authoritative
         * for this build. Remove stale presentation
         * metadata first, then resolve it again against
         * the runtime display asset.
         */
        const {
          imagePresentation:
            staleImagePresentation,
          ...baseEvent
        } =
          event;

        void staleImagePresentation;

        const imagePresentation =
          resolveEventImageAnalysis(
            imageAnalysisCache,
            baseEvent.image
          );

        return {
          ...baseEvent,

          ...(imagePresentation
            ? {
                imagePresentation
              }
            : {})
        };
      }
    );

  return {
    ...payload,

    count:
      events.length,

    events,

    warning:
      'SMS Ticket live sync failed; existing event data reused with current build-time enrichments.',

    fallbackRefreshedAt:
      refreshedAt
  };
}
