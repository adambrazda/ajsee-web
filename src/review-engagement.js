// src/review-engagement.js

const SUPPORTED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const TEXT = {
  cs: {
    heading: 'Sdílet recenzi',
    description: 'Pošlete ji někomu, koho by mohla zaujmout.',
    share: 'Sdílet',
    copy: 'Kopírovat odkaz',
    copied: 'Odkaz byl zkopírován.',
    copyFailed: 'Odkaz se nepodařilo zkopírovat.',
    manualCopy: 'Zkopírujte odkaz ručně:',
    shareFailed: 'Sdílení se nepodařilo otevřít.'
  },
  en: {
    heading: 'Share this review',
    description: 'Send it to someone who might enjoy it.',
    share: 'Share',
    copy: 'Copy link',
    copied: 'Link copied.',
    copyFailed: 'The link could not be copied.',
    manualCopy: 'Copy the link manually:',
    shareFailed: 'The sharing menu could not be opened.'
  },
  de: {
    heading: 'Rezension teilen',
    description: 'Senden Sie sie an jemanden, den sie interessieren könnte.',
    share: 'Teilen',
    copy: 'Link kopieren',
    copied: 'Link kopiert.',
    copyFailed: 'Der Link konnte nicht kopiert werden.',
    manualCopy: 'Link manuell kopieren:',
    shareFailed: 'Das Teilen-Menü konnte nicht geöffnet werden.'
  },
  sk: {
    heading: 'Zdieľať recenziu',
    description: 'Pošlite ju niekomu, koho by mohla zaujať.',
    share: 'Zdieľať',
    copy: 'Kopírovať odkaz',
    copied: 'Odkaz bol skopírovaný.',
    copyFailed: 'Odkaz sa nepodarilo skopírovať.',
    manualCopy: 'Skopírujte odkaz ručne:',
    shareFailed: 'Ponuku zdieľania sa nepodarilo otvoriť.'
  },
  pl: {
    heading: 'Udostępnij recenzję',
    description: 'Wyślij ją komuś, kogo może zainteresować.',
    share: 'Udostępnij',
    copy: 'Kopiuj link',
    copied: 'Link został skopiowany.',
    copyFailed: 'Nie udało się skopiować linku.',
    manualCopy: 'Skopiuj link ręcznie:',
    shareFailed: 'Nie udało się otworzyć menu udostępniania.'
  },
  hu: {
    heading: 'Kritika megosztása',
    description: 'Küldje el valakinek, akit érdekelhet.',
    share: 'Megosztás',
    copy: 'Link másolása',
    copied: 'A link másolva.',
    copyFailed: 'A link másolása nem sikerült.',
    manualCopy: 'Másolja ki kézzel a linket:',
    shareFailed: 'A megosztási menü nem nyitható meg.'
  }
};

function normalizeLang(value = '') {
  const lang = String(value)
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return SUPPORTED_LANGS.includes(lang)
    ? lang
    : 'cs';
}

function getCanonicalShareUrl() {
  const canonical = document.querySelector(
    'link[rel="canonical"]'
  )?.href;

  if (canonical) {
    return canonical;
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';

  return url.toString();
}

function getReviewTitle(article) {
  return (
    article.querySelector('h1')?.textContent?.trim() ||
    document.title ||
    'AJSEE Review'
  );
}

function shareIcon() {
  return [
    '<svg viewBox="0 0 24 24"',
    ' class="review-engagement__icon"',
    ' aria-hidden="true">',
    '<path d="M18 16a3 3 0 0 0-2.39 1.19L8.91 13.7',
    'a3.1 3.1 0 0 0 0-3.4l6.7-3.49A3 3 0 1 0',
    '14.9 4.9L8.2 8.39a3 3 0 1 0 0 7.22',
    'l6.7 3.49A3 3 0 1 0 18 16Z"/>',
    '</svg>'
  ].join('');
}

function copyIcon() {
  return [
    '<svg viewBox="0 0 24 24"',
    ' class="review-engagement__icon"',
    ' aria-hidden="true">',
    '<path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Z"/>',
    '<path d="M19 5H8a2 2 0 0 0-2 2v14',
    'a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7',
    'a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/>',
    '</svg>'
  ].join('');
}

function trackShare({
  method,
  slug,
  language,
  result = 'success'
}) {
  const payload = {
    event: 'review_share_click',
    share_method: method,
    review_slug: slug,
    language,
    result,
    page_path:
      window.location.pathname +
      window.location.search,
    page_location: window.location.href,
    ts: new Date().toISOString()
  };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch {
    // Analytics must never block sharing.
  }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag(
        'event',
        'review_share_click',
        {
          share_method: method,
          review_slug: slug,
          language,
          result,
          page_path: payload.page_path
        }
      );
    }
  } catch {
    // Analytics must never block sharing.
  }
}

async function copyText(text) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }

  if (!copied) {
    throw new Error('Legacy clipboard copy failed.');
  }

  return true;
}

function createButton({
  className,
  label,
  icon
}) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.innerHTML =
    icon +
    '<span>' +
    label +
    '</span>';

  return button;
}

export function initReviewEngagement() {
  const article = document.querySelector(
    '.review-detail[data-review-slug]'
  );

  if (!article) {
    return null;
  }

  if (article.dataset.reviewEngagementReady === 'true') {
    return article.querySelector(
      '.review-engagement'
    );
  }

  const slug = String(
    article.dataset.reviewSlug || ''
  ).trim();

  if (!slug) {
    return null;
  }

  const language = normalizeLang(
    document.documentElement.lang ||
    window.AJSEE_LANG ||
    'cs'
  );

  const text = TEXT[language] || TEXT.cs;
  const shareUrl = getCanonicalShareUrl();
  const title = getReviewTitle(article);

  const panel = document.createElement('section');
  panel.className = 'review-engagement';
  panel.setAttribute(
    'aria-labelledby',
    'reviewEngagementTitle'
  );

  const content = document.createElement('div');
  content.className = 'review-engagement__content';

  const heading = document.createElement('h2');
  heading.id = 'reviewEngagementTitle';
  heading.className = 'review-engagement__title';
  heading.textContent = text.heading;

  const description = document.createElement('p');
  description.className =
    'review-engagement__description';
  description.textContent = text.description;

  content.append(heading, description);

  const actions = document.createElement('div');
  actions.className = 'review-engagement__actions';

  const status = document.createElement('p');
  status.className = 'review-engagement__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  let statusTimer = null;

  function showStatus(message, isError = false) {
    window.clearTimeout(statusTimer);

    status.textContent = message;
    status.classList.toggle(
      'is-error',
      Boolean(isError)
    );
    status.classList.add('is-visible');

    statusTimer = window.setTimeout(() => {
      status.classList.remove('is-visible');
    }, 3200);
  }

  if (typeof navigator.share === 'function') {
    const shareButton = createButton({
      className:
        'review-engagement__button ' +
        'review-engagement__button--share',
      label: text.share,
      icon: shareIcon()
    });

    shareButton.addEventListener(
      'click',
      async () => {
        shareButton.disabled = true;
        shareButton.setAttribute('aria-busy', 'true');

        try {
          await navigator.share({
            title,
            text: title,
            url: shareUrl
          });

          trackShare({
            method: 'system',
            slug,
            language
          });
        } catch (error) {
          if (error?.name !== 'AbortError') {
            showStatus(text.shareFailed, true);

            trackShare({
              method: 'system',
              slug,
              language,
              result: 'error'
            });
          }
        } finally {
          shareButton.disabled = false;
          shareButton.removeAttribute('aria-busy');
        }
      }
    );

    actions.appendChild(shareButton);
  }

  const copyButton = createButton({
    className:
      'review-engagement__button ' +
      'review-engagement__button--copy',
    label: text.copy,
    icon: copyIcon()
  });

  copyButton.addEventListener(
    'click',
    async () => {
      copyButton.disabled = true;
      copyButton.setAttribute('aria-busy', 'true');

      try {
        await copyText(shareUrl);
        showStatus(text.copied);

        trackShare({
          method: 'copy',
          slug,
          language
        });
      } catch {
        showStatus(text.copyFailed, true);

        window.prompt(
          text.manualCopy,
          shareUrl
        );

        trackShare({
          method: 'copy_manual',
          slug,
          language,
          result: 'fallback'
        });
      } finally {
        copyButton.disabled = false;
        copyButton.removeAttribute('aria-busy');
      }
    }
  );

  actions.appendChild(copyButton);

  panel.append(content, actions, status);

  const ticketCta = article.querySelector(
    '.review-cta'
  );

  if (
    ticketCta &&
    ticketCta.parentElement === article
  ) {
    article.insertBefore(panel, ticketCta);
  } else {
    article.appendChild(panel);
  }

  article.dataset.reviewEngagementReady = 'true';

  return panel;
}

