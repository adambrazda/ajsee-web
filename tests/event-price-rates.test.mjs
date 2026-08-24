import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEventPriceRatesClient,
  normalizeEventPriceRateSnapshot
} from '../src/event-price-rates.js';

function validPayload(
  overrides = {}
) {
  return {
    ok:
      true,

    base:
      'EUR',

    date:
      '2026-08-21',

    source:
      'ECB',

    stale:
      false,

    rates: {
      EUR:
        1,

      CZK:
        24.153,

      GBP:
        0.85725,

      USD:
        1.1567,

      PLN:
        4.275,

      HUF:
        394.2
    },

    ...overrides
  };
}

test(
  'normalizes a valid event-price FX snapshot',
  () => {
    const snapshot =
      normalizeEventPriceRateSnapshot(
        validPayload()
      );

    assert.equal(
      snapshot.base,
      'EUR'
    );

    assert.equal(
      snapshot.rates.EUR,
      1
    );

    assert.equal(
      snapshot.rates.CZK,
      24.153
    );

    assert.equal(
      snapshot.stale,
      false
    );
  }
);

test(
  'rejects an incomplete FX snapshot',
  () => {
    const payload =
      validPayload();

    delete payload.rates.GBP;

    assert.throws(
      () =>
        normalizeEventPriceRateSnapshot(
          payload
        ),
      /invalid-fx-rate-gbp/
    );
  }
);

test(
  'browser FX client reuses its in-memory snapshot',
  async () => {
    let fetchCount =
      0;

    let now =
      5_000;

    const client =
      createEventPriceRatesClient({
        fetchImpl:
          async () => {
            fetchCount++;

            return new Response(
              JSON.stringify(
                validPayload()
              ),
              {
                status:
                  200,

                headers: {
                  'Content-Type':
                    'application/json'
                }
              }
            );
          },

        cacheTtlMs:
          60_000,

        nowFn:
          () =>
            now
      });

    const first =
      await client.getSnapshot();

    now +=
      10_000;

    const second =
      await client.getSnapshot();

    assert.equal(
      fetchCount,
      1
    );

    assert.deepEqual(
      second,
      first
    );
  }
);

test(
  'browser FX client refreshes an expired snapshot',
  async () => {
    let fetchCount =
      0;

    let now =
      5_000;

    const client =
      createEventPriceRatesClient({
        fetchImpl:
          async () => {
            fetchCount++;

            return new Response(
              JSON.stringify(
                validPayload()
              ),
              {
                status:
                  200,

                headers: {
                  'Content-Type':
                    'application/json'
                }
              }
            );
          },

        cacheTtlMs:
          1_000,

        nowFn:
          () =>
            now
      });

    await client.getSnapshot();

    now +=
      2_000;

    await client.getSnapshot();

    assert.equal(
      fetchCount,
      2
    );
  }
);

test(
  'browser FX client rejects upstream failure',
  async () => {
    const client =
      createEventPriceRatesClient({
        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                ok:
                  false
              }),
              {
                status:
                  503,

                headers: {
                  'Content-Type':
                    'application/json'
                }
              }
            )
      });

    await assert.rejects(
      () =>
        client.getSnapshot(),
      /fx-rates-http-503/
    );
  }
);