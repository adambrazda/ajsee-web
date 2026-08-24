import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const filters =
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
  'price filter exposes accessible visible validation markup',
  () => {
    assert.match(
      filters,
      /aria-describedby="filter-price-help"/
    );

    assert.match(
      filters,
      /aria-errormessage="filter-price-error"/
    );

    assert.match(
      filters,
      /id="filter-price-error"/
    );

    assert.match(
      filters,
      /role="alert"/
    );

    assert.match(
      filters,
      /data-i18n-key="filters\.priceInvalid"/
    );
  }
);

for (
  const [
    name,
    relativePath
  ]
  of [
    [
      'homepage',
      '../src/home-entry.js'
    ],
    [
      'events',
      '../src/events-entry.js'
    ]
  ]
) {
  const source =
    fs.readFileSync(
      new URL(
        relativePath,
        import.meta.url
      ),
      'utf8'
    );

  test(
    `${name} blocks invalid price before form synchronization`,
    () => {
      assert.match(
        source,
        /function validatePriceFilterInput\(/
      );

      assert.match(
        source,
        /validity\?\.valid/
      );

      assert.match(
        source,
        /setPriceFilterValidationState\(/
      );

      const start =
        source.indexOf(
          'function bindFilterFormInteractions(formEl) {'
        );

      const end =
        source.indexOf(
          '\nfunction ',
          start + 1
        );

      const scope =
        source.slice(
          start,
          end
        );

      const submit =
        scope.indexOf(
          "wireOnce(formEl, 'submit'"
        );

      const validation =
        scope.indexOf(
          '!validatePriceFilterInput({',
          submit
        );

      const sync =
        scope.indexOf(
          'syncFiltersFromForm();',
          submit
        );

      assert.ok(
        submit >= 0
      );

      assert.ok(
        validation > submit
      );

      assert.ok(
        sync > validation
      );

      assert.match(
        scope,
        /price-validation-blur/
      );

      assert.match(
        scope,
        /price-validation-input/
      );
    }
  );

  test(
    `${name} clears stale visible price validation on state restore`,
    () => {
      const start =
        source.indexOf(
          'function setFilterInputsFromState() {'
        );

      const end =
        source.indexOf(
          '\nfunction ',
          start + 1
        );

      const scope =
        source.slice(
          start,
          end
        );

      assert.match(
        scope,
        /setPriceFilterValidationState\(\s*false\s*\)/
      );
    }
  );

  test(
    `${name} localizes the price validation error`,
    () => {
      const start =
        source.indexOf(
          'function updateFilterLocaleTexts() {'
        );

      const end =
        source.indexOf(
          '\nfunction ',
          start + 1
        );

      const scope =
        source.slice(
          start,
          end
        );

      assert.match(
        scope,
        /filters\.priceInvalid/
      );

      assert.match(
        scope,
        /#filter-price-error/
      );
    }
  );
}

for (
  const language
  of [
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]
) {
  test(
    `${language} price validation copy stays synchronized`,
    () => {
      const src =
        JSON.parse(
          fs.readFileSync(
            new URL(
              `../src/locales/${language}.json`,
              import.meta.url
            ),
            'utf8'
          )
        );

      const publicLocale =
        JSON.parse(
          fs.readFileSync(
            new URL(
              `../public/locales/${language}.json`,
              import.meta.url
            ),
            'utf8'
          )
        );

      assert.equal(
        typeof src.filters.priceInvalid,
        'string'
      );

      assert.ok(
        src.filters.priceInvalid.length >
          0
      );

      assert.equal(
        publicLocale.filters.priceInvalid,
        src.filters.priceInvalid
      );
    }
  );
}

test(
  'price validation exposes shared visible error styling',
  () => {
    assert.match(
      styles,
      /AJSEE_PRICE_FILTER_VALIDATION_V1/
    );

    assert.match(
      styles,
      /#filter-price-max\[aria-invalid="true"\]/
    );

    assert.match(
      styles,
      /\.filter-error\[hidden\]/
    );
  }
);
