import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const premium =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/filters-premium.scss',
      import.meta.url
    ),
    'utf8'
  );

const events =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/events.scss',
      import.meta.url
    ),
    'utf8'
  );

test(
  'Near Me quick chip is neutral until its pressed state is active',
  () => {
    const sharedNearMeBlocks =
      [
        ...premium.matchAll(
          /#chipNearMe,\s*#filter-nearme\s*\{([\s\S]*?)\}/g
        )
      ];

    for (
      const match of
      sharedNearMeBlocks
    ) {
      assert.doesNotMatch(
        match[1],
        /(?:background|color|border(?:-color)?|box-shadow|font-weight|letter-spacing|padding|min-height)\s*:/
      );
    }

    assert.match(
      premium,
      /#filter-nearme\s*\{[\s\S]*?background:\s*linear-gradient\(135deg,\s*var\(--near-1\),\s*var\(--near-2\)\)/
    );

    assert.match(
      premium,
      /#chipNearMe\[aria-pressed="true"\]\s*\{[\s\S]*?background:\s*linear-gradient\(135deg,\s*var\(--near-1\),\s*var\(--near-2\)\)[\s\S]*?color:\s*#fff/
    );

    const unconditionalNearBlocks =
      [
        ...events.matchAll(
          /\.chip-near\s*\{([\s\S]*?)\}/g
        )
      ];

    for (
      const match of
      unconditionalNearBlocks
    ) {
      assert.doesNotMatch(
        match[1],
        /background\s*:|color\s*:|border-color\s*:|box-shadow\s*:/
      );
    }

    assert.match(
      events,
      /\.chip-near\s+svg\s*\{[\s\S]*?stroke:\s*currentColor;/
    );
  }
);
