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
`{event: 'partner_click'}` object.** The published GTM container still has a
legacy custom-event trigger that would send a second event with fewer fields.
GTM can react to legacy `partner_click` gtag commands as well, so the new
canonical name is deliberately `ajsee_partner_click`. GTM is retained for
compatibility with other tags.

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

On 20 October 2026, the public GTM container `GTM-T5NZVSSW` used
`G-KOZS0D9JLK` (letter O) for its base/test tags but `G-K0ZS0D9JLK` (zero) for
its partner-click tag. The application uses the latter. Check the actual
stream in GA4 before correcting the separate GTM configuration; this code
change does not edit the account or publish the GTM container.
