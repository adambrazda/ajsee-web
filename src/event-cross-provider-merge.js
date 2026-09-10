const SUPPORTED_CROSS_PROVIDER_SET =
  new Set([
    'smsticket',
    'colosseumticket'
  ]);


function text(value) {
  if (value == null) {
    return '';
  }

  if (
    typeof value ===
    'string'
  ) {
    return value.trim();
  }

  return String(
    value
  ).trim();
}


function localizedText(
  value
) {
  if (
    value == null
  ) {
    return '';
  }

  if (
    typeof value ===
    'string'
  ) {
    return value.trim();
  }

  if (
    typeof value ===
    'object'
  ) {
    const candidate =
      value.cs ||
      value.sk ||
      value.en ||
      Object.values(
        value
      ).find(
        (entry) =>
          typeof entry ===
          'string'
      );

    return text(
      candidate
    );
  }

  return text(
    value
  );
}


function foldExact(
  value
) {
  return localizedText(
    value
  )
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /&/g,
      ' and '
    )
    .replace(
      /['’`´]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


export function crossProviderEventProvider(
  event = {}
) {
  const raw =
    String(
      event?.partner ||
      event?.source ||
      event?.bookingProvider ||
      event?.affiliate?.provider ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    raw.includes(
      'smsticket'
    )
  ) {
    return 'smsticket';
  }

  if (
    raw.includes(
      'colosseum'
    )
  ) {
    return 'colosseumticket';
  }

  return '';
}


function exactDateTimeMinute(
  event = {}
) {
  const raw =
    text(
      event?.datetime ||
      event?.date
    );

  const match =
    raw.match(
      /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/
    );

  if (!match) {
    return '';
  }

  return (
    match[1] +
    'T' +
    match[2]
  );
}


function eventCity(
  event = {}
) {
  return (
    event?.location?.city ||
    event?.venue?.city ||
    event?.place?.city ||
    event?.city ||
    ''
  );
}


function eventTitle(
  event = {}
) {
  return (
    event?.title ||
    event?.name ||
    ''
  );
}


export function exactCrossProviderOccurrenceKey(
  event = {}
) {
  const provider =
    crossProviderEventProvider(
      event
    );

  if (
    !SUPPORTED_CROSS_PROVIDER_SET.has(
      provider
    )
  ) {
    return '';
  }

  const title =
    foldExact(
      eventTitle(
        event
      )
    );

  const city =
    foldExact(
      eventCity(
        event
      )
    );

  const datetime =
    exactDateTimeMinute(
      event
    );

  if (
    !title ||
    !city ||
    !datetime
  ) {
    return '';
  }

  return [
    title,
    datetime,
    city
  ].join('|');
}


function ticketCurrency(
  event = {}
) {
  const explicit =
    text(
      event?.currency ||
      event?.price?.currency ||
      event?.priceOptions?.[0]?.currency
    )
      .toUpperCase();

  if (explicit) {
    return explicit;
  }

  const price =
    text(
      event?.priceFrom
    );

  if (
    price.includes('Kč') ||
    /CZK/i.test(price)
  ) {
    return 'CZK';
  }

  if (
    price.includes('€') ||
    /EUR/i.test(price)
  ) {
    return 'EUR';
  }

  if (
    price.includes('£') ||
    /GBP/i.test(price)
  ) {
    return 'GBP';
  }

  if (
    price.includes('$') ||
    /USD/i.test(price)
  ) {
    return 'USD';
  }

  return '';
}


function eventTicketOption(
  event = {}
) {
  const url =
    text(
      event?.tickets ||
      event?.url
    );

  if (!url) {
    return null;
  }

  const provider =
    crossProviderEventProvider(
      event
    );

  if (!provider) {
    return null;
  }

  return {
    url,

    priceFrom:
      text(
        event?.priceFrom
      ),

    currency:
      ticketCurrency(
        event
      ),

    provider
  };
}


function normalizeExistingTicketOption(
  rawOption,
  event
) {
  if (
    !rawOption ||
    typeof rawOption !==
      'object'
  ) {
    return null;
  }

  const url =
    text(
      rawOption.url
    );

  if (!url) {
    return null;
  }

  return {
    url,

    priceFrom:
      text(
        rawOption.priceFrom ??
        event?.priceFrom
      ),

    currency:
      text(
        rawOption.currency ||
        ticketCurrency(
          event
        )
      ).toUpperCase(),

    provider:
      text(
        rawOption.provider ||
        crossProviderEventProvider(
          event
        )
      ).toLowerCase()
  };
}


function eventTicketOptions(
  event = {}
) {
  const existing =
    Array.isArray(
      event?.ticketOptions
    )
      ? event.ticketOptions
      : [];

  if (
    existing.length
  ) {
    return existing
      .map(
        (option) =>
          normalizeExistingTicketOption(
            option,
            event
          )
      )
      .filter(Boolean);
  }

  const single =
    eventTicketOption(
      event
    );

  return single
    ? [single]
    : [];
}


function combineTicketOptions(
  primary,
  secondary
) {
  const options = [];
  const seenUrls =
    new Set();

  for (
    const option of
    [
      ...eventTicketOptions(
        primary
      ),
      ...eventTicketOptions(
        secondary
      )
    ]
  ) {
    if (
      !option?.url ||
      seenUrls.has(
        option.url
      )
    ) {
      continue;
    }

    seenUrls.add(
      option.url
    );

    options.push(
      option
    );
  }

  return options;
}


function mergeExactPair(
  smsticket,
  colosseumticket
) {
  const ticketOptions =
    combineTicketOptions(
      smsticket,
      colosseumticket
    );

  if (
    ticketOptions.length < 2
  ) {
    return smsticket;
  }

  return {
    ...smsticket,

    ticketOptions
  };
}


/*
 * AJSEE_CROSS_PROVIDER_EXACT_MERGE_v1
 *
 * Fail-closed cross-provider dedupe.
 *
 * A group is merged only when it contains exactly:
 * - one SMS Ticket occurrence,
 * - one ColosseumTicket occurrence.
 *
 * Match dimensions:
 * - normalized title equality,
 * - exact local date + HH:mm,
 * - normalized city equality.
 *
 * No fuzzy title matching.
 * No approximate times.
 * No venue guessing.
 * No Ticketmaster participation.
 *
 * SMS Ticket remains the primary event/card and the Colosseum
 * purchase route is exposed through the existing ticketOptions contract.
 */
export function mergeExactCrossProviderOccurrences(
  events = []
) {
  if (
    !Array.isArray(
      events
    ) ||
    events.length < 2
  ) {
    return Array.isArray(
      events
    )
      ? [...events]
      : [];
  }

  const groups =
    new Map();

  events.forEach(
    (
      event,
      index
    ) => {
      const key =
        exactCrossProviderOccurrenceKey(
          event
        );

      if (!key) {
        return;
      }

      const provider =
        crossProviderEventProvider(
          event
        );

      let group =
        groups.get(
          key
        );

      if (!group) {
        group = [];

        groups.set(
          key,
          group
        );
      }

      group.push({
        event,
        index,
        provider
      });
    }
  );

  const replacements =
    new Map();

  const skipped =
    new Set();

  for (
    const group of
    groups.values()
  ) {
    /*
     * Ambiguous group = do nothing.
     * This prevents accidental many-to-one merges.
     */
    if (
      group.length !== 2
    ) {
      continue;
    }

    const sms =
      group.filter(
        (item) =>
          item.provider ===
          'smsticket'
      );

    const colosseum =
      group.filter(
        (item) =>
          item.provider ===
          'colosseumticket'
      );

    if (
      sms.length !== 1 ||
      colosseum.length !== 1
    ) {
      continue;
    }

    const firstIndex =
      Math.min(
        sms[0].index,
        colosseum[0].index
      );

    const secondIndex =
      Math.max(
        sms[0].index,
        colosseum[0].index
      );

    replacements.set(
      firstIndex,
      mergeExactPair(
        sms[0].event,
        colosseum[0].event
      )
    );

    skipped.add(
      secondIndex
    );
  }

  return events.flatMap(
    (
      event,
      index
    ) => {
      if (
        skipped.has(
          index
        )
      ) {
        return [];
      }

      if (
        replacements.has(
          index
        )
      ) {
        return [
          replacements.get(
            index
          )
        ];
      }

      return [
        event
      ];
    }
  );
}


export default {
  mergeExactCrossProviderOccurrences
};
