// netlify/functions/get-comments.js
export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',           // zvaž omezení na https://ajsee.cz
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  try {
    const SITE_ID = process.env.NETLIFY_SITE_ID;
    const TOKEN   = process.env.NETLIFY_API_TOKEN;
    const FORM_ID = process.env.COMMENTS_FORM_ID || null; // volitelné urychlení

    if (!SITE_ID || !TOKEN) {
      return { statusCode: 500, headers: cors, body: 'Missing NETLIFY_SITE_ID or NETLIFY_API_TOKEN' };
    }

    const { postId = '', postType = '' } = event.queryStringParameters || {};
    if (!postId || !postType) {
      return { statusCode: 400, headers: cors, body: 'Missing postId or postType' };
    }

    async function api(path) {
      const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      return res.json();
    }

    let formId = FORM_ID;
    if (!formId) {
      // najdi form "site-comments"
      const forms = await api(`/sites/${SITE_ID}/forms`);
      const form = forms.find(f => f.name === 'site-comments');
      if (!form) return { statusCode: 404, headers: cors, body: 'Form site-comments not found' };
      formId = form.id;
    }

    // načti submissions (prvních 100; případně stránkuj per_page & page)
    const subs = await api(`/forms/${formId}/submissions?per_page=100`);
    // filtr + map
    const filtered = subs
      .filter(s => s.data && s.data.postId === postId && s.data.postType === postType && !s.spam)
      .map(s => ({
        id: s.id,
        name: String(s.data.name || '').slice(0, 120),
        website: String(s.data.website || ''),
        comment: String(s.data.comment || ''),
        created_at: s.created_at
      }))
      // seřadit od nejstaršího
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(filtered) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: `Error: ${err.message}` };
  }
}
