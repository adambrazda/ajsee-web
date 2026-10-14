import { HOME_HERO_PHOTOS, selectHomeHeroPhoto, homeHeroPhotoText } from './home-hero-photos.js';

const LAST_PHOTO_KEY = 'ajsee.home.hero.last.v1';

export function initHomeHeroPhoto(doc = document, options = {}) {
  const figure = doc.querySelector('[data-home-hero-photo]');
  if (!figure || figure.dataset.photoInitialized === 'true') return;
  figure.dataset.photoInitialized = 'true';
  const image = figure.querySelector('img');
  const source = figure.querySelector('source');
  const caption = figure.querySelector('[data-home-hero-caption]');
  const credit = figure.querySelector('[data-home-hero-credit]');
  const win = doc.defaultView;
  let storage;
  let previousId;
  try {
    storage = options.storage ?? win.sessionStorage;
    previousId = storage.getItem(LAST_PHOTO_KEY);
  } catch { /* Random selection also works when storage is unavailable. */ }

  const preview = /^(deploy-preview-\d+--ajsee-demo\.netlify\.app|localhost|127\.0\.0\.1)$/.test(win.location.hostname);
  let activePhoto;
  let usedOriginalFallback = false;

  function updateLabels() {
    const text = homeHeroPhotoText(activePhoto, doc.documentElement.lang);
    image.alt = text.alt;
    caption.textContent = text.caption;
    const link = doc.createElement('a');
    link.href = activePhoto.source;
    link.textContent = text.credit;
    if (activePhoto.source.startsWith('https://')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    credit.replaceChildren(link);
  }

  function showPhoto(photo, originalFallback = false) {
    activePhoto = photo;
    figure.dataset.photoId = photo.id;
    figure.classList.remove('is-photo-ready');
    updateLabels();
    try { storage?.setItem(LAST_PHOTO_KEY, photo.id); } catch { /* Nonessential preference. */ }
    // The transparent img is the mobile fallback. Only this one selected
    // source is fetched on screens where the approved hero includes a photo.
    source.srcset = originalFallback
      ? '/uploads/reviews/jesus-christ-superstar-london-2026/jesus-christ-superstar-standing-ovation-oya-canli.jpg'
      : `/images/home-hero/${photo.id}-640.webp 640w, /images/home-hero/${photo.id}-1200.webp 1200w`;
    if (preview && win.parent !== win) {
      win.parent.postMessage({ type: 'ajsee-home-hero-ready', index: HOME_HERO_PHOTOS.indexOf(photo) + 1, total: HOME_HERO_PHOTOS.length }, win.location.origin);
    }
  }

  image.addEventListener('load', () => {
    if (image.currentSrc && !image.currentSrc.startsWith('data:')) figure.classList.add('is-photo-ready');
  });
  image.addEventListener('error', () => {
    if (usedOriginalFallback) return;
    usedOriginalFallback = true;
    showPhoto(HOME_HERO_PHOTOS[0], true);
  });
  new win.MutationObserver(updateLabels).observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });

  if (preview) {
    win.addEventListener('message', event => {
      if (event.origin !== win.location.origin || event.source !== win.parent || event.data?.type !== 'ajsee-home-hero-next') return;
      const index = HOME_HERO_PHOTOS.indexOf(activePhoto);
      showPhoto(HOME_HERO_PHOTOS[(index + 1) % HOME_HERO_PHOTOS.length]);
    });
  }

  showPhoto(selectHomeHeroPhoto(HOME_HERO_PHOTOS, previousId, options.random));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initHomeHeroPhoto(), { once: true });
  else initHomeHeroPhoto();
}
