import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  matchesKeywordPrefix
} from '../src/search/keyword-match.js';

test(
  'keyword eros matches Eros Ramazzotti',
  () => {
    assert.equal(
      matchesKeywordPrefix(
        'EROS RAMAZZOTTI - UNA STORIA IMPORTANTE',
        'eros'
      ),
      true
    );
  }
);

test(
  'keyword eros does not match Aerosmith',
  () => {
    assert.equal(
      matchesKeywordPrefix(
        'Queen Metallica Nirvana Aerosmith Guns N Roses',
        'eros'
      ),
      false
    );
  }
);

test(
  'keyword supports artist-name prefix search',
  () => {
    assert.equal(
      matchesKeywordPrefix(
        'Eros Ramazzotti',
        'ramazz'
      ),
      true
    );
  }
);

test(
  'multi-token keyword matches corresponding prefixes',
  () => {
    assert.equal(
      matchesKeywordPrefix(
        'EROS RAMAZZOTTI - UNA STORIA IMPORTANTE',
        'eros ramazz'
      ),
      true
    );
  }
);

const ticketmasterSource =
  readFileSync(
    new URL(
      '../src/adapters/ticketmaster.js',
      import.meta.url
    ),
    'utf8'
  ).replace(/\r\n/g, '\n');

function getAncillaryMatcher() {
  const start =
    ticketmasterSource.indexOf(
      'function isTicketmasterAncillaryEvent(ev = {}) {'
    );

  const end =
    ticketmasterSource.indexOf(
      '\nfunction filterRawEventsByStrictCityCountry',
      start
    );

  assert.notEqual(
    start,
    -1,
    'Ticketmaster ancillary matcher must exist'
  );

  assert.notEqual(
    end,
    -1,
    'Ticketmaster ancillary matcher boundary must exist'
  );

  const helperSource =
    ticketmasterSource.slice(
      start,
      end
    );

  return new Function(
    `${helperSource}
     return isTicketmasterAncillaryEvent;`
  )();
}

test(
  'normal Ticketmaster concert remains discoverable',
  () => {
    const isAncillary =
      getAncillaryMatcher();

    assert.equal(
      isAncillary({
        name:
          'EROS RAMAZZOTTI - UNA STORIA IMPORTANTE',
        _embedded: {
          attractions: [
            {
              name: 'Eros Ramazzotti'
            }
          ]
        }
      }),
      false
    );
  }
);

test(
  'Ticketmaster Fast Track product is ancillary',
  () => {
    const isAncillary =
      getAncillaryMatcher();

    assert.equal(
      isAncillary({
        name:
          'EROS RAMAZZOTTI - UNA STORIA IMPORTANTE | Fast Track',
        _embedded: {
          attractions: [
            {
              name: 'Fast Track - O2 arena'
            },
            {
              name: 'Eros Ramazzotti'
            }
          ]
        }
      }),
      true
    );
  }
);

test(
  'Fast Track wording alone is not enough to hide an event',
  () => {
    const isAncillary =
      getAncillaryMatcher();

    assert.equal(
      isAncillary({
        name:
          'Fast Track Festival',
        _embedded: {
          attractions: [
            {
              name: 'Some Artist'
            }
          ]
        }
      }),
      false
    );
  }
);

test(
  'Ticketmaster collection removes ancillary products before mapping',
  () => {
    assert.match(
      ticketmasterSource,
      /const discoverableRawList = strictRawList\.filter\([\s\S]*?!isTicketmasterAncillaryEvent\(event\)[\s\S]*?collectedRaw\.push\(\.\.\.discoverableRawList\)/
    );
  }
);

const smsSource =
  readFileSync(
    new URL(
      '../src/adapters/smsticket.js',
      import.meta.url
    ),
    'utf8'
  );

const eventsApiSource =
  readFileSync(
    new URL(
      '../src/api/eventsApi.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'SMS Ticket uses the shared keyword matcher',
  () => {
    assert.match(
      smsSource,
      /matchesKeywordPrefix\(haystack, query\)/
    );
  }
);

test(
  'events API uses the shared keyword matcher for final filtering',
  () => {
    assert.match(
      eventsApiSource,
      /matchesKeywordPrefix\(eventSearchText\(ev, loc\), q\)/
    );
  }
);
