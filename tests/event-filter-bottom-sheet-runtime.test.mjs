import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  'shared mobile filter sheet has accessible modal hooks',
  () => {
    assert.match(
      source,
      /aria-labelledby="filters-sheet-title"/
    );

    assert.match(
      source,
      /id="filters-sheet-title"/
    );

    assert.match(
      source,
      /data-filter-sheet-close/
    );

    assert.match(
      source,
      /data-filter-sheet-backdrop/
    );

    assert.equal(
      (
        source.match(
          /id="filter-price-max"/g
        ) || []
      ).length,
      1
    );

    assert.equal(
      (
        source.match(
          /id="filter-price-currency"/g
        ) || []
      ).length,
      1
    );
  }
);


test(
  'shared mobile filter runtime manages dialog state',
  () => {
    assert.match(
      source,
      /FILTER_SHEET_MEDIA_QUERY[\s\S]*?max-width:\s*720px/
    );

    assert.match(
      source,
      /setAttribute\(\s*'role',\s*'dialog'\s*\)/
    );

    assert.match(
      source,
      /setAttribute\(\s*'aria-modal',\s*'true'\s*\)/
    );

    assert.match(
      source,
      /event\.key\s*===\s*'Escape'/
    );

    assert.match(
      source,
      /event\.key\s*!==\s*'Tab'/
    );

    assert.match(
      source,
      /focusSharedEventFilterSheet/
    );
  }
);


test(
  'sheet open state locks document scrolling',
  () => {
    assert.match(
      styles,
      /ajsee-filter-sheet-open[\s\S]*?overflow:\s*hidden/
    );
}
);


test(
  'valid submit closes the detail sheet after rendering',
  () => {
    for (
      const relativePath of
      [
        '../src/home-entry.js',
        '../src/events-entry.js'
      ]
    ) {
      const pageSource =
        fs.readFileSync(
          new URL(
            relativePath,
            import.meta.url
          ),
          'utf8'
        );

      const submitMatch =
        pageSource.match(
          /wireOnce\(formEl, 'submit', async e => \{([\s\S]*?)\n\s*\}, 'submit'\);/
        );

      assert.ok(
        submitMatch,
        `submit handler missing in ${relativePath}`
      );

      const submitBody =
        submitMatch[1];

      const renderIndex =
        submitBody.lastIndexOf(
          'await renderAndSync'
        );

      const closeIndex =
        submitBody.lastIndexOf(
          'setSharedEventFilterDetailsExpanded'
        );

      const scrollIndex =
        submitBody.lastIndexOf(
          'scrollToSharedEventResults'
        );

      assert.ok(
        renderIndex >= 0,
        `render missing in ${relativePath}`
      );

      assert.ok(
        closeIndex > renderIndex,
        `sheet must close after render in ${relativePath}`
      );

      assert.ok(
        scrollIndex > closeIndex,
        `result scroll must follow sheet close in ${relativePath}`
      );
    }
  }
);
