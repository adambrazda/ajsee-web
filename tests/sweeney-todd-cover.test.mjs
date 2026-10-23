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
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-cover.avif";

const expectedGallery = [
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-interior.avif",
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-curtain-call.avif",
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-orchestra.avif",
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-oya-canli.avif",
  "/uploads/reviews/sweeney-todd-prague-2026/sweeney-todd-state-opera-poster.avif"
];

test(
  "Sweeney Todd remains a safely unpublished review",
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
  "Sweeney Todd uses Oya Canli photography for the cover and gallery",
  () => {
    assert.equal(item.cover, expectedCover);
    assert.equal(item.coverCredit, "Photo: Oya Canli");

    assert.match(item.coverAlt, /cast of Sweeney Todd/i);
    assert.match(item.coverAlt, /State Opera/i);
    assert.match(item.coverAlt, /orchestra/i);

    assert.equal(item.gallery.length, 5);

    assert.deepEqual(
      item.gallery.map((image) => image.image),
      expectedGallery
    );

    assert.equal(
      new Set(item.gallery.map((image) => image.image)).size,
      5
    );

    for (const image of item.gallery) {
      assert.equal(image.credit, "Photo: Oya Canli");
      assert.ok(image.alt.length > 40);
      assert.match(image.image, /\.avif$/);
    }
  }
);

test(
  "Sweeney Todd review photography is valid local AVIF",
  async () => {
    const imagePaths = [
      expectedCover,
      ...expectedGallery
    ];

    for (const imagePath of imagePaths) {
      const imageUrl = new URL(
        `../public${imagePath}`,
        import.meta.url
      );

      const image = await readFile(imageUrl);
      const imageStat = await stat(imageUrl);

      assert.equal(
        image.subarray(4, 8).toString("ascii"),
        "ftyp",
        `${imagePath} is not an ISO BMFF/AVIF file`
      );

      const brands = image
        .subarray(8, 32)
        .toString("ascii");

      assert.match(
        brands,
        /avif|avis/,
        `${imagePath} does not advertise an AVIF brand`
      );

      assert.ok(
        imageStat.size > 20_000,
        `${imagePath} is unexpectedly small`
      );

      assert.ok(
        imageStat.size < 300_000,
        `${imagePath} is unexpectedly large`
      );
    }
  }
);

test(
  "Sweeney Todd records the photography transition",
  () => {
    assert.match(
      item.internalNotes,
      /Oya Canli original photography/
    );

    assert.match(
      item.internalNotes,
      /five-photo gallery/
    );

    assert.match(
      item.internalNotes,
      /Do not publish/i
    );
  }
);
