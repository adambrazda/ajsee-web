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

function redirectResponse(
  location,
  setCookies = []
) {
  return {
    status: 302,
    headers: {
      get(name) {
        const key =
          String(name || '').toLowerCase();

        if (key === 'location') {
          return location;
        }

        if (
          key === 'set-cookie' &&
          setCookies.length
        ) {
          return setCookies.join(', ');
        }

        return null;
      },

      getSetCookie() {
        return setCookies;
      }
    }
  };
}

test(
  'Ticketmaster CZ resolves the Impact sync chain on Netlify and sends the browser directly to an attributed Ticketmaster URL',
  async () => {
    const previousMode =
      process.env.TM_IMPACT_TRACKING_MODE;

    const previousLegacy =
      process.env.TM_IMPACT_TRACKING_ENABLED;

    const previousFetch =
      globalThis.fetch;

    const calls = [];

    try {
      delete process.env.TM_IMPACT_TRACKING_MODE;
      delete process.env.TM_IMPACT_TRACKING_ENABLED;

      globalThis.fetch =
        async (rawUrl) => {
          const url =
            new URL(String(rawUrl));

          calls.push(url.toString());

          if (
            url.hostname ===
              'ticketmaster.evyy.net' &&
            !url.searchParams.has('level')
          ) {
            const returnUrl =
              new URL(url.toString());

            returnUrl.searchParams.set(
              'level',
              '1'
            );

            const syncUrl =
              new URL(
                'https://www.ojrq.net/p/'
              );

            syncUrl.searchParams.set(
              'return',
              returnUrl.toString()
            );

            syncUrl.searchParams.set(
              'cid',
              '23901'
            );

            syncUrl.searchParams.set(
              'tpsync',
              'yes'
            );

            syncUrl.searchParams.set(
              'auth',
              'test-auth'
            );

            return redirectResponse(
              syncUrl.toString(),
              ['impact_session=abc; Path=/; Secure']
            );
          }

          if (
            url.hostname ===
            'www.ojrq.net'
          ) {
            return redirectResponse(
              url.searchParams.get('return'),
              ['sync_session=xyz; Path=/; Secure']
            );
          }

          if (
            url.hostname ===
              'ticketmaster.evyy.net' &&
            url.searchParams.get('level') ===
              '1'
          ) {
            const finalUrl =
              new URL(target);

            finalUrl.searchParams.set(
              'clickId',
              'test-click'
            );

            finalUrl.searchParams.set(
              'utm_campaign',
              '7218577'
            );

            finalUrl.searchParams.set(
              'utm_medium',
              'affiliate'
            );

            finalUrl.searchParams.set(
              'utm_source',
              '7218577-AJSEE LTD'
            );

            finalUrl.searchParams.set(
              'camefrom',
              'CFC_BUYAT_7218577'
            );

            finalUrl.searchParams.set(
              'ircid',
              '23901'
            );

            finalUrl.searchParams.set(
              'irgwc',
              '1'
            );

            finalUrl.searchParams.set(
              'afsrc',
              '1'
            );

            return redirectResponse(
              finalUrl.toString()
            );
          }

          throw new Error(
            `Unexpected fetch URL: ${url}`
          );
        };

      const serverModule =
        await import(
          `${moduleUrl.href}?mode=server-current-asset`
        );

      const response =
        await serverModule.handler({
          ...event,
          headers: {
            'user-agent':
              'AJSEE Test Browser',
            'accept-language':
              'cs-CZ,cs;q=0.9'
          }
        });

      assert.equal(
        response.statusCode,
        302
      );

      const finalUrl =
        new URL(
          response.headers.Location
        );

      assert.equal(
        finalUrl.hostname,
        'www.ticketmaster.cz'
      );

      assert.equal(
        finalUrl.searchParams.get('clickId'),
        'test-click'
      );

      assert.equal(
        finalUrl.searchParams.get('irgwc'),
        '1'
      );

      assert.equal(
        finalUrl.searchParams.get('utm_campaign'),
        '7218577'
      );

      assert.equal(
        finalUrl.searchParams.get('ircid'),
        '23901'
      );

      assert.equal(
        calls.length,
        3
      );

      assert.match(
        calls[0],
        /ticketmaster\.evyy\.net\/c\/7218577\/1958979\/23901/
      );

      assert.match(
        calls[1],
        /www\.ojrq\.net/
      );

      assert.match(
        calls[2],
        /ticketmaster\.evyy\.net/
      );

      assert.doesNotMatch(
        response.headers.Location,
        /evyy\.net|ojrq\.net/
      );
    } finally {
      globalThis.fetch =
        previousFetch;

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
  'server-side Impact resolution failure retains the safe browser fallback',
  async () => {
    const previousMode =
      process.env.TM_IMPACT_TRACKING_MODE;

    const previousLegacy =
      process.env.TM_IMPACT_TRACKING_ENABLED;

    const previousFetch =
      globalThis.fetch;

    try {
      delete process.env.TM_IMPACT_TRACKING_MODE;
      delete process.env.TM_IMPACT_TRACKING_ENABLED;

      globalThis.fetch =
        async () => {
          throw new Error(
            'simulated upstream failure'
          );
        };

      const serverModule =
        await import(
          `${moduleUrl.href}?mode=server-fallback`
        );

      const response =
        await serverModule.handler(event);

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
        /7218577\/1958979\/23901/
      );

      assert.match(
        response.body,
        /www\.ticketmaster\.cz/
      );
    } finally {
      globalThis.fetch =
        previousFetch;

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
        affiliateUrl.pathname,
        '/c/7218577/1958979/23901'
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
