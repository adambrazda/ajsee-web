// scripts/sync-smsticket-events.mjs
// ---------------------------------------------------------
// AJSEE – smsticket XML feed sync
// Stáhne veřejný smsticket feed, převede ho na normalizovaný JSON
// a uloží do /public/data/smsticket-events.json.
// ---------------------------------------------------------

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { withProviderDateRange } from '../src/provider-event-dates.js';
import { isLocalEventDateAvailable } from '../src/event-calendar.js';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { smsticketCountryCode } from '../shared/geo/smsticket-country.js';

import {
  resolveEventImageAnalysis
} from '../src/event-image-analysis.js';

import {
  fetchSmsticketXml,
  refreshSmsticketFallbackPayload
} from '../src/smsticket-sync-resilience.js';

const SMSTICKET_API_URL = 'https://www.smsticket.cz/api/public/v1.1/events';
const OUT_FILE = path.resolve('public/data/smsticket-events.json');

const IMAGE_ANALYSIS_FILE =
  path.resolve(
    'data/event-image-analysis/smsticket.json'
  );
const AFFILIATE_PARAM = 'a_box=d4n78jv6';

// AJSEE_SMSTICKET_CITY_SUBSETS_v1
// Keep the full feed as the canonical fallback, but also write small city feeds
// for explicit high-traffic city searches so the browser does not need to
// download and parse the whole SMS Ticket dataset.
const CITY_SUBSETS = [
  { slug: 'praha', aliases: ['praha', 'prague'] },
  { slug: 'brno', aliases: ['brno'] },
  { slug: 'ostrava', aliases: ['ostrava'] },
  { slug: 'bratislava', aliases: ['bratislava'] },
  { slug: 'kosice', aliases: ['kosice', 'košice'] }
];

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in value) return String(value['#text'] || '').trim();
  return String(value || '').trim();
}

function httpsUrl(url = '') {
  return String(url || '').replace(/^http:\/\//i, 'https://');
}

function appendAffiliate(url = '') {
  const clean = String(url || '').trim();
  if (!clean) return '';

  if (clean.includes('a_box=')) return clean;

  const separator = clean.includes('?') ? '&' : '?';
  return `${clean}${separator}${AFFILIATE_PARAM}`;
}

function combineDateTime(date = '', time = '') {
  const d = String(date || '').trim();
  const t = String(time || '').trim();

  if (!d) return '';
  if (!t) return `${d}T12:00:00`;

  return `${d}T${t.length === 5 ? `${t}:00` : t}`;
}

function truncateText(value = '', max = 900) {
  const clean = String(value || '').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, '').trim() + '?';
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    // handle double-escaped values first
    .replace(/&amp;lt;/gi, '<')
    .replace(/&amp;gt;/gi, '>')
    .replace(/&amp;quot;/gi, '"')
    .replace(/&amp;#39;/gi, "'")
    .replace(/&amp;nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

function stripHtml(html = '') {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '? ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pickPhoto(event, wantedType = 'normalized') {
  const photos = toArray(event?.photos?.photo);

  const matched = photos.find((photo) => {
    return String(photo?.['@_type'] || '').toLowerCase() === wantedType;
  });

  return httpsUrl(text(matched || photos[0] || ''));
}

function getThemes(event) {
  return toArray(event?.classfication?.themes?.theme)
    .map((theme) => text(theme?.name))
    .filter(Boolean);
}

function getGenres(event) {
  return toArray(event?.classfication?.themes?.theme)
    .flatMap((theme) => toArray(theme?.genres?.genre).map(text))
    .filter(Boolean);
}

function getTypes(event) {
  return toArray(event?.classfication?.types?.type)
    .map(text)
    .filter(Boolean);
}

function fold(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapCategory({ themes = [], types = [] } = {}) {
  const haystack = fold([...themes, ...types].join(' '));

  if (haystack.includes('sport')) return 'sports';
  if (haystack.includes('deti') || haystack.includes('rodin')) return 'family';
  if (haystack.includes('divadlo') || haystack.includes('theatre')) return 'arts';
  if (haystack.includes('hudba') || haystack.includes('koncert') || haystack.includes('festival')) return 'music';

  return 'other';
}

function isTestEvent(event) {
  const name = fold(text(event?.name));
  const description = fold(text(event?.description));

  return (
    name.includes(' test') ||
    name.includes('- test') ||
    name.includes('testovaci') ||
    description.includes('slouzi pouze k testovani')
  );
}

function isFutureOrActive(event) {
  const startDate = text(event?.dates?.start_date);
  const bookingEndDate = text(event?.dates?.booking_end_date);
  const dated = withProviderDateRange({
    date: startDate, title: text(event?.name), country: smsticketCountryCode(event), bookingEndsAt: bookingEndDate,
    types: getTypes(event), description: stripHtml(decodeHtmlEntities(String(event.description || '')))
  }, { endLocalDate: text(event?.dates?.end_date) });
  return isLocalEventDateAvailable(dated, new Date(), { allowBooking: true });
}

async function readSmsticketImageAnalysisCache() {
  const emptyCache = {
    version: 1,
    provider: 'smsticket',
    assets: {}
  };

  if (
    !existsSync(
      IMAGE_ANALYSIS_FILE
    )
  ) {
    return emptyCache;
  }

  try {
    const raw =
      await readFile(
        IMAGE_ANALYSIS_FILE,
        'utf8'
      );

    const parsed =
      JSON.parse(
        raw
      );

    if (
      Number(
        parsed?.version
      ) !== 1 ||
      !parsed?.assets ||
      typeof parsed.assets !== 'object'
    ) {
      console.warn(
        '[smsticket] invalid image analysis cache; using safe fallback'
      );

      return emptyCache;
    }

    return parsed;
  } catch (error) {
    console.warn(
      '[smsticket] image analysis cache unavailable; using safe fallback: ' +
      (
        error?.message ||
        error
      )
    );

    return emptyCache;
  }
}

function normalizeEvent(
  event,
  imageAnalysisCache = {}
) {
  const sourceId = text(event?.id);
  const country = smsticketCountryCode(event);
  const title = text(event?.name);
  const rawDescription = decodeHtmlEntities(String(event?.description || '').trim());
  const descriptionText = truncateText(stripHtml(rawDescription));

  const startDate = text(event?.dates?.start_date);
  const startTime = text(event?.dates?.start_time);
  const bookingEndDate = text(event?.dates?.booking_end_date);
  const bookingEndTime = text(event?.dates?.booking_end_time);

  const rawBookingUrl = text(event?.booking_url || event?.details?.url);
  const bookingUrl = appendAffiliate(rawBookingUrl);

  const themes = getThemes(event);
  const genres = getGenres(event);
  const types = getTypes(event);
  const category = mapCategory({ themes, types });

  const city = text(event?.place?.city);
  const venueName = text(event?.place?.company);
  const street = text(event?.place?.street);

  const latitudeRaw = text(event?.place?.wgs84?.latitude);
  const longitudeRaw = text(event?.place?.wgs84?.longitude);
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  const image = pickPhoto(event, 'normalized');
  const imageOriginal = pickPhoto(event, 'original');

  /*
   * Presentation metadata is asset-specific.
   * Resolve it against the same normalized image URL that
   * event cards render; imageOriginal is provider metadata only.
   */
  const imagePresentation =
    resolveEventImageAnalysis(
      imageAnalysisCache,
      image
    );

  return withProviderDateRange({
    id: `smsticket-${sourceId}`,
    partner: 'smsticket',
    source: 'smsticket',
    sourceId,

    title: {
      cs: title,
      en: title,
      de: title,
      sk: title,
      pl: title,
      hu: title
    },

    description: { cs: descriptionText },

    date: startDate,
    datetime: combineDateTime(startDate, startTime),
    time: startTime,

    bookingEndsAt: combineDateTime(bookingEndDate, bookingEndTime),
    priceFrom: text(event?.details?.entrance_fee),

    category,
    categories: themes,
    genres,
    types,

    image,
    imageOriginal,

    ...(imagePresentation
      ? {
          imagePresentation
        }
      : {}),

    url: bookingUrl,
    tickets: bookingUrl,
    rawUrl: rawBookingUrl,

    country,

    location: {
      city,
      country,
      lat: latitude,
      lon: longitude,
      latitude,
      longitude
    },

    venue: {
      name: venueName,
      city,
      country,
      address: {
        city,
        street,
        country
      },
      location: {
        lat: latitude,
        lon: longitude,
        latitude,
        longitude
      }
    },

    place: {
      city,
      company: venueName,
      street,
      id: text(event?.place?.id)
    },

    affiliate: {
      provider: 'smsticket',
      param: AFFILIATE_PARAM
    }
  }, { endLocalDate: text(event?.dates?.end_date), description: stripHtml(rawDescription) });
}


function foldSubsetCity(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSubsetCity(event = {}) {
  return foldSubsetCity(
    event?.place?.city ||
    event?.venue?.city ||
    event?.city ||
    ''
  );
}

function matchesSubsetCity(event, definition) {
  const city = getSubsetCity(event);

  if (!city) return false;

  return definition.aliases.some((alias) => {
    const foldedAlias = foldSubsetCity(alias);

    return (
      city === foldedAlias ||
      city.startsWith(foldedAlias + ' ') ||
      city.endsWith(' ' + foldedAlias) ||
      city.includes(' ' + foldedAlias + ' ')
    );
  });
}

// AJSEE_SMSTICKET_LIGHT_CITY_SUBSETS_v1
// City subset feeds are listing payloads. Keep the full smsticket-events.json
// unchanged as the canonical fallback, but strip fields that are not needed for
// event cards, city/category/date/keyword filtering, provider badges or links.
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

function createLightCitySubsetEvent(event = {}) {
  const {
    description,
    imageOriginal,
    rawUrl,
    bookingEndsAt,
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

function createSubsetPayload(payload, definition, events) {
  const lightEvents = events.map(createLightCitySubsetEvent);

  return {
    ...payload,
    subset: {
      type: 'city',
      slug: definition.slug,
      aliases: definition.aliases,
      payload: 'listing-light',
      descriptionPayload: 'excerpt-240',
      removedFields: [
        'imageOriginal',
        'rawUrl',
        'bookingEndsAt'
      ]
    },
    count: lightEvents.length,
    events: lightEvents
  };
}

async function writeSmsticketPayloads(
  payload,
  {
    logLabel = 'synced',
    outputFile = OUT_FILE
  } = {}
) {
  const outputDir = path.dirname(outputFile);
  await mkdir(outputDir, { recursive: true });

  await atomicWriteJson(outputFile, payload);

  console.log(
    '[smsticket] ' +
    logLabel +
    ' ' +
    payload.events.length +
    ' events -> ' +
    outputFile
  );

  for (const definition of CITY_SUBSETS) {
    const subsetEvents = payload.events.filter((event) => matchesSubsetCity(event, definition));
    const subsetFile = path.join(outputDir, 'smsticket-events-' + definition.slug + '.json');
    const subsetPayload = createSubsetPayload(payload, definition, subsetEvents);

    await atomicWriteJson(subsetFile, subsetPayload);

    console.log(
      '[smsticket] city subset ' +
      definition.slug +
      ': ' +
      subsetEvents.length +
      ' events -> ' +
      subsetFile
    );
  }
}
async function atomicWriteJson(file, payload) {
  const temporary = file + '.tmp-' + process.pid;
  try {
    await writeFile(temporary, JSON.stringify(payload, null, 2), 'utf8');
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function readExistingFallback(outputFile = OUT_FILE) {
  if (!existsSync(outputFile)) return null;

  try {
    const raw = await readFile(outputFile, 'utf8');
    const payload = JSON.parse(raw);
    return Array.isArray(payload?.events) && payload.events.length > 0 ? payload : null;
  } catch {
    return null;
  }
}

export function parseSmsticketXml(xml) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > 30 * 1024 * 1024 ||
      /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Invalid SMS Ticket XML document');
  const validity = XMLValidator.validate(xml);
  if (validity !== true) throw new Error('Malformed SMS Ticket XML');
  const parsed = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text',
    trimValues: true, parseTagValue: false, parseAttributeValue: false,
    stopNodes: ['*.description']
  }).parse(xml);
  if (!parsed?.events || typeof parsed.events !== 'object') throw new Error('Missing SMS Ticket events root');
  const events = toArray(parsed.events.event);
  if (!events.length) throw new Error('Empty SMS Ticket feed');
  return events;
}

export function buildSmsticketPayload(xml, {
  existingPayload, imageAnalysisCache = {}, syncedAt = new Date().toISOString(),
  minimumEvents = 100, allowLargeDrop = false
} = {}) {
  const rawEvents = parseSmsticketXml(xml);
  const nonTest = rawEvents.filter(event => !isTestEvent(event));
  const available = nonTest.filter(isFutureOrActive);
  const normalized = available.map(event => normalizeEvent(event, imageAnalysisCache));
  const events = normalized.filter(event => event.sourceId && event.title?.cs && event.url && event.datetime)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  if (events.length < Math.max(1, minimumEvents)) throw new Error('SMS Ticket feed has too few valid events: ' + events.length);
  if (new Set(events.map(event => event.sourceId)).size !== events.length) throw new Error('Duplicate SMS Ticket event IDs');
  const previous = existingPayload?.events?.length || 0;
  if (!allowLargeDrop && previous >= minimumEvents && events.length < Math.floor(previous * 0.5)) {
    throw new Error('SMS Ticket event count dropped from ' + previous + ' to ' + events.length);
  }
  return { source: 'smsticket', sourceUrl: SMSTICKET_API_URL, syncedAt,
    lastSyncAttemptAt: syncedAt, lastSyncStatus: 'ok', count: events.length, events,
    stats: { rawEvents: rawEvents.length, excludedTests: rawEvents.length - nonTest.length,
      expiredOrUndated: nonTest.length - available.length, rejected: normalized.length - events.length,
      accepted: events.length }
  };
}

export async function runSmsticketSync({
  outputFile = OUT_FILE, fetchImpl = globalThis.fetch,
  startedAt = new Date().toISOString(), minimumEvents = 100,
  allowLargeDrop = process.env.SMSTICKET_ALLOW_COUNT_DROP === '1'
} = {}) {
  const existing = await readExistingFallback(outputFile);

  try {
    const xml =
      await fetchSmsticketXml(
        SMSTICKET_API_URL,
        {
          fetchImpl,
          onRetry({
            attempt,
            maxAttempts,
            error
          }) {
            console.warn(
              '[smsticket] request attempt ' +
              attempt +
              '/' +
              maxAttempts +
              ' failed: ' +
              (
                error?.message ||
                error
              ) +
              '; retrying'
            );
          }
        }
      );

    const imageAnalysisCache =
      await readSmsticketImageAnalysisCache();

    const payload = buildSmsticketPayload(xml, { existingPayload: existing, imageAnalysisCache,
      syncedAt: startedAt, minimumEvents, allowLargeDrop });
    await writeSmsticketPayloads(payload, { outputFile });
    return payload;
  } catch (error) {
    console.warn(`[smsticket] sync failed: ${error?.message || error}`);

    if (existing) {
      const imageAnalysisCache =
        await readSmsticketImageAnalysisCache();

      const refreshedFallback =
        refreshSmsticketFallbackPayload(
          existing,
          imageAnalysisCache,
          startedAt
        );

      await writeSmsticketPayloads(
        refreshedFallback,
        {
          logLabel:
            'refreshed cached',
          outputFile
        }
      );

      console.warn(
        '[smsticket] keeping existing cached event data with current build-time enrichments'
      );

      return refreshedFallback;
    }

    // A first-time failure cannot manufacture a fresh, successful empty feed.
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runSmsticketSync();
}
