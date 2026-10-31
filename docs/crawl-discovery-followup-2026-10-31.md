# Crawl discovery follow-up — 31 October 2026

## Evidence

Authenticated Search Console crawl statistics, last updated 30 October, cover
the preceding 90 days: about 1.53k requests, 244 ms average response time,
98% HTTP 200, 1% redirects and 1% 404. Host status reports no availability
problems. Discovery accounts for less than 1% of requests; HTML is 10%, and
page-resource fetching is 82%. These rounded figures do not establish why
Google deprioritized any particular URL.

The sitemap contains 222 canonical pages. Walking initial HTML anchors from
the homepage before this change reached 216. All six guide indexes were
orphans. The 24 pilot details were already reachable, with seven incoming
pages each and depths of one or two links. They were not orphans.

The shared header had 1,872 language buttons across the sitemap pages with
no href. Pilot details already had their own native language links.

Five additional URL inspections found the Czech seating guide indexed,
with a crawl on 31 October at 12:25:09 as displayed in GSC. The Polish,
Hungarian and Slovak seating guides and German Events remained crawled but
not indexed, with last crawls in May. This confirms that the aggregate
indexing report dated 23 October is not a live inventory.

## Changes

- Guide detail breadcrumbs now link to the localized guide index in initial
  HTML, matching the existing runtime breadcrumb and schema hierarchy.
- Shared language options become native anchors based on each page's
  hreflang map. This preserves translated London route names and avoids
  guessing destination URLs.
- Navigation initialization, FAQ deduplication and link localization leave
  explicit language destinations intact. Header menu styles apply to the
  navigation list, so language anchors retain the existing dropdown layout.
- The SEO build check walks the sitemap's HTML link graph and rejects
  unreachable/orphan pages, index-blocked sitemap entries, inconsistent
  canonical URLs and incorrect language destinations.

The resulting graph reaches 222/222 pages with zero orphans. Maximum depth
remains four. Shared language menus contain 1,872 native anchors.

## Validation

793 tests passed across the required prebuild suites, homepage featured
checks and built SEO suites. The Ticketmaster affiliate safety guard passed.
The local frontend build and 155 SEO smoke checks passed with the existing
Colosseum feed snapshot. A full local sync requires the production
COLOSSEUMTICKET_A_BOX setting, which is not installed in this isolated
worktree; the deployment build must run the full configured pipeline.

Focused regressions cover all six FAQ locales, runtime language-link
preservation and translated London alternatives. No partner destination,
tracking parameter, event filter, review content or publication state is
changed.

These fixes remove evidenced discovery weaknesses. They do not guarantee
indexing or explain all 193 discovered-but-not-indexed URLs. Subsequent GSC
checks must distinguish a new crawl, accepted crawl request and actual
indexation.
