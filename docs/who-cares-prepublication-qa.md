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

## Media upload — BLOCKED until binary files are added

Two original supplied Oya photographs optimized locally in WebP (EXIF orientation applied, no crop, metadata stripped, quality 82). Archive contains final repo-relative paths:
- `public/uploads/reviews/who-cares-ballet-prague-2026/state-opera-auditorium-oya-canli.webp` (1280×960, 314294 bytes; original 1000037727.jpg).
- `public/uploads/reviews/who-cares-ballet-prague-2026/state-opera-curtain-orchestra-oya-canli.webp` (900×1200, 262958 bytes; original 1000037725.jpg).

**The binary files are NOT in the repository yet.** Do not add public image references until the files exist. After upload, set root cover to /uploads/reviews/who-cares-ballet-prague-2026/state-opera-auditorium-oya-canli.webp; retain root coverAlt and coverCredit. Set gallery to one entry with image /uploads/reviews/who-cares-ballet-prague-2026/state-opera-curtain-orchestra-oya-canli.webp, credit Oya Canli / AJSEE, and English alt below. Set each translation's galleryAlts to a one-item array from this table, matching image order.

| Language | Gallery alt |
| --- | --- |
| en | Painted curtain, gilded interior of Prague's State Opera and musicians in the orchestra pit. |
| cs | Detail malované opony, zlaceného interiéru Státní opery a hudebníků v orchestřišti. |
| sk | Detail maľovanej opony, pozláteného interiéru pražskej Štátnej opery a hudobníkov v orchestrisku. |
| de | Bemalter Vorhang, vergoldeter Innenraum der Prager Staatsoper sowie Musikerinnen und Musiker im Orchestergraben. |
| pl | Malowana kurtyna, złocone wnętrze praskiej Opery Państwowej i muzycy w kanale orkiestrowym. |
| hu | A prágai Állami Opera festett függönye, aranyozott belső tere és a zenekari árokban ülő zenészek. |

Exclude both curtain-call photographs (#4/#5) from site and social release until publication permission is confirmed. Cast board (#1) for internal verification only.

## Prepublication checklist

- [x] Approved six-language draft and matching credits/dates.
- [x] Localized CTA data and shared canonical DanceEvent metadata prepared on prep branch.
- [x] Renderer helper and targeted regression tests added.
- [x] Original photos converted locally to WebP.
- [ ] Upload two binaries and attach cover/gallery metadata and localized gallery alt texts.
- [ ] Confirm publication permissions for selected photographs; do not add curtain-call images without separate permission.
- [ ] Run npm run reviews:test and verify full Netlify preview build.
- [ ] Check mobile and desktop layouts, image aspect ratios, visible credits, contrast and keyboard access.
- [ ] Before release confirm canonical, hreflang only for existing translations, JSON-LD, no draft in public index or sitemap, no dead CTA/related links.
- [ ] Publish only on explicit approval; then verify six HTTP 200 pages, all images, canonical/hreflang and sitemap on production.

