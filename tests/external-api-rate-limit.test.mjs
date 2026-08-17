import test from 'node:test';
import assert from 'node:assert/strict';

import aiHandler, {
  config as aiConfig
} from '../netlify/functions/ai-event-search.js';

import ticketmasterEventsDefault, {
  handler as ticketmasterEventsHandler,
  config as ticketmasterEventsConfig
} from '../netlify/functions/ticketmasterEvents.js';

import ticketmasterCitySuggestDefault, {
  handler as ticketmasterCitySuggestHandler,
  config as ticketmasterCitySuggestConfig
} from '../netlify/functions/ticketmasterCitySuggest.js';

function assertRateLimit(
  config,
  {
    path,
    limit
  }
) {
  assert.equal(
    config?.path,
    path
  );

  assert.deepEqual(
    config?.rateLimit,
    {
      action:
        'rate_limit',

      windowLimit:
        limit,

      windowSize:
        60,

      aggregateBy: [
        'ip',
        'domain'
      ]
    }
  );
}

test(
  'AI Search has strict per-IP rate limiting',
  () => {
    assert.equal(
      typeof aiHandler,
      'function'
    );

    assertRateLimit(
      aiConfig,
      {
        path:
          '/.netlify/functions/ai-event-search',

        limit:
          6
      }
    );
  }
);

test(
  'Ticketmaster Events keeps legacy handler and exposes modern protected wrapper',
  () => {
    assert.equal(
      typeof ticketmasterEventsHandler,
      'function'
    );

    assert.equal(
      typeof ticketmasterEventsDefault,
      'function'
    );

    assertRateLimit(
      ticketmasterEventsConfig,
      {
        path:
          '/.netlify/functions/ticketmasterEvents',

        limit:
          60
      }
    );
  }
);

test(
  'Ticketmaster City Suggest keeps legacy handler and exposes modern protected wrapper',
  () => {
    assert.equal(
      typeof ticketmasterCitySuggestHandler,
      'function'
    );

    assert.equal(
      typeof ticketmasterCitySuggestDefault,
      'function'
    );

    assertRateLimit(
      ticketmasterCitySuggestConfig,
      {
        path:
          '/.netlify/functions/ticketmasterCitySuggest',

        limit:
          30
      }
    );
  }
);