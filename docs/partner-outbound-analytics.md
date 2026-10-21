# Partner outbound analytics

`src/partner-outbound.js` owns the `ajsee_partner_click` GA4 event. The global
bootstrap installs delegated `click` and middle-button `auxclick` listeners.
Card and modal bindings use the same function and pass the activation event,
so one activation cannot be counted by both listeners. Pointer gestures do
not count. A second completed click does count.

The event requires a current explicit analytics consent. Rejected clicks are
not queued or persisted. Withdrawing consent in the cookie settings disables
measurement and reloads the page to remove previously loaded Google scripts.
Source HTML templates must not independently load GA4.

## Transport

Send one `gtag('event', 'ajsee_partner_click', parameters)` command, targeted at the
stream in `src/utils/analytics-config.js`. **Do not additionally push a plain
`{event: 'partner_click'}` object.** The legacy GTM custom-event trigger can
send a second event with fewer fields. Its tag was paused in published GTM
version 6 on 20 October 2026; keep the canonical name `ajsee_partner_click`
independent of that old configuration. GTM is retained for compatibility.

GA4 configuration is queued before the script finishes loading, so a fast
click cannot precede configuration. The click handler never rewrites the
anchor, cancels navigation or waits for analytics.

## Reporting contract

| Parameter | Meaning |
| --- | --- |
| `partner` | `ticketmaster`, `smsticket`, `colosseumticket`, `todaytix`, `trustedstays` |
| `partner_event_id` | Listing/occurrence ID where available; empty for editorial articles |
| `event_title` | Event title or editorial headline |
| `partner_event_name` | Legacy alias for the title |
| `partner_city` | Event city, where available |
| `source_page_path` | Source pathname, without search text, coordinates or fragments |
| `page_type` | Homepage, Events, editorial, London, accommodation or other page type |
| `page_language` | AJSEE page language; separate from the visitor's browser language |
| `placement` | Card, modal, review CTA, London hero/popular section, UK/France accommodation CTA, etc. |
| `product_type` | `tickets`, `accommodation`, or `partner_info` for the partner roster |
| `content_slug` | Editorial article slug where available |
| `destination_host` | Seller domain, including the target inside `tmOutbound` |
| `outbound_url` | Seller origin/path; query parameters are omitted only in analytics |
| `ticket_option_index`, `ticket_price_from`, `ticket_currency` | Selected modal ticket option, when present |

Google reserves `event_id` and `language`; do not use them for reportable AJSEE
custom dimensions. The in-memory diagnostic snapshot retains the local
`event_id`, but the transmitted parameter is `partner_event_id`. No rich click
payload is written to local/session storage.

Register needed event-scoped custom dimensions in GA4 before expecting them in
standard reports. Start with partner, source page, placement, page language,
product type and content slug; add event title/ID only if the reporting use
case requires their higher cardinality. Sending a parameter does not prove
that it is registered or that a GA4 report already contains it.

Do not sum automatic outbound `click` or legacy `partner_click` events with `ajsee_partner_click`. Do not
treat clicks on internal AJSEE promotions as partner clickouts. Exclude
`product_type=partner_info` when reporting purchase-intent clickouts. A
clickout is not a confirmed order or commission.

## Commercial invariants

- Ticketmaster retains its existing server `tmOutbound` / Impact route.
- ColosseumTicket and SMS Ticket keep the exact original `a_box` links.
- TodayTix keeps `ajsee.tixculture.com`, including the specific show URL.
- TrustedStays keeps the existing referral URL and campaign parameters.

The AI search learning funnel remains separate and receives only its existing
privacy-safe event reference, provider, result position and placement.

## Checks

Run `npm run analytics:test` and the existing modal / ticket / affiliate tests.
The analytics suite is part of `prebuild`. Verify a live event in GA4 Realtime
after deployment; an intercepted test request is not proof of GA4 ingestion.

Before the account cleanup on 20 October 2026, GTM container `GTM-T5NZVSSW` used
`G-KOZS0D9JLK` (letter O) for its base/test tags but `G-K0ZS0D9JLK` (zero) for
its partner-click tag. The application uses the latter, verified against GA4
property `492103490`, web stream `11312537950`.

## Verified account configuration, 20 October 2026

- One controlled TodayTix hero click at 12:54:52 UTC appeared in GA4 Realtime
  as one `ajsee_partner_click`, with `partner=todaytix`. This is live ingestion
  evidence, separate from the intercepted local transport tests.
- GTM version 6 pauses only `AJSEE - GA4 - Google tag`, `AJSEE - GA4 - Test
  event`, and `GA4 - partner_click`. The ten pre-existing changes in Default
  Workspace were not published with it.
- Existing event-scoped dimensions already include `partner`, `placement`,
  `event_title`, and `destination_host`. Four additional event dimensions were
  verified in the saved list: `source_page_path`, `page_type`, `product_type`,
  and `content_slug`. The initial attempt to verify `page_language` was blocked
  by component and permission errors. On 21 October the saved exploration
  included the dimension “AJSEE jazyk stránky” and its table returned page
  language values. This confirms the reporting dimension is usable; new
  definitions do not backfill historical reports.
- The diagnostic ready event uses `analytics_init_source`, never `source`,
  and does not mark ordinary visitors with `debug_mode`. The old diagnostic
  value had appeared in acquisition reports; the change does not rewrite
  that historical attribution.
- Consent UI is bootstrapped by the shared identity entry, including direct
  arrivals on London and accommodation pages. London includes the shared
  consent styles. An absent preferred language must not force Czech before
  URL or document language is checked.

The primary weekly KPI is **total users** who generated `ajsee_partner_click`
with `product_type` equal to `tickets` or `accommodation`. Event count is the
secondary volume metric. Report overall users directly, never by summing
partner or page rows. Internal promotions and `partner_info` are excluded.
The first complete Monday–Sunday week after this setup is 26 October–1
November 2026; process the result after GA4's reporting delay.

The exploration “AJSEE – prokliky k partnerům” was created with Total users,
Event count, a Monday–Sunday last-week range, the exact event-name filter,
and `product_type` matching `^(tickets|accommodation)$`. Partner and source
page tabs were saved. Access recovered on 21 October and all six saved views
were inspected. Reloading the exploration confirmed that the Monday–Sunday
range, dimensions and refinements below persist.

## Verified exploration, 21 October 2026

| View | Row dimension | Additional scope |
| --- | --- | --- |
| Partneři | `partner` | Tickets and accommodation |
| Stránky | `source_page_path` | Tickets and accommodation |
| Umístění | `placement` | Tickets and accommodation |
| Jazyky | `page_language` | Tickets and accommodation |
| Události | `event_title` | `product_type` matches `^tickets$` |
| Články | `content_slug` | `page_type` exactly matches `blog-detail` |

Every view uses Total users and Event count and requires Event name exactly
`ajsee_partner_click`. Other views retain the purchase-intent product filter
`^(tickets|accommodation)$`. The articles view intentionally excludes empty
article rows created by clicks from listings or London landing pages; an
empty table is valid until a click from an article has been processed.

The last-seven-days range was used temporarily to confirm processed data by
partner, page, placement, language and event title. It includes a known
controlled test click and must not be described as purely organic activity
or sales. The final saved range remains the last complete Monday–Sunday
week. Before the first complete measurement week, a zero in that saved range
can simply refer to a period before the new event was deployed. Totals are
distinct users within the selected scope; never sum the user counts of rows.
