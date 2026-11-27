import { CONSENT_KEY, GA4_MEASUREMENT_ID } from './analytics-config.js';

// Only campaign attribution belongs in an analytics URL. Never copy filter,
// free-text, coordinate, identity-token or fragment values into GA4.
const CAMPAIGN_KEYS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term',
  'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'dclid', 'gbraid', 'wbraid'
]);

export function analyticsPageContext(target = globalThis) {
  try {
    const url = new URL(target.location.href);
    const safe = new URL(url.origin + url.pathname);
    for (const [key, value] of url.searchParams) {
      if (CAMPAIGN_KEYS.has(key)) safe.searchParams.append(key, value);
    }
    let referrer = '';
    try {
      const ref = new URL(target.document?.referrer || '');
      if (/^https?:$/.test(ref.protocol)) {
        referrer = ref.origin + ref.pathname;
      }
    } catch { /* No referrer. */ }
    return { page_path: url.pathname, page_location: safe.href, page_referrer: referrer };
  } catch {
    return { page_path: '/', page_location: '', page_referrer: '' };
  }
}

export function canTrackAnalytics(target = globalThis) {
  try {
    const consent = JSON.parse(target.localStorage.getItem(CONSENT_KEY));
    return consent?.analytics === true &&
      target['ga-disable-' + GA4_MEASUREMENT_ID] !== true &&
      target.location?.protocol === 'https:' &&
      !/localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0/i.test(target.location.hostname || '');
  } catch {
    return false;
  }
}

// One transport, explicit current consent. Do not initialize a queue for
// rejected visitors; callers must not depend on analytics for UI behavior.
export function trackAnalyticsEvent(name, parameters = {}, target = globalThis) {
  if (!canTrackAnalytics(target) || typeof target.gtag !== 'function') return false;
  try {
    const { event, source, debug_mode, page_location, page_path, page_referrer, send_to, ...fields } = parameters;
    target.gtag('event', name, {
      ...fields,
      ...analyticsPageContext(target),
      send_to: GA4_MEASUREMENT_ID
    });
    return true;
  } catch {
    return false;
  }
}
