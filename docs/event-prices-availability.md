# Event prices and ticket availability

## Delivered in this preview

Shared homepage/listing cards and the detail modal show localized seller prices in CS/SK/EN/DE/PL/HU. Ticketmaster's mapped events preserve minimum and maximum price ranges. SMS Ticket's entrance-fee text provides a starting price. Multiple currencies stay separate; missing prices display a seller-price fallback and never imply a free ticket. The modal explains that prices are indicative and that final fees must be checked with the seller. Existing affiliate URLs and price filtering remain unchanged.

The shared availability control has a neutral fallback, a native hover tooltip and a touch/keyboard expandable explanation. No green, orange, red or sold-out claim is inferred from the existence of a price, sale window, missing event or booking link. Ticketmaster offsale, cancelled and postponed states get their own neutral labels.

## Live-data audit (2026-10-06)

- Ticketmaster's current Discovery integration supplies price ranges and event sale status, not remaining ticket counts. `offsale` is not a sold-out flag. `ticketLimit` is a per-purchase limit, not remaining inventory.
- The public SMS Ticket XML feed was retrieved and inspected: 3,268 event records with entrance fees and booking dates, but no inventory count or dedicated sold-out field. The live feed contained plain numeric CZK/EUR prices. A missing event must not be relabeled sold out.
- No existing authorized inventory integration was found in the application. No new access permission, key or partner integration was enabled.
- TodayTix white-label integration is outside this change.

Primary documentation:
- https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- https://developer.ticketmaster.com/products-and-docs/apis/inventory-status/
- https://developer.ticketmaster.com/products-and-docs/apis/partner/availability/
- https://smsticket.zendesk.com/hc/cs/articles/213639209-Implementace-API-pro-v%C3%A1%C5%A1-web
- https://www.smsticket.cz/api/public/v1.1/events

## Prepared inventory presentation; not connected to live inventory

The renderer can consume `ticketInventory` only from an integration which has permission to provide that data. Current adapters do not populate it. The contract requires `source` matching the event partner, `scope: "seller"`, an ISO `observedAt`, a supported `status`, and optionally a nonnegative integer `remaining`.

Supported statuses: `plentiful` (green), `limited` (orange), `last` (red), `sold_out` (explicit seller-scoped badge), `available` / `unavailable` (neutral). Positive availability alone cannot establish plentiful supply. Zero availability alone cannot establish a permanent sell-out. Contradictory data becomes unknown. Counts below 100 appear in the modal with the observation timestamp. The 100 threshold controls number display only; color requires an explicit provider classification. Evidence over 15 minutes old, in the future, missing, or for another seller becomes neutral when rendered. These states have synthetic regression coverage, not a live inventory verification.

Before connecting live inventory, agree provider-specific classifications, permitted update frequency and publication rules. Add server-side caching plus refresh/expiry of already-open pages based on provider contracts; the rendering guard alone is not a live freshness mechanism. Do not ship an inventory integration until that refresh path is implemented. A seller's allocation is not the whole venue's capacity, and ticket counts do not guarantee adjacent seats.

## Next access steps

Ticketmaster Inventory Status API needs specific access from devportalinquiry@ticketmaster.com. It offers available / few tickets left / unavailable / unknown, including CZ and GB, but no exact remaining count. Exact counts require the separately enabled Partner Availability API; availability and redistribution rights for AJSEE must be confirmed. For SMS Ticket, ask the affiliate contact whether a partner feed exposes inventory, sold-out states and timestamps. No message has been sent.

## Validation

Regression tests cover price bounds, currencies, zero/unknown prices, safe text parsing, actual card expansion, six languages, stale/contradictory inventory and modal reuse. Mock inventory is used only in tests and never added to production event data.
