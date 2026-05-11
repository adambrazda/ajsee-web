// netlify/functions/get-comments.js
const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

function normalizeLang(value, fallback = 'cs') {
  const lang = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.includes(lang) ? lang : fallback;
}

function normalizeCommentPostId(value = '') {
  let pathname = String(value || '').trim();

  try {
    pathname = new URL(pathname, 'https://ajsee.cz').pathname;
  } catch {
    pathname = pathname.split('?')[0].split('#')[0];
  }

  pathname = pathname
    .replace(/^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i, '')
    .replace(/\/+/g, '/');

  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (pathname !== '/' && !pathname.endsWith('/')) pathname += '/';

  return pathname;
}

function jsonResponse(statusCode, cors, body) {
  return {
    statusCode,
    headers: cors,
    body: JSON.stringify(body),
  };
}

function emptyCommentsResponse(cors, page = 1, perPage = 100, extra = {}) {
  return jsonResponse(200, cors, {
    items: [],
    pagination: { page, perPage, hasMore: false },
    ...extra,
  });
}

export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, cors, { error: 'Method Not Allowed' });
  }

  const qs = event.queryStringParameters || {};
  const postId = normalizeCommentPostId(qs.postId || '');
  const postType = String(qs.postType || '').trim();
  const lang = normalizeLang(qs.lang || 'cs');
  const page = Math.max(1, parseInt(qs.page || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(qs.perPage || '100', 10)));

  if (!postId || !postType) {
    return jsonResponse(400, cors, { error: 'Missing postId or postType' });
  }

  try {
    const SITE_ID = process.env.NETLIFY_SITE_ID;
    const TOKEN =
      process.env.NETLIFY_ACCESS_TOKEN ||
      process.env.NETLIFY_API_TOKEN ||
      process.env.NETLIFY_TOKEN;
    const FORM_ID = process.env.COMMENTS_FORM_ID || null;

    // Komentáře nejsou kritická funkce stránky. Pokud chybí env proměnné,
    // vracíme prázdný seznam místo 500, aby frontend negeneroval chyby v konzoli.
    if (!SITE_ID || !TOKEN) {
      return emptyCommentsResponse(cors, page, perPage, {
        degraded: true,
        reason: 'comments-api-not-configured',
      });
    }

    async function api(path) {
      const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status} ${path}: ${txt}`);
      }

      const link = res.headers.get('link') || res.headers.get('Link') || '';
      const data = await res.json();

      return { data, link };
    }

    let formId = FORM_ID;

    if (!formId) {
      const { data: forms } = await api(`/sites/${SITE_ID}/forms`);
      const form = Array.isArray(forms)
        ? forms.find((item) => item.name === 'site-comments')
        : null;

      if (!form) {
        return emptyCommentsResponse(cors, page, perPage);
      }

      formId = form.id;
    }

    const { data: submissions, link } = await api(
      `/forms/${formId}/submissions?page=${page}&per_page=${perPage}`
    );

    const items = (Array.isArray(submissions) ? submissions : [])
      .filter((submission) => !submission.spam)
      .filter((submission) => {
        const submissionLang = normalizeLang(submission.data?.lang || 'cs');

        return (
          normalizeCommentPostId(submission.data?.postId || '') === postId &&
          String(submission.data?.postType || '') === postType &&
          submissionLang === lang
        );
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((submission) => ({
        id: submission.id,
        name: String(submission.data?.name || '').slice(0, 120),
        comment: String(submission.data?.comment || '').slice(0, 5000),
        createdAt: submission.created_at,
      }));

    return jsonResponse(200, cors, {
      items,
      pagination: {
        page,
        perPage,
        hasMore: /rel="next"/i.test(link),
      },
    });
  } catch {
    return emptyCommentsResponse(cors, page, perPage, {
      degraded: true,
      reason: 'comments-api-error',
    });
  }
}
