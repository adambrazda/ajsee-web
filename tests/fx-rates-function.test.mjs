import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFxRatesHandler,
  parseEcbDailyRates
} from '../netlify/functions/fx-rates.js';

const SAMPLE_XML = `
<gesmes:Envelope>
  <Cube>
    <Cube time="2026-08-21">
      <Cube currency="USD" rate="1.1567"/>
      <Cube currency="GBP" rate="0.85725"/>
      <Cube currency="CZK" rate="24.153"/>
      <Cube currency="PLN" rate="4.2750"/>
      <Cube currency="HUF" rate="394.20"/>
    </Cube>
  </Cube>
</gesmes:Envelope>
`;

test(
  'parses ECB daily rates into the AJSEE EUR reference contract',
  () => {
    assert.deepEqual(
      parseEcbDailyRates(
        SAMPLE_XML
      ),
      {
        base:
          'EUR',

        date:
          '2026-08-21',

        rates: {
          EUR:
            1,

          USD:
            1.1567,

          GBP:
            0.85725,

          CZK:
            24.153,

          PLN:
            4.275,

          HUF:
            394.2
        }
      }
    );
  }
);

test(
  'rejects incomplete ECB payloads',
  () => {
    assert.throws(
      () =>
        parseEcbDailyRates(
          `
          <Cube time="2026-08-21">
            <Cube currency="CZK" rate="24.153"/>
          </Cube>
          `
        ),
      /ecb-rate-missing/
    );
  }
);

test(
  'serves and caches a fresh ECB snapshot',
  async () => {
    let fetchCount =
      0;

    const handler =
      createFxRatesHandler({
        fetchImpl:
          async () => {
            fetchCount++;

            return new Response(
              SAMPLE_XML,
              {
                status:
                  200,

                headers: {
                  'Content-Type':
                    'application/xml'
                }
              }
            );
          },

        nowFn:
          () =>
            1_000_000
      });

    const request =
      new Request(
        'https://ajsee.cz/api/fx-rates'
      );

    const first =
      await handler(
        request
      );

    const second =
      await handler(
        request
      );

    assert.equal(
      first.status,
      200
    );

    assert.equal(
      second.status,
      200
    );

    assert.equal(
      fetchCount,
      1
    );

    const payload =
      await first.json();

    assert.equal(
      payload.ok,
      true
    );

    assert.equal(
      payload.base,
      'EUR'
    );

    assert.equal(
      payload.rates.CZK,
      24.153
    );

    assert.match(
      first.headers.get(
        'cache-control'
      ) || '',
      /max-age=900/
    );
  }
);

test(
  'falls back to stale cached rates when ECB temporarily fails',
  async () => {
    let now =
      1_000_000;

    let fetchCount =
      0;

    const handler =
      createFxRatesHandler({
        fetchImpl:
          async () => {
            fetchCount++;

            if (
              fetchCount ===
              1
            ) {
              return new Response(
                SAMPLE_XML,
                {
                  status:
                    200
                }
              );
            }

            throw new Error(
              'network-down'
            );
          },

        nowFn:
          () =>
            now
      });

    const request =
      new Request(
        'https://ajsee.cz/api/fx-rates'
      );

    const first =
      await handler(
        request
      );

    assert.equal(
      first.status,
      200
    );

    now +=
      7 * 60 * 60 * 1000;

    const stale =
      await handler(
        request
      );

    assert.equal(
      stale.status,
      200
    );

    const payload =
      await stale.json();

    assert.equal(
      payload.stale,
      true
    );

    assert.equal(
      payload.rates.GBP,
      0.85725
    );

    assert.equal(
      stale.headers.get(
        'x-ajsee-fx-stale'
      ),
      '1'
    );
  }
);

test(
  'fails closed when neither fresh nor stale rates are available',
  async () => {
    const handler =
      createFxRatesHandler({
        fetchImpl:
          async () => {
            throw new Error(
              'network-down'
            );
          }
      });

    const response =
      await handler(
        new Request(
          'https://ajsee.cz/api/fx-rates'
        )
      );

    assert.equal(
      response.status,
      503
    );

    const payload =
      await response.json();

    assert.equal(
      payload.ok,
      false
    );

    assert.equal(
      payload.code,
      'fx-rates-unavailable'
    );
  }
);