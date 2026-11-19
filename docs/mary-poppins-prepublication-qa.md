# Mary Poppins — pre-publication QA (2026-11-19)

## Publication state — DO NOT PUBLISH YET

- Source: `content/reviews/items/mary-poppins-from-film-to-west-end-stage.json`
- `status: draft`, `published: false`, `publishedAt: ""`
- Content type `article`, category `theatre`, author Oya Canli.
- All six complete localizations approved and stored: `en`, `cs`, `sk`, `de`, `pl`, `hu`.
- Five H2 chapters per localization. Localized SEO titles, descriptions, cover alt, two gallery alts and editorial CTAs are present.
- Source currently uses remote image URLs. These are **not** ready for publication. Existing review tests require published images to exist under `public/`.
- Do not change publication flags manually. Use the validated `npm run reviews:publish -- mary-poppins-from-film-to-west-end-stage` only after all media is locally stored and all tests pass, and only when editorial release is explicitly authorized.

## Media: source verification and remaining work

The editorial owner confirms AJSEE may use the production photos on the website and Instagram. Source identities and credits were cross-checked against official theatre/production reporting. Source photos must still be acquired as original bytes, optimized, and committed to this repository.

| Asset | Source URL (current draft) | Verified subject | Credit |
| --- | --- | --- | --- |
| Cover | https://d28054jbxkgsih.cloudfront.net/uploads/productions/Marty-Poppins/Stefanie-Jones-as-Mary-Poppins.-Photo-by-Danny-Kaan.jpg?v=1768913960 | Stefanie Jones as Mary Poppins, umbrella and bag, stage scene | Photo: Danny Kaan / Cameron Mackintosh and Disney Theatrical Group |
| Gallery 1 | https://images.mayflower.org.uk/uploads/2025/02/6-scaled.jpg | Bert and chimney sweeps performing on purple-lit stage | Photo: Danny Kaan / Mary Poppins UK & Ireland Tour |
| Gallery 2 | https://chorusbox.blog/wp-content/uploads/2024/09/Stefanie-Jones-Jack-Chambers-Florence-Swann-as-Jane-William-Stafford-as-Michael.-By-Matt-Crockett.jpg | Mary, Bert, Jane and Michael on stylized London rooftops | Photo: Matt Crockett / Mary Poppins UK & Ireland Tour |

References: 
- https://www.mayflower.org.uk/whats-on/mary-poppins-2025/ (Danny Kaan gallery credits).
- https://chorusbox.blog/full-casting-announced-for-mary-poppins-uk-and-ireland-tour/ (Matt Crockett publicity image).
- https://www.cameronmackintosh.com/news/view/cameron-mackintosh-disney-theatrical-group-announce-the-2024-2025-uk-ireland-tour-of-the-classic-multi-award-winning-musical-mary-poppins (producer/cast).

### Asset processing checklist

1. Download originals into a **temporary workspace**, verify subject/crop/photographer, and check actual pixel dimensions and integrity.
2. Encode each image into AVIF/WebP with metadata removed, sensible responsive sizes (e.g. 800 and 1600 px for cover, 700/1200 px for gallery); retain original aspect ratios, without making up detail or stretching.
3. Commit files under `public/uploads/reviews/mary-poppins-from-film-to-west-end-stage/`; use descriptive lowercase filenames and no external image hotlinks. Verify each local path exists.
4. Update `cover` and `gallery[].image` in the JSON and keep photographer credits intact.
5. Check EN/CZ/SK/DE/PL/HU `coverAlt` and `galleryAlts` against final image selection. Do not claim the `Step in Time` number in photo alt text without production identification.
6. Verify cover image dimensions are emitted at build time, gallery has stable layout, and the mobile / desktop presentation is visually correct.
7. If a separate 1200 × 630 Open Graph crop is needed, add it with appropriate code and tests; the existing renderer presently uses the same `cover` URL for OG.

## URL, on-page links and analytics

- Same slug across all languages; Czech canonical route `/reviews/<slug>/`, other routes `/<lang>/reviews/<slug>/`.
- `x-default` is Czech under current editorial routing convention.
- Internal CTA destinations match `shared/london-musicals-routes.json`:
  - cs: `/londynske-muzikaly/`
  - en: `/en/london-musicals/`
  - sk: `/sk/londynske-muzikaly/`
  - de: `/de/london-musicals/`
  - pl: `/pl/londynskie-musicale/`
  - hu: `/hu/londoni-musicalek/`
- `scripts/review-cta-url.mjs` strips incoming UTM parameters on first-party AJSEE destinations and avoids adding new UTM data to them. External providers retain attribution; ColosseumTicket redirect handling remains.
- Internal article CTAs open in same tab without `rel="sponsored"`. Tests: `tests/review-cta-url.test.mjs`.
- `relatedSlugs` points to `my-fair-lady-70-years-musical-legend`. The generator outputs a localized **Related reading** block once both articles are published; it is not an inline link in the Julie Andrews paragraph.
- Existing CMS schema uses Article, not BlogPosting; Open Graph title/description currently reuse SEO title/description.
- Drafts are excluded from production review JSON, listing, static review pages, and sitemap. Deploy-preview drafts may appear only in noindex preview builds.

## Required final acceptance gate

- [x] All 6 editorial translations approved and stored
- [x] Localized SEO metadata and image descriptions included
- [x] Photographer/source attribution identified
- [x] Original image URLs checked visually against subject
- [x] Internal CTA link handling fixed; targeted local helper tests passed
- [x] Publication remains disabled
- [ ] Source photographs re-hosted as optimized local assets (blocking)
- [ ] Full `npm run reviews:test` + `npm run build` executed against complete repo (not performed in current environment)
- [ ] Deployed private preview visually checked at 360/390/768/1440 px (not performed)
- [ ] Real Netlify production deploy and release checks verified (not performed)
- [ ] Explicit permission to publish granted (not granted)

**Release remains blocked** until images, builds, and final visual QA are complete. Nothing in this document constitutes authorization to publish.
