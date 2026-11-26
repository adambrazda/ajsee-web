# Who Cares? — prepublication QA (2026-11-26)

## Editorial and release gate

- EN, CS, SK, DE, PL, HU: approved; preserve all six bodies, subtitles, and production credits.
- Source: `content/reviews/items/who-cares-ballet-prague-2026.json`.
- Keep `status: "draft"`, `published: false`, and empty `publishedAt` until explicit publication approval. Planned publication: 2026-11-30, not scheduled automatically.
- Category `theatre`, contentType `review`; ballet is the editorial genre and DanceEvent is the event schema. No rating was supplied.
- Attended performance: 2026-11-05T19:00:00+01:00.
- Related reading: `chicago-the-musical-uk-tour-2027` via existing renderer, in every language.
- All CTA URLs use the corresponding language's AJSEE events catalogue, with Czech canonical route /events. Verify direct HTTP 200, final language and absence of UTM on internal destinations at release.
- ColosseumTicket has the production page (https://colosseumticket.cz/cs/akce/X4ij9I9RQhmO9BJjHDLFTA-who-cares-statni-opera-vstupenky); sources inspected on 26 Nov list past performances. No future purchasable dates confirmed; retain generic CTA. Live AJSEE feed not verified.

## Event schema

The optional shared `eventSchema` field opts into DanceEvent. The existing renderer's Review / Article selection and generic Event fallback remain unchanged. Canonical entity names and postal address are shared across locales; the visible venue label remains translated. Official venue address (Wilsonova 4, Praha 1, 110 00) and ballet company pages checked against National Theatre website:
- https://www.narodni-divadlo.cz/cs/budovy/statni-opera
- https://www.narodni-divadlo.cz/cs/soubory/balet/o-nas

Verify emitted JSON-LD in all six built HTML pages: Review, itemReviewed DanceEvent, attended date, Place/PostalAddress, PerformingGroup, sameAs, inLanguage, no reviewRating. No promises of Google review stars.

## Media — five original photographs integrated

Editor confirmed permission for the official National Theatre photography. Source: supplied 47-photo ZIP, original JPEGs by Serghei Gherciu. Credit: Photo: Serghei Gherciu © The George Balanchine Trust. No generative editing, no crop; only resizing and WebP compression.

- Cover: 5041 (1600 × 1067, 76,292 bytes); used by review cards, OG and JSON-LD.
- Inline at end of first section: 5031 (1280 × 853, 62,520 bytes), Lagerfeld costumes.
- Inline at end of second section: 5039 (1280 × 853, 59,254 bytes), New York dancers.
- Gallery: both original Oya Canli / AJSEE photos (auditorium and curtain/orchestra), previously integrated.
- All five photos have localized alt text in six languages. Inline photographs lazy-load and reserve aspect ratio via intrinsic dimensions. Curtain-call photographs remain excluded.
- All three new Git blob SHA values verified against local optimized originals.
- Approved article bodies, publication flags and related reading unchanged. Inline placement is optional and does not change other reviews.

## Prepublication checklist

- [x] Approved six-language draft and matching credits/dates.
- [x] Localized CTA data and shared canonical DanceEvent metadata prepared on prep branch.
- [x] Renderer helper and targeted regression tests added.
- [x] Original photos converted locally to WebP.
- [x] Upload five binaries and attach cover, inline and gallery metadata with localized alt texts.
- [x] Editor confirmed permission for official National Theatre photos; separate curtain-call photos excluded.
- [ ] Run npm run reviews:test and verify full Netlify preview build.
- [ ] Check mobile and desktop layouts, image aspect ratios, visible credits, contrast and keyboard access.
- [ ] Before release confirm canonical, hreflang only for existing translations, JSON-LD, no draft in public index or sitemap, no dead CTA/related links.
- [ ] Publish only on explicit approval; then verify six HTTP 200 pages, all images, canonical/hreflang and sitemap on production.

