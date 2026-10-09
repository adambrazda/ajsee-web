import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return fs.readFileSync(
    new URL(
      '../' + relativePath,
      import.meta.url
    ),
    'utf8'
  );
}

function between(
  source,
  startMarker,
  endMarker
) {
  const start =
    source.indexOf(
      startMarker
    );

  const end =
    source.indexOf(
      endMarker,
      start + startMarker.length
    );

  assert.notEqual(
    start,
    -1,
    'start marker must exist: ' +
      startMarker
  );

  assert.notEqual(
    end,
    -1,
    'end marker must exist: ' +
      endMarker
  );

  return source.slice(
    start,
    end
  );
}

const sms =
  read(
    'scripts/sync-smsticket-events.mjs'
  );

const colosseum =
  read(
    'scripts/sync-colosseumticket-events.mjs'
  );

const modal =
  read(
    'src/event-modal.js'
  );

test(
  'city subsets keep bounded descriptions for the shared modal',
  () => {
    for (
      const [provider, source] of [
        ['SMS Ticket', sms],
        ['ColosseumTicket', colosseum]
      ]
    ) {
      assert.match(
        source,
        /CITY_SUBSET_DESCRIPTION_MAX_CHARS\s*=\s*240/,
        provider +
          ' must cap subset descriptions at 240 characters'
      );

      assert.match(
        source,
        /compactCitySubsetDescription/,
        provider +
          ' must compact modal descriptions'
      );

      assert.match(
        source,
        /descriptionPayload:\s*['"]excerpt-240['"]/,
        provider +
          ' subset metadata must declare the excerpt contract'
      );
    }

    const smsSubset =
      between(
        sms,
        'function createSubsetPayload',
        'async function writeSmsticketPayloads'
      );

    const colosseumSubset =
      between(
        colosseum,
        'function createSubsetPayload',
        'function serializeJson'
      );

    assert.equal(
      /removedFields[\s\S]*?['"]description['"]/.test(
        smsSubset
      ),
      false,
      'SMS Ticket must not claim that description is removed'
    );

    assert.equal(
      /removedFields[\s\S]*?['"]description['"]/.test(
        colosseumSubset
      ),
      false,
      'ColosseumTicket must not claim that description is removed'
    );

    assert.match(
      modal,
      /pickLocalized\(eventData\.description, preferredLocales\)/
    );

    assert.match(
      modal,
      /descEl\.textContent = description/
    );

    assert.match(
      modal,
      /descEl\.hidden = !description/
    );
  }
);
