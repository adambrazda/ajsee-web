import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  getSharedEventFiltersMarkup
} from '../src/event-filters.js';

const markup =
  getSharedEventFiltersMarkup();

const source =
  fs.readFileSync(
    new URL(
      '../src/event-filters.js',
      import.meta.url
    ),
    'utf8'
  );

const styles =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/_filters-parity-final.scss',
      import.meta.url
    ),
    'utf8'
  );

test(
  'shared filters expose semantic max starting-price controls',
  () => {
    assert.match(
      markup,
      /id="filter-price-max"/
    );

    assert.match(
      markup,
      /name="max_price"/
    );

    assert.match(
      markup,
      /type="number"/
    );

    assert.match(
      markup,
      /min="0"/
    );

    assert.match(
      markup,
      /aria-describedby="filter-price-help"/
    );

    assert.match(
      markup,
      /id="filter-price-currency"/
    );

    assert.match(
      markup,
      /name="price_currency"/
    );
  }
);

test(
  'shared price UI exposes all supported currencies',
  () => {
    for (
      const currency
      of [
        'CZK',
        'EUR',
        'GBP',
        'USD',
        'PLN',
        'HUF'
      ]
    ) {
      assert.match(
        markup,
        new RegExp(
          `value="${currency}"`
        )
      );
    }
  }
);

test(
  'price controls communicate starting-price semantics',
  () => {
    assert.match(
      markup,
      /Cena od/
    );

    assert.match(
      markup,
      /nejnižší známé ceny/
    );
  }
);

test(
  'price URL state expands detailed filters',
  () => {
    assert.match(
      source,
      /'priceMax'/
    );

    assert.match(
      source,
      /'priceCurrency'/
    );
  }
);

test(
  'desktop layout includes price without creating a second row',
  () => {
    assert.match(
      styles,
      /category city date keyword price actions/
    );
  }
);

test(
  'tablet layout gives price a full row',
  () => {
    assert.match(
      styles,
      /"price price"/
    );
  }
);

test(
  'canonical expanded mobile grid includes price before actions',
  () => {
    assert.match(
      styles,
      /data-ajsee-filter-details-expanded="true"[\s\S]*?grid-template-areas:[\s\S]*?"category date"[\s\S]*?"city city"[\s\S]*?"keyword keyword"[\s\S]*?"price price"[\s\S]*?"actions actions"/
    );
  }
);

test(
  'price divider starts below the shared label',
  () => {
    assert.match(
      styles,
      /\.price-control::after[\s\S]*?top:\s*27px[\s\S]*?right:\s*var\(--price-currency-width\)/
    );

    assert.match(
      styles,
      /#filter-price-currency[\s\S]*?border-left:\s*0/
    );
  }
);


test(
  'price UI keeps amount and currency together',
  () => {
    assert.match(
      styles,
      /\.filter-price[\s\S]*?\.price-control[\s\S]*?grid-template-columns/
    );
  }
);
