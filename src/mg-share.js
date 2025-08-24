// /src/mg-share.js
export function renderSharePanel({ slug, language, title, container }) {
  if (!container) return;

  // Vyčisti případný předchozí render (prevence duplicit při soft-navigaci / re-renderu)
  const prev = container.querySelector('.mg-share');
  if (prev) prev.remove();

  const shareUrl = new URL(
    `/microguides/?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(language)}`,
    window.location.origin
  ).toString();

  // i18n helper s fallbacky (když loader vrátí původní klíč nebo prázdno)
  const i18n = window.i18n ? window.i18n(language) : (k) => k;
  const t = (key, fallback) => {
    try {
      const v = i18n(key);
      return !v || v === key ? fallback : v;
    } catch { return fallback; }
  };

  const labelShare    = t('mg.share.label',    'Share');
  const labelTwitter  = t('mg.share.twitter',  'Share on X');
  const labelFacebook = t('mg.share.facebook', 'Share on Facebook');
  const labelCopy     = t('mg.share.copy',     'Copy link');
  const labelCopied   = t('mg.share.copied',   'Link copied');
  const labelSystem   = t('mg.share.system',   'Share…');

  const el = document.createElement('div');
  el.className = 'mg-share';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', labelShare);

  const btns = document.createElement('div');
  btns.className = 'mg-share__btns';

  const label = document.createElement('span');
  label.className = 'mg-share__label';
  label.textContent = labelShare;

  // --- Analytics helper
  function sendAnalytics(network) {
    const payload = { event: 'mg_share_click', network, slug, language };
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      window.dataLayer.push(payload);
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'mg_share_click', { network, slug, language });
    }
  }

  // --- Copy helper (se secure + non-secure fallbackem)
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast(labelCopied);
    } catch {
      // poslední možnost
      window.prompt(labelCopy, text);
    }
  }

  // --- Toast
  let toastTimeout = null;
  function toast(text) {
    let tEl = el.querySelector('.mg-share__toast');
    if (!tEl) {
      tEl = document.createElement('div');
      tEl.className = 'mg-share__toast';
      tEl.setAttribute('role', 'status');
      tEl.setAttribute('aria-live', 'polite');
      tEl.setAttribute('aria-atomic', 'true');
      el.appendChild(tEl);
    }
    tEl.textContent = text;
    tEl.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => tEl.classList.remove('is-visible'), 1800);
  }

  // --- Systémové sdílení (Web Share API), jen pokud je k dispozici
  if (navigator.share) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mg-share__btn mg-share__btn--system';
    b.setAttribute('aria-label', labelSystem);
    b.innerHTML = systemIcon();
    b.addEventListener('click', async () => {
      try {
        await navigator.share({ title: title || document.title, url: shareUrl });
        sendAnalytics('system');
      } catch { /* zavření je OK */ }
    });
    btns.appendChild(b);
  }

  // --- X / Twitter
  const xUrl = new URL('https://twitter.com/intent/tweet');
  xUrl.searchParams.set('url', shareUrl);
  xUrl.searchParams.set('text', title || document.title || '');
  const aX = document.createElement('a');
  aX.href = xUrl.toString();
  aX.target = '_blank';
  aX.rel = 'noopener noreferrer';
  aX.className = 'mg-share__btn';
  aX.setAttribute('aria-label', labelTwitter);
  aX.innerHTML = xIcon();
  aX.addEventListener('click', () => sendAnalytics('x'));
  btns.appendChild(aX);

  // --- Facebook
  const fbUrl = new URL('https://www.facebook.com/sharer/sharer.php');
  fbUrl.searchParams.set('u', shareUrl);
  const aFb = document.createElement('a');
  aFb.href = fbUrl.toString();
  aFb.target = '_blank';
  aFb.rel = 'noopener noreferrer';
  aFb.className = 'mg-share__btn';
  aFb.setAttribute('aria-label', labelFacebook);
  aFb.innerHTML = facebookIcon();
  aFb.addEventListener('click', () => sendAnalytics('facebook'));
  btns.appendChild(aFb);

  // --- Copy link
  const bCopy = document.createElement('button');
  bCopy.type = 'button';
  bCopy.className = 'mg-share__btn';
  bCopy.setAttribute('aria-label', labelCopy);
  bCopy.innerHTML = copyIcon();
  bCopy.addEventListener('click', async () => {
    await copyToClipboard(shareUrl);
    sendAnalytics('copy');
  });
  btns.appendChild(bCopy);

  el.appendChild(label);
  el.appendChild(btns);
  container.appendChild(el);

  // --- SVG ikony (inline, bez závislostí)
  function xIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M18.9 3H21l-6.54 7.47L22 21h-5.98l-4.68-5.67L5.9 21H3l7.03-8.03L2 3h6.1l4.22 5.11L18.9 3Zm-2.1 16h1.65L8.27 5H6.57l10.23 14Z"/></svg>`;
  }
  function facebookIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.04 5.66 21.2 10.44 22v-7.02H7.9v-2.92h2.54V9.41c0-2.52 1.49-3.92 3.77-3.92 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.55v1.86h2.77l-.44 2.92h-2.33V22C18.34 21.2 22 17.04 22 12.06Z"/></svg>`;
  }
  function copyIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg>`;
  }
  function systemIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M13 5.08 15.59 7.7 17 6.3 12 1.3 7 6.3l1.41 1.41L11 5.08V14h2V5.08ZM5 10H3v9c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-9h-2v9H5v-9Z"/></svg>`;
  }

  return el;
}
