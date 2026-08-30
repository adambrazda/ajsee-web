import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime =
  fs.readFileSync(
    new URL(
      '../src/utils/ajsee-date-popover.js',
      import.meta.url
    ),
    'utf8'
  );

const styles =
  fs.readFileSync(
    new URL(
      '../src/styles/partials/_date-popover.scss',
      import.meta.url
    ),
    'utf8'
  );


test(
  'mobile date popover exposes forward navigation on the visible month',
  () => {
    assert.match(
      runtime,
      /ajsee-date-popover__nav--mobile-next[\s\S]*?data-nav="next"/
    );

    assert.match(
      runtime,
      /querySelectorAll\('\[data-nav="next"\]'\)/
    );
  }
);


test(
  'mobile date popover displays one month with a compact viewport height',
  () => {
    assert.match(
      styles,
      /@media \(max-width: 720px\)[\s\S]*?\.ajsee-date-popover__nav--mobile-next[\s\S]*?display:\s*inline-flex/
    );

    assert.match(
      styles,
      /@media \(max-width: 720px\)[\s\S]*?\.ajsee-date-popover__month\[data-month="1"\][\s\S]*?display:\s*none/
    );

    assert.match(
      styles,
      /max-height:[\s\S]*?78dvh/
    );

    assert.match(
      styles,
      /\.ajsee-date-popover__calendar\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*auto/
    );
  }
);


test(
  'desktop date popover retains its two-month layout',
  () => {
    assert.match(
      runtime,
      /data-month="0"/
    );

    assert.match(
      runtime,
      /data-month="1"/
    );

    assert.match(
      runtime,
      /renderMonth\(0\);[\s\S]*?renderMonth\(1\);/
    );

    assert.match(
      styles,
      /@media \(min-width: 721px\)[\s\S]*?\.ajsee-date-popover__months\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/
    );
  }
);
