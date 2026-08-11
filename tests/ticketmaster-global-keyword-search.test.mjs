import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiSource = fs.readFileSync(
  new URL('../src/api/eventsApi.js', import.meta.url),
  'utf8'
);

const tmSource = fs.readFileSync(
  new URL('../src/adapters/ticketmaster.js', import.meta.url),
  'utf8'
);

test(
  'keyword-only discovery opts Ticketmaster into a global search',
  () => {
    assert.match(
      apiSource,
      /normalizedKeyword\.length >= 2[\s\S]*!hasExplicitPlaceFilter[\s\S]*!hasNearMeFilter/
    );

    assert.match(
      apiSource,
      /countryCode:\s*'',[\s\S]*globalKeywordSearch:\s*true/
    );

    assert.match(
      apiSource,
      /fetchTicketmasterEvents\(\{[\s\S]*filters:\s*ticketmasterFilters/
    );
  }
);

test(
  'global keyword search is Ticketmaster-only',
  () => {
    assert.match(
      apiSource,
      /const localProviderFilters = \{[\s\S]*\.\.\.upstreamFilters/
    );

    assert.doesNotMatch(
      apiSource,
      /const localProviderFilters = \{[\s\S]*\.\.\.ticketmasterFilters/
    );
  }
);

test(
  'Ticketmaster global search requires explicit upstream opt-in',
  () => {
    assert.match(
      tmSource,
      /filters\.globalKeywordSearch === true/
    );

    assert.match(
      tmSource,
      /globalKeyword\.length >= 2/
    );

    assert.match(
      tmSource,
      /!effectiveRawCity/
    );
  }
);

test(
  'global keyword search removes country only from the opted-in broad attempt',
  () => {
    assert.match(
      tmSource,
      /allowGlobalKeywordSearch[\s\S]*\?\s*''[\s\S]*:\s*countrySearchCode \|\| explicitCountry \|\| 'CZ'/
    );

    assert.match(
      tmSource,
      /if \(!hasGeo && attempt\.countryCode\) qs\.set\('countryCode', attempt\.countryCode\)/
    );
  }
);

test(
  'normal no-city Ticketmaster discovery keeps the CZ fallback',
  () => {
    assert.match(
      tmSource,
      /countrySearchCode \|\| explicitCountry \|\| 'CZ'/
    );
  }
);

test(
  'city and Near Me guards remain part of global keyword eligibility',
  () => {
    assert.match(
      apiSource,
      /Boolean\(upstreamCity\)/
    );

    assert.match(
      apiSource,
      /const hasNearMeFilter =\s*filters\.nearMeLat != null &&\s*filters\.nearMeLon != null;/
    );

    assert.match(
      tmSource,
      /filters\.nearMeLat != null[\s\S]*filters\.nearMeLon != null/
    );
  }
);
test(
  'global keyword discovery uses Ticketmaster wildcard locale',
  () => {
    assert.match(
      tmSource,
      /allowGlobalKeywordSearch\s*\?\s*\['\*'\]\s*:\s*makeLocaleList/
    );
  }
);

test(
  'normal Ticketmaster discovery keeps the existing locale resolver',
  () => {
    assert.match(
      tmSource,
      /makeLocaleList\(\{[\s\S]*marketLocale,[\s\S]*locale,[\s\S]*countryCode:\s*targetCountryForLocale/
    );
  }
);