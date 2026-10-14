# ColosseumTicket venue geography

Geographic searches use occurrence venues with documented coordinates. They never
substitute a city centre, the user's coordinates, another same-named venue, or an
address selected only because it was the geocoder's first result.

## Reviewed registry

`shared/geo/colosseum-venue-locations.js` contains 138 venue identities reviewed on
2026-10-14. Against the inspected 2,290-occurrence feed, 2,097 occurrences have a
reviewed location (91.6%); 193 occurrences at 61 other venue identities remain
unlocated. These are snapshot counts; every production build prints fresh counts.

Each record binds the provider's venue name, city and street to a point and its
evidence. Most coordinates are WGS84 address points from the ČÚZK RÚIAN service.
The venue/address relationship comes from the provider. Corrections and missing
addresses additionally cite the operator or a public institution. Karlovy Vary
uses the theatre's explicitly published GPS position, marked with venue precision.
Address points have address precision; they are not promises of a particular door
or room inside a building.

RÚIAN candidates were accepted only after checking address-point type, score 100,
the municipality, street and supplied house-number components. Multiple distinct
matching points were rejected. Examples include the two addresses matching the
short Kyjov house number and the ambiguous Český Těšín address. A number of halls
and placeholders such as `EXTERNÍ - Brno` still lack adequate location evidence.

Reviewed corrections include Jindřišká → Jindřišská for Klubovna, the house number
for Divadlo „12“, and the missing final digit in the Bez zábradlí address. Full
address aliases are explicitly enumerated from the reviewed evidence. Matching
does not truncate street numbers or expand a partial address at runtime.

Primary coordinate sources:

- https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1
- https://www.karlovarske-divadlo.cz/en

Every registry record retains its own verification URL and review date. Additional
operator evidence is retained as `addressSourceUrl` where applicable. Unknown
venues retain the provider's country metadata; CZ is added only for a reviewed
Czech venue. Valid coordinates already declared by the provider are preserved.

## Runtime and build behavior

Both normalization and the adapter enrich known venues. The adapter supports
older cached feeds that do not yet contain the coordinates. No live geocoding or
third-party map request is added to visitor searches.

A radius always loads the full local feed, including when `cityLabel` still names
the circle's centre. Exact-city searches retain city subsets. The common distance
helper rejects missing and out-of-range values and never combines partial points
from different provider objects. The same inclusive distance boundary applies to
the local adapters and the aggregate filter.

Geographic coverage metadata survives remote continuation batches. Missing
locations are distinguished from HTTP failures and from remote pagination. Both
pages explain the scope; an empty geographic result is described as no matching
events with a verified location. Exact-city and unrestricted searches can still
include unlocated events, subject to their other filters and availability.

## Maintaining coverage

Run `npm run colosseumticket:geography` to list unresolved venue identities and
their occurrence counts. A different normalized feed can be passed as a path.
The production prebuild uses `--summary` after refreshing the provider feed.

For a new or changed venue, verify its actual event address with the provider or
operator, retrieve the corresponding address point or explicit venue GPS, and
record the evidence. Ambiguous street-only, municipality-only, swapped-number or
unidentified-hall matches remain excluded until they can be resolved. Commit the
reviewed registry change and run the geographic and full regression suites.
