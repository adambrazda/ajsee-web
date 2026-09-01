import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  localizeCoverCredit
} from "../scripts/review-cover-credit.mjs";

const builderSource = await readFile(
  new URL(
    "../scripts/build-review-details.mjs",
    import.meta.url
  ),
  "utf8"
);

test(
  "localizes visual-source credits in every AJSEE language",
  () => {
    const source =
      "Visual source: National Theatre Prague";

    const expected = {
      cs: "Zdroj vizuálu: National Theatre Prague",
      en: "Visual source: National Theatre Prague",
      de: "Bildquelle: National Theatre Prague",
      sk: "Zdroj vizuálu: National Theatre Prague",
      pl: "Źródło grafiki: National Theatre Prague",
      hu: "A vizuál forrása: National Theatre Prague"
    };

    for (
      const [language, localizedCredit]
      of Object.entries(expected)
    ) {
      assert.equal(
        localizeCoverCredit(
          source,
          language
        ),
        localizedCredit
      );
    }
  }
);

test(
  "localizes photo credits in every AJSEE language",
  () => {
    const source =
      "Photo: Oya Canli";

    const expected = {
      cs: "Foto: Oya Canli",
      en: "Photo: Oya Canli",
      de: "Foto: Oya Canli",
      sk: "Foto: Oya Canli",
      pl: "Zdjęcie: Oya Canli",
      hu: "Fotó: Oya Canli"
    };

    for (
      const [language, localizedCredit]
      of Object.entries(expected)
    ) {
      assert.equal(
        localizeCoverCredit(
          source,
          language
        ),
        localizedCredit
      );
    }
  }
);

test(
  "preserves custom credits without a recognized prefix",
  () => {
    assert.equal(
      localizeCoverCredit(
        "Courtesy of the production",
        "cs"
      ),
      "Courtesy of the production"
    );
  }
);

test(
  "uses English for an unsupported language",
  () => {
    assert.equal(
      localizeCoverCredit(
        "Visual source: National Theatre Prague",
        "fr"
      ),
      "Visual source: National Theatre Prague"
    );
  }
);

test(
  "returns an empty string for a missing credit",
  () => {
    assert.equal(
      localizeCoverCredit(
        "",
        "cs"
      ),
      ""
    );

    assert.equal(
      localizeCoverCredit(
        null,
        "cs"
      ),
      ""
    );
  }
);

test(
  "review detail builder applies the localization helper",
  () => {
    assert.match(
      builderSource,
      /import\s+\{\s*localizeCoverCredit\s*\}/
    );

    assert.match(
      builderSource,
      /localizeCoverCredit\(review\.coverCredit,\s*lang\)/
    );

    assert.doesNotMatch(
      builderSource,
      /const coverCredit = review\.coverCredit \|\| ''/
    );
  }
);

test(
  "review detail builder localizes gallery credits and labels",
  () => {
    assert.match(
      builderSource,
      /localizeCoverCredit\(item\.credit,\s*lang\)/
    );

    assert.match(
      builderSource,
      /sk:\s*['"]Fotogaléria['"]/
    );

    assert.match(
      builderSource,
      /pl:\s*['"]Galeria zdjęć['"]/
    );

    assert.match(
      builderSource,
      /hu:\s*['"]Fotógaléria['"]/
    );
  }
);
