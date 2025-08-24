// /src/mg-share.js
export function renderSharePanel({ slug, language, title, container, variant = 'block' }) {
  if (!container) return;

  // Lokální (namespacované) styly – ochrana proti globálnímu svg { width:100% } apod.
  ensureShareStyles();

  // Vyčisti případný předchozí render (prevence duplicit při soft-navigaci / re-renderu)
  const prev = container.querySelector('.mg-share');
  if (prev) prev.remove();

  const shareUrl = new URL(
    `/microguides/?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(language)}`,
    window.location.origin
  ).toString();

  // i18n helper s fallbacky
  const i18n = window.i18n ? window.i18n(language) : (k) => k;
  const t = (key, fallback) => {
    try { const v = i18n(key); return !v || v === key ? fallback : v; }
    catch { return fallback; }
  };

  const labelShare    = t('mg.share.label',    'Share');
  const labelTwitter  = t('mg.share.twitter',  'Share on X');
  const labelFacebook = t('mg.share.facebook', 'Share on Facebook');
  const labelLinkedIn = t('mg.share.linkedin', 'Share on LinkedIn');
  const labelWhatsApp = t('mg.share.whatsapp', 'Share on WhatsApp');
  const labelCopy     = t('mg.share.copy',     'Copy link');
  const labelCopied   = t('mg.share.copied',   'Link copied');
  const labelSystem   = t('mg.share.system',   'Share…');

  const el = document.createElement('div');
  const isInline = variant === 'inline';
  el.className = 'mg-share' + (isInline ? ' mg-share--inline' : '');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', labelShare);

  const btns = document.createElement('div');
  btns.className = 'mg-share__btns';

  // Label renderuj jen v „block“ variantě (pod hero); v inline je skrytý
  if (!isInline) {
    const label = document.createElement('span');
    label.className = 'mg-share__label';
    label.textContent = labelShare;
    el.appendChild(label);
  }

  // --- Analytics helper
  function sendAnalytics(network) {
    const payload = { event: 'mg_share_click', network, slug, language };
    if (window.dataLayer?.push) window.dataLayer.push(payload);
    if (typeof window.gtag === 'function') window.gtag('event', 'mg_share_click', payload);
  }

  // --- Copy helper
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
    } catch { window.prompt(labelCopy, text); }
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

  // --- LinkedIn
  const liUrl = new URL('https://www.linkedin.com/sharing/share-offsite/');
  liUrl.searchParams.set('url', shareUrl);
  const aLi = document.createElement('a');
  aLi.href = liUrl.toString();
  aLi.target = '_blank';
  aLi.rel = 'noopener noreferrer';
  aLi.className = 'mg-share__btn';
  aLi.setAttribute('aria-label', labelLinkedIn);
  aLi.innerHTML = linkedinIcon();
  aLi.addEventListener('click', () => sendAnalytics('linkedin'));
  btns.appendChild(aLi);

  // --- WhatsApp
  const waUrl = new URL('https://wa.me/');
  waUrl.searchParams.set('text', `${title || document.title || ''} ${shareUrl}`);
  const aWa = document.createElement('a');
  aWa.href = waUrl.toString();
  aWa.target = '_blank';
  aWa.rel = 'noopener noreferrer';
  aWa.className = 'mg-share__btn';
  aWa.setAttribute('aria-label', labelWhatsApp);
  aWa.innerHTML = whatsappIcon();
  aWa.addEventListener('click', () => sendAnalytics('whatsapp'));
  btns.appendChild(aWa);

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

  el.appendChild(btns);
  container.appendChild(el);

  // --- SVG ikony
  function xIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M18.9 3H21l-6.54 7.47L22 21h-5.98l-4.68-5.67L5.9 21H3l7.03-8.03L2 3h6.1l4.22 5.11L18.9 3Zm-2.1 16h1.65L8.27 5H6.57l10.23 14Z"/></svg>`;
  }
  function facebookIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.04 5.66 21.2 10.44 22v-7.02H7.9v-2.92h2.54V9.41c0-2.52 1.49-3.92 3.77-3.92 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.55v1.86h2.77l-.44 2.92h-2.33V22C18.34 21.2 22 17.04 22 12.06Z"/></svg>`;
  }
  function linkedinIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM.5 8h4V23h-4V8Zm7.5 0h3.8v2.05h.05c.53-.95 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.09V23h-4v-6.67c0-1.59-.03-3.64-2.22-3.64-2.22 0-2.56 1.73-2.56 3.53V23h-4V8Z"/></svg>`;
  }
  function whatsappIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M20.52 3.48A11.94 11.94 0 0 0 12.01 0C5.39 0 .02 5.37.02 11.99c0 2.12.55 4.18 1.61 6.01L0 24l6.16-1.6A12.03 12.03 0 0 0 12 24c6.62 0 12-5.37 12-12 0-3.2-1.24-6.21-3.48-8.52ZM12 21.5c-1.87 0-3.69-.5-5.28-1.44l-.38-.23-3.04.79.81-2.97-.25-.4A9.5 9.5 0 1 1 21.5 12 9.5 9.5 0 0 1 12 21.5Zm5.3-7.17c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.15-.19.29-.74.93-.9 1.12-.17.2-.33.22-.62.08-.29-.15-1.22-.45-2.33-1.45-.86-.77-1.44-1.7-1.61-1.98-.17-.29-.02-.45.13-.6.13-.13.29-.33.43-.5.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.52-.07-.15-.64-1.53-.88-2.1-.23-.56-.47-.49-.64-.49h-.55c-.19 0-.5.07-.77.37-.26.29-1 1-1 2.45 0 1.44 1.03 2.83 1.17 3.03.15.2 2.02 3.08 4.89 4.31 2.87 1.22 2.87.81 3.38.76.52-.05 1.7-.69 1.94-1.36.24-.67.24-1.25.17-1.36-.07-.11-.26-.18-.55-.33Z"/></svg>`;
  }
  function copyIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg>`;
  }
  function systemIcon() {
    return `<svg viewBox="0 0 24 24" class="mg-share__icon" aria-hidden="true"><path d="M13 5.08 15.59 7.7 17 6.3 12 1.3 7 6.3l1.41 1.41L11 5.08V14h2V5.08ZM5 10H3v9c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-9h-2v9H5v-9Z"/></svg>`;
  }

  return el;

  // ——— Styles injection (only once) ———
  function ensureShareStyles() {
    if (document.getElementById('mg-share-styles')) return;
    const css = `
      .mg-share{display:flex;align-items:center;gap:12px;margin:12px 0 0}
      .mg-share--inline{margin:0} /* inline v hero bez extra mezery */
      .mg-share__label{font-weight:600;font-size:14px;opacity:.9}
      .mg-share__btns{display:flex;flex-wrap:wrap;gap:8px}
      .mg-share__btn{appearance:none;border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;
        width:36px;height:36px;display:inline-grid;place-items:center;padding:0;line-height:0;text-decoration:none;
        transition:transform .15s ease,box-shadow .15s ease}
      .mg-share__btn:hover{box-shadow:0 2px 10px rgba(0,0,0,.08);transform:translateY(-1px)}
      .mg-share__btn:active{transform:translateY(0)}
      .mg-share__btn--system{border-style:dashed}
      .mg-share svg{width:auto;height:auto}
      .mg-share__icon{width:20px;height:20px;display:block}
      .mg-share__toast{position:fixed;inset:auto 16px 16px auto;background:#111;color:#fff;
        padding:8px 10px;border-radius:10px;font-size:12px;opacity:0;transform:translateY(6px);
        transition:opacity .18s ease,transform .18s ease;z-index:2147483647}
      .mg-share__toast.is-visible{opacity:1;transform:translateY(0)}
      @media (prefers-color-scheme:dark){
        .mg-share__btn{background:#121212;border-color:rgba(255,255,255,.14)}
        .mg-share__label{opacity:.92}
      }
    `;
    const s = document.createElement('style');
    s.id = 'mg-share-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
}
