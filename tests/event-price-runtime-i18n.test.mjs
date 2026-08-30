import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const targets = [
  [
    'homepage',
    '../src/home-entry.js'
  ],
  [
    'events',
    '../src/events-entry.js'
  ]
];

for (
  const [
    name,
    relativePath
  ]
  of targets
) {
  const source =
    fs.readFileSync(
      new URL(
        relativePath,
        import.meta.url
      ),
      'utf8'
    );

  const start =
    source.indexOf(
      'function updateFilterLocaleTexts() {'
    );

  const end =
    source.indexOf(
      '\nfunction expandFilters()',
      start
    );

  const scope =
    source.slice(
      start,
      end
    );

  test(
    `${name} dynamically localizes price-filter UI`,
    () => {
      assert.match(
        scope,
        /filters\.priceMax/
      );

      assert.match(
        scope,
        /filters\.priceCurrency/
      );

      assert.match(
        scope,
        /filters\.priceMaxPlaceholder/
      );

      assert.match(
        scope,
        /filters\.priceHelp/
      );
    }
  );

  test(
    `${name} updates price accessibility text`,
    () => {
      assert.match(
        scope,
        /priceCurrency\.setAttribute\(\s*'aria-label'/
      );

      assert.match(
        scope,
        /priceCurrency\.setAttribute\(\s*'title'/
      );

      assert.match(
        scope,
        /priceHelp\.textContent/
      );
    }
  );

  test(
    `${name} localizes the empty currency option`,
    () => {
      assert.match(
        scope,
        /option\[value=""\]/
      );

      assert.match(
        scope,
        /emptyOption\.textContent\s*=\s*currencyLabel/
      );
    }
  );

  test(
    `${name} refreshes default currency when price filter is inactive`,
    () => {
      assert.match(
        scope,
        /!hasActivePriceFilter\(\s*currentFilters\s*\)/
      );

      assert.match(
        scope,
        /defaultPriceCurrencyForLocale\(\s*currentLang\s*\)/
      );
    }
  );
}
