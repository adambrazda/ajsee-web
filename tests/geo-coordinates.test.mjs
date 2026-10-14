import test from 'node:test';
import assert from 'node:assert/strict';
import { validCoordinates, distanceKm, eventCoordinates } from '../shared/geo/coordinates.js';
import { hasGeoCoordinates, readGeoPlaceFromSearchParams } from '../src/event-place-runtime.js';

test('coordinates reject missing, nonnumeric and out-of-range values without converting them to zero', () => {
  for (const invalid of [null, undefined, '', ' ', false, true, [], {}, NaN, Infinity, 91, -91]) {
    assert.equal(validCoordinates(invalid, 14), false, String(invalid));
    assert.equal(hasGeoCoordinates({ nearMeLat: invalid, nearMeLon: 14 }), false);
    assert.equal(distanceKm(50, 14, invalid, 14), Infinity);
  }
  assert.equal(validCoordinates(50, 181), false);
  assert.equal(validCoordinates('50.08', '14.43'), true);
  assert.equal(validCoordinates(0, 0), true);
  assert.equal(eventCoordinates({ location: { lat: null, lon: null } }), null);
  assert.equal(eventCoordinates({ location: { lat: 50 }, venue: { location: { lon: 14 } } }), null);
  assert.deepEqual(eventCoordinates({ location: { lat: 91, lon: 14 }, venue: { location: { lat: 50, lon: 14 } } }), { lat: 50, lon: 14 });
});

test('distance has finite antipodes and a reproducible radius boundary', () => {
  assert.equal(distanceKm(50, 14, 50, 14), 0);
  const oneKm = 1 / 6371 * 180 / Math.PI;
  assert.ok(Math.abs(distanceKm(0, 0, oneKm, 0) - 1) < 1e-9);
  assert.ok(Number.isFinite(distanceKm(90, 180, -90, 0)));
});

test('invalid coordinate ranges cannot return through a saved geographic URL', () => {
  for (const type of ['nearMe', 'cityRadius']) {
    const params = new URLSearchParams({ placeType: type, city: 'Praha', lat: '91', lon: '14', radius: '30', nearMe: '1' });
    assert.equal(readGeoPlaceFromSearchParams(params), null);
    params.set('lat', '50'); params.set('lon', '181');
    assert.equal(readGeoPlaceFromSearchParams(params), null);
  }
});
