// netlify/functions/get-comments.js
export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*', // pro produkci můžeš nahradit např. 'https://ajsee.cz'
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const SITE_ID = process.env.NETLIFY_SITE_ID;
    const TOKEN =
      process.env.NETLIFY_ACCESS_TOKEN ||
      process.env.NETLIFY_API_TOKEN ||
      process.env.NETLIFY_TOKEN;
    const FORM_ID = process.env.COMMENTS_FORM_ID || null; // volitelné urychlení

    if (!SITE_ID || !TOKEN) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: 'Missing NETLIFY_SITE_ID or NETLIFY_ACCESS_TOKEN/NETLIFY_API_TOKEN' }),
      };
    }

    const qs = event.queryStringParameters || {};
    const postId   = (qs.postId || '').trim();
    const postType = (qs.postType || '').trim();
    const langRaw  = (qs.lang || 'cs').toLowerCase();
    const lang     = langRaw.split(/[-_]/)[0] || 'cs';
    const page     = Math.max(1, parseInt(qs.page || '1', 10));
    const perPage  = Math.min(100, Math.max(1, parseInt(qs.perPage || '100', 10)));

    if (!postId || !postType) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing postId or postType' }) };
    }

    async function api(path) {
      const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status} ${path}: ${txt}`);
      }
      // Vezmeme si i Link hlavičku (na pozdější paging)
      const link = res.headers.get('link') || res.headers.get('Link') || '';
      const data = await res.json();
      return { data, link };
    }

    // Najdi ID formy (pokud není přes env)
    let formId = FORM_ID;
    if (!formId) {
      const { data: forms } = await api(`/sites/${SITE_ID}/forms`);
      const form = Array.isArray(forms) ? forms.find(f => f.name === 'site-comments') : null;
      if (!form) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ items: [], pagination: { page, perPage, hasMore: false } }) };
      }
      formId = form.id;
    }

    // Stáhni submissions pro danou formu
    const { data: subs, link } = await api(`/forms/${formId}/submissions?per_page=${perPage}&page=${page}`);

    // Filtrování + mapování na veřejná data
    const items = (Array.isArray(subs) ? subs : [])
      .filter(s => !s.spam)
      .filter(s => {
        const sLang = String(s.data?.lang || 'cs').toLowerCase().split(/[-_]/)[0] || 'cs';
        return (
          String(s.data?.postId || '') === postId &&
          String(s.data?.postType || '') === postType &&
          sLang === lang
        );
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(s => ({
        id: s.id,
        name: String(s.data?.name || '').slice(0, 120),
        // E-mail a website NEzveřejňujeme (požadavek)
        comment: String(s.data?.comment || '').slice(0, 5000),
        createdAt: s.created_at,
      }));

    // Hrubý odhad hasMore z Link hlavičky (není nutné používat na FE)
    const hasMore = /\brel="?next"?/i.test(link || '');

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ items, pagination: { page, perPage, hasMore } }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: String(err && err.message || err) }),
    };
  }
}
