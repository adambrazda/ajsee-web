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
  'events runtime imports shared price form helpers',
  () => {
    assert.match(
      source,
      /defaultPriceCurrencyForLocale/
    );

    assert.match(
      source,
      /normalizePriceFilterState/
    );
  }
);

test(
  'events runtime reads shared price controls',
  () => {
    assert.match(
      source,
      /qs\('#filter-price-max'\)/
    );

    assert.match(
      source,
      /qs\('#filter-price-currency'\)/
    );
  }
);

test(
  'events runtime restores canonical price state into the form',
  () => {
    assert.match(
      source,
      /priceMax\.value\s*=/
    );

    assert.match(
      source,
      /currentFilters\.maxPrice/
    );

    assert.match(
      source,
      /priceCurrency\.value\s*=/
    );

    assert.match(
      source,
      /currentFilters\.priceCurrency\s*\|\|\s*defaultPriceCurrencyForLocale/
    );
  }
);

test(
  'events runtime canonicalizes price form values into state',
  () => {
    assert.match(
      source,
      /normalizePriceFilterState\(\{[\s\S]*?maxPrice:[\s\S]*?rawPriceMax[\s\S]*?priceCurrency:/
    );

    assert.match(
      source,
      /currentFilters\.maxPrice\s*=\s*normalizedPrice\.maxPrice/
    );

    assert.match(
      source,
      /currentFilters\.priceCurrency\s*=\s*normalizedPrice\.priceCurrency/
    );
  }
);

test(
  'events runtime uses locale currency when no explicit currency is selected',
  () => {
    assert.match(
      source,
      /priceCurrency\?\.value\s*\|\|[\s\S]*?defaultPriceCurrencyForLocale\(\s*currentLang\s*\)/
    );
  }
);

test(
  'events runtime exposes invalid price input state accessibly',
  () => {
    assert.match(
      source,
      /priceMax\.setAttribute\(\s*'aria-invalid'/
    );

    assert.match(
      source,
      /normalizedPrice\.maxPrice\s*===\s*null/
    );
  }
);
