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
  'homepage runtime imports shared price form helpers',
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
  'homepage runtime reads shared price controls',
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
  'homepage restores canonical price state into the form',
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
      /currentFilters\.priceCurrency\s*\|\|[\s\S]*?defaultPriceCurrencyForLocale/
    );
  }
);

test(
  'homepage canonicalizes price form values into runtime state',
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
  'homepage uses locale currency when no explicit currency is selected',
  () => {
    assert.match(
      source,
      /priceCurrency\?\.value\s*\|\|[\s\S]*?defaultPriceCurrencyForLocale\(\s*currentLang\s*\)/
    );
  }
);

test(
  'homepage exposes invalid price input state accessibly',
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

test(
  'homepage active-filter badge counts a valid price filter',
  () => {
    assert.match(
      source,
      /hasActivePriceFilter\(\s*filters\s*\)[\s\S]*?count\+\+/
    );
  }
);

test(
  'homepage CTA to events preserves canonical price URL parameters',
  () => {
    assert.match(
      source,
      /syncPriceFilterSearchParams\(\s*params,\s*filters\s*\)/
    );
  }
);
