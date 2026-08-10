import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveEventLocation,
  formatEventVenueLine,
  formatEventCalendarLocation
} from '../src/event-location.js';

test('Ticketmaster prefers display city while preserving actual venue city', () => {
  const event = {
    location: {
      city: 'Praha',
      actualCity: 'Praha 9',
      country: 'CZ'
    },
    venue: {
      name: 'O2 arena',
      city: 'Praha 9'
    }
  };

  assert.deepEqual(
    resolveEventLocation(event),
    {
      venueName: 'O2 arena',
      city: 'Praha',
      actualCity: 'Praha 9',
      country: 'CZ'
    }
  );

  assert.equal(
    formatEventVenueLine(event),
    'O2 arena · Praha'
  );
});

test('SMS Ticket supports venue.name and venue.city', () => {
  const event = {
    venue: {
      name: 'Sono Centrum',
      city: 'Brno'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Sono Centrum · Brno'
  );
});

test('SMS Ticket falls back to place.company and place.city', () => {
  const event = {
    place: {
      company: 'Divadlo ABC',
      city: 'Praha'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Divadlo ABC · Praha'
  );
});

test('legacy venueName is supported', () => {
  const event = {
    venueName: 'Kulturní dům',
    location: {
      city: 'Hodonín',
      country: 'CZ'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Kulturní dům · Hodonín'
  );
});

test('city-only event remains useful', () => {
  const event = {
    location: {
      city: 'Ostrava',
      country: 'CZ'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Ostrava'
  );
});

test('venue-only event remains useful', () => {
  const event = {
    venue: {
      name: 'Royal Albert Hall'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Royal Albert Hall'
  );
});

test('venue and city are not duplicated when identical', () => {
  const event = {
    venue: {
      name: 'Brno'
    },
    location: {
      city: 'Brno'
    }
  };

  assert.equal(
    formatEventVenueLine(event),
    'Brno'
  );
});

test('string location remains supported as a fallback', () => {
  const event = {
    location: 'London'
  };

  assert.deepEqual(
    resolveEventLocation(event),
    {
      venueName: '',
      city: 'London',
      actualCity: 'London',
      country: ''
    }
  );
});
test('Ticketmaster calendar keeps the precise venue city', () => {
  const event = {
    location: {
      city: 'Praha',
      actualCity: 'Praha 9',
      country: 'CZ'
    },
    venue: {
      name: 'O2 arena',
      city: 'Praha 9'
    }
  };

  assert.equal(
    formatEventCalendarLocation(event),
    'O2 arena, Praha 9, CZ'
  );
});

test('SMS Ticket calendar location uses venue and city', () => {
  const event = {
    venue: {
      name: 'Sono Centrum',
      city: 'Brno'
    }
  };

  assert.equal(
    formatEventCalendarLocation(event),
    'Sono Centrum, Brno'
  );
});