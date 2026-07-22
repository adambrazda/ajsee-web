import assert
  from 'node:assert/strict';

import {
  readFile
} from 'node:fs/promises';

import test
  from 'node:test';

async function readProjectFile(
  relativePath
) {
  return readFile(
    new URL(
      '../' + relativePath,
      import.meta.url
    ),
    'utf8'
  );
}

const [
  template,
  entry,
  component,
  reviewBuilder,
  styles
] = await Promise.all([
  readProjectFile(
    'blog-detail.html'
  ),

  readProjectFile(
    'src/blog-detail-entry.js'
  ),

  readProjectFile(
    'src/article-comments.js'
  ),

  readProjectFile(
    'scripts/build-review-details.mjs'
  ),

  readProjectFile(
    'src/styles/partials/_comments.scss'
  )
]);

test(
  'blog template contains only the new comments mount point',
  () => {
    const mountPointCount =
      template.split(
        'id="articleComments"'
      ).length - 1;

    assert.equal(
      mountPointCount,
      1
    );

    for (
      const forbiddenPattern of [
        'data-netlify=',
        'site-comments',
        'get-comments',
        'id="commentForm"',
        'commentPostId',
        'commentPostType',
        'commentLang'
      ]
    ) {
      assert.equal(
        template.includes(
          forbiddenPattern
        ),
        false,
        'Legacy pattern remains: ' +
          forbiddenPattern
      );
    }
  }
);

test(
  'blog detail entry configures comments for blog and review pages',
  () => {
    for (
      const requiredPattern of [
        "from './article-comments.js'",
        'initializeArticleComments',
        'initializeCommentsForPage',
        'document.body.dataset.page',
        "'review-detail'",
        'root.dataset.articleComments',
        'root.dataset.postType',
        'root.dataset.postId',
        'root.dataset.lang',
        "'[data-review-slug]'",
        "query.get('slug')",
        "query.get('id')"
      ]
    ) {
      assert.equal(
        entry.includes(
          requiredPattern
        ),
        true,
        'Missing integration pattern: ' +
          requiredPattern
      );
    }
  }
);

test(
  'review generator preserves the shared comments mount point',
  () => {
    assert.equal(
      reviewBuilder.includes(
        '<!-- COMMENTS: begin'
      ),
      false
    );

    assert.equal(
      template.includes(
        '<!-- COMMENTS: begin -->'
      ),
      true
    );

    assert.equal(
      template.includes(
        '<!-- COMMENTS: end -->'
      ),
      true
    );
  }
);

test(
  'public component exposes accessible responsive integration',
  () => {
    for (
      const requiredPattern of [
        "root.setAttribute(",
        "'aria-labelledby'",
        "root.removeAttribute(",
        "'hidden'",
        'article-comments__field--full',
        'fullWidth:',
        'copy.title +'
      ]
    ) {
      assert.equal(
        component.includes(
          requiredPattern
        ),
        true,
        'Missing component pattern: ' +
          requiredPattern
      );
    }

    assert.equal(
      component.includes(
        '.innerHTML'
      ),
      false
    );

    assert.equal(
      component.includes(
        'insertAdjacentHTML'
      ),
      false
    );
  }
);

test(
  'comments styles cover focus mobile and reduced motion states',
  () => {
    for (
      const requiredPattern of [
        '.article-comments',
        '&__field--full',
        ':focus-visible',
        '@media (max-width: 720px)',
        'prefers-reduced-motion',
        'white-space: pre-wrap'
      ]
    ) {
      assert.equal(
        styles.includes(
          requiredPattern
        ),
        true,
        'Missing style pattern: ' +
          requiredPattern
      );
    }
  }
);


test(
  'microguide template and runtime use the moderated comments integration',
  async () => {
    const [
      microguideTemplate,
      microguideRuntime
    ] = await Promise.all([
      readProjectFile(
        'microguides/index.html'
      ),

      readProjectFile(
        'src/mg-runtime.js'
      )
    ]);

    const mountCount =
      microguideTemplate.split(
        'id="articleComments"'
      ).length - 1;

    assert.equal(
      mountCount,
      1
    );

    for (
      const requiredTemplatePattern of [
        '<section id="articleComments" hidden></section>',
        'src="/src/mg-runtime.js"'
      ]
    ) {
      assert.equal(
        microguideTemplate.includes(
          requiredTemplatePattern
        ),
        true,
        'Missing microguide template pattern: ' +
          requiredTemplatePattern
      );
    }

    for (
      const requiredRuntimePattern of [
        "from './article-comments.js'",
        'initializeArticleComments',
        "$('#articleComments')",
        'comments.dataset.articleComments',
        'comments.dataset.postType',
        "'microguide'",
        'comments.dataset.postId',
        'comments.dataset.lang',
        'comments.hidden'
      ]
    ) {
      assert.equal(
        microguideRuntime.includes(
          requiredRuntimePattern
        ),
        true,
        'Missing microguide runtime pattern: ' +
          requiredRuntimePattern
      );
    }

    for (
      const legacyPattern of [
        'id="commentForm"',
        'site-comments',
        'get-comments',
        'commentPostId',
        'commentPostType',
        'commentLang',
        "$('#comments')"
      ]
    ) {
      assert.equal(
        microguideTemplate.includes(
          legacyPattern
        ) ||
        microguideRuntime.includes(
          legacyPattern
        ),
        false,
        'Legacy microguide pattern remains: ' +
          legacyPattern
      );
    }
  }
);
