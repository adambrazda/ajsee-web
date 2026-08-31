import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exactCrossProviderOccurrenceKey,
  mergeExactCrossProviderOccurrences
} from '../src/event-cross-provider-merge.js';


function event({
  id,
  provider,
  title =
    'Filmové melodie s Melody Quartettem',
  datetime =
    '2099-09-15T19:00:00',
  city =
    'Praha',
  venue =
    'Jeruzalémská synagoga',
  url,
  priceFrom =
    '799 Kč',
  currency =
    'CZK',
  ticketOptions
}) {
  return {
    id,

    partner:
      provider,

    source:
      provider,

    sourceName:
      provider ===
      'smsticket'
        ? 'SMS Ticket'
        : 'ColosseumTicket',

    title: {
      cs:
        title
    },

    datetime,

    location: {
      city,
      country:
        'CZ'
    },

    venue: {
      name:
        venue,
      city,
      country:
        'CZ'
    },

    url,

    tickets:
      url,

    priceFrom,

    currency,

    ...(ticketOptions
      ? {
          ticketOptions
        }
      : {})
  };
}


test(
  'exact normalized title datetime and city create the same key',
  () => {
    const sms =
      event({
        id:
          'smsticket-1',

        provider:
          'smsticket',

        url:
          'https://www.smsticket.cz/test'
      });

    const col =
      event({
        id:
          'colosseumticket-1',

        provider:
          'colosseumticket',

        title:
          'Filmové melodie s Melody Quartettem',

        venue:
          'Jeruzalémská (Jubilejní) synagoga',

        url:
          'https://colosseumticket.cz/test'
      });

    assert.equal(
      exactCrossProviderOccurrenceKey(
        sms
      ),
      exactCrossProviderOccurrenceKey(
        col
      )
    );
  }
);


test(
  'merges one exact SMS and Colosseum occurrence into SMS primary with two ticket options',
  () => {
    const sms =
      event({
        id:
          'smsticket-69190',

        provider:
          'smsticket',

        url:
          'https://www.smsticket.cz/vstupenky/69190-test'
      });

    const col =
      event({
        id:
          'colosseumticket-test',

        provider:
          'colosseumticket',

        venue:
          'Jeruzalémská (Jubilejní) synagoga',

        url:
          'https://colosseumticket.cz/cs/akce/test'
      });

    const result =
      mergeExactCrossProviderOccurrences([
        sms,
        col
      ]);

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].id,
      'smsticket-69190'
    );

    assert.equal(
      result[0].partner,
      'smsticket'
    );

    assert.deepEqual(
      result[0].ticketOptions,
      [
        {
          url:
            'https://www.smsticket.cz/vstupenky/69190-test',

          priceFrom:
            '799 Kč',

          currency:
            'CZK',

          provider:
            'smsticket'
        },

        {
          url:
            'https://colosseumticket.cz/cs/akce/test',

          priceFrom:
            '799 Kč',

          currency:
            'CZK',

          provider:
            'colosseumticket'
        }
      ]
    );
  }
);


test(
  'preserves existing SMS Ticket options when Colosseum is added',
  () => {
    const sms =
      event({
        id:
          'smsticket-primary',

        provider:
          'smsticket',

        url:
          'https://www.smsticket.cz/primary',

        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/primary',

            priceFrom:
              '799 Kč',

            currency:
              'CZK',

            provider:
              'smsticket'
          },

          {
            url:
              'https://www.smsticket.cz/alternative',

            priceFrom:
              '32 EUR',

            currency:
              'EUR',

            provider:
              'smsticket'
          }
        ]
      });

    const col =
      event({
        id:
          'colosseumticket-secondary',

        provider:
          'colosseumticket',

        url:
          'https://colosseumticket.cz/secondary'
      });

    const result =
      mergeExactCrossProviderOccurrences([
        sms,
        col
      ]);

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].ticketOptions.length,
      3
    );

    assert.deepEqual(
      result[0]
        .ticketOptions
        .map(
          (option) =>
            option.provider
        ),
      [
        'smsticket',
        'smsticket',
        'colosseumticket'
      ]
    );
  }
);


test(
  'does not merge different titles',
  () => {
    const sms =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const col =
      event({
        id:
          'col-b',

        provider:
          'colosseumticket',

        title:
          'Jiná akce',

        url:
          'https://col/b'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        sms,
        col
      ]).length,
      2
    );
  }
);


test(
  'does not merge different times',
  () => {
    const sms =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const col =
      event({
        id:
          'col-b',

        provider:
          'colosseumticket',

        datetime:
          '2099-09-15T19:30:00',

        url:
          'https://col/b'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        sms,
        col
      ]).length,
      2
    );
  }
);


test(
  'does not merge different cities',
  () => {
    const sms =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const col =
      event({
        id:
          'col-b',

        provider:
          'colosseumticket',

        city:
          'Brno',

        url:
          'https://col/b'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        sms,
        col
      ]).length,
      2
    );
  }
);


test(
  'does not merge same-provider duplicates',
  () => {
    const first =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const second =
      event({
        id:
          'sms-b',

        provider:
          'smsticket',

        url:
          'https://sms/b'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        first,
        second
      ]).length,
      2
    );
  }
);


test(
  'ambiguous many-to-one groups fail closed',
  () => {
    const sms =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const colA =
      event({
        id:
          'col-a',

        provider:
          'colosseumticket',

        url:
          'https://col/a'
      });

    const colB =
      event({
        id:
          'col-b',

        provider:
          'colosseumticket',

        url:
          'https://col/b'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        sms,
        colA,
        colB
      ]).length,
      3
    );
  }
);


test(
  'Ticketmaster never participates in the SMS Colosseum merge',
  () => {
    const sms =
      event({
        id:
          'sms-a',

        provider:
          'smsticket',

        url:
          'https://sms/a'
      });

    const ticketmaster =
      event({
        id:
          'tm-a',

        provider:
          'ticketmaster',

        url:
          'https://ticketmaster.example/a'
      });

    assert.equal(
      mergeExactCrossProviderOccurrences([
        sms,
        ticketmaster
      ]).length,
      2
    );
  }
);
