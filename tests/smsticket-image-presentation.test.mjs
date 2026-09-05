import test from 'node:test';
import assert from 'node:assert/strict';

import {
  withSmsticketImagePresentation
} from '../src/adapters/smsticket.js';

test(
  'SMS Ticket artwork receives the shared adaptive matte rule',
  () => {
    const event =
      withSmsticketImagePresentation({
        id:
          'smsticket-74664',

        image:
          'https://www.smsticket.cz/cdn/events/2026/74664/poster.jpg'
      });

    assert.deepEqual(
      event.imagePresentation,
      {
        fit:
          'auto',
        x:
          50,
        y:
          50,
        surface:
          'adaptive-matte',
        source:
          'rules',
        version:
          2
      }
    );
  }
);

test(
  'existing image presentation has priority over the SMS Ticket rule',
  () => {
    const presentation = {
      fit:
        'cover',
      x:
        42,
      y:
        30,
      source:
        'manual',
      version:
        2
    };

    const input = {
      image:
        'https://www.smsticket.cz/cdn/events/example.jpg',

      imagePresentation:
        presentation
    };

    const output =
      withSmsticketImagePresentation(
        input
      );

    assert.strictEqual(
      output,
      input
    );

    assert.strictEqual(
      output.imagePresentation,
      presentation
    );
  }
);

test(
  'event without an SMS Ticket image is left unchanged',
  () => {
    const input = {
      id:
        'smsticket-no-image'
    };

    const output =
      withSmsticketImagePresentation(
        input
      );

    assert.strictEqual(
      output,
      input
    );

    assert.equal(
      output.imagePresentation,
      undefined
    );
  }
);
