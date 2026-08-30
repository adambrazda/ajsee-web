const MAX_ORIGINAL_QUERY_CHARS =
  800;

const MAX_QUESTION_CHARS =
  500;

const MAX_PREVIOUS_INTENT_BYTES =
  12000;

export const MAX_CLARIFICATION_ROUNDS =
  2;


function plainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}


function normalizedText(
  value,
  {
    min = 1,
    max
  }
) {
  const text =
    String(
      value ??
      ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  if (
    text.length < min ||
    text.length > max
  ) {
    return '';
  }

  return text;
}


function encodedSize(value) {
  try {
    return new TextEncoder()
      .encode(
        JSON.stringify(value)
      )
      .byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}


export function normalizeClarificationContext(
  value,
  {
    locale = ''
  } = {}
) {
  if (
    value === undefined ||
    value === null
  ) {
    return {
      ok:
        true,

      value:
        null
    };
  }

  if (!plainObject(value)) {
    return {
      ok:
        false,

      value:
        null
    };
  }

  const originalQuery =
    normalizedText(
      value.originalQuery,
      {
        min:
          2,

        max:
          MAX_ORIGINAL_QUERY_CHARS
      }
    );

  const question =
    normalizedText(
      value.question,
      {
        min:
          2,

        max:
          MAX_QUESTION_CHARS
      }
    );

  const round =
    Number(
      value.round
    );

  const previousIntent =
    value.previousIntent;

  const expectedLocale =
    String(
      locale ||
      ''
    )
      .trim()
      .toLowerCase();

  const previousLocale =
    plainObject(
      previousIntent
    )
      ? String(
          previousIntent.locale ||
          ''
        )
          .trim()
          .toLowerCase()
      : '';

  if (
    !originalQuery ||
    !question ||
    !Number.isInteger(round) ||
    round < 1 ||
    round >
      MAX_CLARIFICATION_ROUNDS ||
    !plainObject(previousIntent) ||
    previousLocale !==
      expectedLocale ||
    previousIntent
      ?.clarification
      ?.required !== true ||
    encodedSize(
      previousIntent
    ) >
      MAX_PREVIOUS_INTENT_BYTES
  ) {
    return {
      ok:
        false,

      value:
        null
    };
  }

  return {
    ok:
      true,

    value: {
      originalQuery,
      question,
      round,

      previousIntent:
        structuredClone(
          previousIntent
        )
    }
  };
}


export function buildClarificationInput({
  query,
  context = null
} = {}) {
  const reply =
    String(
      query ??
      ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  if (!context) {
    return reply;
  }

  return [
    'AJSEE_CLARIFICATION_REPLY_V1',

    JSON.stringify({
      mode:
        'clarification_reply',

      round:
        context.round,

      originalQuery:
        context.originalQuery,

      clarificationQuestion:
        context.question,

      previousIntent:
        context.previousIntent,

      reply
    })
  ].join(
    '\n'
  );
}
