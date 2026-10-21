import './identity-init.js';
import { initNav } from './nav-core.js';

// Shared navigation and consent also work on direct, localized detail visits.
initNav({ lang: document.documentElement.lang || 'cs' });
document.querySelectorAll('.main-nav a[aria-current]').forEach(link => link.removeAttribute('aria-current'));
document.querySelector('.main-nav a[data-i18n-key="nav-events"]')?.setAttribute('aria-current', 'page');

// Keep keyboard focus inside an open drawer and return it to its opener.
const opener = document.querySelector('.hamburger-btn');
const navigation = document.querySelector('.main-nav');
if (opener && navigation) {
  opener.setAttribute('aria-controls', navigation.id);
  opener.setAttribute('aria-expanded', 'false');
  let wasOpen = false;
  new MutationObserver(() => {
    const open = navigation.classList.contains('open');
    opener.setAttribute('aria-expanded', String(open));
    if (open && !wasOpen) navigation.querySelector('.menu-close')?.focus();
    if (!open && wasOpen) opener.focus();
    wasOpen = open;
  }).observe(navigation, { attributes: true, attributeFilter: ['class'] });
  navigation.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !navigation.classList.contains('open')) return;
    const items = [...navigation.querySelectorAll('button,a[href]')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}

// Let the review surface show the entire document at each actual CSS viewport.
if (window.parent !== window) {
  const reportHeight = () => window.parent.postMessage({
    type: 'ajsee-event-preview-size', height: Math.ceil(document.querySelector('.site-footer').getBoundingClientRect().bottom + window.scrollY) + 2
  }, window.location.origin);
  new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener('load', reportHeight, { once: true });
  reportHeight();
}
