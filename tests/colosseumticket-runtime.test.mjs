import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';


const eventsApiSource =
  fs.readFileSync(
    new URL(
      '../src/api/eventsApi.js',
      import.meta.url
    ),
    'utf8'
  );

const packageJson =
  JSON.parse(
    fs.readFileSync(
      new URL(
        '../package.json',
        import.meta.url
      ),
      'utf8'
    )
  );


test(
  'eventsApi imports ColosseumTicket as an independent provider',
  () => {
    assert.match(
      eventsApiSource,
      /fetchEvents as fetchColosseumTicketEvents/
    );

    assert.match(
      eventsApiSource,
      /AJSEE_COLOSSEUM_PROVIDER_ISOLATION_v1/
    );
  }
);


test(
  'Colosseum uses local provider filters and never Ticketmaster global filters',
  () => {
    const match =
      eventsApiSource.match(
        /fetchColosseumTicketEvents\(\{[\s\S]*?\}\);/
      );

    assert.ok(
      match,
      'Colosseum fetch call is missing'
    );

    assert.match(
      match[0],
      /filters:\s*localProviderFilters/
    );

    assert.doesNotMatch(
      match[0],
      /ticketmasterFilters/
    );
  }
);


test(
  'Colosseum provider failure is isolated from aggregation',
  () => {
    assert.match(
      eventsApiSource,
      /try\s*\{[\s\S]*fetchColosseumTicketEvents[\s\S]*\}\s*catch\s*\(e\)/
    );
  }
);


test(
  'Colosseum sync is enabled in production prebuild but not local predev',
  () => {
    const predev =
      packageJson.scripts?.predev ||
      '';

    const prebuild =
      packageJson.scripts?.prebuild ||
      '';

    assert.equal(
      predev.includes(
        'colosseumticket:sync'
      ),
      false
    );

    assert.equal(
      prebuild.includes(
        'colosseumticket:sync'
      ),
      true
    );
  }
);


test(
  'exact SMS Ticket and Colosseum cross-provider merge runs before ID dedupe',
  () => {
    const mergeMarker =
      eventsApiSource.indexOf(
        'AJSEE_CROSS_PROVIDER_EXACT_MERGE_v1'
      );

    const idDedupe =
      eventsApiSource.indexOf(
        'const seen = new Set();'
      );

    assert.notEqual(
      mergeMarker,
      -1
    );

    assert.ok(
      idDedupe > mergeMarker,
      'exact cross-provider merge must run before ID dedupe'
    );

    assert.match(
      eventsApiSource,
      /mergeExactCrossProviderOccurrences\(/
    );
  }
);


test(
  'Colosseum runtime is explicitly enabled after commercial activation',
  () => {
    assert.match(
      eventsApiSource,
      /const ENABLE_COLOSSEUMTICKET\s*=\s*true;/
    );

    const providerStart =
      eventsApiSource.indexOf(
        '// --- ColosseumTicket ---'
      );

    const providerEnd =
      eventsApiSource.indexOf(
        '// --- SeatPlan ---',
        providerStart
      );

    assert.ok(
      providerStart >= 0 &&
      providerEnd > providerStart
    );

    const providerBlock =
      eventsApiSource.slice(
        providerStart,
        providerEnd
      );

    assert.match(
      providerBlock,
      /if\s*\(\s*ENABLE_COLOSSEUMTICKET\s*\)/
    );
  }
);
