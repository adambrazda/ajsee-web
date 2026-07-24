const LABELS = {
  cs: {
    open: 'Otev\u0159\u00edt obr\u00e1zek ve v\u011bt\u0161\u00edm n\u00e1hledu',
    close: 'Zav\u0159\u00edt n\u00e1hled obr\u00e1zku'
  },
  en: {
    open: 'Open image in a larger view',
    close: 'Close image preview'
  },
  de: {
    open: 'Bild in einer gr\u00f6\u00dferen Ansicht \u00f6ffnen',
    close: 'Bildvorschau schlie\u00dfen'
  },
  sk: {
    open: 'Otvori\u0165 obr\u00e1zok vo v\u00e4\u010d\u0161om n\u00e1h\u013eade',
    close: 'Zavrie\u0165 n\u00e1h\u013ead obr\u00e1zka'
  },
  pl: {
    open: 'Otw\u00f3rz obraz w wi\u0119kszym podgl\u0105dzie',
    close: 'Zamknij podgl\u0105d obrazu'
  },
  hu: {
    open: 'K\u00e9p megnyit\u00e1sa nagyobb n\u00e9zetben',
    close: 'K\u00e9pel\u0151n\u00e9zet bez\u00e1r\u00e1sa'
  }
};

let dialog = null;
let dialogImage = null;
let closeButton = null;
let previousFocus = null;

function getLabels() {
  const language = (
    document.documentElement.lang ||
    'en'
  )
    .toLowerCase()
    .split('-')[0];

  return LABELS[language] || LABELS.en;
}

function closeLightbox() {
  if (
    dialog &&
    dialog.open
  ) {
    dialog.close();
  }
}

function ensureLightbox() {
  if (dialog) {
    return;
  }

  const labels =
    getLabels();

  dialog =
    document.createElement('dialog');

  dialog.className =
    'article-image-lightbox';

  dialog.setAttribute(
    'aria-label',
    labels.close
  );

  closeButton =
    document.createElement('button');

  closeButton.type =
    'button';

  closeButton.className =
    'article-image-lightbox__close';

  closeButton.setAttribute(
    'aria-label',
    labels.close
  );

  const closeIcon =
    document.createElement('span');

  closeIcon.setAttribute(
    'aria-hidden',
    'true'
  );

  closeIcon.textContent =
    '\u00d7';

  closeButton.append(closeIcon);

  const frame =
    document.createElement('div');

  frame.className =
    'article-image-lightbox__frame';

  dialogImage =
    document.createElement('img');

  dialogImage.className =
    'article-image-lightbox__image';

  dialogImage.alt =
    '';

  frame.append(dialogImage);

  dialog.append(
    closeButton,
    frame
  );

  document.body.append(dialog);

  closeButton.addEventListener(
    'click',
    closeLightbox
  );

  dialogImage.addEventListener(
    'click',
    closeLightbox
  );

  frame.addEventListener(
    'click',
    (event) => {
      if (event.target === frame) {
        closeLightbox();
      }
    }
  );

  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) {
        closeLightbox();
      }
    }
  );

  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      closeLightbox();
    }
  );

  dialog.addEventListener(
    'close',
    () => {
      document.body.classList.remove(
        'article-image-lightbox-open'
      );

      dialogImage.removeAttribute(
        'src'
      );

      dialogImage.alt =
        '';

      if (
        previousFocus instanceof HTMLElement
      ) {
        previousFocus.focus();
      }

      previousFocus =
        null;
    }
  );
}

function openLightbox(image) {
  ensureLightbox();

  previousFocus =
    image;

  dialogImage.src =
    image.currentSrc ||
    image.src;

  dialogImage.alt =
    image.alt || '';

  document.body.classList.add(
    'article-image-lightbox-open'
  );

  dialog.showModal();
  closeButton.focus();
}

function prepareImage(image) {
  if (
    image.dataset.articleLightbox === 'true' ||
    image.closest('.article-image-lightbox')
  ) {
    return;
  }

  const labels =
    getLabels();

  image.dataset.articleLightbox =
    'true';

  if (
    !image.hasAttribute('tabindex')
  ) {
    image.tabIndex =
      0;
  }

  image.setAttribute(
    'role',
    'button'
  );

  image.setAttribute(
    'aria-haspopup',
    'dialog'
  );

  const accessibleLabel =
    image.alt
      ? labels.open + ': ' + image.alt
      : labels.open;

  image.setAttribute(
    'aria-label',
    accessibleLabel
  );
}

function prepareArticleImages(article) {
  article
    .querySelectorAll('img')
    .forEach(prepareImage);
}

document.addEventListener(
  'click',
  (event) => {
    if (
      !(event.target instanceof Element)
    ) {
      return;
    }

    const image =
      event.target.closest(
        '#blogArticle img[data-article-lightbox="true"]'
      );

    if (
      !(image instanceof HTMLImageElement)
    ) {
      return;
    }

    event.preventDefault();
    openLightbox(image);
  }
);

document.addEventListener(
  'keydown',
  (event) => {
    if (
      !(event.target instanceof Element)
    ) {
      return;
    }

    const image =
      event.target.closest(
        '#blogArticle img[data-article-lightbox="true"]'
      );

    if (
      !(image instanceof HTMLImageElement) ||
      (
        event.key !== 'Enter' &&
        event.key !== ' '
      )
    ) {
      return;
    }

    event.preventDefault();
    openLightbox(image);
  }
);

function initialize() {
  const article =
    document.querySelector(
      '#blogArticle'
    );

  if (!article) {
    return;
  }

  prepareArticleImages(article);

  const observer =
    new MutationObserver(
      () => {
        prepareArticleImages(article);
      }
    );

  observer.observe(
    article,
    {
      childList: true,
      subtree: true
    }
  );
}

if (
  document.readyState === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    initialize
  );
} else {
  initialize();
}
