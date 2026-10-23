import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const itemUrl = new URL(
  "../content/reviews/items/sweeney-todd-prague-2026.json",
  import.meta.url
);

const item = JSON.parse(
  await readFile(itemUrl, "utf8")
);

const expectedCover =
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-prague-2026-cover.webp";

test(
  "Sweeney Todd is staged as an unpublished review",
  () => {
    assert.equal(item.contentType, "review");
    assert.equal(item.status, "approved");
    assert.equal(item.published, false);
    assert.equal(item.publishedAt, "");
    assert.equal(item.performanceDate, "2026-10-03");
    assert.equal(item.featured, false);
    assert.equal(item.rating, null);
  }
);

test(
  "Sweeney Todd temporarily keeps the previous cover until review photography is staged",
  () => {
    assert.equal(item.cover, expectedCover);

    assert.equal(
      item.coverCredit,
      "Visual source: National Theatre Prague"
    );

    assert.match(
      item.coverAlt,
      /meat pie/i
    );

    assert.match(
      item.coverAlt,
      /finger/i
    );

    assert.match(
      item.coverAlt,
      /State Opera/i
    );

    assert.deepEqual(item.gallery, []);
  }
);

test(
  "Sweeney Todd temporary cover remains a valid local WebP asset",
  async () => {
    const coverUrl = new URL(
      `../public${expectedCover}`,
      import.meta.url
    );

    const cover = await readFile(coverUrl);
    const coverStat = await stat(coverUrl);

    assert.equal(
      cover.subarray(0, 4).toString("ascii"),
      "RIFF"
    );

    assert.equal(
      cover.subarray(8, 12).toString("ascii"),
      "WEBP"
    );

    assert.ok(
      coverStat.size > 50_000
    );

    assert.ok(
      coverStat.size < 500_000
    );
  }
);

test(
  "Sweeney Todd records the review transition and incoming Oya Canli photography",
  () => {
    assert.match(
      item.internalNotes,
      /converts the existing published Sweeney Todd preview into a new review/i
    );

    assert.match(
      item.internalNotes,
      /Oya Canli photography was supplied/i
    );

    assert.match(
      item.internalNotes,
      /Do not publish/i
    );
  }
);
