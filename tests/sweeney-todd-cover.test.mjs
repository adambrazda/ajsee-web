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
  "Sweeney Todd remains an unpublished theatre preview",
  () => {
    assert.equal(item.contentType, "preview");
    assert.equal(item.status, "approved");
    assert.equal(item.published, false);
    assert.equal(item.featured, false);
    assert.equal(item.rating, null);
  }
);

test(
  "Sweeney Todd has the approved cover metadata",
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
  "Sweeney Todd cover is a valid local WebP asset",
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
  "Sweeney Todd records the visual source",
  () => {
    assert.match(
      item.internalNotes,
      /Oya Canli/
    );

    assert.match(
      item.internalNotes,
      /National Theatre Prague/
    );

    assert.match(
      item.internalNotes,
      /narodni-divadlo\.cz/
    );

    assert.match(
      item.internalNotes,
      /gallery is intentionally empty/
    );
  }
);
