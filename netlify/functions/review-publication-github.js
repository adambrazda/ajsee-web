const API_BASE =
  'https://api.github.com';

const API_VERSION =
  '2026-03-10';

function createGitHubError(
  code = 'github-api-error'
) {
  const error =
    new Error(code);

  error.status =
    502;

  error.code =
    code;

  return error;
}

function assertToken(
  token
) {
  if (
    typeof token !== 'string' ||
    token.trim() === ''
  ) {
    throw new Error(
      'GitHub token is required'
    );
  }
}

function encodePath(
  value
) {
  return String(value)
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment)
    )
    .join('/');
}

function repositoryUrl({
  owner,
  repo,
  suffix = ''
}) {
  const encodedOwner =
    encodeURIComponent(
      String(owner)
    );

  const encodedRepo =
    encodeURIComponent(
      String(repo)
    );

  return (
    `${API_BASE}/repos/${encodedOwner}/${encodedRepo}${suffix}`
  );
}

async function readResponseJson(
  response
) {
  try {
    return await response.json();
  }
  catch {
    return null;
  }
}

export function createReviewPublicationGitHubClient({
  token,
  fetchFn = fetch
} = {}) {
  assertToken(
    token
  );

  if (
    typeof fetchFn !== 'function'
  ) {
    throw new Error(
      'fetchFn is required'
    );
  }

  const headers = {
    Accept:
      'application/vnd.github+json',

    Authorization:
      `Bearer ${token}`,

    'X-GitHub-Api-Version':
      API_VERSION,

    'User-Agent':
      'AJSEE-review-publication',

    'Content-Type':
      'application/json; charset=utf-8'
  };

  async function request(
    url,
    {
      method = 'GET',
      body
    } = {}
  ) {
    let response;

    try {
      response =
        await fetchFn(
          url,
          {
            method,
            headers,

            ...(body === undefined
              ? {}
              : {
                  body:
                    JSON.stringify(
                      body
                    )
                })
          }
        );
    }
    catch {
      throw createGitHubError();
    }

    const data =
      await readResponseJson(
        response
      );

    if (!response.ok) {
      throw createGitHubError();
    }

    return data;
  }

  async function getBranchHead({
    owner,
    repo,
    branch
  }) {
    const ref =
      `heads/${encodePath(branch)}`;

    const data =
      await request(
        repositoryUrl({
          owner,
          repo,
          suffix:
            `/git/ref/${ref}`
        })
      );

    const sha =
      data?.object?.sha;

    if (
      typeof sha !== 'string' ||
      sha.trim() === ''
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      sha
    };
  }

  async function getFile({
    owner,
    repo,
    path,
    ref
  }) {
    const url =
      new URL(
        repositoryUrl({
          owner,
          repo,
          suffix:
            `/contents/${encodePath(path)}`
        })
      );

    url.searchParams.set(
      'ref',
      String(ref)
    );

    const data =
      await request(
        url
      );

    if (
      !data ||
      data.type !== 'file' ||
      data.encoding !== 'base64' ||
      typeof data.sha !== 'string' ||
      typeof data.content !== 'string'
    ) {
      throw createGitHubError(
        'github-review-file-invalid'
      );
    }

    let content;

    try {
      content =
        Buffer
          .from(
            data.content,
            'base64'
          )
          .toString(
            'utf8'
          );
    }
    catch {
      throw createGitHubError(
        'github-review-file-invalid'
      );
    }

    return {
      sha:
        data.sha,

      content
    };
  }

  async function findOpenPullRequest({
    owner,
    repo,
    base,
    head
  }) {
    const url =
      new URL(
        repositoryUrl({
          owner,
          repo,
          suffix:
            '/pulls'
        })
      );

    url.searchParams.set(
      'state',
      'open'
    );

    url.searchParams.set(
      'base',
      base
    );

    url.searchParams.set(
      'head',
      `${owner}:${head}`
    );

    url.searchParams.set(
      'per_page',
      '10'
    );

    const data =
      await request(
        url
      );

    if (!Array.isArray(data)) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    if (data.length === 0) {
      return null;
    }

    const pullRequest =
      data[0];

    if (
      !Number.isInteger(
        pullRequest?.number
      ) ||
      typeof pullRequest?.html_url !==
        'string'
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      number:
        pullRequest.number,

      url:
        pullRequest.html_url
    };
  }

  async function findOpenPullRequestByHeadPrefix({
    owner,
    repo,
    base,
    headPrefix
  }) {
    if (
      typeof headPrefix !== 'string' ||
      !headPrefix.trim()
    ) {
      throw createGitHubError(
        'github-head-prefix-invalid'
      );
    }

    const url =
      new URL(
        repositoryUrl({
          owner,
          repo,
          suffix:
            '/pulls'
        })
      );

    url.searchParams.set(
      'state',
      'open'
    );

    url.searchParams.set(
      'base',
      base
    );

    url.searchParams.set(
      'per_page',
      '100'
    );

    const data =
      await request(
        url
      );

    if (!Array.isArray(data)) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    const expectedRepository =
      `${owner}/${repo}`
        .toLowerCase();

    const pullRequest =
      data.find(
        (candidate) => {
          const candidateHead =
            candidate?.head?.ref;

          const candidateRepository =
            candidate?.head?.repo?.full_name;

          return (
            typeof candidateHead ===
              'string' &&
            candidateHead.startsWith(
              headPrefix
            ) &&
            typeof candidateRepository ===
              'string' &&
            candidateRepository
              .toLowerCase() ===
              expectedRepository
          );
        }
      );

    if (!pullRequest) {
      return null;
    }

    if (
      !Number.isInteger(
        pullRequest?.number
      ) ||
      typeof pullRequest?.html_url !==
        'string' ||
      typeof pullRequest?.head?.ref !==
        'string'
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      number:
        pullRequest.number,

      url:
        pullRequest.html_url,

      head:
        pullRequest.head.ref
    };
  }

  async function createBranch({
    owner,
    repo,
    branch,
    sha
  }) {
    const data =
      await request(
        repositoryUrl({
          owner,
          repo,
          suffix:
            '/git/refs'
        }),
        {
          method:
            'POST',

          body: {
            ref:
              `refs/heads/${branch}`,

            sha
          }
        }
      );

    if (
      typeof data?.object?.sha !==
        'string'
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      branch,
      sha:
        data.object.sha
    };
  }

  async function updateFile({
    owner,
    repo,
    path,
    branch,
    sha,
    content,
    message
  }) {
    const encodedContent =
      Buffer
        .from(
          content,
          'utf8'
        )
        .toString(
          'base64'
        );

    const data =
      await request(
        repositoryUrl({
          owner,
          repo,
          suffix:
            `/contents/${encodePath(path)}`
        }),
        {
          method:
            'PUT',

          body: {
            message,
            content:
              encodedContent,
            sha,
            branch
          }
        }
      );

    const commitSha =
      data?.commit?.sha;

    if (
      typeof commitSha !== 'string' ||
      commitSha.trim() === ''
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      commitSha
    };
  }

  async function createPullRequest({
    owner,
    repo,
    title,
    body,
    base,
    head
  }) {
    const data =
      await request(
        repositoryUrl({
          owner,
          repo,
          suffix:
            '/pulls'
        }),
        {
          method:
            'POST',

          body: {
            title,
            body,
            base,
            head
          }
        }
      );

    if (
      !Number.isInteger(
        data?.number
      ) ||
      typeof data?.html_url !==
        'string'
    ) {
      throw createGitHubError(
        'github-response-invalid'
      );
    }

    return {
      number:
        data.number,

      url:
        data.html_url
    };
  }

  return {
    getBranchHead,
    getFile,
    findOpenPullRequest,
    findOpenPullRequestByHeadPrefix,
    createBranch,
    updateFile,
    createPullRequest
  };
}
