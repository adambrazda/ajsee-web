import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const styles =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/_filters-parity-final.scss',
      import.meta.url
    ),
    'utf8'
  );


test(
  'mobile quick filters use one horizontal scroll row',
  () => {
    assert.match(
      styles,
      /\.filters-toolbar\s*\{[\s\S]*?overflow-x:\s*auto/
    );

    assert.match(
      styles,
      /\.filters-toolbar[\s\S]*?\.chips\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*nowrap/
    );

    assert.match(
      styles,
      /\.filters-toolbar[\s\S]*?\.chip\s*\{[\s\S]*?flex:\s*0 0 auto/
    );
  }
);


test(
  'expanded mobile details render as a fixed bottom sheet',
  () => {
    assert.match(
      styles,
      /data-ajsee-filter-details-expanded="true"[\s\S]*?\.filters-sheet-backdrop[\s\S]*?position:\s*fixed/
    );

    assert.match(
      styles,
      /data-ajsee-filter-details-expanded="true"[\s\S]*?\.filters-fieldset[\s\S]*?display:\s*flex[\s\S]*?position:\s*fixed/
    );

    assert.match(
      styles,
      /\.filters-fieldset[\s\S]*?max-height:[\s\S]*?92dvh/
    );
  }
);


test(
  'mobile sheet keeps header and actions available while scrolling',
  () => {
    assert.match(
      styles,
      /\.filters-sheet-header\s*\{[\s\S]*?position:\s*sticky/
    );

    assert.match(
      styles,
      /\.filter-actions\s*\{[\s\S]*?position:\s*sticky[\s\S]*?grid-template-columns/
    );

    assert.match(
      styles,
      /#filter-nearme\s*\{\s*display:\s*none/
    );

    assert.match(
      styles,
      /\[type="reset"\]\.btn[\s\S]*?grid-column:\s*1/
    );

    assert.match(
      styles,
      /\[type="submit"\]\.btn[\s\S]*?grid-column:\s*2/
    );
  }
);
