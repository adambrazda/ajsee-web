import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL(
  '../netlify/functions/tmOutbound.js',
  import.meta.url
);

const target =
  'https://www.ticketmaster.cz/event/test-event/123456';

const event = {
  httpMethod: 'GET',
  queryStringParameters: {
    to: target,
    cc: 'CZ',
    source: 'events_page',
    placement: 'event_card',
    eid: '123456'
  }
};

test(
  'Ticketmaster outbound defaults to adaptive Impact routing with a direct fallback',
  async () => {
    const previousMode =
      process.env.TM_IMPACT_TRACKING_MODE;

    const previousLegacy =
      process.env.TM_IMPACT_TRACKING_ENABLED;

    try {
      delete process.env.TM_IMPACT_TRACKING_MODE;
      delete process.env.TM_IMPACT_TRACKING_ENABLED;

      const adaptiveModule =
        await import(
          `${moduleUrl.href}?mode=adaptive-default`
        );

      const response =
        await adaptiveModule.handler(event);

      assert.equal(
        response.statusCode,
        200
      );

      assert.match(
        response.headers['Content-Type'],
        /text\/html/
      );

      assert.match(
        response.body,
        /ticketmaster\.evyy\.net/
      );

      assert.match(
        response.body,
        /www\.ojrq\.net/
      );

      assert.match(
        response.body,
        /ajsee\.tmImpactReachability\.v1/
      );

      assert.match(
        response.body,
        /window\.location\.replace/
      );

      assert.match(
        response.body,
        /2038768\/23901/
      );

      assert.match(
        response.body,
        /www\.ticketmaster\.cz/
      );
    } finally {
      if (previousMode === undefined) {
        delete process.env.TM_IMPACT_TRACKING_MODE;
      } else {
        process.env.TM_IMPACT_TRACKING_MODE =
          previousMode;
      }

      if (previousLegacy === undefined) {
        delete process.env.TM_IMPACT_TRACKING_ENABLED;
      } else {
        process.env.TM_IMPACT_TRACKING_ENABLED =
          previousLegacy;
      }
    }
  }
);

test(
  'Ticketmaster outbound can be forced direct or affiliate for emergency operations',
  async () => {
    const previousMode =
      process.env.TM_IMPACT_TRACKING_MODE;

    try {
      process.env.TM_IMPACT_TRACKING_MODE =
        'direct';

      const directModule =
        await import(
          `${moduleUrl.href}?mode=direct-explicit`
        );

      const directResponse =
        await directModule.handler(event);

      assert.equal(
        directResponse.statusCode,
        302
      );

      assert.equal(
        directResponse.headers.Location,
        target
      );

      process.env.TM_IMPACT_TRACKING_MODE =
        'affiliate';

      const affiliateModule =
        await import(
          `${moduleUrl.href}?mode=affiliate-explicit`
        );

      const affiliateResponse =
        await affiliateModule.handler(event);

      const affiliateUrl =
        new URL(
          affiliateResponse.headers.Location
        );

      assert.equal(
        affiliateResponse.statusCode,
        302
      );

      assert.equal(
        affiliateUrl.hostname,
        'ticketmaster.evyy.net'
      );

      assert.equal(
        affiliateUrl.searchParams.get('u'),
        target
      );

      assert.equal(
        affiliateUrl.searchParams.get('subId1'),
        'events_page'
      );

      assert.equal(
        affiliateUrl.searchParams.get('subId2'),
        'event_card'
      );

      assert.equal(
        affiliateUrl.searchParams.get('subId3'),
        '123456'
      );
    } finally {
      if (previousMode === undefined) {
        delete process.env.TM_IMPACT_TRACKING_MODE;
      } else {
        process.env.TM_IMPACT_TRACKING_MODE =
          previousMode;
      }
    }
  }
);
