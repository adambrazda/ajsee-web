import { XMLParser } from 'fast-xml-parser';
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
  'https://colosseumticket.cz/api/export/affiliate.xml';

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
    allowLargeDrop = false
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
    COLOSSEUMTICKET_MIN_OCCURRENCES
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
    COLOSSEUMTICKET_MIN_PARENT_EVENTS
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
      COLOSSEUMTICKET_MIN_OCCURRENCES
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
      /^\s*([\d\s]+(?:[,.]\d+)?)\s*-\s*([\d\s]+(?:[,.]\d+)?)\s*Kč\s*$/i
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
      currency: 'CZK'
    };
  }

  const single =
    raw.match(
      /^\s*([\d\s]+(?:[,.]\d+)?)\s*Kč\s*$/i
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
      currency: 'CZK'
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

function normalizeGallery(event) {
  return toArray(
    event?.GALLERY
  )
    .map(text)
    .filter(Boolean);
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

function normalizeOccurrence(
  parent,
  term
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
      (category) =>
        category.label
    );

  const rawCategoryIds =
    providerCategories
      .map(
        (category) =>
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

  const image =
    text(
      parent?.imageurl
    );

  const gallery =
    normalizeGallery(
      parent
    );

  const date =
    parseDate(
      term?.eventdate?.datefrom
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

  const url =
    text(
      term?.eventdate?.url_objednavka
    );

  const price =
    parseColosseumPrice(
      term?.CENA
    );

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

  if (
    !providerEventId ||
    !providerOccurrenceId ||
    !title ||
    !datetime ||
    !venueName ||
    !url ||
    price.min === null ||
    !price.currency
  ) {
    return null;
  }

  const sourceId =
    `${providerEventId}:${providerOccurrenceId}`;

  return {
    id:
      `colosseumticket-${providerEventId}-${providerOccurrenceId}`,

    partner:
      'colosseumticket',

    source:
      'colosseumticket',

    sourceName:
      'ColosseumTicket',

    sourceId,

    providerEventId,
    providerOccurrenceId,

    title: {
      cs: title
    },

    description:
      description
        ? {
            cs: description
          }
        : {},

    datetime,

    date,

    time,

    /*
     * The provider feed does not expose a country field.
     * Do not manufacture canonical geography metadata here.
     * Provider market scope is enforced by the adapter.
     */
    location: {
      city
    },

    venue: {
      name: venueName,
      city,
      address: {
        street
      }
    },

    address,

    image,
    gallery,

    url,
    tickets: url,
    rawUrl: url,

    priceFrom:
      price.raw,

    currency:
      price.currency,

    price: {
      min: price.min,
      max: price.max,
      currency:
        price.currency
    },

    priceOptions: [
      {
        amount:
          price.min,
        currency:
          price.currency
      }
    ],

    seats,

    /*
     * The provider has not yet confirmed whether seats=0
     * means sold out. Preserve the value only; do not derive
     * availability from it.
     */
    availability: null,

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
}

export function normalizeColosseumFeed(
  rawEvents
) {
  const events = [];
  const ids = new Set();
  const rawTermIds = new Map();

  let zeroTermParents = 0;
  let rejectedOccurrences = 0;
  let missingCityOccurrences = 0;
  let missingCategoryParents = 0;

  for (
    const parent of
    toArray(rawEvents)
  ) {
    const parentCategories =
      normalizeProviderCategories(
        parent?.type
      );

    if (
      !parentCategories.length
    ) {
      missingCategoryParents += 1;
    }

    const terms =
      toArray(
        parent?.['TERMÍNY']?.['TERMÍN']
      );

    if (!terms.length) {
      zeroTermParents += 1;
      continue;
    }

    for (const term of terms) {
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

      const event =
        normalizeOccurrence(
          parent,
          term
        );

      if (!event) {
        rejectedOccurrences += 1;
        continue;
      }

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
        missingCityOccurrences += 1;
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

      if (dateDifference !== 0) {
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

      missingCityOccurrences,

      missingCategoryParents,

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

  return lightEvent;
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
      removedFields: [
        'description',
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
  payload
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

async function readExistingPayload() {
  if (
    !existsSync(
      OUT_FILE
    )
  ) {
    return null;
  }

  try {
    return JSON.parse(
      await readFile(
        OUT_FILE,
        'utf8'
      )
    );
  } catch {
    return null;
  }
}

async function readFeedSource() {
  const localFile =
    text(
      process.env
        .COLOSSEUMTICKET_FEED_FILE
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
      COLOSSEUMTICKET_FEED_URL
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

  try {
    const source =
      await readFeedSource();

    const rawEvents =
      parseColosseumXml(
        source.xml
      );

    const normalized =
      normalizeColosseumFeed(
        rawEvents
      );

    if (
      normalized.events.length ===
      0
    ) {
      throw new Error(
        'ColosseumTicket normalization produced zero occurrences.'
      );
    }

    const payload = {
      source:
        'colosseumticket',

      sourceUrl:
        source.mode ===
        'remote'
          ? COLOSSEUMTICKET_FEED_URL
          : '',

      generatedAt:
        startedAt,

      count:
        normalized.events.length,

      stats:
        normalized.stats,

      events:
        normalized.events
    };

    const allowLargeDrop =
      String(
        process.env
          .COLOSSEUMTICKET_ALLOW_COUNT_DROP ||
        ''
      )
        .trim() ===
      '1';

    const sanity =
      assertColosseumPayloadSanity(
        payload,
        existingBeforeSync,
        {
          allowLargeDrop
        }
      );

    console.log(
      `[colosseumticket] sanity: ${sanity.occurrenceCount} occurrences, ${sanity.parentEvents} parents, previous ${sanity.existingCount || 0}`
    );

    if (allowLargeDrop) {
      console.warn(
        '[colosseumticket] count-drop protection overridden by COLOSSEUMTICKET_ALLOW_COUNT_DROP=1'
      );
    }

    await writePayloads(
      payload
    );

    return payload;
  } catch (error) {
    console.warn(
      `[colosseumticket] sync failed: ${error?.message || error}`
    );

    const existing =
      existingBeforeSync ||
      await readExistingPayload();

    if (
      existing &&
      Array.isArray(
        existing.events
      ) &&
      existing.events.length
    ) {
      console.warn(
        `[colosseumticket] keeping existing cached data (${existing.events.length} occurrences)`
      );

      return existing;
    }

    throw error;
  }
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
