// scripts/sync-smsticket-events.mjs
// ---------------------------------------------------------
// AJSEE – smsticket XML feed sync
// Stáhne veřejný smsticket feed, převede ho na normalizovaný JSON
// a uloží do /public/data/smsticket-events.json.
// ---------------------------------------------------------

import { XMLParser } from 'fast-xml-parser';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SMSTICKET_API_URL = 'https://www.smsticket.cz/api/public/v1.1/events';
const OUT_FILE = path.resolve('public/data/smsticket-events.json');
const AFFILIATE_PARAM = 'a_box=d4n78jy6';

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
  const relevantDate = bookingEndDate || startDate;

  if (!relevantDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(`${relevantDate}T23:59:59`);
  return Number.isFinite(eventDate.getTime()) && eventDate >= today;
}

function normalizeEvent(event) {
  const sourceId = text(event?.id);
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

  return {
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

    url: bookingUrl,
    tickets: bookingUrl,
    rawUrl: rawBookingUrl,

    country: 'CZ',

    location: {
      city,
      country: 'CZ',
      lat: latitude,
      lon: longitude,
      latitude,
      longitude
    },

    venue: {
      name: venueName,
      city,
      country: 'CZ',
      address: {
        city,
        street,
        country: 'CZ'
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
  };
}

async function readExistingFallback() {
  if (!existsSync(OUT_FILE)) return null;

  try {
    const raw = await readFile(OUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const startedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(SMSTICKET_API_URL, {
      signal: controller.signal,
      headers: {
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'AJSEE smsticket sync'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`smsticket API returned ${response.status}`);
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
      stopNodes: ['*.description']
    });

    const parsed = parser.parse(xml);
    const rawEvents = toArray(parsed?.events?.event);

    const events = rawEvents
      .filter((event) => !isTestEvent(event))
      .filter(isFutureOrActive)
      .map(normalizeEvent)
      .filter((event) => event.sourceId && event.title?.cs && event.url && event.datetime)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    const payload = {
      source: 'smsticket',
      sourceUrl: SMSTICKET_API_URL,
      syncedAt: startedAt,
      count: events.length,
      events
    };

    await mkdir(path.dirname(OUT_FILE), { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[smsticket] synced ${events.length} events -> ${OUT_FILE}`);
  } catch (error) {
    console.warn(`[smsticket] sync failed: ${error?.message || error}`);

    const existing = await readExistingFallback();

    if (existing) {
      console.warn('[smsticket] keeping existing cached data');
      return;
    }

    await mkdir(path.dirname(OUT_FILE), { recursive: true });
    await writeFile(
      OUT_FILE,
      JSON.stringify({
        source: 'smsticket',
        sourceUrl: SMSTICKET_API_URL,
        syncedAt: startedAt,
        count: 0,
        events: [],
        warning: 'Initial sync failed; empty fallback created.'
      }, null, 2),
      'utf8'
    );

    console.warn('[smsticket] empty fallback created');
  }
}

await main();
