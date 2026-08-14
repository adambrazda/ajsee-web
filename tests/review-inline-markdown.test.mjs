import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(
  new URL("../", import.meta.url)
);

function visibleReviewContent(html) {
  const marker =
    '<div class="blog-content review-content">';

  const start = html.indexOf(marker);

  if (start === -1) {
    throw new Error("review-content start not found");
  }

  const end = html.indexOf(
    "</div>",
    start + marker.length
  );

  if (end === -1) {
    throw new Error("review-content end not found");
  }

  return html.slice(
    start + marker.length,
    end
  );
}

function findStructuredBody(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findStructuredBody(entry);

      if (result) {
        return result;
      }
    }

    return "";
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  if (
    typeof value.articleBody === "string"
  ) {
    return value.articleBody;
  }

  if (
    typeof value.reviewBody === "string"
  ) {
    return value.reviewBody;
  }

  for (const child of Object.values(value)) {
    const result =
      findStructuredBody(child);

    if (result) {
      return result;
    }
  }

  return "";
}

function parseJsonLd(html) {
  const match = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );

  assert.ok(
    match,
    "review detail must contain JSON-LD"
  );

  return JSON.parse(match[1]);
}

test(
  "review detail renders safe inline Markdown and clean structured data",
  async () => {
    const build = spawnSync(
      process.execPath,
      ["scripts/build-review-details.mjs"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          REVIEW_PREVIEW: "1"
        },
        encoding: "utf8"
      }
    );

    assert.equal(
      build.status,
      0,
      [
        build.stdout,
        build.stderr
      ].filter(Boolean).join("\n")
    );

    const notreDamePath = path.join(
      ROOT,
      "review-preview",
      "notre-dame-de-paris-poland-2027",
      "index.html"
    );

    const notreDameHtml =
      await readFile(
        notreDamePath,
        "utf8"
      );

    const content =
      visibleReviewContent(
        notreDameHtml
      );

    assert.match(
      content,
      /<em>Notre-Dame de Paris<\/em>/
    );

    assert.match(
      content,
      /<strong>Victor Hugo[^<]*<\/strong>/
    );

    assert.match(
      content,
      /<h2>Zajímavosti o <em>Notre-Dame de Paris<\/em><\/h2>/
    );

    assert.doesNotMatch(
      content,
      /\*Notre-Dame de Paris\*/
    );

    assert.doesNotMatch(
      content,
      /\*\*Victor Hugo/
    );

    assert.match(
      notreDameHtml,
      /Zdroj vizuálu: AJSEE/
    );

    const structuredData =
      parseJsonLd(
        notreDameHtml
      );

    const structuredBody =
      findStructuredBody(
        structuredData
      );

    assert.ok(
      structuredBody,
      "Article JSON-LD must expose articleBody"
    );

    assert.match(
      structuredBody,
      /Notre-Dame de Paris/
    );

    assert.doesNotMatch(
      structuredBody,
      /\*\*/
    );

    assert.doesNotMatch(
      structuredBody,
      /\*Notre-Dame de Paris\*/
    );

    assert.doesNotMatch(
      structuredBody,
      /\*Le Temps des Cathédrales\*/
    );

    /*
     * Shared-renderer regression:
     * existing Les Misérables localized content
     * already contains Markdown bold.
     */
    const lesMisPath = path.join(
      ROOT,
      "review-preview",
      "les-miserables-arena-spectacular-royal-albert-hall-2026",
      "index.html"
    );

    const lesMisHtml =
      await readFile(
        lesMisPath,
        "utf8"
      );

    const lesMisContent =
      visibleReviewContent(
        lesMisHtml
      );

    assert.match(
      lesMisContent,
      /<strong>Les Misérables: The Arena Spectacular<\/strong>/
    );

    assert.doesNotMatch(
      lesMisContent,
      /\*\*Les Misérables: The Arena Spectacular\*\*/
    );
  }
);