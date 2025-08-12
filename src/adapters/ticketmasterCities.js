// src/adapters/ticketmasterCities.js
const memoryCache = new Map(); // jednoduchý cache {key -> array}

export async function suggestCities({ locale = 'cs', countryCode = 'CZ', keyword = '', size = 50 } = {}) {
  const q = keyword.trim();
  if (q.length < 2) return [];

  const cacheKey = `${locale}|${countryCode}|${q.toLowerCase()}|${size}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

  const qs = new URLSearchParams({ locale, countryCode, keyword: q, size: String(size) });
  const url = `/.netlify/functions/ticketmasterCitySuggest?${qs.toString()}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    const out = Array.isArray(data.cities) ? data.cities : [];
    memoryCache.set(cacheKey, out);
    return out;
  } catch {
    return [];
  }
}
