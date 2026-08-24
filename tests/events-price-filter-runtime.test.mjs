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
  'events runtime contains canonical price state',
  () => {
    assert.match(
      source,
      /maxPrice:\s*null/
    );

    assert.match(
      source,
      /priceCurrency:\s*''/
    );
  }
);

test(
  'events runtime reads and writes canonical price URL state',
  () => {
    assert.match(
      source,
      /readPriceFilterFromSearchParams/
    );

    assert.match(
      source,
      /syncPriceFilterSearchParams/
    );

    assert.match(
      source,
      /currentFilters\.maxPrice\s*=\s*priceFilter\.maxPrice/
    );

    assert.match(
      source,
      /currentFilters\.priceCurrency\s*=\s*priceFilter\.priceCurrency/
    );
  }
);

test(
  'events runtime clears price individually and with reset all',
  () => {
    assert.match(
      source,
      /case 'price':[\s\S]*?currentFilters\.maxPrice\s*=\s*null[\s\S]*?currentFilters\.priceCurrency\s*=\s*''/
    );

    const matches =
      source.match(
        /currentFilters\.maxPrice\s*=\s*null/g
      ) || [];

    assert.ok(
      matches.length >= 2
    );
  }
);

test(
  'events pager signature includes canonical price state',
  () => {
    assert.match(
      source,
      /maxPrice:\s*api\.maxPrice\s*\?\?\s*null/
    );

    assert.match(
      source,
      /priceCurrency:\s*api\.priceCurrency\s*\|\|\s*''/
    );
  }
);

test(
  'buildApiFilters continues to forward runtime price fields through spread',
  () => {
    assert.match(
      source,
      /function buildApiFilters\(filters\)[\s\S]*?const api = \{[\s\S]*?\.\.\.filters,/
    );
  }
);
