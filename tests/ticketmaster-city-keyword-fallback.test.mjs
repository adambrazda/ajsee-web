import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapterSource = readFileSync(
  new URL(
    '../src/adapters/ticketmaster.js',
    import.meta.url
  ),
  'utf8'
).replace(/\r\n/g, '\n');

function getDecisionFunction() {
  const startMarker =
    "function shouldSkipCzSkCityBroadFallback({ city = '', countryCode = '', filters = {} } = {}) {";

  const start =
    adapterSource.indexOf(startMarker);

  assert.notEqual(
    start,
    -1,
    'fallback function must exist'
  );

  const endMarker =
    '\n\nexport async function fetchEvents';

  const end =
    adapterSource.indexOf(
      endMarker,
      start
    );

  assert.notEqual(
    end,
    -1,
    'fallback function boundary must exist'
  );

  const functionSource =
    adapterSource.slice(
      start,
      end
    );

  return new Function(
    `${functionSource}
     return shouldSkipCzSkCityBroadFallback;`
  )();
}

test(
  'CZ city-only search keeps broad fallback disabled',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Prague',
        countryCode: 'CZ',
        filters: {}
      }),
      true
    );
  }
);

test(
  'SK city-only search keeps broad fallback disabled',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Bratislava',
        countryCode: 'SK',
        filters: {}
      }),
      true
    );
  }
);

test(
  'CZ city plus artist keyword enables broad fallback',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Prague',
        countryCode: 'CZ',
        filters: {
          keyword: 'Eros Ramazzotti'
        }
      }),
      false
    );
  }
);

test(
  'short meaningful keyword such as U2 enables fallback',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Prague',
        countryCode: 'CZ',
        filters: {
          keyword: 'U2'
        }
      }),
      false
    );
  }
);

test(
  'single-character keyword does not trigger broad fallback',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Prague',
        countryCode: 'CZ',
        filters: {
          keyword: 'a'
        }
      }),
      true
    );
  }
);

test(
  'manual fallback override remains supported',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Prague',
        countryCode: 'CZ',
        filters: {
          forceTicketmasterBroadFallback: true
        }
      }),
      false
    );
  }
);

test(
  'non-CZ/SK city behavior remains unchanged',
  () => {
    const shouldSkip =
      getDecisionFunction();

    assert.equal(
      shouldSkip({
        city: 'Vienna',
        countryCode: 'AT',
        filters: {}
      }),
      false
    );
  }
);

test(
  'broad fallback remains guarded by the CZ/SK decision',
  () => {
    assert.match(
      adapterSource,
      /if\s*\(!skipCzSkCityBroadFallback\)\s*\{[\s\S]*?mode:\s*'broad'/
    );
  }
);
