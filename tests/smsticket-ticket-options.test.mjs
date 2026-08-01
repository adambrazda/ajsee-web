import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  mergeExactSmsticketOccurrences,
} from '../src/adapters/smsticket.js';

function occurrence(overrides = {}) {
  return {
    id: 'smsticket-1',
    sourceId: '1',
    partner: 'smsticket',
    source: 'smsticket',
    title: {
      cs: 'Testovaci akce',
      en: 'Test event',
    },
    datetime: '2026-10-20T08:30:00',
    date: '2026-10-20',
    bookingEndsAt: '2026-10-20T07:30:00',
    priceFrom: '500 CZK',
    tickets:
      'https://www.smsticket.cz/vstupenky/1-test',
    url:
      'https://www.smsticket.cz/vstupenky/1-test',
    location: {
      city: 'Praha',
      country: 'CZ',
      lat: 50.1084247,
      lon: 14.4869633,
    },
    place: {
      id: '8463',
      company: 'UNYP ARENA',
      city: 'Praha',
      street: 'Kovanecka 2405/27',
    },
    venue: {
      name: 'UNYP ARENA',
      city: 'Praha',
      address: {
        street: 'Kovanecka 2405/27',
      },
    },
    ...overrides,
  };
}

test(
  'merges the IDO currency variants and prefers CZK',
  () => {
    const eur = occurrence({
      id: 'smsticket-71242',
      sourceId: '71242',
      priceFrom: '25 EUR',
      tickets:
        'https://www.smsticket.cz/vstupenky/71242-ido',
      url:
        'https://www.smsticket.cz/vstupenky/71242-ido',
    });

    const czk = occurrence({
      id: 'smsticket-71109',
      sourceId: '71109',
      priceFrom: '750 CZK',
      tickets:
        'https://www.smsticket.cz/vstupenky/71109-ido',
      url:
        'https://www.smsticket.cz/vstupenky/71109-ido',
    });

    const result =
      mergeExactSmsticketOccurrences([
        eur,
        czk,
      ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'smsticket-71109');

    assert.deepEqual(
      result[0].ticketOptions,
      [
        {
          url:
            'https://www.smsticket.cz/vstupenky/71109-ido',
          priceFrom: '750 CZK',
          currency: 'CZK',
          provider: 'smsticket',
        },
        {
          url:
            'https://www.smsticket.cz/vstupenky/71242-ido',
          priceFrom: '25 EUR',
          currency: 'EUR',
          provider: 'smsticket',
        },
      ]
    );
  }
);

test(
  'prefers the same-currency event with later booking end',
  () => {
    const earlier = occurrence({
      id: 'smsticket-69262',
      sourceId: '69262',
      title: {
        cs:
          'Karel Kahovec + Beatles Revival + Michal Sindelar',
      },
      datetime: '2026-11-07T20:00:00',
      bookingEndsAt: '2026-11-07T18:00:00',
      priceFrom: '390 CZK',
      tickets:
        'https://www.smsticket.cz/vstupenky/69262-karel',
      url:
        'https://www.smsticket.cz/vstupenky/69262-karel',
      place: {
        id: '4179',
        company: 'Kulturni dum Dvorana',
        city: 'Loket',
        street: 'Radnicni 312',
      },
      venue: {
        name: 'Kulturni dum Dvorana',
        city: 'Loket',
        address: {
          street: 'Radnicni 312',
        },
      },
      location: {
        city: 'Loket',
        country: 'CZ',
      },
    });

    const later = occurrence({
      ...earlier,
      id: 'smsticket-69323',
      sourceId: '69323',
      bookingEndsAt: '2026-11-07T19:00:00',
      tickets:
        'https://www.smsticket.cz/vstupenky/69323-karel',
      url:
        'https://www.smsticket.cz/vstupenky/69323-karel',
    });

    const result =
      mergeExactSmsticketOccurrences([
        earlier,
        later,
      ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'smsticket-69323');
    assert.equal(result[0].ticketOptions.length, 2);
  }
);

test(
  'does not merge the same title and time in different cities',
  () => {
    const prague = occurrence();

    const brno = occurrence({
      id: 'smsticket-2',
      sourceId: '2',
      tickets:
        'https://www.smsticket.cz/vstupenky/2-test',
      url:
        'https://www.smsticket.cz/vstupenky/2-test',
      location: {
        city: 'Brno',
        country: 'CZ',
      },
      place: {
        id: '9999',
        company: 'Sono Centrum',
        city: 'Brno',
        street: 'Veveri 113',
      },
      venue: {
        name: 'Sono Centrum',
        city: 'Brno',
        address: {
          street: 'Veveri 113',
        },
      },
    });

    const result =
      mergeExactSmsticketOccurrences([
        prague,
        brno,
      ]);

    assert.equal(result.length, 2);
  }
);

test(
  'does not merge different times at the same venue',
  () => {
    const afternoon = occurrence({
      datetime: '2026-10-20T14:00:00',
    });

    const evening = occurrence({
      id: 'smsticket-2',
      sourceId: '2',
      datetime: '2026-10-20T17:00:00',
      tickets:
        'https://www.smsticket.cz/vstupenky/2-test',
      url:
        'https://www.smsticket.cz/vstupenky/2-test',
    });

    const result =
      mergeExactSmsticketOccurrences([
        afternoon,
        evening,
      ]);

    assert.equal(result.length, 2);
  }
);

test(
  'keeps a normal single event unchanged',
  () => {
    const event = occurrence();

    const result =
      mergeExactSmsticketOccurrences([event]);

    assert.equal(result.length, 1);
    assert.equal(result[0], event);

    assert.equal(
      Object.hasOwn(result[0], 'ticketOptions'),
      false
    );
  }
);

test(
  'does not duplicate the same ticket URL',
  () => {
    const first = occurrence();

    const second = occurrence({
      id: 'smsticket-2',
      sourceId: '2',
    });

    const result =
      mergeExactSmsticketOccurrences([
        first,
        second,
      ]);

    assert.equal(result.length, 1);

    assert.equal(
      Object.hasOwn(result[0], 'ticketOptions'),
      false
    );
  }
);

test(
  'event modal contains the multiple-ticket UI path',
  () => {
    const modalSource = fs.readFileSync(
      new URL(
        '../src/event-modal.js',
        import.meta.url
      ),
      'utf8'
    );

    assert.match(
      modalSource,
      /normalizeModalTicketOptions/
    );

    assert.match(
      modalSource,
      /modalTicketOptions/
    );

    assert.match(
      modalSource,
      /renderModalTicketOptions/
    );
  }
);

test(
  'tracks single and multiple modal ticket clicks',
  () => {
    const modalSource = fs.readFileSync(
      new URL(
        '../src/event-modal.js',
        import.meta.url
      ),
      'utf8'
    );

    assert.match(
      modalSource,
      /trackModalPartnerClickFromLink/
    );

    assert.match(
      modalSource,
      /bindModalPartnerClickTracking/
    );

    assert.match(
      modalSource,
      /const placement\s*=/
    );

    assert.match(
      modalSource,
      /\r?\n\s*placement,\r?\n/
    );

    assert.match(
      modalSource,
      /ticket_currency/
    );

    assert.match(
      modalSource,
      /ticket_option_index/
    );

    assert.match(
      modalSource,
      /\\u00b7/
    );

    assert.doesNotMatch(
      modalSource,
      /numberedBase \+ ' \? ' \+ price/
    );
  }
);
