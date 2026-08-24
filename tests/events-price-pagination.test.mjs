import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source =
  fs.readFileSync(
    new URL(
      '../src/events-entry.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'events runtime loads FX rates only for an active price filter',
  () => {
    assert.match(
      source,
      /hasActivePriceFilter\(\s*api\s*\)/
    );

    assert.match(
      source,
      /getRatesForPriceFilter\(\s*api\s*\)/
    );
  }
);

test(
  'events runtime filters each raw batch before merging it into the buffer',
  () => {
    assert.match(
      source,
      /const rawNextEvents\s*=/
    );

    assert.match(
      source,
      /filterEventPriceBatch\(\s*rawNextEvents,\s*requestFilters,\s*priceRates \|\| \{\}\s*\)/
    );

    assert.match(
      source,
      /mergeEventsIntoBuffer\(\s*nextEvents\s*\)/
    );
  }
);

test(
  'events pagination derives hasMore from the raw unfiltered batch',
  () => {
    assert.match(
      source,
      /rawNextEvents\.length\s*<\s*EVENTS_API_BATCH_SIZE/
    );

    assert.doesNotMatch(
      source,
      /nextEvents\.length\s*<\s*EVENTS_API_BATCH_SIZE/
    );
  }
);

test(
  'active price filtering may load multiple raw batches to fill the UI page',
  () => {
    assert.match(
      source,
      /EVENTS_PRICE_FILTER_MAX_BATCHES_PER_RENDER\s*=\s*5/
    );

    assert.match(
      source,
      /while\s*\(\s*eventsPager\.buffer\.length\s*<\s*needed[\s\S]*?eventsPager\.hasMore[\s\S]*?batchesLoaded\s*<\s*maxBatches/
    );

    assert.match(
      source,
      /priceFilterActive\s*\?\s*EVENTS_PRICE_FILTER_MAX_BATCHES_PER_RENDER\s*:\s*1/
    );
  }
);

test(
  'FX failure degrades to safe same-currency comparisons',
  () => {
    assert.match(
      source,
      /priceRates\s*=\s*\{\}/
    );

    assert.match(
      source,
      /same-currency comparisons only/
    );
  }
);
