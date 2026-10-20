import './identity-init.js';
import { initNav } from './nav-core.js';

// The pilot has real Czech copy only. Do not advertise untranslated routes.
initNav({ lang: 'cs' });
document.querySelectorAll('.main-nav a[aria-current]').forEach(link => link.removeAttribute('aria-current'));
document.querySelector('.main-nav a[data-i18n-key="nav-events"]')?.setAttribute('aria-current', 'page');

// Let the review surface show the entire document at each actual CSS viewport.
if (window.parent !== window) {
  const reportHeight = () => window.parent.postMessage({
    type: 'ajsee-event-preview-size', height: Math.ceil(document.querySelector('.site-footer').getBoundingClientRect().bottom + window.scrollY) + 2
  }, window.location.origin);
  new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener('load', reportHeight, { once: true });
  reportHeight();
}
