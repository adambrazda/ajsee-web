import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source =
  fs.readFileSync(
    new URL(
      '../src/home-entry.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'homepage keeps its existing single-request path without a price filter',
  () => {
    assert.match(
      source,
      /if\s*\(\s*!hasActivePriceFilter\(\s*api\s*\)\s*\)[\s\S]*?getAllHomeEvents\(\{[\s\S]*?filters:\s*api/
    );
  }
);

test(
  'homepage loads FX rates only for an active price filter',
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
  'homepage filters raw batches before collecting preview events',
  () => {
    assert.match(
      source,
      /filterEventPriceBatch\(\s*rawEvents,\s*requestFilters,\s*priceRates \|\| \{\}\s*\)/
    );
  }
);

test(
  'homepage price search targets six cards with bounded batch loading',
  () => {
    assert.match(
      source,
      /HOME_PRICE_FILTER_TARGET_COUNT\s*=\s*6/
    );

    assert.match(
      source,
      /HOME_PRICE_FILTER_API_BATCH_SIZE\s*=\s*50/
    );

    assert.match(
      source,
      /HOME_PRICE_FILTER_MAX_BATCHES\s*=\s*3/
    );
  }
);

test(
  'homepage stops based on the raw aggregation batch rather than affordable count',
  () => {
    assert.match(
      source,
      /rawEvents\.length\s*<\s*HOME_PRICE_FILTER_API_BATCH_SIZE/
    );

    assert.doesNotMatch(
      source,
      /acceptedEvents\.length\s*<\s*HOME_PRICE_FILTER_API_BATCH_SIZE/
    );
  }
);

test(
  'homepage deduplicates price-filtered results across batches',
  () => {
    assert.match(
      source,
      /const seen\s*=\s*new Set\(\)/
    );

    assert.match(
      source,
      /seen\.has\(\s*key\s*\)/
    );

    assert.match(
      source,
      /seen\.add\(\s*key\s*\)/
    );
  }
);

test(
  'homepage render uses the price-aware fetch path',
  () => {
    assert.match(
      source,
      /const events\s*=\s*await fetchHomeEventsForRender\(\s*locale,\s*api\s*\)/
    );
  }
);

test(
  'homepage FX failure degrades to same-currency comparisons',
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
