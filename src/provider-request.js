import { unpackEventFeed } from '../shared/event-feed.js';

const COMPACT_FEEDS = new Map([
  ['/data/smsticket-events.json', '/data/smsticket-events.compact.json'],
  ['/data/colosseumticket-events.json', '/data/colosseumticket-events.compact.json']
]);

// Bound the complete operation, including response-body reading. An abort alone
// is insufficient when a transport fails to settle its promise.
export async function withRequestDeadline(operation, timeoutMs = 5000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Provider request timed out');
      error.code = 'PROVIDER_TIMEOUT';
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function fetchProviderJson(url) {
  return withRequestDeadline(async signal => {
    const read = async input => {
      const response = await fetch(input, { cache: 'default', signal });
      if (!response.ok) throw new Error(`Provider response ${response.status}`);
      return unpackEventFeed(await response.json()).events;
    };
    const compact = COMPACT_FEEDS.get(url);
    if (compact) {
      try { return await read(compact); }
      catch (error) { if (signal.aborted) throw error; }
    }
    // A missing/invalid compact artifact must not hide the original inventory.
    return read(url);
  });
}
