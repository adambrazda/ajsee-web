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
  'homepage runtime contains canonical price state',
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
  'homepage runtime reads and writes canonical price URL state',
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
  'homepage reset clears canonical price state',
  () => {
    assert.match(
      source,
      /currentFilters\.maxPrice\s*=\s*null/
    );

    assert.match(
      source,
      /currentFilters\.priceCurrency\s*=\s*''/
    );
  }
);

test(
  'homepage fetch signature includes canonical price state',
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
  'homepage render forwards runtime price fields through filter spread',
  () => {
    assert.match(
      source,
      /async function renderEvents[\s\S]*?let api = \{[\s\S]*?\.\.\.filters,/
    );
  }
);
