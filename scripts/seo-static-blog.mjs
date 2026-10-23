// Check the rendered static blog inventory against the cards expected for this build.
// A preview may include editorial drafts; production must match its published-only index.
export function checkStaticBlogCards(html, expectedCards) {
  const expected = expectedCards.map((card) => String(card.slug));
  const rendered = [...String(html).matchAll(/\bdata-slug="([^"]+)"/g)].map((match) => match[1]);
  const expectedSlugs = new Set(expected);
  const renderedSlugs = new Set(rendered);
  const missing = expected.filter((slug) => !renderedSlugs.has(slug));
  const unexpected = rendered.filter((slug) => !expectedSlugs.has(slug));

  return {
    ok: expected.length > 0 &&
      expected.length === expectedSlugs.size &&
      rendered.length === expected.length &&
      rendered.length === renderedSlugs.size &&
      missing.length === 0 &&
      unexpected.length === 0,
    expectedCount: expected.length,
    renderedCount: rendered.length,
    missing,
    unexpected,
  };
}
