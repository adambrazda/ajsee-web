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
    const response = await fetch(url, { cache: 'default', signal });
    if (!response.ok) throw new Error(`Provider response ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.events)) throw new Error('Invalid provider feed');
    return payload.events;
  });
}
