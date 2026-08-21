import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script =
  await readFile(
    new URL(
      '../public/admin/publication/publication.js',
      import.meta.url
    ),
    'utf8'
  );

test(
  'publication admin uses ephemeral Identity JWT for status requests',
  () => {
    assert.match(
      script,
      /netlifyIdentity/
    );

    assert.match(
      script,
      /\.jwt\s*\(\s*\)/
    );

    assert.match(
      script,
      /\/api\/review-publication-admin/
    );

    assert.match(
      script,
      /Authorization/
    );

    assert.match(
      script,
      /Bearer/
    );

    assert.match(
      script,
      /method\s*:\s*["']GET["']/
    );
  }
);

test(
  'publication admin does not persist authentication or inject API content as HTML',
  () => {
    assert.doesNotMatch(
      script,
      /localStorage/
    );

    assert.doesNotMatch(
      script,
      /sessionStorage/
    );

    assert.doesNotMatch(
      script,
      /\.innerHTML/
    );

    assert.doesNotMatch(
      script,
      /insertAdjacentHTML/
    );

    assert.match(
      script,
      /\.textContent/
    );
  }
);

test(
  'publication preparation uses an authenticated POST and prevents duplicate submission',
  () => {
    assert.match(
      script,
      /method\s*:\s*["']POST["']/
    );

    assert.match(
      script,
      /["']Content-Type["']\s*:\s*["']application\/json["']/
    );

    assert.match(
      script,
      /Authorization\s*:\s*`Bearer \$\{token\}`/
    );

    assert.match(
      script,
      /JSON\.stringify\s*\(\s*\{[\s\S]*?action\s*:\s*["']prepare["'][\s\S]*?slug[\s\S]*?\}\s*\)/
    );

    assert.match(
      script,
      /prepareButton\.addEventListener\s*\(\s*["']click["']/
    );

    assert.match(
      script,
      /prepareButton\.disabled\s*=\s*true/
    );

    assert.match(
      script,
      /prepareButton\.disabled\s*=\s*false/
    );

    assert.match(
      script,
      /if\s*\(\s*preparationInFlight\s*\)\s*\{\s*return;/
    );

    assert.match(
      script,
      /if\s*\(\s*approvedSlug\s*!==\s*slug\s*\)/
    );

    assert.match(
      script,
      /currentPreparationId\s*!==\s*requestId/
    );

    assert.match(
      script,
      /slugInput\.disabled\s*=\s*true/
    );

    assert.match(
      script,
      /slugInput\.disabled\s*=\s*false/
    );

    assert.match(
      script,
      /slugInput\.addEventListener\s*\(\s*["']input["'][\s\S]*?approvedSlug\s*=\s*null;[\s\S]*?\+\+requestId/
    );

    assert.match(
      script,
      /existing/
    );

    assert.match(
      script,
      /pullRequest/
    );
  }
);


test(
  'publication admin preserves Czech UTF-8 status text',
  () => {
    assert.match(
      script,
      /P\u0159ihl\u00e1\u0161en\u00ed ov\u011b\u0159eno\./
    );

    assert.match(
      script,
      /Obsah je ji\u017e zve\u0159ejn\u011bn\u00fd\./
    );

    assert.match(
      script,
      /Obsah je schv\u00e1len\u00fd a p\u0159ipraven\u00fd/
    );

    assert.match(
      script,
      /Netlify Identity se nepoda\u0159ilo na\u010d\u00edst\./
    );

    assert.doesNotMatch(
      script,
      /p\?ihl|ov\?\?|zve\?ejn|nepoda\?ilo|na\?\?st/i
    );
  }
);
