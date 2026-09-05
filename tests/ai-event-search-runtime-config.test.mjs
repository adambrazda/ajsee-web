import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TURNSTILE_TEST_SITEKEY,
  formatLocalIsoWithOffset,
  isAiSearchServerEnabled,
  resolveAiSearchClientConfig
} from '../src/ai-search/runtime-config.js';

test(
  'deploy previews use the Cloudflare testing sitekey without production flags',
  () => {
    assert.deepEqual(
      resolveAiSearchClientConfig({
        hostname:
          'deploy-preview-175--ajsee-demo.netlify.app'
      }),
      {
        enabled:
          true,

        sitekey:
          TURNSTILE_TEST_SITEKEY,

        mode:
          'cloudflare-dummy'
      }
    );
  }
);

test(
  'production AI search fails closed until both enable flag and sitekey exist',
  () => {
    for (
      const config of [
        {},
        {
          enabled:
            'true'
        },
        {
          sitekey:
            'production-sitekey'
        },
        {
          enabled:
            'false',

          sitekey:
            'production-sitekey'
        }
      ]
    ) {
      assert.equal(
        resolveAiSearchClientConfig({
          hostname:
            'ajsee.cz',

          ...config
        }).enabled,
        false
      );
    }
  }
);

test(
  'production AI search enables only on AJSEE production hosts with explicit config',
  () => {
    const expected = {
      enabled:
        true,

      sitekey:
        'production-sitekey',

      mode:
        'production'
    };

    for (
      const hostname of [
        'ajsee.cz',
        'www.ajsee.cz'
      ]
    ) {
      assert.deepEqual(
        resolveAiSearchClientConfig({
          hostname,
          enabled:
            'true',
          sitekey:
            'production-sitekey'
        }),
        expected
      );
    }

    assert.equal(
      resolveAiSearchClientConfig({
        hostname:
          'example.com',
        enabled:
          'true',
        sitekey:
          'production-sitekey'
      }).enabled,
      false
    );
  }
);

test(
  'server gate allows previews, requires explicit production activation, and rejects unknown hosts',
  () => {
    assert.equal(
      isAiSearchServerEnabled({
        hostname:
          'deploy-preview-175--ajsee-demo.netlify.app'
      }),
      true
    );

    assert.equal(
      isAiSearchServerEnabled({
        hostname:
          'ajsee.cz',

        enabled:
          'true'
      }),
      true
    );

    assert.equal(
      isAiSearchServerEnabled({
        hostname:
          'ajsee.cz'
      }),
      false
    );

    assert.equal(
      isAiSearchServerEnabled({
        hostname:
          'ajsee-demo.netlify.app',

        enabled:
          'true'
      }),
      false
    );

    assert.equal(
      isAiSearchServerEnabled({
        hostname:
          'example.com',

        enabled:
          'true'
      }),
      false
    );
  }
);

test(
  'local ISO formatter preserves the browser date and UTC offset',
  () => {
    assert.equal(
      formatLocalIsoWithOffset(
        new Date(
          '2026-09-05T22:30:00.000Z'
        ),
        -120
      ),
      '2026-09-06T00:30:00+02:00'
    );

    assert.equal(
      formatLocalIsoWithOffset(
        new Date(
          '2026-01-05T23:45:00.000Z'
        ),
        -60
      ),
      '2026-01-06T00:45:00+01:00'
    );
  }
);
