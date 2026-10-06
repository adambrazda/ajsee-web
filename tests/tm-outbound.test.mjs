import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL(
  '../netlify/functions/tmOutbound.js',
  import.meta.url
);

test(
  'Ticketmaster outbound defaults to the clean seller URL and only enables Impact explicitly',
  async () => {
    const previous =
      process.env.TM_IMPACT_TRACKING_ENABLED;

    try {
      delete process.env.TM_IMPACT_TRACKING_ENABLED;

      const directModule =
        await import(
          `${moduleUrl.href}?mode=direct-default`
        );

      const target =
        'https://www.ticketmaster.cz/event/test-event/123456';

      const directResponse =
        await directModule.handler({
          httpMethod: 'GET',
          queryStringParameters: {
            to: target,
            cc: 'CZ',
            source: 'events_page',
            placement: 'event_card',
            eid: '123456'
          }
        });

      assert.equal(
        directResponse.statusCode,
        302
      );

      assert.equal(
        directResponse.headers.Location,
        target
      );

      process.env.TM_IMPACT_TRACKING_ENABLED =
        'true';

      const affiliateModule =
        await import(
          `${moduleUrl.href}?mode=affiliate-explicit`
        );

      const affiliateResponse =
        await affiliateModule.handler({
          httpMethod: 'GET',
          queryStringParameters: {
            to: target,
            cc: 'CZ',
            source: 'events_page',
            placement: 'event_card',
            eid: '123456'
          }
        });

      const affiliateUrl =
        new URL(
          affiliateResponse.headers.Location
        );

      assert.equal(
        affiliateUrl.hostname,
        'ticketmaster.evyy.net'
      );

      assert.equal(
        affiliateUrl.searchParams.get('u'),
        target
      );
    } finally {
      if (previous === undefined) {
        delete process.env.TM_IMPACT_TRACKING_ENABLED;
      } else {
        process.env.TM_IMPACT_TRACKING_ENABLED =
          previous;
      }
    }
  }
);
