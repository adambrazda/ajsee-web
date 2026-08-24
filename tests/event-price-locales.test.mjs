import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const expected = {
  cs: {
    priceMax:
      'Cena od \u2013 max.',

    priceCurrency:
      'M\u011bna'
  },

  en: {
    priceMax:
      'Starting price \u2013 max.',

    priceCurrency:
      'Currency'
  },

  de: {
    priceMax:
      'Preis ab \u2013 max.',

    priceCurrency:
      'W\u00e4hrung'
  },

  sk: {
    priceMax:
      'Cena od \u2013 max.',

    priceCurrency:
      'Mena'
  },

  pl: {
    priceMax:
      'Cena od \u2013 maks.',

    priceCurrency:
      'Waluta'
  },

  hu: {
    priceMax:
      'Kezd\u0151\u00e1r \u2013 max.',

    priceCurrency:
      'P\u00e9nznem'
  }
};

for (
  const language
  of Object.keys(expected)
) {
  test(
    `${language} price-filter locale stays synchronized across src and public`,
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

      for (
        const key
        of [
          'priceMax',
          'priceCurrency',
          'priceMaxPlaceholder',
          'priceHelp'
        ]
      ) {
        assert.equal(
          typeof src.filters[key],
          'string'
        );

        assert.ok(
          src.filters[key].length >
            0
        );

        assert.equal(
          publicLocale.filters[key],
          src.filters[key]
        );
      }

      assert.equal(
        src.filters.priceMax,
        expected[language].priceMax
      );

      assert.equal(
        src.filters.priceCurrency,
        expected[language].priceCurrency
      );

      assert.equal(
        src.filters.priceMaxPlaceholder,
        '1000'
      );
    }
  );
}