# Provider coverage safeguards

## SMS Ticket geography

The public XML feed includes foreign venues but currently omits country fields.
The import must not treat the seller's nationality as proof that every venue is
in Czechia. `shared/geo/smsticket-country.js` uses explicit provider country
metadata when present, verified city/coordinate checks for audited foreign
venues, and the existing canonical city directory. Coordinate checks distinguish
Slovak Trnava/Žilina from Czech municipalities with the same names. The Luxor
venue without coordinates requires its verified provider venue identity.

The same correction runs on legacy browser snapshots and failed-sync fallbacks.
It changes country fields, never coordinates, dates, prices or purchase URLs.
Unrecognized places still use existing country metadata or the source's CZ
market default. This is not a complete world geocoder: new ambiguous foreign
locations need provider country data or verified geography before claiming
country completeness.

The generated city catalog includes version-two `providerCountries` from actual
feed records. The aggregation may skip an unsupported seller market only with
this explicit coverage metadata. An old or unavailable catalog falls back to
inspecting real events. This avoids downloading the full SMS snapshot for
uncovered foreign markets without restoring a hard-coded CZ/SK restriction.
The existing London/TodayTix routing remains intact. Near Me is independent of
the default CZ country.

## SMS Ticket import

Before publishing data, validate XML syntax, the events root, nonempty content,
document size (30 MiB), the minimum valid event count (100), unique provider IDs,
and an unexpected count drop below half of the previous snapshot. DTD/entity
declarations are rejected. Reconciliation counts distinguish tests, expired or
undated rows and invalid required fields.

A failed sync keeps the last nonempty snapshot, corrects cached geography, and
records `lastSyncStatus: fallback` / `lastSyncAttemptAt`. `syncedAt` remains the
last successful source refresh. With no existing usable snapshot the build
fails instead of publishing an invented empty feed. Validated output uses an
atomic rename per file. A reviewed genuine large inventory decrease can be
accepted with `SMSTICKET_ALLOW_COUNT_DROP=1`; this does not bypass XML, minimum
count or duplicate-ID validation.

## Ticketmaster continuation

Discovery's offset depth applies per query. Before the next offset reaches
1,000, roll the query forward with an inclusive `startDateTime`, or backward
with an inclusive `endDateTime`, based on the raw provider page. Inclusion of
the boundary is necessary to retain other performances at exactly that time.
The search session deduplicates IDs across windows and never moves published
events. A monotonically increasing `pagesFetched` counter keeps deferred queries
fair even when the window's page index resets to zero.

Date-only inventory uses a documented `localStartDateTime` interval covering the
whole boundary day. No show time is invented. TBA/TBD inclusion is forwarded
explicitly because the API otherwise excludes uncertain dates once date filters
are applied. The existing user-selected local calendar overlap filter remains
in place. Proxy metadata captures the raw continuation boundary before local
country filtering; cursor cache entries use a new version suffix.

The request cap, deadlines and rate-limit cooldown are unchanged. If more than
the API depth shares one timestamp/day, or undated inventory has no usable
continuation boundary, return explicitly incomplete coverage rather than skip
items or repeat the same query indefinitely. Users can narrow place/category/
date criteria; an API-wide inventory guarantee is not possible for such a
provider-limited query.

## Validation

`npm run providers:coverage:test` is required by prebuild. It exercises the real
aggregation for the audited Slovak and other foreign venues; preserves Czech
namesakes, country-only queries, Near Me and tracking URLs; runs real imports in
temporary directories against invalid/empty/partial responses; and traverses
more than 1,000 Ticketmaster candidates in both sort directions with timestamp
ties, date-only tickets and TBA data. It also checks raw proxy boundary metadata.

These changes do not supply missing ColosseumTicket occurrences. An unrestricted
export remains a partner dependency. Full-feed periodic refresh independent of
deployment remains separate work.
