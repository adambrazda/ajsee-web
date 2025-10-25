// src/utils/url.js
// Bezpečné URL helpery + affiliate + i18n wrappery pro Ticketmaster

import { TM_LANG_MAP } from '../config.js';

export function esc(s='') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function safeUrl(raw) {
  try {
    const u = new URL(raw, location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {}
  return '#';
}

export function adjustTicketmasterLanguage(rawUrl, lang = 'en') {
  try {
    const u = new URL(rawUrl, location.href);
    const tm = TM_LANG_MAP[(lang || 'en').slice(0,2)] || TM_LANG_MAP.en;
    u.searchParams.set('language', tm);
    if (!u.searchParams.has('locale')) u.searchParams.set('locale', tm);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// window.__impact = { clickBase: 'https://go.impact.com/c/...?...?u=' }
//  or window.__aff = { param:'irclickid', value:'...' }
export function wrapAffiliate(url) {
  try {
    const cfg = window.__impact || window.__aff || {};
    if (cfg.clickBase && /^https?:/i.test(cfg.clickBase)) {
      return cfg.clickBase + encodeURIComponent(url);
    }
    if (cfg.param && cfg.value) {
      const u = new URL(url);
      if (!u.searchParams.has(cfg.param)) u.searchParams.set(cfg.param, cfg.value);
      return u.toString();
    }
  } catch {}
  return url;
}
