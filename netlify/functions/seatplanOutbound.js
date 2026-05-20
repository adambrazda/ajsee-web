// netlify/functions/seatplanOutbound.js
// ---------------------------------------------------------
// AJSEE SeatPlan outbound redirect
//
// Goal:
// - receive a SeatPlan production URL through "to" / "u" / "url"
// - allow only seatplan.com destinations
// - generate an Impact tracked SeatPlan deep link server-side
// - keep Impact IDs out of frontend HTML
// ---------------------------------------------------------

const AJSEE_IMPACT_ID = '7218577';
const AJSEE_PARTNER_PROPERTY_ID = '8292139';

const SEATPLAN_ASSET_ID = '2219054';
const SEATPLAN_PROGRAM_ID = '28679';
const SEATPLAN_SVLINK = '15858525';

const IMPACT_BASE_URL = `https://seatplan.sjv.io/c/${AJSEE_IMPACT_ID}/${SEATPLAN_ASSET_ID}/${SEATPLAN_PROGRAM_ID}`;
const DEFAULT_FALLBACK_URL = 'https://seatplan.com/london/';

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function safeRedirect(location, statusCode = 302) {
  return {
    statusCode,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    body: '',
  };
}

function normalizeHost(hostname = '') {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function cleanTrackingValue(value = '', fallback = '') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return cleaned || fallback;
}

function safeDecodeMaybe(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isAllowedSeatPlanHost(hostname = '') {
  const host = normalizeHost(hostname);
  return host === 'seatplan.com';
}

function parseDestinationUrl(value = '') {
  const raw = safeDecodeMaybe(value);

  if (!raw) return null;

  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return null;
  }

  if (!isAllowedSeatPlanHost(parsed.hostname)) {
    return null;
  }

  parsed.protocol = 'https:';

  return parsed;
}

function buildSeatPlanImpactUrl(destinationUrl, q = {}) {
  const impactUrl = new URL(IMPACT_BASE_URL);

  const subId1 = cleanTrackingValue(q.subId1 || q.source || 'ajsee', 'ajsee');
  const subId2 = cleanTrackingValue(q.subId2 || q.placement || 'london_theatre', 'london_theatre');
  const subId3 = cleanTrackingValue(q.subId3 || q.eid || q.slug || 'seatplan', 'seatplan');

  impactUrl.searchParams.set('subId1', subId1);
  impactUrl.searchParams.set('subId2', subId2);
  impactUrl.searchParams.set('subId3', subId3);

  // URLSearchParams handles encoding. Do not pre-encode destinationUrl.
  impactUrl.searchParams.set('u', destinationUrl.toString());

  impactUrl.searchParams.set('partnerpropertyid', AJSEE_PARTNER_PROPERTY_ID);
  impactUrl.searchParams.set('MediaPartnerPropertyId', AJSEE_PARTNER_PROPERTY_ID);
  impactUrl.searchParams.set('svlink', SEATPLAN_SVLINK);
  impactUrl.searchParams.set('level', '1');

  return impactUrl.toString();
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters || {};
  const destinationRaw = q.to || q.u || q.url || '';

  const destinationUrl = parseDestinationUrl(destinationRaw);

  if (!destinationUrl) {
    return safeRedirect(DEFAULT_FALLBACK_URL);
  }

  const trackedUrl = buildSeatPlanImpactUrl(destinationUrl, q);

  return safeRedirect(trackedUrl);
};