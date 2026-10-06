# Ticketmaster affiliate safety contract

This document describes a revenue-critical production invariant.

## Why this exists

Ticketmaster affiliate links run through Impact. The Impact redirect chain can include
`ticketmaster.evyy.net` and the sync domain `ojrq.net`.

Some corporate DNS / firewall products, including pfBlockerNG DNSBL, can block or
intercept `ojrq.net`. If the customer's browser is sent directly through that chain,
the purchase journey can stop on a TLS/certificate error before Ticketmaster opens.

AJSEE previously solved this in May 2026 with a Netlify outbound function that inspected
the chain server-side. That protection was later removed during an affiliate-routing
refactor. The regression reappeared in production in October 2026.

## Non-negotiable production invariant

In the default production mode:

1. The browser opens the AJSEE Netlify outbound endpoint.
2. Netlify builds the correct Impact tracking link.
3. Netlify resolves the Impact / `ojrq.net` redirect chain server-side.
4. The browser receives only the final Ticketmaster / allowed seller URL.
5. The final URL should carry affiliate evidence such as `clickId`, `irgwc=1`,
   `ircid`, `camefrom`, or AJSEE's Impact campaign/source values.
6. If server-side Impact resolution fails, the browser must fall back directly to the
   seller. It must not be exposed to `ticketmaster.evyy.net` or `ojrq.net`.

This prioritizes a working purchase journey while preserving affiliate attribution
whenever Impact is operational.

## Current Ticketmaster Czech Republic mapping

- AJSEE Impact partner ID: `7218577`
- Asset ID: `1958979`
- Program ID: `23901`
- Partner property ID: `8292139`

The previous CZ asset `2038768` is legacy-only and must not become the generated
default again.

## Emergency modes

`TM_IMPACT_TRACKING_MODE=server`
: Default and required production behavior.

`TM_IMPACT_TRACKING_MODE=affiliate`
: Emergency diagnostic override. This exposes the raw Impact chain to the browser and
  can fail on DNSBL / ad-blocking networks. Do not use as the normal production mode.

`TM_IMPACT_TRACKING_MODE=direct`
: Emergency bypass. Purchase flow remains available, but affiliate attribution can be
  lost.

Legacy `adaptive` maps to `server`.

## Guardrails

Every production build runs:

`npm run ticketmaster:safety`

The guard fails the build if the default server-side resolver, current CZ asset, direct
failure fallback, required tests, or other critical invariants disappear.

Behavioral regression tests live in:

`tests/tm-outbound.test.mjs`

Those tests are also included in the required prebuild test suite.

## Change policy

Any change to `netlify/functions/tmOutbound.js`, Ticketmaster Impact IDs, redirect
handling, or the safety guard must be treated as revenue-critical.

Before merging such a change:

- verify Netlify deploy preview,
- test on a normal network,
- test on a network that blocks `ojrq.net`,
- confirm the final Ticketmaster URL contains affiliate evidence,
- confirm the browser never visits `ojrq.net` in normal server mode,
- verify Impact reporting after its normal reporting delay.

Do not remove or weaken these protections as part of unrelated Ticketmaster, event-card,
tracking, or redirect refactors.
