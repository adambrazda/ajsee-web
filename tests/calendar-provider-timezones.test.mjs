import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real provider aggregation, prices and cursors retain the same days in five visitor timezones', () => {
  let baseline;
  for (const TZ of ['UTC', 'Europe/Prague', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati']) {
    const result = JSON.parse(execFileSync(process.execPath,
      [fileURLToPath(new URL('./fixtures/calendar-provider-search.mjs', import.meta.url))],
      { env: { ...process.env, TZ }, timeout: 15000, encoding: 'utf8' }).trim());
    if (baseline) assert.deepEqual(result, baseline, TZ);
    else baseline = result;
  }
});
