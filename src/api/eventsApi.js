// /src/api/eventsApi.js
// ---------------------------------------------------------
// Aggregate events from adapters, apply consistent client-side filters
// ---------------------------------------------------------

import { fetchEvents as fetchTicketmasterEvents } from '../adapters/ticketmaster.js';

// Consider anything that's not localhost/127.* as production (adjust if needed)
const isProduction =
  typeof window !== 'undefined' &&
  !/^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname) &&
  window.location.hostname.includes('ajsee');

function inRangeISO(dateStr, fromISO, toISO) {
  if (!dateStr) return false;
  const d = new Date(dateStr).toISOString();
  if (fromISO && d < new Date(fromISO).toISOString()) return false;
  if (toISO && d > new Date(toISO).toISOString()) return false;
  return true;
}

function normalizeStr(s) {
  return (s || '').toString().toLowerCase();
}

/**
 * Fetches and merges events from partners, then applies client-side filters
 * (useful especially for demo/secondary sources).
 */
export async function getAllEvents({ locale = 'cs', filters = {} } = {}) {
  let all = [];

  // --- Ticketmaster (always) ---
  const tm = await fetchTicketmasterEvents({ locale, filters });
  all = all.concat(tm);

  // --- Demo source (dev only) ---
  if (!isProduction) {
    const { fetchEvents: fetchDemoEvents } = await import('../adapters/demo.js');
    const demo = await fetchDemoEvents({ locale, filters });
    all = all.concat(demo);
  }

  // ---- Client-side filters (defensive; backend already filters for TM) ----
  const {
    category = 'all',
    city = '',
    keyword = '',
    dateFrom = '',
    dateTo = '',
    sort = 'nearest',
  } = filters;

  // Category
  if (category && category !== 'all') {
    all = all.filter(ev => normalizeStr(ev.category) === normalizeStr(category));
  }

  // City (contains)
  if (city) {
    const cityNorm = normalizeStr(city);
    all = all.filter(ev => normalizeStr(ev?.location?.city).includes(cityNorm));
  }

  // Keyword (title/description contains)
  if (keyword) {
    const q = normalizeStr(keyword);
    all = all.filter(ev =>
      normalizeStr(ev?.title?.[locale] || ev?.title?.cs || ev?.title)
        .includes(q) ||
      normalizeStr(ev?.description?.[locale] || ev?.description?.cs || ev?.description)
        .includes(q)
    );
  }

  // Date range
  const fromISO = dateFrom ? new Date(dateFrom).toISOString() : '';
  const toISO = dateTo ? new Date(dateTo).toISOString() : '';
  if (fromISO || toISO) {
    all = all.filter(ev => inRangeISO(ev.datetime || ev.date, fromISO, toISO));
  }

  // Sort by date
  all.sort((a, b) => {
    const da = new Date(a.datetime || a.date);
    const db = new Date(b.datetime || b.date);
    return sort === 'latest' ? db - da : da - db; // default nearest
  });

  return all;
}
