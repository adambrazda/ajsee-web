import test from 'node:test';
import assert from 'node:assert/strict';
import { sortEventsByTime } from '../src/event-time-sort.js';
import { calendarDay } from '../src/event-calendar.js';

test('date ordering retains ties and undated events in both directions', () => {
  const events = [
    { id: 'missing', date: '' }, { id: 'late', date: '2026-11-09T20:00:00+01:00' },
    { id: 'first', date: '2026-11-08T18:00:00Z' }, { id: 'tie', date: '2026-11-08T19:00:00+01:00' },
    { id: 'invalid', date: 'invalid' },
  ];
  for (const latest of [false, true]) {
    let calls = 0;
    const actual = sortEventsByTime([...events], event => { calls++; return Date.parse(event.date); }, latest);
    assert.deepEqual(actual.map(e => e.id), latest
      ? ['late', 'first', 'tie', 'missing', 'invalid']
      : ['first', 'tie', 'late', 'missing', 'invalid']);
    assert.equal(calls, events.length, 'date resolution is linear, independent of comparisons');
  }
  events[1].date = '2026-11-01';
  assert.equal(sortEventsByTime([...events], event => Date.parse(event.date))[0].id, 'late');
});

test('shared clock conversion is reused per venue zone and invalidated after Date mutation', () => {
  const clock = new Date('2026-11-08T23:59:59.999Z');
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  let calls = 0;
  Intl.DateTimeFormat.prototype.formatToParts = function(...args) { calls++; return original.apply(this, args); };
  try {
    for (let i = 0; i < 5000; i++) assert.equal(calendarDay(clock, 'UTC'), '2026-11-08');
    assert.equal(calls, 1);
    assert.equal(calendarDay(clock, 'Europe/Prague'), '2026-11-09');
    assert.equal(calls, 2);
    clock.setTime(clock.getTime() + 1);
    assert.equal(calendarDay(clock, 'UTC'), '2026-11-09');
    assert.equal(calls, 3);
    clock.setTime(NaN);
    assert.equal(calendarDay(clock, 'UTC'), '');
  } finally { Intl.DateTimeFormat.prototype.formatToParts = original; }
});
