// src/comments.js
const DICT = {
  cs: {
    zero: 'Zatím žádné komentáře.',
    one:  '1 komentář',
    many: '%d komentářů',
    ago:  (d) => new Date(d).toLocaleString('cs-CZ'),
  },
  en: {
    zero: 'No comments yet.',
    one:  '1 comment',
    many: '%d comments',
    ago:  (d) => new Date(d).toLocaleString('en-GB'),
  },
  de: {
    zero: 'Noch keine Kommentare.',
    one:  '1 Kommentar',
    many: '%d Kommentare',
    ago:  (d) => new Date(d).toLocaleString('de-DE'),
  },
  sk: {
    zero: 'Zatiaľ žiadne komentáre.',
    one:  '1 komentár',
    many: '%d komentárov',
    ago:  (d) => new Date(d).toLocaleString('sk-SK'),
  },
  pl: {
    zero: 'Brak komentarzy.',
    one:  '1 komentarz',
    many: '%d komentarzy',
    ago:  (d) => new Date(d).toLocaleString('pl-PL'),
  },
  hu: {
    zero: 'Még nincs hozzászólás.',
    one:  '1 hozzászólás',
    many: '%d hozzászólás',
    ago:  (d) => new Date(d).toLocaleString('hu-HU'),
  },
};

(function initComments() {
  const listEl = document.getElementById('commentsList');
  const postIdEl = document.getElementById('commentPostId');
  const postTypeEl = document.getElementById('commentPostType');
  const lang = (document.getElementById('commentLang')?.value || document.documentElement.lang || 'cs').toLowerCase();

  if (!listEl || !postIdEl || !postTypeEl) return;

  async function load() {
    const postId = postIdEl.value;
    const postType = postTypeEl.value;
    listEl.innerHTML = '<div class="comments-loading">…</div>';
    try {
      const url = `/api/get-comments?postId=${encodeURIComponent(postId)}&postType=${encodeURIComponent(postType)}`;
      const r = await fetch(url, { cache: 'no-store' });
      const arr = r.ok ? await r.json() : [];
      render(arr);
    } catch {
      render([]);
    }
  }

  function esc(s = '') {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function avatar(name) {
    const ch = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return `<div class="cmt-avatar" aria-hidden="true">${esc(ch)}</div>`;
  }

  function render(items) {
    const d = DICT[lang] || DICT.cs;
    if (!Array.isArray(items) || !items.length) {
      listEl.innerHTML = `<p class="comments-empty">${d.zero}</p>`;
      return;
    }
    const header = (items.length === 1) ? d.one : (d.many || '%d comments').replace('%d', items.length);

    const html = [
      `<h4 class="comments-count">${esc(header)}</h4>`,
      `<ul class="comments-items">`,
      ...items.map(it => {
        const name = esc(it.name || 'Anon');
        const when = esc((d.ago && d.ago(it.created_at)) || it.created_at);
        const website = (it.website && /^https?:\/\//i.test(it.website)) ? `<a href="${esc(it.website)}" rel="nofollow noopener" target="_blank">↗</a>` : '';
        const comment = esc(it.comment || '');
        return `
          <li class="cmt">
            ${avatar(name)}
            <div class="cmt-body">
              <div class="cmt-meta">
                <span class="cmt-name">${name}</span>
                ${website ? `<span class="cmt-dot">•</span> ${website}` : ''}
                <time class="cmt-time" datetime="${esc(it.created_at)}">${when}</time>
              </div>
              <p class="cmt-text">${comment.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>')}</p>
            </div>
          </li>`;
      }),
      `</ul>`
    ].join('');
    listEl.innerHTML = html;
  }

  // udělej přístupné i z inline submit skriptů:
  window.refreshComments = load;
  // první načtení
  load();
})();
