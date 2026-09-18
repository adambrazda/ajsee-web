import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(
  new URL("../", import.meta.url)
);

test(
  "review detail supports one optional accessible inline video",
  async () => {
    const builder = await readFile(
      path.join(
        ROOT,
        "scripts",
        "build-review-details.mjs"
      ),
      "utf8"
    );

    const styles = await readFile(
      path.join(
        ROOT,
        "src",
        "styles",
        "partials",
        "blog-page.scss"
      ),
      "utf8"
    );

    /*
     * Reviews use one explicit editorial marker.
     * It must never open arbitrary HTML injection
     * inside review Markdown.
     */
    assert.match(
      builder,
      /REVIEW_VIDEO_MARKER\s*=\s*['"]\[\[review-video\]\]['"]/
    );

    assert.match(
      builder,
      /function\s+buildReviewVideoHtml\s*\(/
    );

    /*
     * Caption is localized with the article.
     */
    assert.match(
      builder,
      /translation\?\.videoCaption/
    );

    /*
     * The generated player must remain user-controlled
     * and suitable for mobile browsers.
     */
    assert.match(
      builder,
      /<video[\s\S]*?\bcontrols\b[\s\S]*?\bplaysinline\b[\s\S]*?preload=["']metadata["']/i
    );

    assert.match(
      builder,
      /<source[\s\S]*?type=["']video\/mp4["']/i
    );

    assert.doesNotMatch(
      builder,
      /<video[^>]*\bautoplay\b/i
    );

    /*
     * The editorial marker must be removed before
     * structured article/review text is produced.
     */
    assert.match(
      builder,
      /markdownToPlainText[\s\S]*?REVIEW_VIDEO_MARKER/
    );

    /*
     * Video is responsive and covered by the repository style guard.
     */
    assert.match(
      styles,
      /\.review-video\s*\{/
    );

    assert.match(
      styles,
      /\.review-video__player\s*\{[\s\S]*?width:\s*100%/
    );

  }
);
