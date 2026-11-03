# ColosseumTicket Slovakia

The production prebuild synchronizes both official affiliate exports:

- CZ: https://colosseumticket.cz/api/export/affiliate.xml
- SK: https://colosseumticket.sk/api/export/affiliate.xml

The Slovak partner URL supplied by AJSEE points to https://colosseumticket.sk/sk.
Its `a_box` matches the value already configured in `COLOSSEUMTICKET_A_BOX`
(verified against the live Czech feed on 2026-11-03), so both markets can use the
existing server setting. `COLOSSEUMTICKET_SK_A_BOX` provides a Slovak-only override
if the provider later separates the identifiers. Partner values stay in server
configuration and generated ticket feeds rather than source or client bundles.
The outbound function selects configuration by the destination host and replaces
all visitor-provided affiliate values. HTTPS, hostname, credential and port
validation applies to both storefronts. Ticketmaster routing is unchanged.

## Data and discovery

Both markets share the existing Colosseum adapter, event cards, modals, consent
tracking and compressed feed. Slovak content retains its `sk` language; keyword
filtering works in all six interface languages. Euro single/range/decimal prices
are parsed without currency conversion. Unknown and zero prices keep the existing
commercial safeguards. `Pre deti` maps to the same family taxonomy as `Pro děti`;
the original provider categories remain available.

Each source keeps its own normalized cache, minimum-count and 50% count-drop
checks. An unavailable market retains its own last successful data. If a market
has never synchronized successfully, a failing initial import fails the build.
`COLOSSEUMTICKET_FEED_FILE` and `COLOSSEUMTICKET_SK_FEED_FILE` allow reproducible
offline validation. The final combined feed and its city subsets are written
only after both markets are ready.

The SK portal also lists Czech events. Cross-market duplicates match occurrence
ID, local date/time, city and venue name, independently of abbreviated streets.
The established Czech ID, ticket URL and venue are retained; Slovak text is added
as a separate translation. Different venues or cities sharing a term ID remain
separate. New Slovak canonical IDs have a `colosseumticket-sk-` prefix to avoid
collisions between provider installations.

The reviewed 2026-11-03 exports contained 2,307 Czech and 144 Slovak-portal terms.
There were 91 identical Ostrava terms and 53 additional terms located in Slovakia,
giving 2,360 combined occurrences. The Slovak cities were Bratislava, Trnava,
Košice, Žilina, Nitra, Prešov, Banská Bystrica and Trenčín. Counts change with the
provider export; they are not inventory or availability guarantees.

Event country is based on reviewed city/venue evidence, rather than the seller
domain. All eight Slovak cities enter the shared city index. Unreviewed future
Slovak-source cities are never silently labeled Czech. Exact-city searches can
include venues without coordinates. Radius searches continue to require a
reviewed venue position; registry records retain their evidence and precision in
`shared/geo/colosseum-sk-venue-locations.js`. No visitor-time geocoding or city
center substitution is introduced.

## Validation

`npm run colosseumticket:test` includes the Slovak integration tests. They cover
currencies, family taxonomy, market deduplication, independent refresh failure,
ID collisions, country and city discovery, Slovak keyword fallback in all six
languages, both-host outbound safety, analytics and reviewed geographic matching.
Run the standard `npm run build` for the site's remaining regression/SEO checks.
