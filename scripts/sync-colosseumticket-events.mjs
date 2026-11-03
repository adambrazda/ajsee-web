import { XMLParser } from 'fast-xml-parser';
import { withProviderDateRange } from '../src/provider-event-dates.js';
import { withColosseumGeography } from '../shared/geo/colosseum-geography.js';
import { COLOSSEUMTICKET_MARKETS, colosseumMarketForHost, colosseumAffiliateBox } from '../shared/colosseumticket.js';
import { colosseumSlovakCityCountry } from '../shared/geo/colosseum-sk-venue-locations.js';
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import {
  existsSync
} from 'node:fs';
import path from 'node:path';
import {
  pathToFileURL
} from 'node:url';

export const COLOSSEUMTICKET_FEED_URL =
  COLOSSEUMTICKET_MARKETS.CZ.feedUrl;

export const COLOSSEUMTICKET_FETCH_TIMEOUT_MS =
  20_000;

export const COLOSSEUMTICKET_MAX_FEED_BYTES =
  10 * 1024 * 1024;

export const COLOSSEUMTICKET_MIN_OCCURRENCES =
  100;

export const COLOSSEUMTICKET_MIN_PARENT_EVENTS =
  100;

export const COLOSSEUMTICKET_MIN_EXISTING_COUNT_RATIO =
  0.5;

export const COLOSSEUMTICKET_MAX_OCCURRENCES =
  20_000;

const OUT_FILE =
  path.resolve(
    'public/data/colosseumticket-events.json'
  );

const OUT_DIR =
  path.dirname(OUT_FILE);

const CITY_SUBSETS = [
  {
    slug: 'praha',
    aliases: ['praha', 'prague']
  },
  {
    slug: 'brno',
    aliases: ['brno']
  },
  {
    slug: 'ostrava',
    aliases: ['ostrava']
  }
];

export function assertColosseumHttpsFeedUrl(
  rawUrl
) {
  let parsed;

  try {
    parsed =
      new URL(
        String(
          rawUrl ||
          ''
        )
      );
  } catch {
    throw new Error(
      'ColosseumTicket feed URL is invalid.'
    );
  }

  if (
    parsed.protocol !==
    'https:'
  ) {
    throw new Error(
      'ColosseumTicket remote feed must use HTTPS.'
    );
  }

  return parsed.href;
}


export function assertColosseumFeedByteLength(
  byteLength,
  maximumBytes =
    COLOSSEUMTICKET_MAX_FEED_BYTES
) {
  const size =
    Number(
      byteLength
    );

  const maximum =
    Number(
      maximumBytes
    );

  if (
    !Number.isFinite(size) ||
    size < 0
  ) {
    throw new Error(
      'ColosseumTicket feed size is invalid.'
    );
  }

  if (
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    throw new Error(
      'ColosseumTicket maximum feed size is invalid.'
    );
  }

  if (
    size > maximum
  ) {
    throw new Error(
      `ColosseumTicket feed exceeds maximum size of ${maximum} bytes.`
    );
  }

  return size;
}


export async function readColosseumResponseTextWithLimit(
  response,
  maximumBytes =
    COLOSSEUMTICKET_MAX_FEED_BYTES
) {
  const contentLength =
    Number(
      response?.headers?.get?.(
        'content-length'
      )
    );

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >= 0
  ) {
    assertColosseumFeedByteLength(
      contentLength,
      maximumBytes
    );
  }

  if (
    !response?.body ||
    typeof response.body.getReader !==
      'function'
  ) {
    const buffer =
      await response.arrayBuffer();

    assertColosseumFeedByteLength(
      buffer.byteLength,
      maximumBytes
    );

    return new TextDecoder(
      'utf-8',
      {
        fatal: false
      }
    ).decode(
      buffer
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder(
      'utf-8',
      {
        fatal: false
      }
    );

  const chunks = [];

  let totalBytes =
    0;

  try {
    while (true) {
      const {
        done,
        value
      } =
        await reader.read();

      if (done) {
        break;
      }

      const chunk =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(
              value
            );

      totalBytes +=
        chunk.byteLength;

      try {
        assertColosseumFeedByteLength(
          totalBytes,
          maximumBytes
        );
      } catch (error) {
        try {
          await reader.cancel();
        } catch {
          // best-effort cancellation
        }

        throw error;
      }

      chunks.push(
        decoder.decode(
          chunk,
          {
            stream: true
          }
        )
      );
    }

    chunks.push(
      decoder.decode()
    );

    return chunks.join(
      ''
    );
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // noop
    }
  }
}


export function assertColosseumPayloadSanity(
  payload,
  existingPayload = null,
  {
    allowLargeDrop = false,
    minimumOccurrences = COLOSSEUMTICKET_MIN_OCCURRENCES,
    minimumParentEvents = COLOSSEUMTICKET_MIN_PARENT_EVENTS
  } = {}
) {
  const events =
    Array.isArray(
      payload?.events
    )
      ? payload.events
      : [];

  const occurrenceCount =
    events.length;

  const declaredCount =
    Number(
      payload?.count
    );

  const statsOccurrences =
    Number(
      payload?.stats?.occurrences
    );

  const parentEvents =
    Number(
      payload?.stats?.parentEvents
    );

  if (
    occurrenceCount <
    minimumOccurrences
  ) {
    throw new Error(
      `ColosseumTicket sanity check rejected only ${occurrenceCount} occurrences.`
    );
  }

  if (
    occurrenceCount >
    COLOSSEUMTICKET_MAX_OCCURRENCES
  ) {
    throw new Error(
      `ColosseumTicket sanity check rejected unexpected count of ${occurrenceCount} occurrences.`
    );
  }

  if (
    parentEvents <
    minimumParentEvents
  ) {
    throw new Error(
      `ColosseumTicket sanity check rejected only ${parentEvents} parent events.`
    );
  }

  if (
    declaredCount !==
    occurrenceCount
  ) {
    throw new Error(
      'ColosseumTicket payload count does not match events length.'
    );
  }

  if (
    statsOccurrences !==
    occurrenceCount
  ) {
    throw new Error(
      'ColosseumTicket stats occurrence count does not match events length.'
    );
  }

  const existingEvents =
    Array.isArray(
      existingPayload?.events
    )
      ? existingPayload.events
      : [];

  const existingCount =
    existingEvents.length;

  if (
    !allowLargeDrop &&
    existingCount >=
      minimumOccurrences
  ) {
    const minimumExpected =
      Math.floor(
        existingCount *
        COLOSSEUMTICKET_MIN_EXISTING_COUNT_RATIO
      );

    if (
      occurrenceCount <
      minimumExpected
    ) {
      throw new Error(
        `ColosseumTicket occurrence count dropped from ${existingCount} to ${occurrenceCount}; minimum accepted without override is ${minimumExpected}.`
      );
    }
  }

  return {
    occurrenceCount,
    parentEvents,
    existingCount
  };
}


function toArray(value) {
  if (value == null) return [];

  return Array.isArray(value)
    ? value
    : [value];
}

function text(value) {
  if (value == null) return '';

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value).trim();
  }

  return '';
}

function fold(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value) {
  const raw =
    text(value);

  const match =
    raw.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (!match) return '';

  const [, day, month, year] =
    match;

  return `${year}-${month}-${day}`;
}

function parseTime(value) {
  const raw =
    text(value);

  const match =
    raw.match(
      /^(\d{2}):(\d{2})(?::(\d{2}))?$/
    );

  if (!match) return '';

  const [, hour, minute, second = '00'] =
    match;

  return `${hour}:${minute}:${second}`;
}

function parsePriceNumber(value) {
  const normalized =
    text(value)
      .replace(/\s+/g, '')
      .replace(',', '.');

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

export function parseColosseumPrice(value) {
  const raw =
    text(value);

  if (!raw) {
    return {
      raw: '',
      min: null,
      max: null,
      currency: ''
    };
  }

  const range =
    raw.match(
      /^\s*([\d\s]+(?:[,.]\d+)?)\s*[-–]\s*([\d\s]+(?:[,.]\d+)?)\s*(Kč|CZK|€|EUR)\s*$/i
    );

  if (range) {
    return {
      raw,
      min:
        parsePriceNumber(
          range[1]
        ),
      max:
        parsePriceNumber(
          range[2]
        ),
      currency: /^(€|EUR)$/i.test(range[3]) ? 'EUR' : 'CZK'
    };
  }

  const single =
    raw.match(
      /^\s*([\d\s]+(?:[,.]\d+)?)\s*(Kč|CZK|€|EUR)\s*$/i
    );

  if (single) {
    const amount =
      parsePriceNumber(
        single[1]
      );

    return {
      raw,
      min: amount,
      max: amount,
      currency: /^(€|EUR)$/i.test(single[2]) ? 'EUR' : 'CZK'
    };
  }

  return {
    raw,
    min: null,
    max: null,
    currency: ''
  };
}

export function parseColosseumXml(
  xmlText
) {
  const source =
    String(
      xmlText ||
      ''
    );

  if (
    /<!DOCTYPE\b/i.test(source) ||
    /<!ENTITY\b/i.test(source)
  ) {
    throw new Error(
      'Colosseum feed contains a forbidden XML entity declaration.'
    );
  }

  const parser =
    new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      processEntities: true
    });

  const parsed =
    parser.parse(
      source
    );

  const events =
    toArray(
      parsed?.events?.event
    );

  if (!events.length) {
    throw new Error(
      'Colosseum feed contains no event nodes.'
    );
  }

  return events;
}

const COLOSSEUMTICKET_IMAGE_HOSTS =
  new Set([
    'www.datocms-assets.com'
  ]);


export function normalizeColosseumImageUrl(
  value
) {
  const raw =
    text(
      value
    );

  if (!raw) {
    return '';
  }

  let parsed;

  try {
    parsed =
      new URL(
        raw
      );
  } catch {
    return '';
  }

  if (
    parsed.protocol !==
      'https:' ||
    parsed.username ||
    parsed.password ||
    (
      parsed.port &&
      parsed.port !==
        '443'
    )
  ) {
    return '';
  }

  const hostname =
    text(
      parsed.hostname
    )
      .toLowerCase()
      .replace(
        /\.$/,
        ''
      );

  if (
    !COLOSSEUMTICKET_IMAGE_HOSTS.has(
      hostname
    )
  ) {
    return '';
  }

  return parsed.href;
}


function collectColosseumImageCandidates(
  value,
  output = []
) {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const normalized =
      normalizeColosseumImageUrl(
        value
      );

    if (normalized) {
      output.push(
        normalized
      );
    }

    return output;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of value
    ) {
      collectColosseumImageCandidates(
        item,
        output
      );
    }

    return output;
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    for (
      const item of
      Object.values(
        value
      )
    ) {
      collectColosseumImageCandidates(
        item,
        output
      );
    }
  }

  return output;
}


function normalizeGallery(event) {
  return [
    ...new Set(
      collectColosseumImageCandidates(
        event?.GALLERY
      )
    )
  ];
}

function normalizeProviderCategory(
  value
) {
  if (value == null) {
    return null;
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const label =
      text(
        value['#text']
      );

    const id =
      text(
        value['@_id']
      );

    if (!label) {
      return null;
    }

    return {
      label,
      id
    };
  }

  const label =
    text(
      value
    );

  if (!label) {
    return null;
  }

  return {
    label,
    id: ''
  };
}


function normalizeProviderCategories(
  typeNode
) {
  const categorySource =
    typeNode &&
    typeof typeNode === 'object' &&
    !Array.isArray(typeNode)
      ? typeNode.category
      : typeNode;

  const output = [];
  const seen =
    new Set();

  for (
    const value of
    toArray(
      categorySource
    )
  ) {
    const normalized =
      normalizeProviderCategory(
        value
      );

    if (
      !normalized ||
      seen.has(
        normalized.label
      )
    ) {
      continue;
    }

    seen.add(
      normalized.label
    );

    output.push(
      normalized
    );
  }

  return output;
}


function normalizeSeats(value) {
  const rawValue =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value['#text']
      : value;

  const raw =
    text(rawValue);

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const number =
    Number(raw);

  return Number.isSafeInteger(number)
    ? number
    : null;
}

function normalizeSeatsStatus(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return '';
  }

  return text(
    value['@_status']
  );
}


export function normalizeColosseumAffiliateBox(
  value
) {
  const raw =
    text(
      value
    );

  if (!raw) {
    return '';
  }

  /*
   * Do not assume a provider-specific identifier shape.
   * URLSearchParams performs escaping for us.
   * Only reject control/whitespace data and unreasonable size.
   */
  if (
    raw.length > 256 ||
    /[\u0000-\u001f\u007f\s]/.test(
      raw
    )
  ) {
    throw new Error(
      'ColosseumTicket affiliate a_box value is invalid.'
    );
  }

  return raw;
}


export function requireColosseumAffiliateBox(
  value
) {
  const normalized =
    normalizeColosseumAffiliateBox(
      value
    );

  if (!normalized) {
    throw new Error(
      'COLOSSEUMTICKET_A_BOX is required for ColosseumTicket production sync.'
    );
  }

  return normalized;
}


export function normalizeColosseumPurchaseUrl(
  value,
  {
    affiliateBox = ''
  } = {}
) {
  const raw =
    text(
      value
    );

  if (!raw) {
    return {
      url:
        '',

      rejectionReason:
        'missingPurchaseUrl'
    };
  }

  let parsed;

  try {
    parsed =
      new URL(
        raw
      );
  } catch {
    return {
      url:
        '',

      rejectionReason:
        'malformedPurchaseUrl'
    };
  }

  if (
    parsed.protocol !==
    'https:'
  ) {
    return {
      url:
        '',

      rejectionReason:
        'insecurePurchaseUrl'
    };
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    return {
      url:
        '',

      rejectionReason:
        'credentialedPurchaseUrl'
    };
  }

  if (
    parsed.port &&
    parsed.port !==
      '443'
  ) {
    return {
      url:
        '',

      rejectionReason:
        'unexpectedPurchasePort'
    };
  }

  const hostname =
    text(
      parsed.hostname
    )
      .toLowerCase()
      .replace(
        /\.$/,
        ''
      );

  if (
    !colosseumMarketForHost(hostname)
  ) {
    return {
      url:
        '',

      rejectionReason:
        'untrustedPurchaseHost'
    };
  }

  const normalizedAffiliateBox =
    normalizeColosseumAffiliateBox(
      affiliateBox
    );

  if (!normalizedAffiliateBox) {
    /*
     * Pure normalization/tests may intentionally omit
     * affiliate configuration.
     */
    return {
      url:
        raw,

      rejectionReason:
        ''
    };
  }

  /*
   * URLSearchParams.set guarantees exactly one a_box value
   * and preserves all unrelated provider query parameters.
   */
  parsed.searchParams.set(
    'a_box',
    normalizedAffiliateBox
  );

  return {
    url:
      parsed.href,

    rejectionReason:
      ''
  };
}


export function classifyColosseumPrice(
  value
) {
  const raw =
    text(
      value
    );

  const parsed =
    parseColosseumPrice(
      raw
    );

  if (!raw) {
    return {
      state:
        'missing',

      parsed
    };
  }

  if (
    parsed.min === null ||
    !parsed.currency ||
    (
      parsed.max !== null &&
      parsed.max <
        parsed.min
    )
  ) {
    return {
      state:
        'unparseable',

      parsed
    };
  }

  /*
   * 0 Kč is not treated as free until provider semantics
   * are explicitly confirmed.
   */
  if (
    parsed.min <= 0
  ) {
    return {
      state:
        'zero',

      parsed
    };
  }

  return {
    state:
      'known',

    parsed
  };
}


function normalizeOccurrence(
  parent,
  term,
  options = {}
) {
  const providerEventId =
    text(
      parent?.['@_id']
    );

  const providerOccurrenceId =
    text(
      term?.ID_TERMIN
    );

  const title =
    text(
      parent?.eventname
    );

  const providerCategories =
    normalizeProviderCategories(
      parent?.type
    );

  const rawCategories =
    providerCategories.map(
      category =>
        category.label
    );

  const rawCategoryIds =
    providerCategories
      .map(
        category =>
          category.id
      )
      .filter(Boolean);

  /*
   * Keep the historical concatenated representation only
   * as source metadata / backward-compatible fallback.
   * rawCategories is the authoritative provider taxonomy.
   */
  const rawType =
    rawCategories.join(
      ''
    );

  const description =
    text(
      parent?.DESCRIPTION
    );

  const gallery =
    normalizeGallery(
      parent
    );

  /*
   * Provider media is published only from the image host
   * observed and approved during the live feed audit.
   * If imageurl is missing or unsafe, prefer the first
   * validated gallery asset.
   */
  const image =
    normalizeColosseumImageUrl(
      parent?.imageurl
    ) ||
    gallery[0] ||
    '';

  const rawDate =
    text(
      term?.eventdate?.datefrom
    );

  const date =
    parseDate(
      rawDate
    );

  const time =
    parseTime(
      term?.eventdate?.timefrom
    );

  const datetime =
    date
      ? `${date}${time ? `T${time}` : ''}`
      : '';

  const venueName =
    text(
      term?.location?.locationname
    );

  const city =
    text(
      term?.location?.city
    );

  const street =
    text(
      term?.location?.street
    );

  const address =
    text(
      term?.ADDRESS
    );

  const purchase =
    normalizeColosseumPurchaseUrl(
      term?.eventdate?.url_objednavka,
      options
    );

  const priceResult =
    classifyColosseumPrice(
      term?.CENA
    );

  const price =
    priceResult.parsed;

  const parentPrice =
    parseColosseumPrice(
      parent?.CENA
    );

  const seatsSource =
    term?.eventdate?.seats;

  const seats =
    normalizeSeats(
      seatsSource
    );

  const seatsStatus =
    normalizeSeatsStatus(
      seatsSource
    );

  let rejectionReason =
    '';

  if (!providerEventId) {
    rejectionReason =
      'missingProviderEventId';
  } else if (!providerOccurrenceId) {
    rejectionReason =
      'missingProviderOccurrenceId';
  } else if (!title) {
    rejectionReason =
      'missingTitle';
  } else if (
    !rawDate ||
    !datetime
  ) {
    rejectionReason =
      'missingOrInvalidDate';
  } else if (!venueName) {
    rejectionReason =
      'missingVenue';
  } else if (
    purchase.rejectionReason
  ) {
    rejectionReason =
      purchase.rejectionReason;
  }

  if (rejectionReason) {
    return {
      event:
        null,

      rejectionReason,

      priceState:
        priceResult.state
    };
  }

  const hasKnownPrice =
    priceResult.state ===
      'known';

  const publicPrice =
    hasKnownPrice
      ? price
      : {
          raw:
            '',

          min:
            null,

          max:
            null,

          currency:
            ''
        };

  const sourceId =
    `${providerEventId}:${providerOccurrenceId}`;

  const event = {
    id:
      `colosseumticket-${options.market === 'SK' ? 'sk-' : ''}${providerEventId}-${providerOccurrenceId}`,

    partner:
      'colosseumticket',

    source:
      'colosseumticket',

    sourceName:
      'ColosseumTicket',

    ...(options.market ? { sourceMarket: options.market } : {}),

    sourceId,

    providerEventId,
    providerOccurrenceId,

    title: {
      [options.locale || 'cs']:
        title
    },

    description:
      description
        ? {
            [options.locale || 'cs']:
              description
          }
        : {},

    datetime,

    date,

    time,

    /*
     * Provider XML does not expose a country field.
     * Only reviewed venue evidence may add canonical geography metadata.
     */
    location: {
      city,
      ...(options.market === 'SK' && colosseumSlovakCityCountry(city)
        ? { country: colosseumSlovakCityCountry(city) } : {})
    },

    venue: {
      name:
        venueName,

      city,

      address: {
        street
      }
    },

    address,

    image,

    gallery,

    url:
      purchase.url,

    tickets:
      purchase.url,

    rawUrl:
      purchase.url,

    /*
     * Zero, missing and unparseable prices remain unknown
     * publicly rather than being interpreted as free.
     */
    priceFrom:
      publicPrice.raw,

    currency:
      publicPrice.currency,

    price: {
      min:
        publicPrice.min,

      max:
        publicPrice.max,

      currency:
        publicPrice.currency
    },

    priceOptions:
      hasKnownPrice
        ? [
            {
              amount:
                publicPrice.min,

              currency:
                publicPrice.currency
            }
          ]
        : [],

    seats,

    /*
     * seats=0 semantics are not confirmed.
     * Preserve source data without deriving availability.
     */
    availability:
      null,

    categories:
      rawCategories,

    types:
      rawCategories,

    affiliate: {
      provider:
        'colosseumticket'
    },

    sourceMeta: {
      rawType,

      rawCategories,

      rawCategoryIds,

      seatsStatus,

      termPriceRaw:
        price.raw,

      termPriceMin:
        price.min,

      termPriceMax:
        price.max,

      priceState:
        priceResult.state,

      parentPrice:
        parentPrice.raw,

      parentPriceMin:
        parentPrice.min,

      parentPriceMax:
        parentPrice.max,

      parentUrl:
        text(
          parent?.url
        ),

      note:
        text(
          term?.eventdate?.note
        )
    }
  };

  return {
    event: withProviderDateRange(withColosseumGeography(event), {
      endLocalDate: parseDate(text(term?.eventdate?.dateto))
    }),

    rejectionReason:
      '',

    priceState:
      priceResult.state
  };
}



export function normalizeColosseumFeed(
  rawEvents,
  options = {}
) {
  const events = [];
  const ids = new Set();
  const rawTermIds = new Map();

  let zeroTermParents = 0;
  let rejectedOccurrences = 0;
  let missingCityOccurrences = 0;
  let missingCategoryParents = 0;

  const rejectionReasons = {
    missingProviderEventId:
      0,

    missingProviderOccurrenceId:
      0,

    missingTitle:
      0,

    missingOrInvalidDate:
      0,

    missingVenue:
      0,

    missingPurchaseUrl:
      0,

    malformedPurchaseUrl:
      0,

    insecurePurchaseUrl:
      0,

    credentialedPurchaseUrl:
      0,

    unexpectedPurchasePort:
      0,

    untrustedPurchaseHost:
      0
  };

  const priceDiagnostics = {
    known:
      0,

    zero:
      0,

    missing:
      0,

    unparseable:
      0,

    unknown:
      0
  };

  for (
    const parent of
    toArray(
      rawEvents
    )
  ) {
    const parentCategories =
      normalizeProviderCategories(
        parent?.type
      );

    if (
      !parentCategories.length
    ) {
      missingCategoryParents +=
        1;
    }

    const terms =
      toArray(
        parent?.['TERMÍNY']?.['TERMÍN']
      );

    if (!terms.length) {
      zeroTermParents +=
        1;

      continue;
    }

    for (
      const term of
      terms
    ) {
      const rawTermId =
        text(
          term?.ID_TERMIN
        );

      if (rawTermId) {
        rawTermIds.set(
          rawTermId,
          (
            rawTermIds.get(
              rawTermId
            ) ||
            0
          ) +
          1
        );
      }

      const normalized =
        normalizeOccurrence(
          parent,
          term,
          options
        );

      const priceState =
        normalized.priceState;

      if (
        priceState &&
        priceState !==
          'unknown' &&
        Object.hasOwn(
          priceDiagnostics,
          priceState
        )
      ) {
        priceDiagnostics[
          priceState
        ] +=
          1;
      }

      if (
        priceState &&
        priceState !==
          'known'
      ) {
        priceDiagnostics.unknown +=
          1;
      }

      if (
        !normalized.event
      ) {
        rejectedOccurrences +=
          1;

        if (
          normalized.rejectionReason &&
          Object.hasOwn(
            rejectionReasons,
            normalized.rejectionReason
          )
        ) {
          rejectionReasons[
            normalized.rejectionReason
          ] +=
            1;
        }

        continue;
      }

      const event =
        normalized.event;

      if (
        ids.has(
          event.id
        )
      ) {
        throw new Error(
          `Duplicate canonical Colosseum event id: ${event.id}`
        );
      }

      ids.add(
        event.id
      );

      if (
        !event.location.city
      ) {
        missingCityOccurrences +=
          1;
      }

      events.push(
        event
      );
    }
  }

  const duplicateRawTermIds =
    [...rawTermIds.entries()]
      .filter(
        ([, count]) =>
          count > 1
      )
      .map(
        ([id, count]) => ({
          id,
          count
        })
      );

  events.sort(
    (left, right) => {
      const dateDifference =
        String(
          left.datetime ||
          ''
        ).localeCompare(
          String(
            right.datetime ||
            ''
          )
        );

      if (
        dateDifference !==
          0
      ) {
        return dateDifference;
      }

      return String(
        left.id
      ).localeCompare(
        String(
          right.id
        )
      );
    }
  );

  return {
    events,

    stats: {
      parentEvents:
        toArray(
          rawEvents
        ).length,

      occurrences:
        events.length,

      zeroTermParents,

      rejectedOccurrences,

      rejectionReasons,

      missingCityOccurrences,

      missingCategoryParents,

      priceDiagnostics,

      duplicateRawTermIds
    }
  };
}


function matchesSubsetCity(
  event,
  definition
) {
  const city =
    fold(
      event?.location?.city ||
      event?.venue?.city ||
      ''
    );

  if (!city) return false;

  return definition.aliases
    .map(fold)
    .some(
      (alias) =>
        city === alias
    );
}

const CITY_SUBSET_DESCRIPTION_MAX_CHARS = 240;

function compactCitySubsetText(
  value,
  maximum = CITY_SUBSET_DESCRIPTION_MAX_CHARS
) {
  const clean =
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  if (
    !clean ||
    clean.length <= maximum
  ) {
    return clean;
  }

  const candidate =
    clean.slice(
      0,
      maximum + 1
    );

  const boundary =
    candidate.lastIndexOf(' ');

  const cutAt =
    boundary >=
      Math.floor(
        maximum * 0.7
      )
      ? boundary
      : maximum;

  return (
    candidate
      .slice(
        0,
        cutAt
      )
      .trim() +
    '…'
  );
}

function compactCitySubsetDescription(
  description
) {
  if (
    typeof description === 'string'
  ) {
    const compact =
      compactCitySubsetText(
        description
      );

    return compact || undefined;
  }

  if (
    !description ||
    typeof description !== 'object' ||
    Array.isArray(description)
  ) {
    return undefined;
  }

  const output = {};

  for (
    const [locale, value] of
    Object.entries(description)
  ) {
    const compact =
      compactCitySubsetText(
        value
      );

    if (compact) {
      output[locale] =
        compact;
    }
  }

  return Object.keys(output).length
    ? output
    : undefined;
}

function createLightEvent(
  event
) {
  const {
    description,
    gallery,
    rawUrl,
    sourceMeta,
    ...lightEvent
  } = event;

  const compactDescription =
    compactCitySubsetDescription(
      description
    );

  return {
    ...lightEvent,

    ...(compactDescription
      ? {
          description:
            compactDescription
        }
      : {})
  };
}

function createSubsetPayload(
  payload,
  definition
) {
  const subsetEvents =
    payload.events
      .filter(
        (event) =>
          matchesSubsetCity(
            event,
            definition
          )
      )
      .map(
        createLightEvent
      );

  return {
    ...payload,

    subset: {
      type: 'city',
      slug:
        definition.slug,
      aliases:
        definition.aliases,
      payload:
        'listing-light',
      descriptionPayload:
        'excerpt-240',
      removedFields: [
        'gallery',
        'rawUrl',
        'sourceMeta'
      ]
    },

    count:
      subsetEvents.length,

    events:
      subsetEvents
  };
}

function serializeJson(
  payload
) {
  const serialized =
    `${JSON.stringify(
      payload,
      null,
      2
    )}\n`;

  /*
   * Validate our own serialization before it can reach
   * any public data artifact.
   */
  JSON.parse(
    serialized
  );

  return serialized;
}


function temporaryJsonPath(
  filePath
) {
  const random =
    Math.random()
      .toString(36)
      .slice(2);

  return path.join(
    path.dirname(
      filePath
    ),
    `.${path.basename(
      filePath
    )}.${process.pid}.${Date.now()}.${random}.tmp`
  );
}


async function stageJson(
  filePath,
  payload
) {
  const serialized =
    serializeJson(
      payload
    );

  const tempPath =
    temporaryJsonPath(
      filePath
    );

  await writeFile(
    tempPath,
    serialized,
    {
      encoding:
        'utf8',

      flag:
        'wx'
    }
  );

  /*
   * Re-read the staged artifact so a truncated/incomplete
   * filesystem write is never intentionally published.
   */
  const stagedText =
    await readFile(
      tempPath,
      'utf8'
    );

  JSON.parse(
    stagedText
  );

  return {
    filePath,
    tempPath
  };
}


async function removeStagedFiles(
  staged
) {
  await Promise.allSettled(
    staged.map(
      ({ tempPath }) =>
        rm(
          tempPath,
          {
            force: true
          }
        )
    )
  );
}


export async function writeColosseumJsonAtomically(
  filePath,
  payload
) {
  await mkdir(
    path.dirname(
      filePath
    ),
    {
      recursive: true
    }
  );

  const staged =
    await stageJson(
      filePath,
      payload
    );

  try {
    await rename(
      staged.tempPath,
      staged.filePath
    );
  } finally {
    await rm(
      staged.tempPath,
      {
        force: true
      }
    );
  }
}


async function writePayloads(
  payload,
  marketPayloads = []
) {
  await mkdir(
    OUT_DIR,
    {
      recursive: true
    }
  );

  /*
   * Prepare every public artifact before replacing any
   * currently usable cache file.
   */
  const outputs = [
    ...marketPayloads.map(marketPayload => ({
      filePath: path.join(OUT_DIR, `colosseumticket-events-${marketPayload.market.toLowerCase()}.json`),
      payload: marketPayload
    })),
    {
      filePath:
        OUT_FILE,

      payload
    },

    ...CITY_SUBSETS.map(
      (definition) => ({
        filePath:
          path.join(
            OUT_DIR,
            `colosseumticket-events-${definition.slug}.json`
          ),

        payload:
          createSubsetPayload(
            payload,
            definition
          )
      })
    )
  ];

  const staged = [];

  try {
    for (
      const output of
      outputs
    ) {
      staged.push(
        await stageJson(
          output.filePath,
          output.payload
        )
      );
    }

    /*
     * Each final replacement is an atomic filesystem rename.
     * No final file is touched until all four artifacts have
     * been serialized, written and parsed successfully.
     */
    for (
      const item of
      staged
    ) {
      await rename(
        item.tempPath,
        item.filePath
      );
    }
  } catch (error) {
    await removeStagedFiles(
      staged
    );

    throw error;
  }

  await removeStagedFiles(
    staged
  );

  console.log(
    `[colosseumticket] synced ${payload.events.length} occurrences -> ${OUT_FILE}`
  );

  for (
    const definition of
    CITY_SUBSETS
  ) {
    const subset =
      createSubsetPayload(
        payload,
        definition
      );

    const subsetFile =
      path.join(
        OUT_DIR,
        `colosseumticket-events-${definition.slug}.json`
      );

    console.log(
      `[colosseumticket] city subset ${definition.slug}: ${subset.events.length} occurrences -> ${subsetFile}`
    );
  }
}

async function readExistingPayload(filePath = OUT_FILE) {
  if (
    !existsSync(
      filePath
    )
  ) {
    return null;
  }

  try {
    return JSON.parse(
      await readFile(
        filePath,
        'utf8'
      )
    );
  } catch {
    return null;
  }
}

async function readFeedSource(market = 'CZ') {
  const localFile =
    text(
      process.env[market === 'CZ' ? 'COLOSSEUMTICKET_FEED_FILE' : 'COLOSSEUMTICKET_SK_FEED_FILE']
    );

  if (localFile) {
    const resolvedLocalFile =
      path.resolve(
        localFile
      );

    const fileStats =
      await stat(
        resolvedLocalFile
      );

    assertColosseumFeedByteLength(
      fileStats.size
    );

    const xml =
      await readFile(
        resolvedLocalFile,
        'utf8'
      );

    /*
     * stat() measures bytes on disk; this second check also
     * protects callers if input handling changes later.
     */
    assertColosseumFeedByteLength(
      Buffer.byteLength(
        xml,
        'utf8'
      )
    );

    return {
      xml,
      source:
        resolvedLocalFile,
      mode:
        'file'
    };
  }

  const feedUrl =
    assertColosseumHttpsFeedUrl(
      COLOSSEUMTICKET_MARKETS[market].feedUrl
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      COLOSSEUMTICKET_FETCH_TIMEOUT_MS
    );

  try {
    let response;

    try {
      response =
        await fetch(
          feedUrl,
          {
            signal:
              controller.signal,

            headers: {
              'user-agent':
                'AJSEE ColosseumTicket sync'
            }
          }
        );
    } catch (error) {
      if (
        controller.signal.aborted
      ) {
        throw new Error(
          `ColosseumTicket feed request timed out after ${COLOSSEUMTICKET_FETCH_TIMEOUT_MS} ms.`,
          {
            cause:
              error
          }
        );
      }

      throw error;
    }

    if (!response.ok) {
      throw new Error(
        `ColosseumTicket feed returned ${response.status}`
      );
    }

    /*
     * Fetch follows redirects by default. Reject an eventual
     * downgrade even though the configured source is HTTPS.
     */
    if (
      response.url
    ) {
      assertColosseumHttpsFeedUrl(
        response.url
      );
    }

    const xml =
      await readColosseumResponseTextWithLimit(
        response
      );

    return {
      xml,
      source:
        feedUrl,
      mode:
        'remote'
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

export async function runColosseumSync() {
  const startedAt =
    new Date().toISOString();

  /*
   * Capture last-good before touching the provider.
   * It is both the count baseline and the failure fallback.
   */
  const existingBeforeSync =
    await readExistingPayload();

  const allowLargeDrop = String(process.env.COLOSSEUMTICKET_ALLOW_COUNT_DROP || '').trim() === '1';
  // Validate each market separately. A healthy large Czech feed must never
  // conceal an empty/broken Slovak export, or erase its last usable snapshot.
  const results = await Promise.allSettled(Object.entries(COLOSSEUMTICKET_MARKETS).map(async ([market, definition]) => {
    const existingFile = path.join(OUT_DIR, `colosseumticket-events-${market.toLowerCase()}.json`);
    let existing = await readExistingPayload(existingFile);
    if (!existing && existingBeforeSync?.events?.length) {
      const events = existingBeforeSync.events.filter(event => (event.sourceMarket || 'CZ') === market);
      if (events.length) existing = { ...existingBeforeSync, market, count: events.length, events,
        stats: { ...existingBeforeSync.stats, occurrences: events.length,
          parentEvents: new Set(events.map(event => event.providerEventId)).size } };
    }
    try {
      const source = await readFeedSource(market);
      const normalized = normalizeColosseumFeed(parseColosseumXml(source.xml), {
        market, locale: definition.locale,
        affiliateBox: requireColosseumAffiliateBox(colosseumAffiliateBox(market, process.env))
      });
      const payload = { source: 'colosseumticket', market,
        sourceUrl: source.mode === 'remote' ? definition.feedUrl : '', generatedAt: startedAt,
        count: normalized.events.length, stats: normalized.stats, events: normalized.events };
      const sanity = assertColosseumPayloadSanity(payload, existing, {
        allowLargeDrop,
        minimumOccurrences: market === 'CZ' ? COLOSSEUMTICKET_MIN_OCCURRENCES : 10,
        minimumParentEvents: market === 'CZ' ? COLOSSEUMTICKET_MIN_PARENT_EVENTS : 10
      });
      if (market === 'SK') {
        const slovakLocations = candidate => {
          const events = (candidate?.events || []).filter(event => event.location?.country === 'SK');
          return { events, count: events.length, stats: { occurrences: events.length,
            parentEvents: new Set(events.map(event => event.providerEventId)).size } };
        };
        // Czech cross-listings must not conceal the loss of Slovak inventory.
        assertColosseumPayloadSanity(slovakLocations(payload), slovakLocations(existing), {
          allowLargeDrop, minimumOccurrences: 1, minimumParentEvents: 1
        });
      }
      console.log(`[colosseumticket:${market}] ${sanity.occurrenceCount} occurrences, ${sanity.parentEvents} parents, previous ${sanity.existingCount}`);
      return payload;
    } catch (error) {
      if (!existing?.events?.length) throw new Error(`ColosseumTicket ${market} sync failed: ${error.message}`, { cause: error });
      console.warn(`[colosseumticket:${market}] ${error.message}; keeping ${existing.events.length} cached occurrences`);
      return existing;
    }
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  const marketPayloads = results.map(result => result.value);
  const payload = mergeColosseumMarketPayloads(marketPayloads, startedAt);
  if (allowLargeDrop) console.warn('[colosseumticket] count-drop protection overridden by COLOSSEUMTICKET_ALLOW_COUNT_DROP=1');
  await writePayloads(payload, marketPayloads);
  return payload;
}

export function mergeColosseumMarketPayloads(payloads, generatedAt = new Date().toISOString()) {
  const unique = new Map();
  let duplicateMarketOccurrences = 0;
  // Prefer the established Czech identity and URL for cross-listed Czech shows.
  const ordered = [...payloads].sort((a, b) => (a.market === 'CZ' ? 0 : 1) - (b.market === 'CZ' ? 0 : 1));
  for (const payload of ordered) {
    for (const event of payload.events) {
      // Term IDs alone are not globally unique across Colosseum installations.
      // The two exports abbreviate the same street differently. Match the term,
      // time, city and named venue, retaining the established venue address.
      const key = [event.providerOccurrenceId, event.datetime, event.location?.city,
        event.venue?.name].map(fold).join('|');
      const existing = unique.get(key);
      if (existing && existing.sourceMarket !== event.sourceMarket) {
        duplicateMarketOccurrences++;
        unique.set(key, { ...existing,
          title: { ...event.title, ...existing.title },
          description: { ...event.description, ...existing.description } });
      } else {
        // Canonical IDs also distinguish same-market terms at identical venues.
        unique.set(existing ? `${key}|${event.id}` : key, event);
      }
    }
  }
  const events = [...unique.values()].sort((a, b) => a.datetime.localeCompare(b.datetime) || a.id.localeCompare(b.id));
  if (new Set(events.map(event => event.id)).size !== events.length) throw new Error('Duplicate merged ColosseumTicket event id');
  return { source: 'colosseumticket', sourceUrl: COLOSSEUMTICKET_FEED_URL,
    sourceUrls: ordered.map(payload => COLOSSEUMTICKET_MARKETS[payload.market].feedUrl), generatedAt,
    count: events.length,
    markets: Object.fromEntries(ordered.map(({ events, ...metadata }) => [metadata.market, metadata])),
    stats: { parentEvents: ordered.reduce((sum, payload) => sum + payload.stats.parentEvents, 0),
      occurrences: events.length, duplicateMarketOccurrences },
    events };
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return (
    pathToFileURL(
      path.resolve(
        process.argv[1]
      )
    ).href ===
    import.meta.url
  );
}

if (isMainModule()) {
  runColosseumSync()
    .catch(
      (error) => {
        console.error(
          error
        );

        process.exitCode =
          1;
      }
    );
}
