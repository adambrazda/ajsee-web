// scripts/fetch-seatplan.mjs
// ---------------------------------------------------------
// AJSEE - SeatPlan feed normalizer
//
// Fetches SeatPlan production + venue feeds and writes:
//   public/data/seatplan-events.json
//
// Notes:
// - Production list recommended refresh: every ~6 hours when using pricing/offers.
// - Venue list recommended refresh: once per day.
// - Tracking URL is protected through Netlify function seatplanOutbound.
// ---------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';

const PRODUCTION_FEED_URL = 'https://seatplan.com/api/production-list.json';
const VENUE_FEED_URL = 'https://seatplan.com/api/venue-list.json';

const OUT_FILE = path.resolve('public/data/seatplan-events.json');

const USER_AGENT = 'AJSEE SeatPlan pilot / adam@ajsee.cz';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value = '') {
  return String(value || '').trim();
}

function slugify(value = '') {
  return cleanString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function toIsoDate(value = '') {
  const raw = cleanString(value);
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? raw : '';
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function categoryToAjseeCategory(category = '') {
  const c = cleanString(category).toLowerCase();

  if (c.includes('musical')) return 'theatre';
  if (c.includes('play')) return 'theatre';
  if (c.includes('opera')) return 'theatre';
  if (c.includes('dance')) return 'theatre';
  if (c.includes('comedy')) return 'theatre';

  return 'theatre';
}

function buildSeatPlanOutboundUrl(productionUrl, slug) {
  const qs = new URLSearchParams();
  qs.set('to', productionUrl);
  qs.set('subId1', 'ajsee');
  qs.set('subId2', 'london-theatre');
  qs.set('subId3', slug || 'seatplan');

  return `/.netlify/functions/seatplanOutbound?${qs.toString()}`;
}

function pickImage(production = {}) {
  return (
    cleanString(production['url-production-header']) ||
    cleanString(production['url-logo-small']) ||
    cleanString(production['seat-view-url']) ||
    ''
  );
}

function normalizeProduction(show = {}, production = {}, venueById = new Map()) {
  const showName = cleanString(show.name);
  const productionId = cleanString(production['production-id']);
  const productionUrl = cleanString(production['production-url']);

  if (!showName || !productionId || !productionUrl) {
    return null;
  }

  const venueId = cleanString(production['venue-id']);
  const venueFromVenueFeed = venueById.get(venueId) || {};

  const city =
    cleanString(production['venue-city']) ||
    cleanString(venueFromVenueFeed.city) ||
    'London';

  const venueName =
    cleanString(production['venue-name']) ||
    cleanString(venueFromVenueFeed.name);

  const slug = slugify(`${showName}-${productionId}`);
  const bookingFrom = toIsoDate(production['booking-from']);
  const bookingUntil = toIsoDate(production['booking-until']);

  const description = cleanString(production['short-description']);
  const category = categoryToAjseeCategory(show.category);

  const minPrice = toNumberOrNull(production['min-price']);
  const maxPrice = toNumberOrNull(production['max-price']);
  const currency = cleanString(production.currency || 'GBP') || 'GBP';

  const image = pickImage(production);

  return {
    id: `seatplan-${slug}`,
    partner: 'seatplan',
    source: 'seatplan',
    sourceId: productionId,

    title: {
      cs: showName,
      en: showName,
      de: showName,
      sk: showName,
      pl: showName,
      hu: showName
    },

    description: {
      cs: description,
      en: description,
      de: description,
      sk: description,
      pl: description,
      hu: description
    },

    category,
    categories: ['theatre', 'london-theatre'],
    types: [
      cleanString(show.category) || 'Theatre'
    ].filter(Boolean),

    // AJSEE event compatibility fields.
    date: bookingFrom,
    datetime: bookingFrom ? `${bookingFrom}T19:30:00` : '',
    dateFrom: bookingFrom,
    dateTo: bookingUntil,
    bookingFrom,
    bookingUntil,

    image,
    imageOriginal: cleanString(production['url-production-header']) || image,

    url: buildSeatPlanOutboundUrl(productionUrl, slug),
    tickets: buildSeatPlanOutboundUrl(productionUrl, slug),
    rawUrl: productionUrl,

    country: 'GB',
    countryCode: 'GB',

    location: {
      city,
      country: 'GB',
      venue: venueName,
      address1: cleanString(production['venue-address1']),
      address2: cleanString(production['venue-address2']),
      postcode: cleanString(production['venue-postcode'])
    },

    venue: {
      id: venueId,
      name: venueName,
      url: cleanString(production['venue-url']) || cleanString(venueFromVenueFeed.url),
      city,
      seatCount: toNumberOrNull(venueFromVenueFeed.seat_count),
      reviewCount: toNumberOrNull(venueFromVenueFeed.review_count)
    },

    price: {
      min: minPrice,
      max: maxPrice,
      currency
    },

    seatPlan: {
      productionId,
      productionUrl,
      venueId,
      seatViewUrl: cleanString(production['seat-view-url']),
      seatViewSection: cleanString(production['seat-view-section']),
      seatViewRow: cleanString(production['seat-view-row']),
      seatViewSeat: cleanString(production['seat-view-seat']),
      offers: asArray(production.offers)
    },

    affiliate: {
      provider: 'seatplan',
      outbound: 'seatplanOutbound',
      subId1: 'ajsee',
      subId2: 'london-theatre',
      subId3: slug
    },

    attribution: {
      provider: 'SeatPlan',
      requiredForImages: true
    }
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }

  return response.json();
}

async function main() {
  const [productionFeed, venueFeed] = await Promise.all([
    fetchJson(PRODUCTION_FEED_URL),
    fetchJson(VENUE_FEED_URL)
  ]);

  const shows = asArray(productionFeed?.seatplan?.shows);
  const venues = asArray(venueFeed?.seatplan?.venues);

  const venueById = new Map(
    venues.map((venue) => [cleanString(venue.id), venue])
  );

  const events = [];

  for (const show of shows) {
    for (const production of asArray(show.productions)) {
      const normalized = normalizeProduction(show, production, venueById);
      if (normalized) events.push(normalized);
    }
  }

  events.sort((a, b) => {
    const aDate = a.dateFrom || '9999-12-31';
    const bDate = b.dateFrom || '9999-12-31';
    return aDate.localeCompare(bDate) || a.title.en.localeCompare(b.title.en);
  });

  const payload = {
    provider: 'seatplan',
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: cleanString(productionFeed?.seatplan?.generated),
    counts: {
      shows: shows.length,
      venues: venues.length,
      events: events.length
    },
    refreshPolicy: {
      productionList: '6 hours when using offers/pricing',
      venueList: '24 hours'
    },
    events
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('AJSEE SeatPlan feed generated');
  console.log('='.repeat(56));
  console.log(`Shows: ${shows.length}`);
  console.log(`Venues: ${venues.length}`);
  console.log(`Events: ${events.length}`);
  console.log(`${OUT_FILE}: updated`);

  const paddington = events.find((event) => /paddington/i.test(event.title.en));
  if (paddington) {
    console.log('');
    console.log('Paddington sample:');
    console.log(JSON.stringify({
      id: paddington.id,
      title: paddington.title.en,
      dateFrom: paddington.dateFrom,
      dateTo: paddington.dateTo,
      venue: paddington.venue.name,
      tickets: paddington.tickets,
      rawUrl: paddington.rawUrl,
      price: paddington.price
    }, null, 2));
  }
}

main().catch((error) => {
  console.error('[fetch-seatplan] failed:', error);
  process.exitCode = 1;
});